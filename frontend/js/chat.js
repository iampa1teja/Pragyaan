// js/chat.js — Send/render messages, Sources chips, AI-mode prefixing,
//               story-point prefixing, thinking indicator

import { sendChat, ApiError } from './api.js';

let storyId = null;
let isSending = false;
let activeMode = 'chat';   // chat | interview | perspective | divergence | visual
let showToast = () => {};

const MODE_PREFIXES = {
  chat: '',
  interview: '[Interview] ',
  perspective: '[Perspective] ',
  divergence: '[What if] ',
  visual: '[Visual] ',
};

const MODE_PLACEHOLDERS = {
  chat: 'Ask about the story, characters, plot, or anything else…',
  interview: 'Ask a character a question — they\'ll answer in their voice…',
  perspective: 'Describe a scene to retell from another character\'s POV…',
  divergence: 'What if something had happened differently? Explore…',
  visual: 'Describe a scene or character to visualize…',
};

/**
 * @param {string} id - story ID
 * @param {(msg: string, type: string) => void} toastFn
 */
export function initChat(id, toastFn) {
  storyId = id;
  showToast = toastFn;

  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const chatMessages = document.getElementById('chat-messages');

  // Clear previous messages
  chatMessages.innerHTML = '';
  addWelcomeMessage();

  // Remove old listeners by cloning
  const newSend = sendBtn.cloneNode(true);
  sendBtn.parentNode.replaceChild(newSend, sendBtn);
  newSend.addEventListener('click', () => trySend());

  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);
  newInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      trySend();
    }
  });

  // Quick action chips
  document.querySelectorAll('.quick-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.getElementById('chat-input').value = chip.dataset.prompt;
      document.getElementById('chat-input').focus();
    });
  });
}

function addWelcomeMessage() {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'flex justify-center mb-4';
  div.innerHTML = `
    <div class="bg-[var(--nb-surface)] border-[3px] border-[var(--nb-border)] shadow-[4px_4px_0_0_var(--nb-shadow)] px-6 py-3 text-center transform -rotate-1">
      <p class="font-display text-sm uppercase tracking-wider">YOUR STORY IS READY</p>
      <p class="font-mono text-[10px] mt-1 opacity-60">ASK ANYTHING — I'LL EXPLORE IT WITH YOU</p>
    </div>
  `;
  container.appendChild(div);
}

/**
 * Set the active AI mode. Called from app.js when user selects a mode.
 */
export function setMode(mode) {
  activeMode = mode;
  const input = document.getElementById('chat-input');
  if (input) {
    input.placeholder = MODE_PLACEHOLDERS[mode] || MODE_PLACEHOLDERS.chat;
  }

  // Update mode indicator
  const indicator = document.getElementById('mode-indicator');
  if (indicator) {
    if (mode === 'chat') {
      indicator.classList.add('hidden');
    } else {
      indicator.classList.remove('hidden');
      indicator.textContent = MODE_PREFIXES[mode].replace(/[\[\]]/g, '').trim().toUpperCase() + ' MODE';
    }
  }
}

function getStoryPointPrefix() {
  const sel = document.getElementById('story-point-select');
  if (sel && sel.value) {
    return `(at ${sel.value}) `;
  }
  return '';
}

async function trySend() {
  if (isSending) return;
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  input.value = '';

  // Build the full message with prefixes
  const storyPoint = getStoryPointPrefix();
  const modePrefix = MODE_PREFIXES[activeMode] || '';
  const fullMessage = modePrefix + storyPoint + msg;

  // Show user bubble with original text
  appendMessage('user', msg);
  showThinking(true);
  isSending = true;

  try {
    const { reply } = await sendChat(storyId, fullMessage);
    showThinking(false);
    appendMessage('assistant', reply);
  } catch (err) {
    showThinking(false);
    if (err instanceof ApiError) {
      if (err.status === 409) {
        showToast('Story is not ready yet (409). Please wait.', 'error');
      } else if (err.status === 404) {
        showToast('Story not found (404).', 'error');
      } else {
        showToast(`Chat error (${err.status}): ${err.message}`, 'error');
      }
    } else {
      showToast(err.message || 'Chat request failed.', 'error');
    }
  } finally {
    isSending = false;
  }
}

function appendMessage(role, text) {
  const container = document.getElementById('chat-messages');
  const wrapper = document.createElement('div');
  wrapper.classList.add('flex', 'w-full', 'mb-4', 'msg-enter');
  wrapper.classList.add(role === 'user' ? 'justify-end' : 'justify-start');

  const bubble = document.createElement('div');
  bubble.classList.add('max-w-[85%]', 'sm:max-w-[75%]', 'px-4', 'py-3', 'border-[3px]', 'border-[var(--nb-border)]');

  if (role === 'user') {
    bubble.classList.add(
      'bg-[#FFD23F]', 'text-[#111]',
      'shadow-[4px_4px_0_0_var(--nb-shadow)]', 'font-medium'
    );
  } else {
    bubble.classList.add(
      'bg-[var(--nb-surface)]', 'text-[var(--nb-text)]',
      'shadow-[6px_6px_0_0_var(--nb-shadow)]'
    );
  }

  // Render text
  bubble.innerHTML = formatMessage(text);

  // If assistant, maybe add source chips (parse from reply)
  if (role === 'assistant') {
    const sources = extractSources(text);
    if (sources.length > 0) {
      const sourcesRow = document.createElement('div');
      sourcesRow.className = 'flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-[var(--nb-border)] border-opacity-20';
      sourcesRow.innerHTML = `<span class="font-mono text-[10px] uppercase tracking-wider opacity-50 mr-1 self-center">Sources:</span>`;
      sources.forEach(src => {
        const chip = document.createElement('span');
        chip.className = 'font-mono text-[10px] px-2 py-0.5 border-[2px] border-[var(--nb-border)] bg-[var(--nb-bg)] text-[var(--nb-text)] uppercase tracking-wider';
        chip.textContent = src;
        sourcesRow.appendChild(chip);
      });
      bubble.appendChild(sourcesRow);
    }
  }

  // Timestamp
  const ts = document.createElement('span');
  ts.classList.add('block', 'text-[10px]', 'mt-2', 'opacity-50', 'font-mono', 'tracking-wide');
  ts.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  bubble.appendChild(ts);

  wrapper.appendChild(bubble);
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
}

/**
 * Try to extract sources from the reply text.
 * Looks for patterns like [Source: Chapter 38] or (Source: ...) in the reply.
 */
function extractSources(text) {
  const sources = [];
  const regex = /\[(?:Source|Ref|Chapter):\s*([^\]]+)\]/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    sources.push(match[1].trim());
  }
  return sources;
}

function formatMessage(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="font-mono bg-[var(--nb-bg)] px-1 py-0.5 text-xs border border-[var(--nb-border)]">$1</code>')
    .replace(/\n/g, '<br>');
}

function showThinking(on) {
  const el = document.getElementById('thinking-indicator');
  if (on) {
    el.classList.remove('hidden');
    el.classList.add('flex');
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
  } else {
    el.classList.add('hidden');
    el.classList.remove('flex');
  }
}
