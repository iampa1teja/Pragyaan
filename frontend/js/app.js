// js/app.js
import { init as initTheme } from './theme.js';
import { init as initLayout } from './layout.js';
import { Router } from './router.js';
import * as api from './api.js';

import { initHome, setStoryLoaded as homeSetStoryLoaded, resetUploadState } from './home.js';
import { initCharacters, onEnterCharacters } from './characters.js';
import { initTimeline, onEnterTimeline } from './timeline.js';
import { initPerspective, onEnterPerspective } from './perspective.js';
import { initDivergence, onEnterDivergence } from './divergence.js';
import { initStudio, onEnterStudio } from './studio.js';
import { initData, onEnterData } from './data.js';

const STORAGE_KEY_STORY = 'nb-story-id';
let currentStoryId = null;
let pollTimer = null;

export function clearPollTimer() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

// Toast System
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast-enter flex items-start gap-3 px-4 py-3 border-[3px] border-[var(--nb-border)] shadow-[6px_6px_0_0_var(--nb-shadow)] font-bold uppercase tracking-wide text-xs max-w-sm pointer-events-auto';
  
  if (type === 'error') {
    toast.classList.add('bg-[#FF5C5C]', 'text-[#111]');
  } else {
    toast.classList.add('bg-[var(--ac-yellow)]', 'text-[#111]');
  }

  toast.innerHTML = `
    <span class="flex-1">${message}</span>
    <button class="font-black text-base leading-none hover:opacity-70 cursor-pointer" aria-label="Close">✕</button>
  `;
  toast.querySelector('button').addEventListener('click', () => toast.remove());
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 6000);
}

function updateGlobalStoryState(storyId) {
  currentStoryId = storyId;
  if (storyId) {
    localStorage.setItem(STORAGE_KEY_STORY, storyId);
  } else {
    localStorage.removeItem(STORAGE_KEY_STORY);
  }
}

// Global Poll logic for Home
async function pollStatus(storyId) {
  let attempts = 0;
  const maxAttempts = 90;
  let consecErrors = 0;

  function updatePill(status) {
    const pill = document.getElementById('status-pill');
    if (!pill) return;
    const labels = { ingesting: 'INGESTING', ingested: 'INGESTED', ready: 'READY', failed: 'FAILED' };
    pill.textContent = labels[status] || status.toUpperCase();
    pill.style.backgroundColor = { ingesting: 'var(--ac-yellow)', ingested: 'var(--ac-blue)', ready: 'var(--ac-green)', failed: '#FF5C5C' }[status] || 'var(--ac-yellow)';
  }

  const check = async () => {
    try {
      attempts++;
      const data = await api.getStoryStatus(storyId);
      consecErrors = 0;
      updatePill(data.status);

      if (data.status === 'ready') {
        updateGlobalStoryState(storyId);
        homeSetStoryLoaded(storyId, showToast);
        return;
      } else if (data.status === 'failed') {
        showToast('Story processing failed.', 'error');
        document.getElementById('poll-error-msg').textContent = 'Processing failed.';
        document.getElementById('poll-error-msg').classList.remove('hidden');
        document.getElementById('poll-retry-btn').classList.remove('hidden');
        return;
      }
    } catch (err) {
      consecErrors++;
      if (consecErrors >= 5) {
        showToast('Lost connection to server.', 'error');
        document.getElementById('poll-error-msg').textContent = 'Connection lost.';
        document.getElementById('poll-error-msg').classList.remove('hidden');
        document.getElementById('poll-retry-btn').classList.remove('hidden');
        return;
      }
    }

    if (attempts >= maxAttempts) {
      showToast('Polling timed out.', 'error');
      document.getElementById('poll-error-msg').textContent = 'Timed out.';
      document.getElementById('poll-error-msg').classList.remove('hidden');
      document.getElementById('poll-retry-btn').classList.remove('hidden');
      return;
    }

    pollTimer = setTimeout(check, 2000);
  };
  check();
}

async function onUploadFiles(files) {
  try {
    const data = await api.uploadStory(files);
    // Switch Home to building state
    document.getElementById('home-upload-state').classList.add('hidden');
    document.getElementById('home-building-state').classList.remove('hidden');
    pollStatus(data.id);
  } catch (err) {
    showToast(err.message || 'Upload failed', 'error');
  }
}

async function checkExistingStory() {
  const savedId = localStorage.getItem(STORAGE_KEY_STORY);
  if (savedId) {
    try {
      const data = await api.getStoryStatus(savedId);
      if (data.status === 'ready') {
        updateGlobalStoryState(savedId);
        homeSetStoryLoaded(savedId, showToast);
      } else if (data.status === 'ingesting' || data.status === 'ingested') {
        document.getElementById('home-upload-state').classList.add('hidden');
        document.getElementById('home-building-state').classList.remove('hidden');
        pollStatus(savedId);
      } else {
        localStorage.removeItem(STORAGE_KEY_STORY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY_STORY);
    }
  }
}

function renderMessage(container, role, text) {
  const div = document.createElement('div');
  div.className = `msg-bubble ${role === 'user' ? 'msg-user' : 'msg-ai'} flex flex-col gap-1 max-w-[85%]`;
  div.innerHTML = `<span class="opacity-50 text-[9px] uppercase tracking-wider">${role}</span><span>${text}</span>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

export function createChatInterface(opts) {
  // Common chat interface logic for modules
  const { input, sendBtn, container, onSend } = opts;
  
  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text || !currentStoryId) return;
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    
    renderMessage(container, 'user', text);
    
    // thinking indicator
    const thinking = document.createElement('div');
    thinking.className = 'msg-bubble msg-ai flex gap-1 items-center max-w-[85%] text-xs';
    thinking.innerHTML = `<div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div> Thinking...`;
    container.appendChild(thinking);
    container.scrollTop = container.scrollHeight;

    try {
      const reply = await onSend(currentStoryId, text);
      thinking.remove();
      renderMessage(container, 'ai', reply);
    } catch (err) {
      thinking.remove();
      if (err.status === 409) showToast('Story not ready yet', 'error');
      else if (err.status === 404) showToast('Story not found', 'error');
      else showToast(err.message || 'Failed to send message', 'error');
    }
    
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  };
  
  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

const routes = {
  '/home': { id: 'page-home' },
  '/characters': { id: 'page-characters' },
  '/timeline': { id: 'page-timeline' },
  '/perspective': { id: 'page-perspective' },
  '/divergence': { id: 'page-divergence' },
  '/studio': { id: 'page-studio' },
  '/data': { id: 'page-data' }
};

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initLayout();
  
  // Provide callbacks to modules
  initHome({ onUploadFiles, getStoryId: () => currentStoryId, renderMessage, updateGlobalStoryState });
  initCharacters({ getStoryId: () => currentStoryId, createChatInterface, showToast });
  initTimeline({ getStoryId: () => currentStoryId, showToast });
  initPerspective({ getStoryId: () => currentStoryId, createChatInterface, showToast });
  initDivergence({ getStoryId: () => currentStoryId, createChatInterface, showToast });
  initStudio({ getStoryId: () => currentStoryId, showToast });

  function selectStory(id) {
    updateGlobalStoryState(id);
    homeSetStoryLoaded(id, showToast);
    window.location.hash = '#/home';
  }
  function newStory() {
    updateGlobalStoryState(null);
    clearPollTimer();
    document.getElementById('home-upload-state').classList.remove('hidden');
    document.getElementById('home-building-state').classList.add('hidden');
    document.getElementById('home-dashboard-state').classList.add('hidden');
    resetUploadState();
    window.location.hash = '#/home';
  }
  initData({ getStoryId: () => currentStoryId, onSelectStory: selectStory, onNewStory: newStory, showToast });

  // Save Story + View Data (Home Quick Actions)
  document.getElementById('save-story-btn')?.addEventListener('click', async () => {
    if (!currentStoryId) return;
    try { await api.saveStory(currentStoryId); showToast('Story saved', 'info'); }
    catch (err) { showToast(err.message || 'Save failed', 'error'); }
  });
  document.getElementById('view-data-btn')?.addEventListener('click', () => {
    window.location.hash = '#/data';
  });

  const router = new Router(routes, async (path) => {
    // Data page (story library) is always accessible; other tool pages need a story
    if (path !== '/home' && path !== '/data' && !currentStoryId) {
      return false;
    }

    if (path === '/characters' && currentStoryId) await onEnterCharacters(currentStoryId);
    if (path === '/timeline' && currentStoryId) await onEnterTimeline(currentStoryId);
    if (path === '/perspective' && currentStoryId) await onEnterPerspective(currentStoryId);
    if (path === '/divergence' && currentStoryId) await onEnterDivergence(currentStoryId);
    if (path === '/studio' && currentStoryId) await onEnterStudio(currentStoryId);
    if (path === '/data') await onEnterData();

    return true;
  });
  
  await checkExistingStory();
  router.start();

  const retryBtn = document.getElementById('poll-retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      document.getElementById('poll-error-msg').classList.add('hidden');
      document.getElementById('poll-retry-btn').classList.add('hidden');
      document.getElementById('home-upload-state').classList.remove('hidden');
      document.getElementById('home-building-state').classList.add('hidden');
      resetUploadState();
    });
  }

  document.getElementById('upload-new-btn').addEventListener('click', () => {
    updateGlobalStoryState(null);
    clearPollTimer();
    document.getElementById('home-upload-state').classList.remove('hidden');
    document.getElementById('home-building-state').classList.add('hidden');
    document.getElementById('home-dashboard-state').classList.add('hidden');
    resetUploadState();
    router.navigate('#/home');
  });
});
