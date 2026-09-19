// js/theme.js — Dark / light toggle + persistence + prefers-color-scheme
const STORAGE_KEY = 'nb-theme';
const root = document.documentElement;

function apply(theme) {
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem(STORAGE_KEY, theme);
  updateIcon(theme);
}

function resolveInitial() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateIcon(theme) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const sun = btn.querySelector('.icon-sun');
  const moon = btn.querySelector('.icon-moon');
  if (sun) sun.classList.toggle('hidden', theme === 'light');
  if (moon) moon.classList.toggle('hidden', theme === 'dark');
}

export function current() {
  return root.classList.contains('dark') ? 'dark' : 'light';
}

export function toggle() {
  apply(current() === 'dark' ? 'light' : 'dark');
}

export function init() {
  apply(resolveInitial());
  document.getElementById('theme-toggle')?.addEventListener('click', toggle);
}
