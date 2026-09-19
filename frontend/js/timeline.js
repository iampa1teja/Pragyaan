// js/timeline.js
import * as api from './api.js';

const NODE = ['var(--ac-pink)','var(--ac-purple)','var(--ac-yellow)','var(--ac-blue)','var(--ac-green)','var(--ac-purple)','var(--ac-pink)'];
// pastel pill palette (light bg, dark text — readable in both themes)
const PILL = ['#E9D5FF', '#BFDBFE', '#BBF7D0', '#FEF08A', '#FBCFE8', '#FED7AA'];
const CHAR_PILL = '#E9D5FF';

let storyIdRef = null;
let toast = () => {};

function eventCard(ev, i) {
  const color = NODE[i % NODE.length];
  const chars = (ev.characters || []).map((c) =>
    `<span class="px-2.5 py-1 rounded-full text-[10px] font-semibold text-[#111] border-[2px] border-[var(--nb-border)]" style="background:${CHAR_PILL}">${c}</span>`
  ).join('');
  const tags = (ev.tags || []).map((t, j) =>
    `<span class="px-2.5 py-1 rounded-full text-[10px] font-semibold text-[#111] border-[2px] border-[var(--nb-border)]" style="background:${PILL[j % PILL.length]}">${t}</span>`
  ).join('');

  return `
    <div class="relative pl-10 pb-8 last:pb-0" style="--c:${color}">
      <!-- connecting line -->
      <div class="tl-line absolute left-[9px] top-2 bottom-0 w-[3px] bg-[var(--nb-border)]"></div>
      <!-- hollow ring node -->
      <div class="tl-node absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-[4px] bg-[var(--nb-surface)] z-10" style="border-color:${color}; --c:${color}"></div>

      <div class="flex gap-4">
        <!-- left label -->
        <div class="w-20 shrink-0 hidden sm:block pt-0.5">
          <div class="font-display text-[11px] uppercase tracking-wide">Event ${String(i + 1).padStart(2, '0')}</div>
          <div class="font-mono text-[9px] uppercase mt-1 font-bold" style="color:${color}">${(ev.tags && ev.tags[0]) || ''}</div>
        </div>

        <!-- card -->
        <div class="tl-card flex-1 border-[3px] border-[var(--nb-border)] bg-[var(--nb-surface)] shadow-[4px_4px_0_0_var(--nb-shadow)] flex overflow-hidden">
          <div class="flex-1 p-4 min-w-0">
            <h3 class="font-display text-base uppercase leading-tight">${ev.title}</h3>
            <p class="font-mono text-[11px] mt-1.5 mb-3 opacity-75 leading-relaxed">${ev.description || ''}</p>
            <div class="flex flex-wrap gap-1.5">${chars}${tags}</div>
          </div>
          <!-- image -->
          <div class="tl-img w-28 sm:w-36 shrink-0 border-l-[3px] border-[var(--nb-border)] bg-[var(--nb-bg)] relative flex items-center justify-center cursor-pointer group"
               data-subject="${(ev.title + '. ' + (ev.description || '')).replace(/"/g, '&quot;')}">
            <div class="tl-img-slot w-full h-full flex flex-col items-center justify-center gap-1 text-center px-2">
              <svg class="w-5 h-5 opacity-40 group-hover:opacity-70" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              <span class="font-mono text-[8px] uppercase opacity-50 group-hover:opacity-80">✦ Generate</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

async function generateForCard(el) {
  if (el.dataset.busy) return;
  const slot = el.querySelector('.tl-img-slot');
  el.dataset.busy = '1';
  slot.innerHTML = '<div class="flex gap-1"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div></div>';
  try {
    const asset = await api.generateImage(storyIdRef, { kind: 'concept', subject: el.dataset.subject });
    el.innerHTML = `<img src="${api.mediaUrl(asset.path)}" alt="" class="w-full h-full object-cover">`;
  } catch (err) {
    el.dataset.busy = '';
    slot.innerHTML = '<span class="font-mono text-[8px] uppercase text-[#FF5C5C]">Failed — retry</span>';
    toast(err.status === 409 ? 'Story not ready' : (err.message || 'Image failed'), 'error');
  }
}

export function initTimeline({ getStoryId, showToast }) {
  toast = showToast;
  window.__timeline_on_enter = async (storyId) => {
    storyIdRef = storyId;
    const container = document.getElementById('timeline-container');
    try {
      const data = await api.getTimeline(storyId);
      container.innerHTML = data.events.length
        ? data.events.map(eventCard).join('')
        : '<p class="font-mono text-xs opacity-50">No timeline events found.</p>';
      container.querySelectorAll('.tl-img').forEach((el) =>
        el.addEventListener('click', () => generateForCard(el))
      );
    } catch (err) {
      showToast('Failed to load timeline', 'error');
    }
  };
}

export async function onEnterTimeline(storyId) {
  if (window.__timeline_on_enter) await window.__timeline_on_enter(storyId);
}
