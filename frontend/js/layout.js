// js/layout.js — Sidebar collapse toggles, focus-chat mode, mobile drawers, persistence

const STORAGE_KEY = 'nb-layout';

let state = {
  leftOpen: true,
  rightOpen: true,
  focusMode: false,
};

// Elements (cached after init)
let leftSidebar, rightSidebar, centerContent, overlay;

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s) Object.assign(state, s);
  } catch { /* use defaults */ }
}

function isMobile() {
  return window.innerWidth < 1024; // lg breakpoint
}

function applyLayout() {
  if (!leftSidebar) return;

  if (isMobile()) {
    // On mobile, sidebars are drawers (overlay)
    leftSidebar.classList.toggle('sidebar-drawer-open', state.leftOpen);
    leftSidebar.classList.toggle('sidebar-drawer-closed', !state.leftOpen);
    rightSidebar?.classList.toggle('sidebar-drawer-open-right', state.rightOpen);
    rightSidebar?.classList.toggle('sidebar-drawer-closed-right', !state.rightOpen);
    overlay.classList.toggle('hidden', !state.leftOpen && !state.rightOpen);

    // Remove desktop classes
    leftSidebar.classList.remove('sidebar-collapsed', 'sidebar-expanded');
    rightSidebar?.classList.remove('right-collapsed', 'right-expanded');
  } else {
    // Desktop: width transitions
    leftSidebar.classList.remove('sidebar-drawer-open', 'sidebar-drawer-closed');
    rightSidebar?.classList.remove('sidebar-drawer-open-right', 'sidebar-drawer-closed-right');
    overlay.classList.add('hidden');

    if (state.focusMode) {
      leftSidebar.classList.add('sidebar-collapsed');
      leftSidebar.classList.remove('sidebar-expanded');
      rightSidebar?.classList.add('right-collapsed');
      rightSidebar?.classList.remove('right-expanded');
    } else {
      leftSidebar.classList.toggle('sidebar-collapsed', !state.leftOpen);
      leftSidebar.classList.toggle('sidebar-expanded', state.leftOpen);
      rightSidebar?.classList.toggle('right-collapsed', !state.rightOpen);
      rightSidebar?.classList.toggle('right-expanded', state.rightOpen);
    }
  }

  // Update nav labels visibility
  const labels = leftSidebar.querySelectorAll('.nav-label');
  const collapsed = leftSidebar.classList.contains('sidebar-collapsed');
  labels.forEach(l => l.classList.toggle('hidden', collapsed));

  // Update divider/section headers
  leftSidebar.querySelectorAll('.nav-section-header').forEach(h =>
    h.classList.toggle('hidden', collapsed)
  );

  // Update focus button state
  const focusBtn = document.getElementById('focus-toggle');
  if (focusBtn) {
    focusBtn.classList.toggle('bg-[var(--ac-yellow)]', state.focusMode);
    focusBtn.classList.toggle('text-[#111]', state.focusMode);
  }
}

export function toggleLeft() {
  if (state.focusMode) {
    state.focusMode = false;
    state.leftOpen = true;
    state.rightOpen = true;
  } else {
    state.leftOpen = !state.leftOpen;
  }
  save();
  applyLayout();
}

export function toggleRight() {
  if (state.focusMode) {
    state.focusMode = false;
    state.leftOpen = true;
    state.rightOpen = true;
  } else {
    state.rightOpen = !state.rightOpen;
  }
  save();
  applyLayout();
}

export function toggleFocus() {
  state.focusMode = !state.focusMode;
  if (state.focusMode) {
    // Collapse both
    state.leftOpen = false;
    state.rightOpen = false;
  } else {
    // Restore both
    state.leftOpen = true;
    state.rightOpen = true;
  }
  save();
  applyLayout();
}

export function closeMobileDrawers() {
  state.leftOpen = false;
  state.rightOpen = false;
  save();
  applyLayout();
}

export function init() {
  leftSidebar = document.getElementById('left-sidebar');
  rightSidebar = document.getElementById('right-sidebar');
  centerContent = document.getElementById('center-content');
  overlay = document.getElementById('drawer-overlay');

  load();

  // On mobile, default both closed
  if (isMobile()) {
    state.leftOpen = false;
    state.rightOpen = false;
  }

  applyLayout();

  // Wire buttons
  document.getElementById('toggle-left-sidebar')?.addEventListener('click', toggleLeft);
  document.getElementById('toggle-right-sidebar')?.addEventListener('click', toggleRight);
  document.getElementById('focus-toggle')?.addEventListener('click', toggleFocus);
  overlay?.addEventListener('click', closeMobileDrawers);

  // Re-apply on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isMobile()) {
        state.leftOpen = false;
        state.rightOpen = false;
      }
      applyLayout();
    }, 150);
  });
}

export function showSidebars() {
  // Show sidebars for dashboard state (desktop only)
  if (!isMobile()) {
    state.leftOpen = true;
    state.rightOpen = true;
    state.focusMode = false;
  }
  applyLayout();
}

export function hideSidebars() {
  state.leftOpen = false;
  state.rightOpen = false;
  applyLayout();
}
