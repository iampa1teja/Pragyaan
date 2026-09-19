// js/divergence.js
import * as api from './api.js';

let chatHistory = [];

export function initDivergence({ getStoryId, showToast }) {
  const eventSelect = document.getElementById('div-event-select');
  const changeInput = document.getElementById('div-change-input');
  const generateBtn = document.getElementById('div-generate-btn');
  const msgsContainer = document.getElementById('div-messages');
  const followupInput = document.getElementById('div-followup-input');
  const followupBtn = document.getElementById('div-followup-send');
  
  function clearChat() {
    chatHistory = [];
    msgsContainer.innerHTML = '';
  }
  
  let lastEvent = null;
  let lastChange = null;
  
  window.__div_on_enter = async (storyId) => {
    try {
      const timeline = await api.getTimeline(storyId);
      eventSelect.innerHTML = `<option value="">Select an Event...</option>` + timeline.events.map(e => 
        `<option value="${e.title}">${e.title}</option>`
      ).join('');
    } catch(err) {
      showToast('Failed to load events', 'error');
    }
  };

  function renderMessage(role, text) {
    const div = document.createElement('div');
    div.className = `msg-bubble ${role === 'user' ? 'msg-user' : 'msg-ai'} flex flex-col gap-1 max-w-[85%] whitespace-pre-wrap`;
    div.innerHTML = `<span class="opacity-50 text-[9px] uppercase tracking-wider">${role}</span><span>${text}</span>`;
    msgsContainer.appendChild(div);
    
    if (role === 'ai') {
      const actions = document.createElement('div');
      actions.className = 'flex gap-2 mt-2';
      actions.innerHTML = `
        <button class="brutal-btn-sm bg-[#FFD23F] text-[#111] font-mono text-[9px] px-2 py-1 uppercase explore-further-btn">Explore Further →</button>
        <button class="brutal-btn-sm bg-[var(--nb-surface)] text-[var(--nb-text)] font-mono text-[9px] px-2 py-1 uppercase">Compare with Original</button>
        <button class="brutal-btn-sm bg-[var(--nb-surface)] text-[var(--nb-text)] font-mono text-[9px] px-2 py-1 uppercase">Save as Alt. Timeline</button>
      `;
      actions.querySelector('.explore-further-btn').addEventListener('click', () => {
        followupInput.value = "Explore further on the consequences.";
        followupInput.focus();
      });
      msgsContainer.appendChild(actions);
    }
    
    msgsContainer.scrollTop = msgsContainer.scrollHeight;
  }
  
  async function simulate(isFollowup = false) {
    const storyId = getStoryId();
    const event = eventSelect.value;
    const change = changeInput.value.trim();

    if (!isFollowup) {
      if (event !== lastEvent || change !== lastChange) {
        clearChat();
        lastEvent = event;
        lastChange = change;
      }
    }
    
    if (!event || !change) {
      showToast('Select an event and describe the change.', 'error');
      return;
    }
    
    let message = '';
    if (isFollowup) {
      message = followupInput.value.trim();
      if (!message) return;
      followupInput.value = '';
      renderMessage('user', message);
    } else {
      renderMessage('user', `Simulate divergence:\nEvent: ${event}\nChange: ${change}`);
    }
    
    const thinking = document.createElement('div');
    thinking.className = 'msg-bubble msg-ai flex gap-1 items-center max-w-[85%] text-xs';
    thinking.innerHTML = `<div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div> Thinking...`;
    msgsContainer.appendChild(thinking);
    msgsContainer.scrollTop = msgsContainer.scrollHeight;
    
    generateBtn.disabled = true;
    followupBtn.disabled = true;
    
    try {
      const res = await api.sendDivergence(storyId, {
        event,
        change,
        message,
        history: chatHistory
      });
      
      thinking.remove();
      renderMessage('ai', res.reply);
      
      chatHistory.push({ role: 'user', content: message });
      chatHistory.push({ role: 'assistant', content: res.reply });
      
    } catch (err) {
      thinking.remove();
      showToast(err.message || 'Divergence failed', 'error');
    }
    
    generateBtn.disabled = false;
    followupBtn.disabled = false;
  }

  generateBtn.addEventListener('click', () => simulate(false));
  followupBtn.addEventListener('click', () => simulate(true));
  followupInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') simulate(true);
  });
}

export async function onEnterDivergence(storyId) {
  if (window.__div_on_enter) {
    await window.__div_on_enter(storyId);
  }
}
