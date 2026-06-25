// ============================================================
//  COMPONENT AND SCRIPT BOOTSTRAP
// ============================================================
const COMPONENTS = [
    ['auth', 'components/auth.html'],
    ['header', 'components/header.html'],
    ['dashboard', 'components/dashboard.html'],
    ['mission-card', 'components/mission-card.html'],
    ['countdown-card', 'components/countdown-card.html'],
    ['streak-card', 'components/streak-card.html'],
    ['readiness-card', 'components/readiness-card.html'],
    ['progress-ring', 'components/progress-ring.html'],
    ['insight-card', 'components/insight-card.html'],
    ['io-bar', 'components/io-bar.html'],
    ['footer', 'components/footer.html'],
    ['settings-page', 'components/settings-page.html']
];

const SCRIPTS = [
    'js/config.js',
    'js/supabase.js',
    'js/supabase-services.js',
    'js/data.js',
    'js/utils.js',
    'js/theme.js',
    'js/state.js',
    'js/auth.js',
    'js/render.js',
    'js/navigation.js'
];

async function loadComponents() {
    for (const [id, url] of COMPONENTS) {
        const host = document.getElementById(id);
        if (!host) continue;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load ${url}`);
        host.innerHTML = await response.text();
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.body.appendChild(script);
    });
}

function bindEvents() {
    // ============================================================
    //  EVENTS
    // ============================================================
    function openExamDetailsModal() {
        const presets = ['SBI PO', 'SSC CGL', 'Railway', 'IBPS PO', 'IBPS Clerk', 'SBI Clerk', 'Other'];
        const currentName = state.examName || 'SBI PO';
        const currentDate = state.examDate || '2026-08-01';
        let optionsHtml = presets.map(p => `<option value="${p}" ${p === currentName ? 'selected' : ''}>${p}</option>`).join('');
        openModal('Set Exam Details', `
        <label for="modalExamSelect">Exam Name</label>
        <select id="modalExamSelect" style="margin-bottom:8px;">
            ${optionsHtml}
        </select>
        <input type="text" id="modalExamName" placeholder="Or type custom name" style="display:none; margin-bottom:14px;" />
        <label for="modalExamDate">Exam Date</label>
        <input type="date" id="modalExamDate" value="${currentDate}" />
    `, () => {
            const selectVal = document.getElementById('modalExamSelect').value;
            const customVal = document.getElementById('modalExamName').value.trim();
            const dateVal = document.getElementById('modalExamDate').value;
            if (!dateVal) { showToast('Please select a valid exam date.', 'error'); return; }
            const newDate = new Date(dateVal);
            if (isNaN(newDate)) { showToast('Invalid exam date.', 'error'); return; }
            state.examName = (selectVal === 'Other' && customVal) ? customVal : (selectVal !== 'Other' ? selectVal : state.examName);
            state.examDate = dateVal;
            saveState();
            renderAll();
            showToast('Exam details updated! 📅', 'success');
        });
        const select = document.getElementById('modalExamSelect');
        const customInput = document.getElementById('modalExamName');
        select.addEventListener('change', function () {
            customInput.style.display = this.value === 'Other' ? 'block' : 'none';
        });
    }

    document.getElementById('editExamDateBtn').addEventListener('click', openExamDetailsModal);
    document.getElementById('countdownLabel').addEventListener('click', openExamDetailsModal);

    document.getElementById('setStartDateBtn').addEventListener('click', () => {
        const current = state.startDate ? parseDate(state.startDate) : new Date(2026, 5, 22);
        const val = current.toISOString().split('T')[0];
        openModal('Set Start Date', `
        <label for="modalStartDate">Start Date</label>
        <input type="date" id="modalStartDate" value="${val}" />
        <p style="font-size:0.7rem; color:var(--text-muted);">This will rebuild the schedule from the selected date.</p>
    `, () => {
            const dateVal = document.getElementById('modalStartDate').value;
            if (!dateVal) { showToast('Please select a valid start date.', 'error'); return; }
            const newStart = new Date(dateVal);
            if (isNaN(newStart)) { showToast('Invalid start date.', 'error'); return; }
            openModal('Confirm Start Date Change', `
            <p style="font-size:0.85rem; color:var(--text-secondary); line-height:1.5; margin-bottom:10px;">
                Do you really want to change your preparation start date?
            </p>
            <p style="font-size:0.8rem; color:var(--text-secondary); line-height:1.5; margin-bottom:8px;">
                If you are a fresher and restarting your preparation, you may continue.
            </p>
            <p style="font-size:0.8rem; color:var(--text-secondary); line-height:1.5; margin-bottom:8px;">
                If you are already in the middle of your preparation journey, changing the start date may affect:
            </p>
            <ul style="font-size:0.78rem; color:var(--text-secondary); line-height:1.6; padding-left:20px; margin-bottom:8px;">
                <li>Progress Tracking</li>
                <li>Streak Calculations</li>
                <li>Analytics</li>
            </ul>
            <p style="font-size:0.78rem; color:var(--text-muted); line-height:1.5;">
                Instead, consider using Snooze Mode to pause tracking while preserving your progress.
            </p>
        `, () => {
                state.days = buildDays(newStart);
                state.startDate = formatDate(newStart);
                saveState();
                renderAll();
                showToast('Start date updated! Schedule rebuilt 🔄', 'success');
            });
        });
    });

    document.getElementById('resetScheduleBtn').addEventListener('click', () => {
        if (confirm('Reset schedule to original? Progress will be kept, dates will reset.')) {
            const start = parseDate(state.startDate);
            state.days = buildDays(start);
            saveState();
            renderAll();
            showToast('Schedule reset! 🔄', 'info');
        }
    });

    document.getElementById('themeTriggerBtn').addEventListener('click', () => {
        const current = getTheme();
        const options = THEMES.map((t, i) => `
        <div class="theme-option ${t === current ? 'active' : ''}" data-theme="${t}">
            <span class="dot" style="background:${THEME_DOTS[i]};"></span> ${THEME_LABELS[i]}
        </div>
    `).join('');
        openModal('Choose Theme', `<div class="theme-grid">${options}</div><p style="font-size:0.7rem;color:var(--text-muted);">Click to preview, then Save.</p>`, () => {
            const active = document.querySelector('.theme-option.active');
            if (active) { applyTheme(active.dataset.theme); showToast(`Theme: ${active.textContent.trim()} 🎨`, 'success'); }
        });
        document.querySelectorAll('.theme-option').forEach(el => {
            el.addEventListener('click', function () {
                document.querySelectorAll('.theme-option').forEach(e => e.classList.remove('active'));
                this.classList.add('active');
                const preview = this.dataset.theme;
                document.body.className = '';
                if (preview === 'light') document.body.classList.remove('theme-dark');
                else if (preview === 'dark') document.body.classList.add('theme-dark');
                else document.body.classList.add(`theme-${preview}`);
            });
        });
    });

    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', function (e) {
        if (this.files[0]) { importData(this.files[0]); this.value = ''; }
    });
}

// ============================================================
//  INIT
// ============================================================
function init() {
    loadState();
    applyTheme(getTheme());
    initAuth();
    fetchSettings();
    renderAll();
    initNavigation();
    setInterval(renderCountdown, 1000);
    showToast('Welcome to Quant Tracker! 🚀', 'info');
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) saveState();
    });
}

async function bootstrap() {
    await loadComponents();
    for (const src of SCRIPTS) await loadScript(src);
    bindEvents();
    window.renderAll = renderAll;
    init();
}

bootstrap().catch((error) => {
    console.error(error);
    document.body.insertAdjacentHTML('beforeend', '<p style="color:#ef4444; padding:16px;">Failed to initialize Quant Tracker.</p>');
});
