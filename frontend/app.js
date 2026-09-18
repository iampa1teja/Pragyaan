let currentStory = null;
let allStories = [];

const tabButtons = document.querySelectorAll('.nav-btn');
const viewSections = document.querySelectorAll('.view-section');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessage = document.getElementById('loading-message');

function showLoading(msg = 'Processing...') {
  loadingMessage.textContent = msg;
  loadingOverlay.classList.add('active');
}

function hideLoading() {
  loadingOverlay.classList.remove('active');
}

function switchTab(tabName) {
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  viewSections.forEach(sec => {
    sec.classList.toggle('active', sec.id === `view-${tabName}`);
  });
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('btn-go-interview').addEventListener('click', () => switchTab('interview'));
document.getElementById('btn-go-divergence').addEventListener('click', () => switchTab('divergence'));

async function loadStoriesList() {
  try {
    const res = await fetch('/api/stories');
    allStories = await res.json();
    const listEl = document.getElementById('story-file-list');
    listEl.innerHTML = '';

    if (allStories.length === 0) {
      listEl.innerHTML = '<p style="font-size:12px;opacity:0.8;">No stories uploaded yet.</p>';
      return;
    }

    allStories.forEach((s, idx) => {
      const item = document.createElement('div');
      item.className = `file-item ${currentStory && currentStory.id === s.id ? 'selected' : ''}`;
      item.innerHTML = `
        <div class="file-info">
          <span class="file-name">${s.title || 'Untitled Story'}</span>
          <span class="file-status">${s.characters ? s.characters.length : 0} Characters &bull; ${s.events ? s.events.length : 0} Events</span>
        </div>
        <div class="badge-pixel">&#9829;</div>
      `;
      item.addEventListener('click', () => {
        document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        loadStoryDetails(s.id);
      });
      listEl.appendChild(item);
    });

    if (!currentStory && allStories.length > 0) {
      loadStoryDetails(allStories[0].id);
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadStoryDetails(storyId) {
  showLoading('Loading story data...');
  try {
    const res = await fetch(`/api/story/${storyId}`);
    currentStory = await res.json();
    populateDashboard(currentStory);
    populateInterviewSetup(currentStory);
    populateDivergenceSetup(currentStory);
  } catch (err) {
    alert('Failed to load story: ' + err.message);
  } finally {
    hideLoading();
  }
}

function populateDashboard(story) {
  document.getElementById('dash-story-title').textContent = story.title || 'Story Dashboard';
  
  const charList = document.getElementById('dash-characters-list');
  charList.innerHTML = '';
  const profiles = story.character_profiles || {};
  const characters = story.characters || Object.keys(profiles);

  characters.forEach(name => {
    const prof = profiles[name] || {};
    const traits = prof.personality ? prof.personality.join(', ') : 'None listed';
    const item = document.createElement('div');
    item.className = 'timeline-step';
    item.innerHTML = `
      <span class="step-num">&#9829;</span>
      <div class="step-desc">
        <strong>${name}</strong><br>
        <span style="font-size:11px; opacity:0.85;">Traits: ${traits}</span>
      </div>
    `;
    charList.appendChild(item);
  });

  const timelineList = document.getElementById('dash-timeline-list');
  timelineList.innerHTML = '';
  const events = story.ordered_events || (story.events || []).map((e, i) => ({ position: i + 1, description: e }));

  events.forEach(ev => {
    const item = document.createElement('div');
    item.className = 'timeline-step';
    item.innerHTML = `
      <span class="step-num">${ev.position}</span>
      <div class="step-desc">${ev.description}</div>
    `;
    timelineList.appendChild(item);
  });
}

function populateInterviewSetup(story) {
  const charSelect = document.getElementById('interview-character-select');
  const timeSelect = document.getElementById('interview-timeline-select');
  
  charSelect.innerHTML = '';
  timeSelect.innerHTML = '';

  const characters = story.characters || Object.keys(story.character_profiles || {});
  characters.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    charSelect.appendChild(opt);
  });

  const events = story.ordered_events || (story.events || []).map((e, i) => ({ position: i + 1, description: e }));
  events.forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev.position;
    opt.textContent = `Event ${ev.position}: ${ev.description.substring(0, 45)}...`;
    timeSelect.appendChild(opt);
  });

  updateKnownEventsPreview();
  timeSelect.addEventListener('change', updateKnownEventsPreview);
  charSelect.addEventListener('change', updateKnownEventsPreview);
}

function updateKnownEventsPreview() {
  if (!currentStory) return;
  const timeSelect = document.getElementById('interview-timeline-select');
  const maxPos = parseInt(timeSelect.value || 1, 10);
  const events = currentStory.ordered_events || (currentStory.events || []).map((e, i) => ({ position: i + 1, description: e }));
  const known = events.filter(e => e.position <= maxPos);
  
  const container = document.getElementById('interview-known-events');
  container.innerHTML = '';
  known.forEach(ev => {
    const item = document.createElement('div');
    item.className = 'timeline-step';
    item.innerHTML = `
      <span class="step-num">${ev.position}</span>
      <div class="step-desc" style="font-size:12px;">${ev.description}</div>
    `;
    container.appendChild(item);
  });
}

const interviewChatBox = document.getElementById('interview-chat-box');
const interviewForm = document.getElementById('interview-form');
const interviewInput = document.getElementById('interview-question-input');

interviewForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = interviewInput.value.trim();
  if (!question || !currentStory) return;

  const charName = document.getElementById('interview-character-select').value;
  const timelinePoint = parseInt(document.getElementById('interview-timeline-select').value, 10);

  appendMessage('user', 'You', question);
  interviewInput.value = '';

  showLoading(`Consulting ${charName} and checking consistency...`);
  try {
    const res = await fetch('/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        story_id: currentStory.id,
        story_title: currentStory.title,
        character_name: charName,
        timeline_point: timelinePoint,
        user_question: question
      })
    });

    const data = await res.json();
    appendMessage('agent', charName, data.response, data.consistency);
  } catch (err) {
    appendMessage('agent', 'System', 'Error getting response: ' + err.message);
  } finally {
    hideLoading();
  }
});

function appendMessage(sender, author, text, consistency = null) {
  const msgEl = document.createElement('div');
  msgEl.className = `chat-msg ${sender}`;
  
  let consistencyHtml = '';
  if (consistency) {
    const isPassed = consistency.passed;
    consistencyHtml = `
      <div style="margin-top:6px;">
        <span class="consistency-tag ${isPassed ? '' : 'fail'}">
          ${isPassed ? '&#10003; Consistent' : '&#9888; Retried'} (Retries: ${consistency.retries || 1})
        </span>
      </div>
    `;
  }

  msgEl.innerHTML = `
    <span class="chat-author">${author}</span>
    <div class="chat-bubble">
      ${text}
      ${consistencyHtml}
    </div>
  `;
  interviewChatBox.appendChild(msgEl);
  interviewChatBox.scrollTop = interviewChatBox.scrollHeight;
}

function populateDivergenceSetup(story) {
  const eventSelect = document.getElementById('divergence-event-select');
  eventSelect.innerHTML = '';
  const events = story.ordered_events || (story.events || []).map((e, i) => ({ position: i + 1, description: e }));

  events.forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev.position;
    opt.textContent = `Event ${ev.position}: ${ev.description}`;
    eventSelect.appendChild(opt);
  });
}

document.getElementById('btn-run-divergence').addEventListener('click', async () => {
  if (!currentStory) return;
  const eventPos = parseInt(document.getElementById('divergence-event-select').value, 10);
  const changeInput = document.getElementById('divergence-change-input').value.trim();

  if (!changeInput) {
    alert('Please enter a proposed change or decision.');
    return;
  }

  showLoading('Simulating timeline divergence and causality...');
  try {
    const res = await fetch('/api/divergence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        story_id: currentStory.id,
        story_title: currentStory.title,
        event_position: eventPos,
        proposed_change: changeInput
      })
    });

    const data = await res.json();
    renderDivergenceResults(data);
  } catch (err) {
    alert('Failed to simulate divergence: ' + err.message);
  } finally {
    hideLoading();
  }
});

function renderDivergenceResults(data) {
  const container = document.getElementById('divergence-results');
  container.style.display = 'flex';

  const conseqList = document.getElementById('div-consequences');
  conseqList.innerHTML = '';
  (data.direct_consequences || []).forEach(c => {
    const el = document.createElement('div');
    el.className = 'timeline-step';
    el.innerHTML = `<span class="step-num">&#9829;</span><div class="step-desc">${c}</div>`;
    conseqList.appendChild(el);
  });

  const relList = document.getElementById('div-relationships');
  relList.innerHTML = '';
  (data.relationship_shifts || []).forEach(r => {
    const el = document.createElement('div');
    el.className = 'timeline-step';
    el.innerHTML = `<span class="step-num">&#9829;</span><div class="step-desc">${r}</div>`;
    relList.appendChild(el);
  });

  const origList = document.getElementById('div-original-timeline');
  origList.innerHTML = '';
  const events = currentStory.ordered_events || (currentStory.events || []).map((e, i) => ({ position: i + 1, description: e }));
  events.forEach(ev => {
    const el = document.createElement('div');
    el.className = `timeline-step ${ev.position === data.divergence_point ? 'altered' : ''}`;
    el.innerHTML = `<span class="step-num">${ev.position}</span><div class="step-desc">${ev.description}</div>`;
    origList.appendChild(el);
  });

  const altList = document.getElementById('div-altered-timeline');
  altList.innerHTML = '';
  (data.branched_timeline || []).forEach(ev => {
    const el = document.createElement('div');
    el.className = `timeline-step ${ev.is_altered ? 'altered' : ''}`;
    el.innerHTML = `<span class="step-num">${ev.position}</span><div class="step-desc">${ev.description}</div>`;
    altList.appendChild(el);
  });

  document.getElementById('div-new-ending').textContent = data.new_ending || 'Story concluded.';
}

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const btnBrowse = document.getElementById('btn-browse');

btnBrowse.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.style.background = 'rgba(255,255,255,0.4)';
});

dropzone.addEventListener('dragleave', () => {
  dropzone.style.background = 'rgba(255,255,255,0.15)';
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.style.background = 'rgba(255,255,255,0.15)';
  if (e.dataTransfer.files.length > 0) {
    handleFileUpload(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    handleFileUpload(fileInput.files[0]);
  }
});

async function handleFileUpload(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

  showLoading(`Analyzing & indexing ${file.name}...`);
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Upload failed with status ${res.status}`);
    }

    const data = await res.json();
    await loadStoriesList();
    await loadStoryDetails(data.id);
    switchTab('dashboard');
  } catch (err) {
    alert('Upload error: ' + err.message);
  } finally {
    hideLoading();
  }
}

document.getElementById('btn-load-selected').addEventListener('click', () => {
  if (currentStory) {
    switchTab('dashboard');
  } else {
    alert('Please select or upload a story first.');
  }
});

loadStoriesList();
