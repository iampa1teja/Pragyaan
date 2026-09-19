// js/home.js
import * as api from './api.js';

let selectedFiles = [];

export function resetUploadState() {
  selectedFiles = [];
  const fileList = document.getElementById('file-list');
  const fileInput = document.getElementById('file-input');
  const uploadBtn = document.getElementById('upload-btn');
  if (fileList) fileList.innerHTML = '';
  if (fileInput) fileInput.value = '';
  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }
}

export function initHome({ onUploadFiles, getStoryId, renderMessage, updateGlobalStoryState }) {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadBtn = document.getElementById('upload-btn');
  const fileList = document.getElementById('file-list');

  function updateFileList() {
    fileList.innerHTML = selectedFiles.map(f => 
      `<span class="bg-[var(--ac-yellow)] text-[#111] font-mono text-[10px] px-2 py-1 border-[2px] border-[var(--nb-border)] truncate max-w-[150px]">${f.name}</span>`
    ).join('');
    
    if (selectedFiles.length > 0) {
      uploadBtn.disabled = false;
      uploadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      uploadBtn.disabled = true;
      uploadBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
      selectedFiles = Array.from(e.dataTransfer.files);
      updateFileList();
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      selectedFiles = Array.from(fileInput.files);
      updateFileList();
    }
  });

  uploadBtn.addEventListener('click', () => {
    if (selectedFiles.length > 0) {
      onUploadFiles(selectedFiles);
    }
  });
  
  // Home Chat
  const chatInput = document.getElementById('home-chat-input');
  const chatSend = document.getElementById('home-chat-send');
  const chatMsgs = document.getElementById('home-chat-messages');
  
  chatSend.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    const storyId = getStoryId();
    if (!text || !storyId) return;
    
    chatInput.value = '';
    renderMessage(chatMsgs, 'user', text);
    
    try {
      const { reply } = await api.sendChat(storyId, text);
      renderMessage(chatMsgs, 'ai', reply);
    } catch (err) {
      renderMessage(chatMsgs, 'system', err.message || 'Failed to chat');
    }
  });
  
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') chatSend.click();
  });
  
  // Reset Context
  document.getElementById('reset-context-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear chat history? Files will remain.')) {
      try {
        await api.resetContext(getStoryId());
        chatMsgs.innerHTML = '';
        renderMessage(chatMsgs, 'system', 'Context reset successful.');
      } catch (err) {
        alert('Failed to reset: ' + err.message);
      }
    }
  });
}

export async function setStoryLoaded(storyId, showToast) {
  document.getElementById('home-upload-state').classList.add('hidden');
  document.getElementById('home-building-state').classList.add('hidden');
  document.getElementById('home-dashboard-state').classList.remove('hidden');
  
  try {
    const { files } = await api.getFiles(storyId);
    const ul = document.getElementById('dash-files-list');
    ul.innerHTML = files.map(f => `<li>${f}</li>`).join('');
    const recent = document.getElementById('recent-files-list');
    if (files.length > 0) {
      recent.innerHTML = files.map(f => `<li>${f}</li>`).join('');
    } else {
      recent.innerHTML = 'No files yet.';
    }
  } catch(e) {}

  try {
    const assets = await api.listAssets(storyId);
    const dashAssets = document.getElementById('dash-assets-list');
    if (assets.length > 0) {
      dashAssets.innerHTML = assets.map(a => {
        if (!a.path) return `<div class="aspect-square border-[2px] border-[var(--nb-border)] flex items-center justify-center bg-[var(--nb-bg)] text-[9px] uppercase">${a.type || 'Asset'}</div>`;
        const title = (a.prompt || a.type || 'asset').replace(/"/g, '&quot;').slice(0, 120);
        return `<div class="aspect-square border-[2px] border-[var(--nb-border)] overflow-hidden bg-[var(--nb-bg)] flex items-center justify-center" title="${title}">
          <img src="${api.mediaUrl(a.path)}" alt="Story asset" class="w-full h-full object-cover"
               onerror="this.remove();this.parentElement.insertAdjacentHTML('beforeend','<span class=\\'text-[9px] uppercase opacity-50\\'>Missing</span>')">
        </div>`;
      }).join('');
    } else {
      dashAssets.innerHTML = '<span class="col-span-3">None yet.</span>';
    }
  } catch(e) {}
}
