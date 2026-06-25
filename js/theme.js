//  THEME
// ============================================================
const THEMES = ['light', 'dark', 'purple', 'blue', 'emerald', 'rose', 'amber'];
const THEME_LABELS = ['Light', 'Dark', 'Purple', 'Blue', 'Emerald', 'Rose', 'Amber'];
const THEME_DOTS = ['#e2e8f0', '#1e293b', '#7c3aed', '#3b82f6', '#10b981', '#e11d48', '#f59e0b'];

function applyTheme(theme) {
document.body.className = '';
if (theme === 'light') {
    document.body.classList.remove('theme-dark');
} else if (theme === 'dark') {
    document.body.classList.add('theme-dark');
} else {
    document.body.classList.add(`theme-${theme}`);
}
state.theme = theme;
saveState();
}

function getTheme() { return state.theme || 'light'; }
