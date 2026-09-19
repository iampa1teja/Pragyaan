// js/perspective.js
import * as api from './api.js';

let chatHistory = [];

export function initPerspective({ getStoryId, createChatInterface, showToast }) {
  const charSelect = document.getElementById('persp-char-select');
  const eventSelect = document.getElementById('persp-event-select');
  const msgsContainer = document.getElementById('persp-messages');
  
  function clearChat() {
    chatHistory = [];
    msgsContainer.innerHTML = '';
  }
  
  charSelect.addEventListener('change', () => {
    clearChat();
    const infoCard = document.getElementById('persp-info-card');
    if (infoCard) {
      if (charSelect.value) {
        infoCard.innerHTML = `Explore the story through <strong>${charSelect.value}'s</strong> eyes. Ask questions, request rewrites, or dive into their thoughts.`;
      } else {
        infoCard.innerHTML = `Explore the story through a character's eyes. Ask questions, request rewrites, or dive into their thoughts.`;
      }
    }
  });
  
  eventSelect.addEventListener('change', clearChat);
  
  window.__persp_on_enter = async (storyId) => {
    try {
      const [chars, timeline] = await Promise.all([
        api.getCharacters(storyId),
        api.getTimeline(storyId)
      ]);
      
      charSelect.innerHTML = `<option value="">Select Character...</option>` + chars.map(c => 
        `<option value="${c.name}">${c.name}</option>`
      ).join('');
      
      eventSelect.innerHTML = `<option value="">Select Event (Optional)...</option>` + timeline.events.map(e => 
        `<option value="${e.title}">${e.title}</option>`
      ).join('');
      
    } catch(err) {
      showToast('Failed to load perspective options', 'error');
    }
  };

  createChatInterface({
    input: document.getElementById('persp-input'),
    sendBtn: document.getElementById('persp-send'),
    container: msgsContainer,
    onSend: async (storyId, message) => {
      const character = charSelect.value;
      if (!character) {
        showToast('Please select a character first', 'error');
        throw new Error('No character selected');
      }
      const event = eventSelect.value || undefined;
      
      const res = await api.sendPerspective(storyId, {
        character,
        event,
        message,
        history: chatHistory
      });
      
      chatHistory.push({ role: 'user', content: message });
      chatHistory.push({ role: 'assistant', content: res.reply });
      return res.reply;
    }
  });
}

export async function onEnterPerspective(storyId) {
  if (window.__persp_on_enter) {
    await window.__persp_on_enter(storyId);
  }
}
