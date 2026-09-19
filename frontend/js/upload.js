// js/upload.js — Upload + polling with max-tries/error cutoff + retry + status pill
import { uploadStory, getStoryStatus, ApiError } from './api.js';

let pollTimer = null;
let pollCount = 0;
let consecutiveErrors = 0;
let showToast = () => {};      // injected from app.js

const MAX_POLLS = 90;          // ~3 min at 2s interval
const MAX_CONSECUTIVE_ERRORS = 5;
const POLL_INTERVAL = 2000;

/**
 * @param {(msg: string, type: string) => void} toastFn
 * @param {(storyId: string, title: string) => void} onReady
 */
export function initUpload(toastFn, onReady) {
  showToast = toastFn;

  const zone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadBtn = document.getElementById('upload-btn');
  const retryBtn = document.getElementById('retry-btn');

  if (!zone) return;

  zone.addEventListener('click', () => fileInput.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) selectFile(fileInput.files[0]);
  });

  uploadBtn.addEventListener('click', () => {
    if (uploadBtn._file) doUpload(uploadBtn._file, onReady);
  });

  retryBtn?.addEventListener('click', () => {
    if (retryBtn._storyId) {
      document.getElementById('poll-error-state')?.classList.add('hidden');
      startPolling(retryBtn._storyId, onReady);
    } else if (uploadBtn._file) {
      document.getElementById('poll-error-state')?.classList.add('hidden');
      doUpload(uploadBtn._file, onReady);
    }
  });
}

const ALLOWED_EXTS = ['txt', 'md', 'pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];

function selectFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) {
    showToast('Supported: .txt, .md, .pdf, .docx, or an image.', 'error');
    return;
  }
  const nameEl = document.getElementById('file-name');
  nameEl.textContent = file.name;
  nameEl.classList.remove('hidden');
  const btn = document.getElementById('upload-btn');
  btn._file = file;
  btn.disabled = false;
  btn.classList.remove('opacity-50', 'cursor-not-allowed');
}

async function doUpload(file, onReady) {
  switchToBuilding();

  try {
    const { id } = await uploadStory(file);
    // Store storyId for retry
    document.getElementById('retry-btn')._storyId = id;
    startPolling(id, onReady);
  } catch (err) {
    showToast(err.message || 'Upload failed — try again.', 'error');
    switchToUpload();
  }
}

function switchToBuilding() {
  document.getElementById('panel-upload')?.classList.add('hidden');
  document.getElementById('panel-building')?.classList.remove('hidden');
  document.getElementById('poll-error-state')?.classList.add('hidden');
  updatePill('ingesting');
}

function switchToUpload() {
  document.getElementById('panel-building')?.classList.add('hidden');
  document.getElementById('panel-upload')?.classList.remove('hidden');
}

function startPolling(storyId, onReady) {
  stopPolling();
  pollCount = 0;
  consecutiveErrors = 0;

  pollTimer = setInterval(async () => {
    pollCount++;

    // Max-tries guard
    if (pollCount > MAX_POLLS) {
      stopPolling();
      showPollError('Processing timed out after ~3 minutes. The backend may be under heavy load.');
      return;
    }

    try {
      const data = await getStoryStatus(storyId);
      consecutiveErrors = 0; // reset on success
      updatePill(data.status);

      if (data.status === 'ready') {
        stopPolling();
        onReady(data.id, data.title || 'Untitled');
      } else if (data.status === 'failed') {
        stopPolling();
        showPollError('Story processing failed on the backend.');
      }
    } catch (err) {
      consecutiveErrors++;

      if (err instanceof ApiError && err.status === 404) {
        stopPolling();
        showPollError('Story not found (404). It may have been deleted.');
        return;
      }

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        stopPolling();
        showPollError(`${MAX_CONSECUTIVE_ERRORS} consecutive network errors. Backend may be unreachable.`);
      }
    }
  }, POLL_INTERVAL);
}

function showPollError(msg) {
  showToast(msg, 'error');
  const errorState = document.getElementById('poll-error-state');
  if (errorState) {
    errorState.classList.remove('hidden');
    errorState.querySelector('.error-msg').textContent = msg;
  }
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function updatePill(status) {
  const pill = document.getElementById('status-pill');
  if (!pill) return;

  const labels = { ingesting: 'INGESTING', ingested: 'INGESTED', ready: 'READY', failed: 'FAILED' };
  pill.textContent = labels[status] || status.toUpperCase();

  // Update color
  pill.className = pill.className.replace(/bg-\[#\w+\]/g, '').trim();
  const colors = {
    ingesting: 'bg-[var(--ac-yellow)]',
    ingested: 'bg-[var(--ac-blue)]',
    ready: 'bg-[var(--ac-green)]',
    failed: 'bg-[#FF5C5C]',
  };
  if (colors[status]) pill.classList.add(colors[status]);
}

/** Resume polling for a story saved in localStorage */
export function resumePolling(storyId, toastFn, onReady) {
  showToast = toastFn;
  switchToBuilding();
  document.getElementById('retry-btn')._storyId = storyId;
  startPolling(storyId, onReady);
}

export function cleanup() {
  stopPolling();
}
