// js/api.js
import { BACKEND_URL } from './config.js';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function extractError(res) {
  try {
    const body = await res.json();
    return body.detail || body.message || body.error || res.statusText;
  } catch {
    return res.statusText;
  }
}

async function fetchAPI(endpoint, options = {}) {
  const res = await fetch(`${BACKEND_URL}${endpoint}`, options);
  if (!res.ok) {
    throw new ApiError(res.status, await extractError(res));
  }
  return res.json();
}

export async function uploadStory(files) {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file);
  }
  return fetchAPI('/stories', {
    method: 'POST',
    body: form,
  });
}

export async function getStoryStatus(storyId) {
  return fetchAPI(`/stories/${storyId}`);
}

export async function getFiles(storyId) {
  return fetchAPI(`/stories/${storyId}/files`);
}

export async function sendChat(storyId, message) {
  return fetchAPI(`/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ story_id: storyId, message }),
  });
}

export async function resetContext(storyId) {
  return fetchAPI(`/stories/${storyId}/reset`, { method: 'POST' });
}

export async function getCharacters(storyId) {
  return fetchAPI(`/stories/${storyId}/characters`);
}

export async function getTimeline(storyId) {
  return fetchAPI(`/stories/${storyId}/timeline`);
}

export async function sendInterview(storyId, payload) {
  // payload: { character, story_point, message, history:[{role,content}] }
  return fetchAPI(`/stories/${storyId}/interview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function sendPerspective(storyId, payload) {
  // payload: { character, event, message, history:[…] }
  return fetchAPI(`/stories/${storyId}/perspective`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function sendDivergence(storyId, payload) {
  // payload: { event, change, message, history:[…] }
  return fetchAPI(`/stories/${storyId}/divergence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function listAssets(storyId) {
  return fetchAPI(`/stories/${storyId}/assets`);
}

export async function saveStory(storyId, name) {
  return fetchAPI(`/stories/${storyId}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name || null }),
  });
}

export async function listStories() {
  return fetchAPI(`/stories`);
}

export async function deleteStory(storyId) {
  return fetchAPI(`/stories/${storyId}`, { method: 'DELETE' });
}

export async function getData(storyId) {
  return fetchAPI(`/stories/${storyId}/data`);
}

export async function addEntry(storyId, payload) {
  // payload: { name, type, description }
  return fetchAPI(`/stories/${storyId}/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteData(storyId, rowId) {
  return fetchAPI(`/stories/${storyId}/data/${rowId}`, { method: 'DELETE' });
}

export async function generateImage(storyId, payload) {
  // payload: { kind: 'character' | 'concept', subject }
  return fetchAPI(`/stories/${storyId}/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// Turn a backend "/media/..." path into an absolute URL (BACKEND_URL ends with /api).
export function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  const origin = BACKEND_URL.replace(/\/api\/?$/, '');
  return `${origin}${path}`;
}
