// js/router.js
export class Router {
  constructor(routes, onRoute) {
    this.routes = routes;
    this.onRoute = onRoute;
    this.currentHash = '';
    window.addEventListener('hashchange', () => this.handleHashChange());
  }

  start() {
    if (!window.location.hash) {
      window.location.hash = '#/home';
    } else {
      this.handleHashChange();
    }
  }

  async handleHashChange() {
    const hash = window.location.hash || '#/home';
    if (this.currentHash === hash) return;
    this.currentHash = hash;
    
    // Find route handler
    const path = hash.replace('#', '');
    const route = this.routes[path] || this.routes['/home'];
    
    // Call callback
    let allowed = true;
    if (this.onRoute) {
      allowed = await this.onRoute(path, route);
    }
    
    if (allowed === false) {
      document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
      const gate = document.getElementById('page-gate');
      if (gate) gate.classList.remove('hidden');
      return;
    }

    const gate = document.getElementById('page-gate');
    if (gate) gate.classList.add('hidden');

    // Transition UI
    this.transitionPage(route.id);
  }
  
  navigate(path) {
    window.location.hash = path;
  }

  transitionPage(targetId) {
    // Hide all pages
    document.querySelectorAll('.page-section').forEach(el => {
      el.classList.add('hidden');
    });
    
    // Show target
    const target = document.getElementById(targetId);
    if (target) {
      target.classList.remove('hidden');
      target.classList.add('page-pop');
      setTimeout(() => target.classList.remove('page-pop'), 300);
    }
    
    // Update active nav rail item
    document.querySelectorAll('[data-nav]').forEach(item => {
      item.classList.remove('nav-active');
      if (item.getAttribute('href') === window.location.hash) {
        item.classList.add('nav-active');
      }
    });
  }
}
