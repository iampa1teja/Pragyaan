// js/timeline.js
import * as api from './api.js';

export function initTimeline({ getStoryId, showToast }) {
  window.__timeline_on_enter = async (storyId) => {
    try {
      const data = await api.getTimeline(storyId);
      const container = document.getElementById('timeline-container');
      
      container.innerHTML = `
        <div class="timeline-track-line"></div>
        ${data.events.map(ev => `
          <div class="relative pl-6">
            <div class="absolute left-[-2px] top-4 w-5 h-5 bg-[#3DDC84] border-[3px] border-[var(--nb-border)] transform -translate-x-1/2 z-10"></div>
            <div class="border-[4px] border-[var(--nb-border)] bg-[var(--nb-surface)] p-4 shadow-[4px_4px_0_0_var(--nb-shadow)]">
              <h3 class="font-display text-lg uppercase">${ev.title}</h3>
              <p class="font-mono text-sm mt-2 mb-3 opacity-80">${ev.description}</p>
              <div class="flex flex-wrap gap-2">
                ${(ev.characters || []).map(c => `<span class="bg-[#B980F0] text-[#111] px-2 py-0.5 font-mono text-[9px] uppercase border-[2px] border-[var(--nb-border)]">${c}</span>`).join('')}
                ${(ev.tags || []).map(t => `<span class="bg-[#FFD23F] text-[#111] px-2 py-0.5 font-mono text-[9px] uppercase border-[2px] border-[var(--nb-border)]">${t}</span>`).join('')}
              </div>
            </div>
          </div>
        `).join('')}
      `;
    } catch(err) {
      showToast('Failed to load timeline', 'error');
    }
  };
}

export async function onEnterTimeline(storyId) {
  if (window.__timeline_on_enter) {
    await window.__timeline_on_enter(storyId);
  }
}
