// js/data.js — Data page = story library (list, switch, delete stories)
import * as api from './api.js';

const STATUS_COLOR = {
  ready: 'var(--ac-green)',
  ingesting: 'var(--ac-yellow)',
  ingested: 'var(--ac-blue)',
  failed: '#FF5C5C',
};

let getStoryId = () => null;
let onSelect = () => {};
let onNew = () => {};
let toast = () => {};
let stories = [];
const $ = (id) => document.getElementById(id);

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }); }
  catch { return '—'; }
}

function render() {
  const q = ($('data-search').value || '').toLowerCase();
  const current = getStoryId();
  const view = stories.filter((s) => !q || s.title.toLowerCase().includes(q));

  $('data-tbody').innerHTML = view.map((s, i) => {
    const color = STATUS_COLOR[s.status] || 'var(--ac-blue)';
    const isCurrent = s.id === current;
    return `
      <tr class="story-row border-b-[2px] border-[var(--nb-border)] border-opacity-30 hover:bg-[var(--nb-bg)] cursor-pointer ${isCurrent ? 'bg-[var(--nb-bg)]' : ''}" data-open="${s.id}">
        <td class="py-2.5 pr-2 font-mono text-[11px] opacity-60">${String(i + 1).padStart(2, '0')}</td>
        <td class="py-2.5 pr-2">
          <div class="flex items-center gap-2">
            <span class="w-7 h-7 shrink-0 border-[2px] border-[var(--nb-border)] flex items-center justify-center" style="background:${color}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="#111" stroke-width="2.5" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </span>
            <span class="font-semibold text-sm truncate max-w-[220px]">${s.title}</span>
            ${s.saved ? '<span class="font-mono text-[8px] uppercase bg-[var(--ac-green)] text-[#111] px-1.5 py-0.5 border-[2px] border-[var(--nb-border)]">Saved</span>' : ''}
            ${isCurrent ? '<span class="font-mono text-[8px] uppercase opacity-60">• current</span>' : ''}
          </div>
        </td>
        <td class="py-2.5 pr-2"><span class="px-2.5 py-1 rounded-full text-[10px] font-semibold text-[#111] border-[2px] border-[var(--nb-border)]" style="background:${color}">${(s.status || '').toUpperCase()}</span></td>
        <td class="py-2.5 pr-2 hidden md:table-cell font-mono text-[11px] opacity-75">${(s.files || []).length} file(s), ${s.n_chunks} chunks</td>
        <td class="py-2.5 pr-2 hidden sm:table-cell font-mono text-[11px] opacity-60">${fmtDate(s.created_at)}</td>
        <td class="py-2.5 pr-1 text-right whitespace-nowrap">
          <button data-open="${s.id}" title="Open" class="brutal-btn-sm brutal-btn bg-[var(--ac-blue)] text-[#111] font-mono text-[10px] uppercase px-2 py-1">Open</button>
          <button data-del="${s.id}" title="Delete story" class="text-[#FF5C5C] hover:opacity-70 px-1.5 align-middle">
            <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </td>
      </tr>`;
  }).join('') || '<tr><td colspan="6" class="py-6 text-center font-mono text-xs opacity-50">No stories yet. Upload one from Home.</td></tr>';

  $('data-count').textContent = `${view.length} of ${stories.length} stories`;

  $('data-tbody').querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', (e) => { e.stopPropagation(); del(b.dataset.del); }));
  $('data-tbody').querySelectorAll('[data-open]').forEach((b) =>
    b.addEventListener('click', (e) => { e.stopPropagation(); open(b.dataset.open); }));
}

async function load() {
  try {
    stories = await api.listStories();
    render();
  } catch (err) {
    toast('Failed to load stories', 'error');
  }
}

function open(id) {
  const s = stories.find((x) => x.id === id);
  if (s && s.status !== 'ready') { toast(`Story is ${s.status}, not ready yet`, 'error'); return; }
  onSelect(id);
}

async function del(id) {
  if (!confirm('Permanently delete this story, its files and generated data? This cannot be undone.')) return;
  try {
    await api.deleteStory(id);
    stories = stories.filter((s) => s.id !== id);
    render();
    toast('Story deleted', 'info');
  } catch (err) {
    toast(err.message || 'Delete failed', 'error');
  }
}

export function initData(opts) {
  getStoryId = opts.getStoryId;
  onSelect = opts.onSelectStory || (() => {});
  onNew = opts.onNewStory || (() => {});
  toast = opts.showToast;
  $('data-search').addEventListener('input', render);
  $('data-new-btn').addEventListener('click', () => onNew());
}

export async function onEnterData() {
  await load();
}
