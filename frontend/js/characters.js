// js/characters.js
import * as api from './api.js';

let activeCharacter = null;
let chatHistory = [];

export function initCharacters({ getStoryId, createChatInterface, showToast }) {
  const charSearch = document.getElementById('char-search');
  const charList = document.getElementById('char-list');
  
  charSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.char-btn').forEach(btn => {
      const name = btn.dataset.name.toLowerCase();
      if (name.includes(term)) {
        btn.style.display = '';
      } else {
        btn.style.display = 'none';
      }
    });
  });
  const timeSelect = document.getElementById('char-timeline-select');
  const msgsContainer = document.getElementById('char-messages');
  
  function updateCharHeader() {
    document.getElementById('char-name-header').textContent = activeCharacter?.name || 'Select a character';
    document.getElementById('char-role-header').textContent = activeCharacter?.role || '';
    document.getElementById('char-input').disabled = !activeCharacter;
    document.getElementById('char-send').disabled = !activeCharacter;
  }
  
  function clearChat() {
    chatHistory = [];
    msgsContainer.innerHTML = '';
  }
  
  timeSelect.addEventListener('change', clearChat);
  
  // Expose global enter function (called from app.js router)
  window.__chars_on_enter = async (storyId) => {
    try {
      const [chars, timeline] = await Promise.all([
        api.getCharacters(storyId),
        api.getTimeline(storyId)
      ]);
      
      // Populate Timeline
      timeSelect.innerHTML = timeline.events.map(e => 
        `<option value="${e.title}">${e.title}</option>`
      ).join('');
      
      // Populate Characters
      charList.innerHTML = chars.map(c => `
        <button class="char-btn text-left p-2 border-[2px] border-[var(--nb-border)] bg-[var(--nb-bg)] hover:bg-[#FF5C8A] hover:text-[#111] transition-colors" data-name="${c.name}">
          <div class="font-display uppercase text-xs">${c.name}</div>
          <div class="font-mono text-[9px] opacity-70">${c.role}</div>
        </button>
      `).join('');
      
      document.querySelectorAll('.char-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.char-btn').forEach(b => b.classList.remove('bg-[#FF5C8A]', 'text-[#111]'));
          btn.classList.add('bg-[#FF5C8A]', 'text-[#111]');
          const name = btn.dataset.name;
          activeCharacter = chars.find(x => x.name === name);
          updateCharHeader();
          
          const traitsContainer = document.getElementById('char-traits');
          if (activeCharacter.traits && activeCharacter.traits.length > 0) {
            traitsContainer.innerHTML = activeCharacter.traits.map(t => 
              `<span class="bg-[#FFD23F] text-[#111] font-mono text-[9px] px-2 py-0.5 border-[2px] border-[var(--nb-border)]">${t}</span>`
            ).join('');
          } else {
            traitsContainer.innerHTML = '';
          }
          
          const quoteContainer = document.getElementById('char-quote');
          if (activeCharacter.description) {
            quoteContainer.innerHTML = `<i class="text-sm block mt-2 border-l-2 border-[var(--nb-border)] pl-2 text-left opacity-80">${activeCharacter.description}</i>`;
          } else {
            quoteContainer.innerHTML = '';
          }
          
          clearChat();
          
          // Show suggested questions
          const chips = document.getElementById('char-chips');
          chips.innerHTML = [
            "What are you afraid of?",
            "Who do you trust the most?",
            "What's your true goal?"
          ].map(q => `<button class="brutal-btn-sm bg-[var(--nb-bg)] px-2 py-1 font-mono text-[9px] whitespace-nowrap" onclick="document.getElementById('char-input').value='${q}'">${q}</button>`).join('');
        });
      });
      
    } catch(err) {
      showToast('Failed to load characters/timeline', 'error');
    }
  };

  createChatInterface({
    input: document.getElementById('char-input'),
    sendBtn: document.getElementById('char-send'),
    container: msgsContainer,
    onSend: async (storyId, message) => {
      if (!activeCharacter) {
        showToast('Please select a character first', 'error');
        throw new Error('No character selected');
      }
      const storyPoint = timeSelect.value;
      const res = await api.sendInterview(storyId, {
        character: activeCharacter.name,
        story_point: storyPoint,
        message,
        history: chatHistory
      });
      
      chatHistory.push({ role: 'user', content: message });
      chatHistory.push({ role: 'assistant', content: res.reply });
      return res.reply;
    }
  });
}

export async function onEnterCharacters(storyId) {
  if (window.__chars_on_enter) {
    await window.__chars_on_enter(storyId);
  }
}
