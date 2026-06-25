//  HELPERS
// ============================================================
function formatDate(d) {
const dd = String(d.getDate()).padStart(2, '0');
const mm = String(d.getMonth() + 1).padStart(2, '0');
const yyyy = d.getFullYear();
return `${dd}-${mm}-${yyyy}`;
}
function parseDate(str) {
if (!str) return new Date();
const parts = str.split('-');
if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function daysBetween(a, b) {
const d1 = parseDate(a); d1.setHours(0, 0, 0, 0);
const d2 = parseDate(b); d2.setHours(0, 0, 0, 0);
return Math.round((d2 - d1) / 86400000);
}
function buildDays(startDate) {
const s = new Date(startDate);
return BASE_TOPICS.map((item, idx) => {
    const dt = addDays(s, idx);
    return {
        id: idx,
        day: idx + 1,
        date: formatDate(dt),
        topic: item.topic,
        videos: item.v,
        files: item.f,
        phase: item.phase,
        status: 'todo',
        score: '',
        plannedHours: (item.v * 0.75 + item.f * 0.5).toFixed(1),
        actualHours: 0,
        accuracy: null
    };
});
}

// ============================================================

// ============================================================
//  TOAST
// ============================================================
function showToast(message, type = 'info') {
const container = document.getElementById('toastContainer');
const icons = { success: '✅', error: '❌', info: 'ℹ️' };
const toast = document.createElement('div');
toast.className = `toast ${type}`;
toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span>${message}</span>
    <button class="toast-close">&times;</button>
`;
toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 350);
});
container.appendChild(toast);
setTimeout(() => {
    if (toast.parentNode) {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 350);
    }
}, 4000);
}

// ============================================================
//  EXPORT / IMPORT
// ============================================================
function exportData() {
const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    examName: state.examName,
    examDate: state.examDate,
    startDate: state.startDate,
    theme: state.theme,
    days: state.days,
    streak: state.streak,
    longestStreak: state.longestStreak,
    lastStudyDate: state.lastStudyDate,
    achievements: state.achievements,
    heatmap: state.heatmap,
    scoreHistory: state.scoreHistory,
    studySessions: state.studySessions,
    revisionTracker: state.revisionTracker
};
const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'quant-tracker-backup.json';
a.click();
showToast('Data exported! 📦', 'success');
}

function importData(file) {
const reader = new FileReader();
reader.onload = function(e) {
    try {
        const data = JSON.parse(e.target.result);
        if (data.days && data.days.length === BASE_TOPICS.length) {
            state.examName = data.examName || state.examName;
            state.examDate = data.examDate || state.examDate;
            state.startDate = data.startDate || state.startDate;
            state.theme = data.theme || state.theme;
            state.days = data.days;
            state.streak = data.streak || 0;
            state.longestStreak = data.longestStreak || 0;
            state.lastStudyDate = data.lastStudyDate || null;
            state.achievements = data.achievements || state.achievements;
            state.heatmap = data.heatmap || {};
            state.scoreHistory = data.scoreHistory || [];
            state.studySessions = data.studySessions || [];
            state.revisionTracker = data.revisionTracker || {};
            saveState();
            renderAll();
            showToast('Import successful! 🎉', 'success');
        } else {
            showToast('Invalid file format.', 'error');
        }
    } catch (_) {
        showToast('Error reading file.', 'error');
    }
};
reader.readAsText(file);
}

// ============================================================
//  MODAL
// ============================================================
let modalCallback = null;
function openModal(title, bodyHTML, callback) {
document.getElementById('modalTitle').textContent = title;
document.getElementById('modalBody').innerHTML = bodyHTML;
modalCallback = callback;
document.getElementById('modalOverlay').classList.add('show');
}
document.getElementById('modalCancel').addEventListener('click', () => {
document.getElementById('modalOverlay').classList.remove('show');
});
document.getElementById('modalConfirm').addEventListener('click', () => {
if (modalCallback) modalCallback();
document.getElementById('modalOverlay').classList.remove('show');
});
document.getElementById('modalOverlay').addEventListener('click', (e) => {
if (e.target === e.currentTarget) document.getElementById('modalOverlay').classList.remove('show');
});
