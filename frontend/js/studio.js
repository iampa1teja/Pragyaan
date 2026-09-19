// js/studio.js — Generative Studio (character design + concept art)
import * as api from './api.js';

const STYLES = {
  character: ['Anime', 'Realistic', 'Cinematic', 'Illustrated'],
  concept: ['Cinematic', 'Illustrated', 'Dark', 'Epic'],
};
const ACCENT = { character: 'var(--ac-pink)', concept: 'var(--ac-green)' };

let getStoryId = () => null;
let toast = () => {};
let mode = 'character';
let style = 'Anime';
let characters = [];
let generating = false;

const $ = (id) => document.getElementById(id);

function showView(view) {
  $('studio-landing').classList.toggle('hidden', view !== 'landing');
  $('studio-detail').classList.toggle('hidden', view !== 'detail');
}

function renderStyles() {
  const wrap = $('studio-styles');
  wrap.innerHTML = STYLES[mode].map((s) => `
    <button data-style="${s}" class="studio-style brutal-btn-sm brutal-btn font-mono text-xs uppercase px-3 py-2 ${s === style ? 'text-[#111]' : 'bg-[var(--nb-surface)] text-[var(--nb-text)]'}"
      style="${s === style ? `background:${ACCENT[mode]}` : ''}">${s}</button>
  `).join('');
  wrap.querySelectorAll('.studio-style').forEach((b) => {
    b.addEventListener('click', () => { style = b.dataset.style; renderStyles(); });
  });
}

function openMode(m) {
  mode = m;
  style = STYLES[m][0];
  const isChar = m === 'character';

  $('studio-detail-title').textContent = isChar ? 'Character Design' : 'Concept Art Design';
  $('studio-detail-sub').textContent = isChar
    ? 'Generate a visual design grounded in your story.'
    : 'Describe what you want to see, and we\'ll generate concept art from your story context.';
  $('studio-detail-icon').style.background = ACCENT[m];
  $('studio-generate-label').textContent = isChar ? 'Generate Character' : 'Generate Concept Art';
  $('studio-generate').style.background = 'var(--ac-yellow)';

  $('studio-char-block').classList.toggle('hidden', !isChar);
  $('studio-subject-block').classList.toggle('hidden', isChar);
  $('studio-context').textContent = isChar
    ? 'Select a character to load their story context.'
    : 'Describe a subject to ground the image in your story.';
  $('studio-preview').innerHTML = '<span class="font-mono text-xs opacity-40 uppercase text-center px-4">Your generated image will appear here</span>';
  $('studio-preview-actions').classList.add('hidden');

  renderStyles();
  showView('detail');
}

function renderCharSelect() {
  const sel = $('studio-char-select');
  sel.innerHTML = '<option value="">Select a character…</option>' +
    characters.map((c) => `<option value="${c.name}">${c.name}${c.role ? ' — ' + c.role : ''}</option>`).join('');
  sel.onchange = () => {
    const c = characters.find((x) => x.name === sel.value);
    $('studio-context').textContent = c ? (c.description || `${c.name} (${c.role || 'character'})`) : 'Select a character to load their story context.';
  };
}

function thumb(asset) {
  const url = api.mediaUrl(asset.path);
  return `
    <div class="border-[3px] border-[var(--nb-border)] shadow-[4px_4px_0_0_var(--nb-shadow)] overflow-hidden bg-[var(--nb-surface)]">
      <div class="aspect-square bg-[var(--nb-bg)] overflow-hidden">
        <img src="${url}" alt="" class="w-full h-full object-cover" loading="lazy">
      </div>
      <p class="px-2 py-1 font-mono text-[9px] uppercase truncate">${(asset.prompt || asset.type || '').slice(0, 40)}</p>
    </div>`;
}

async function loadHistory() {
  const storyId = getStoryId();
  if (!storyId) return;
  try {
    const assets = await api.listAssets(storyId);
    const html = assets.length
      ? assets.map(thumb).join('')
      : '<p class="font-mono text-xs opacity-50 col-span-full">No generations yet.</p>';
    $('studio-recent').innerHTML = html;
    $('studio-history').innerHTML = html;
  } catch { /* ignore */ }
}

function buildSubject() {
  const instr = $('studio-instructions').value.trim();
  let base;
  if (mode === 'character') {
    base = $('studio-char-select').value;
  } else {
    base = $('studio-subject-input').value.trim();
  }
  if (!base) return null;
  let subject = base + `. Visual style: ${style}.`;
  if (instr) subject += ` ${instr}`;
  return subject;
}

async function generate() {
  if (generating) return;
  const storyId = getStoryId();
  if (!storyId) { toast('Load a story first', 'error'); return; }
  const subject = buildSubject();
  if (!subject) { toast(mode === 'character' ? 'Select a character' : 'Describe what to visualize', 'error'); return; }

  generating = true;
  const btn = $('studio-generate');
  btn.disabled = true;
  $('studio-preview').innerHTML = `<div class="flex flex-col items-center gap-3"><div class="flex gap-1.5"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div></div><span class="font-mono text-[10px] uppercase opacity-60">Generating…</span></div>`;
  $('studio-preview-actions').classList.add('hidden');

  try {
    const asset = await api.generateImage(storyId, { kind: mode, subject });
    const url = api.mediaUrl(asset.path);
    $('studio-preview').innerHTML = `<img src="${url}" alt="" class="w-full h-full object-contain">`;
    const dl = $('studio-download');
    dl.href = url;
    $('studio-preview-actions').classList.remove('hidden');
    loadHistory();
  } catch (err) {
    $('studio-preview').innerHTML = '<span class="font-mono text-xs text-[#FF5C5C] uppercase text-center px-4">Generation failed</span>';
    if (err.status === 409) toast('Story not ready yet', 'error');
    else toast(err.message || 'Image generation failed', 'error');
  } finally {
    generating = false;
    btn.disabled = false;
  }
}

export function initStudio(opts) {
  getStoryId = opts.getStoryId;
  toast = opts.showToast;

  document.querySelectorAll('[data-studio-open]').forEach((b) => {
    b.addEventListener('click', () => openMode(b.dataset.studioOpen));
  });
  $('studio-back').addEventListener('click', () => { showView('landing'); loadHistory(); });
  $('studio-generate').addEventListener('click', generate);
  $('studio-regenerate').addEventListener('click', generate);
}

export async function onEnterStudio(storyId) {
  showView('landing');
  try {
    characters = await api.getCharacters(storyId);
    renderCharSelect();
  } catch { characters = []; }
  loadHistory();
}
