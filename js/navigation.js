// ============================================================
//  NAVIGATION DRAWER & SETTINGS FUNCTIONALITY
// ============================================================

let currentPage = 'home';
let userSettings = {
    fullName: '',
    age: '',
    targetExam: 'SBI PO',
    customExam: '',
    interests: {
        quant: false,
        reasoning: false,
        english: false,
        ga: false,
        currentAffairs: false,
        computer: false
    }
};

// Initialize navigation after components are loaded
function initNavigation() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navDrawer = document.getElementById('navDrawer');
    const navDrawerOverlay = document.getElementById('navDrawerClose');
    const navDrawerOverlayBg = document.getElementById('navDrawerOverlay');
    const navMenuItems = document.querySelectorAll('.nav-menu-item');

    // Load settings from localStorage
    loadUserSettings();

    // Toggle drawer
    hamburgerBtn.addEventListener('click', toggleDrawer);
    navDrawerOverlayBg.addEventListener('click', closeDrawer);
    document.getElementById('navDrawerClose').addEventListener('click', closeDrawer);

    // Navigation menu clicks
    navMenuItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const page = this.dataset.page;
            navigateToPage(page);
            closeDrawer();
        });
    });

    // Update user info in drawer
    updateNavUserInfo();

    // Initialize settings page events
    initSettingsPage();

    // Initialize about page back button
    const aboutBackBtn = document.getElementById('aboutBackBtn');
    if (aboutBackBtn) {
        aboutBackBtn.addEventListener('click', () => {
            document.getElementById('aboutPage').classList.remove('active');
            navigateToPage('home');
        });
    }
}

function toggleDrawer() {
    const drawer = document.getElementById('navDrawer');
    const overlay = document.getElementById('navDrawerOverlay');
    const hamburgerBtn = document.getElementById('hamburgerBtn');

    drawer.classList.toggle('open');
    overlay.classList.toggle('show');
    hamburgerBtn.classList.toggle('active');
}

function closeDrawer() {
    const drawer = document.getElementById('navDrawer');
    const overlay = document.getElementById('navDrawerOverlay');
    const hamburgerBtn = document.getElementById('hamburgerBtn');

    drawer.classList.remove('open');
    overlay.classList.remove('show');
    hamburgerBtn.classList.remove('active');
}

function navigateToPage(page) {
    currentPage = page;

    // Update active state
    document.querySelectorAll('.nav-menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Show/hide settings page
    const settingsPage = document.getElementById('settingsPage');
    const aboutPage = document.getElementById('aboutPage');
    const dashboard = document.getElementById('dashboard');

    if (page === 'settings') {
        loadSettingsForm();
        settingsPage.classList.add('active');
        aboutPage.classList.remove('active');
    } else if (page === 'about') {
        aboutPage.classList.add('active');
        settingsPage.classList.remove('active');
    } else {
        settingsPage.classList.remove('active');
        aboutPage.classList.remove('active');
    }

    // Scroll to section if on dashboard
    if (page === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (page === 'achievements') {
        scrollToSection('achieveGrid');
    } else if (page === 'subjects') {
        scrollToSection('subjectGrid');
    } else if (page === 'course') {
        scrollToSection('courseAccordion');
    } else if (page === 'leaderboard') {
        scrollToSection('leaderboardContainer');
    }
}

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function updateNavUserInfo() {
    const navUserName = document.getElementById('navUserName');
    const navUserEmail = document.getElementById('navUserEmail');

    if (currentUser && !isGuest) {
        navUserName.textContent = currentUser.username || 'User';
        navUserEmail.textContent = currentUser.email || (currentUser.role ? `Role: ${currentUser.role}` : 'Logged in');
    } else {
        navUserName.textContent = 'Guest User';
        navUserEmail.textContent = 'Not logged in';
    }
}

// ============================================================
//  SETTINGS PAGE
// ============================================================

function initSettingsPage() {
    const settingsBackBtn = document.getElementById('settingsBackBtn');
    const settingsSaveBtn = document.getElementById('settingsSaveBtn');
    const settingsResetBtn = document.getElementById('settingsResetBtn');
    const settingsTargetExam = document.getElementById('settingsTargetExam');
    const customExamField = document.querySelector('.custom-exam-field');

    if (settingsBackBtn) {
        settingsBackBtn.addEventListener('click', () => {
            document.getElementById('settingsPage').classList.remove('active');
            navigateToPage('home');
        });
    }

    if (settingsTargetExam) {
        settingsTargetExam.addEventListener('change', function () {
            customExamField.style.display = this.value === 'Custom' ? 'block' : 'none';
        });
    }

    if (settingsSaveBtn) {
        settingsSaveBtn.addEventListener('click', saveSettings);
    }

    if (settingsResetBtn) {
        settingsResetBtn.addEventListener('click', resetSettings);
    }
}

function loadUserSettings() {
    const stored = localStorage.getItem('quant_tracker_user_settings');
    if (stored) {
        try {
            userSettings = JSON.parse(stored);
        } catch (_) { }
    }
}

function loadSettingsForm() {
    const settingsUsername = document.getElementById('settingsUsername');
    const settingsFullName = document.getElementById('settingsFullName');
    const settingsAge = document.getElementById('settingsAge');
    const settingsTelegramUsername = document.getElementById('settingsTelegramUsername');
    const settingsTelegramId = document.getElementById('settingsTelegramId');
    const settingsTargetExam = document.getElementById('settingsTargetExam');
    const settingsCustomExam = document.getElementById('settingsCustomExam');
    const customExamField = document.querySelector('.custom-exam-field');

    // Load user profile data
    if (currentUser && !isGuest) {
        settingsUsername.value = currentUser.username || '';
        settingsTelegramUsername.value = currentUser.email || 'Not linked';
        settingsTelegramId.value = currentUser.role || 'user';
    } else {
        settingsUsername.value = '';
        settingsTelegramUsername.value = 'Not linked';
        settingsTelegramId.value = 'Not linked';
    }

    // Load saved settings
    settingsFullName.value = userSettings.fullName || '';
    settingsAge.value = userSettings.age || '';
    settingsTargetExam.value = userSettings.targetExam || 'SBI PO';
    settingsCustomExam.value = userSettings.customExam || '';

    // Show/hide custom exam field
    if (settingsTargetExam.value === 'Custom') {
        customExamField.style.display = 'block';
    } else {
        customExamField.style.display = 'none';
    }

    // Load interests
    document.getElementById('interestQuant').checked = userSettings.interests?.quant || false;
    document.getElementById('interestReasoning').checked = userSettings.interests?.reasoning || false;
    document.getElementById('interestEnglish').checked = userSettings.interests?.english || false;
    document.getElementById('interestGA').checked = userSettings.interests?.ga || false;
    document.getElementById('interestCurrentAffairs').checked = userSettings.interests?.currentAffairs || false;
    document.getElementById('interestComputer').checked = userSettings.interests?.computer || false;
}

async function saveSettings() {
    userSettings = {
        fullName: document.getElementById('settingsFullName').value.trim(),
        age: document.getElementById('settingsAge').value,
        targetExam: document.getElementById('settingsTargetExam').value,
        customExam: document.getElementById('settingsCustomExam').value.trim(),
        interests: {
            quant: document.getElementById('interestQuant').checked,
            reasoning: document.getElementById('interestReasoning').checked,
            english: document.getElementById('interestEnglish').checked,
            ga: document.getElementById('interestGA').checked,
            currentAffairs: document.getElementById('interestCurrentAffairs').checked,
            computer: document.getElementById('interestComputer').checked
        }
    };

    localStorage.setItem('quant_tracker_user_settings', JSON.stringify(userSettings));

    if (currentUser?.id && isSupabaseConfigured()) {
        const client = requireSupabaseClient();
        const { error } = await client
            .from('profiles')
            .update({ full_name: userSettings.fullName || null })
            .eq('id', currentUser.id);
        if (!error) await refreshCurrentProfile().catch(() => { });
    }

    // Update examName in state if different
    const newExamName = userSettings.targetExam === 'Custom' ? userSettings.customExam : userSettings.targetExam;
    if (newExamName && newExamName !== state.examName) {
        state.examName = newExamName;
        saveState();
        renderAll();
    }

    showToast('Profile updated successfully!', 'success');
}

function resetSettings() {
    document.getElementById('settingsFullName').value = '';
    document.getElementById('settingsAge').value = '';
    document.getElementById('settingsTargetExam').value = 'SBI PO';
    document.getElementById('settingsCustomExam').value = '';
    document.querySelector('.custom-exam-field').style.display = 'none';

    document.getElementById('interestQuant').checked = false;
    document.getElementById('interestReasoning').checked = false;
    document.getElementById('interestEnglish').checked = false;
    document.getElementById('interestGA').checked = false;
    document.getElementById('interestCurrentAffairs').checked = false;
    document.getElementById('interestComputer').checked = false;

    showToast('Settings reset to defaults', 'info');
}
