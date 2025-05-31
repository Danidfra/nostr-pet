/**
 * Theme Manager
 * Handles automatic theme detection and manual theme switching
 * Supports: auto (system preference), light, dark
 */

class ThemeManager {
  constructor() {
    this.currentTheme = 'auto';
    this.storageKey = 'theme-preference';
    this.body = document.body;
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    this.init();
  }

  init() {
    // Load saved preference or default to auto
    const saved = localStorage.getItem(this.storageKey);
    if (saved && ['auto', 'light', 'dark'].includes(saved)) {
      this.currentTheme = saved;
    }

    // Apply initial theme
    this.applyTheme();

    // Listen for system theme changes
    this.mediaQuery.addEventListener('change', () => {
      if (this.currentTheme === 'auto') {
        this.updateThemeClasses();
      }
    });
  }

  applyTheme() {
    this.updateThemeClasses();
    this.savePreference();
  }

  updateThemeClasses() {
    // Remove existing theme classes
    this.body.classList.remove('theme-light', 'theme-dark');

    if (this.currentTheme === 'light') {
      this.body.classList.add('theme-light');
    } else if (this.currentTheme === 'dark') {
      this.body.classList.add('theme-dark');
    }
    // For 'auto', let CSS media queries handle it
  }

  setTheme(theme) {
    if (!['auto', 'light', 'dark'].includes(theme)) {
      console.warn('Invalid theme:', theme);
      return;
    }

    this.currentTheme = theme;
    this.applyTheme();
    
    // Dispatch custom event for other components to listen to
    window.dispatchEvent(new CustomEvent('themechange', {
      detail: { theme: this.currentTheme }
    }));
  }

  toggleTheme() {
    const themes = ['auto', 'light', 'dark'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    this.setTheme(themes[nextIndex]);
  }

  getTheme() {
    return this.currentTheme;
  }

  getEffectiveTheme() {
    if (this.currentTheme === 'auto') {
      return this.mediaQuery.matches ? 'dark' : 'light';
    }
    return this.currentTheme;
  }

  savePreference() {
    localStorage.setItem(this.storageKey, this.currentTheme);
  }

  // Utility method to get theme icon
  getThemeIcon() {
    switch (this.currentTheme) {
      case 'light': return '☀️';
      case 'dark': return '🌙';
      case 'auto': return '🔄';
      default: return '🔄';
    }
  }

  // Utility method to get theme label
  getThemeLabel() {
    switch (this.currentTheme) {
      case 'light': return 'Light Mode';
      case 'dark': return 'Dark Mode';
      case 'auto': return 'Auto (System)';
      default: return 'Auto (System)';
    }
  }
}

/**
 * Theme Toggle Component
 * Creates a theme toggle button with proper accessibility
 */
class ThemeToggle {
  constructor(container, themeManager) {
    this.container = container;
    this.themeManager = themeManager;
    this.button = null;
    
    this.createButton();
    this.updateButton();
    
    // Listen for theme changes
    window.addEventListener('themechange', () => {
      this.updateButton();
    });

    // Listen for system theme changes when in auto mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.themeManager.getTheme() === 'auto') {
        this.updateButton();
      }
    });
  }

  createButton() {
    this.button = document.createElement('button');
    this.button.className = 'theme-toggle';
    this.button.setAttribute('aria-label', 'Toggle theme');
    this.button.style.cssText = `
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-medium);
      border-radius: 50%;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1.25rem;
      transition: all var(--transition-normal);
      box-shadow: 0 2px 8px var(--shadow-light);
    `;

    this.button.addEventListener('click', () => {
      this.themeManager.toggleTheme();
    });

    this.button.addEventListener('mouseenter', () => {
      this.button.style.backgroundColor = 'var(--bg-tertiary)';
      this.button.style.boxShadow = '0 4px 12px var(--shadow-medium)';
    });

    this.button.addEventListener('mouseleave', () => {
      this.button.style.backgroundColor = 'var(--bg-secondary)';
      this.button.style.boxShadow = '0 2px 8px var(--shadow-light)';
    });

    this.container.appendChild(this.button);
  }

  updateButton() {
    if (!this.button) return;

    const icon = this.themeManager.getThemeIcon();
    const label = this.themeManager.getThemeLabel();
    
    this.button.textContent = icon;
    this.button.setAttribute('aria-label', `Current: ${label}. Click to change theme.`);
    this.button.setAttribute('title', label);
  }
}

/**
 * Initialize theme system
 * Call this when your page loads
 */
function initializeTheme() {
  const themeManager = new ThemeManager();
  
  // Create theme toggle if container exists
  const toggleContainer = document.querySelector('.theme-toggle-container') || document.body;
  if (toggleContainer) {
    new ThemeToggle(toggleContainer, themeManager);
  }

  return themeManager;
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTheme);
} else {
  initializeTheme();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThemeManager, ThemeToggle, initializeTheme };
}