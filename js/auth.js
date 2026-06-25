//  AUTH WITH SUPABASE
// ============================================================
const authOverlay = document.getElementById('authOverlay');
const authError = document.getElementById('authError');
const authUsername = document.getElementById('authUsername');
const authPassword = document.getElementById('authPassword');
const authSubmit = document.getElementById('authSubmit');
const authSwitchText = document.getElementById('authSwitchText');
const authSwitchLink = document.getElementById('authSwitchLink');
const guestLink = document.getElementById('guestModeLink');
const authHeaderBtn = document.getElementById('authHeaderBtn');
const logoutHeaderBtn = document.getElementById('logoutHeaderBtn');
const userStatus = document.getElementById('userStatus');

const regState = { telegramId: '', otpVerified: true, resendCountdown: 60, resendTimer: null };
const loginOtpState = { telegramId: '', resendCountdown: 60, resendTimer: null };
let isLogin = true;

async function authApi(endpoint, method = 'GET', data = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (jwtToken) headers.Authorization = `Bearer ${jwtToken}`;
    const options = { method, headers };
    if (data) options.body = JSON.stringify(data);

    const res = await fetch(endpoint, options);
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || result.message || 'Request failed');
    return result;
}

function setStatus(el, message, type = 'info') {
    if (!el) return;
    const colors = { success: 'var(--success)', error: 'var(--danger)', info: 'var(--text-secondary)' };
    el.textContent = message;
    el.style.color = colors[type] || colors.info;
}

async function setAuthSession(session, profile = null) {
    jwtToken = session?.access_token || null;
    currentUser = profile || null;
    isGuest = !session || !profile;

    if (jwtToken && currentUser) {
        localStorage.setItem('jwt', jwtToken);
        localStorage.setItem('user', JSON.stringify(currentUser));
        authOverlay.classList.remove('show');
        await logUserActivity('login').catch(() => { });
    } else {
        localStorage.removeItem('jwt');
        localStorage.removeItem('user');
    }

    updateAuthUI();
    if (typeof updateNavUserInfo === 'function') updateNavUserInfo();
}

function getTelegramPayload(identifier) {
    const value = identifier.trim();
    if (/^\d+$/.test(value)) return { telegramId: Number(value) };
    return null;
}

async function getEmailForIdentifier(identifier) {
    if (identifier.includes('@')) return identifier;
    const client = requireSupabaseClient();
    const { data, error } = await client.rpc('get_email_for_username', { input_username: identifier });
    if (error) throw error;
    if (!data) throw new Error('Username not found');
    return data;
}

async function finishLogin(session, fallbackName = 'User') {
    const profile = await refreshProfileForSession(session, fallbackName);
    await setAuthSession(session, profile);
    await loadFromCloud();
    renderAll();
}

async function refreshProfileForSession(session, fallbackName = 'User') {
    const client = requireSupabaseClient();
    const user = session.user;
    const { data: profile, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) throw error;
    if (!profile.is_active) {
        await client.auth.signOut();
        throw new Error('Your account has been suspended.');
    }

    await client
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

    return {
        id: user.id,
        email: user.email,
        username: profile.username || fallbackName,
        role: profile.role || 'user',
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        is_active: profile.is_active
    };
}

function setAuthMode(login) {
    isLogin = login;
    document.querySelectorAll('.auth-tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.authTab === (login ? 'login' : 'register'));
    });
    document.getElementById('loginForm').style.display = login ? 'block' : 'none';
    document.getElementById('registerForm').style.display = login ? 'none' : 'block';
    authSwitchText.textContent = login ? "Don't have an account?" : 'Already have an account?';
    authSwitchLink.textContent = login ? 'Register' : 'Login';
    setStatus(authError, '');
}

function goToStep(step) {
    document.querySelectorAll('#registerForm .step-content').forEach((el) => {
        el.classList.toggle('active', Number(el.dataset.step) === step);
    });
}

function getOtp(inputs) {
    return Array.from(inputs).map((i) => i.value).join('');
}

function wireOtpInputs(inputs) {
    inputs.forEach((input, idx) => {
        input.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '').slice(0, 1);
            this.classList.toggle('filled', this.value.length === 1);
            if (this.value && idx < inputs.length - 1) inputs[idx + 1].focus();
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace' && !this.value && idx > 0) {
                inputs[idx - 1].value = '';
                inputs[idx - 1].classList.remove('filled');
                inputs[idx - 1].focus();
            }
        });
        input.addEventListener('paste', function (e) {
            e.preventDefault();
            const digits = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, inputs.length);
            inputs.forEach((inp, i) => {
                inp.value = digits[i] || '';
                inp.classList.toggle('filled', Boolean(digits[i]));
            });
            inputs[Math.min(digits.length, inputs.length - 1)]?.focus();
        });
    });
}

function startTimer(stateObj, button, countdownEl) {
    stateObj.resendCountdown = 60;
    button.disabled = true;
    countdownEl.textContent = stateObj.resendCountdown;
    if (stateObj.resendTimer) clearInterval(stateObj.resendTimer);
    stateObj.resendTimer = setInterval(() => {
        stateObj.resendCountdown -= 1;
        countdownEl.textContent = stateObj.resendCountdown;
        if (stateObj.resendCountdown <= 0) {
            clearInterval(stateObj.resendTimer);
            button.disabled = false;
            countdownEl.textContent = '0';
        }
    }, 1000);
}

async function handleAuth() {
    const identifier = authUsername.value.trim();
    const password = authPassword.value.trim();
    if (!identifier || !password) {
        setStatus(authError, 'Please enter username/email and password', 'error');
        return;
    }
    authSubmit.disabled = true;
    setStatus(authError, 'Logging in...', 'info');
    try {
        const client = requireSupabaseClient();
        const email = await getEmailForIdentifier(identifier);
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await finishLogin(data.session, identifier);
        showToast(`Welcome back, ${identifier}!`, 'success');
    } catch (err) {
        setStatus(authError, err.message, 'error');
    } finally {
        authSubmit.disabled = false;
    }
}

async function logout() {
    if (isSupabaseConfigured()) {
        const client = requireSupabaseClient();
        await logUserActivity('logout').catch(() => { });
        await client.auth.signOut().catch(() => { });
    }
    jwtToken = null;
    currentUser = null;
    isGuest = true;
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    state = getDefaultState();
    saveState();
    updateAuthUI();
    if (typeof updateNavUserInfo === 'function') updateNavUserInfo();
    renderAll();
    showToast('Logged out. Using guest mode.', 'info');
}

function updateAuthUI() {
    if (isGuest) {
        userStatus.textContent = 'Guest';
        authHeaderBtn.style.display = 'inline-flex';
        logoutHeaderBtn.style.display = 'none';
        authHeaderBtn.innerHTML = '<i class="fas fa-user"></i> Login';
        authHeaderBtn.onclick = () => { authOverlay.classList.add('show'); setAuthMode(true); };
    } else {
        const name = currentUser?.username || currentUser?.email || 'User';
        userStatus.textContent = currentUser?.role && currentUser.role !== 'user' ? `${name} · ${currentUser.role}` : String(name);
        authHeaderBtn.style.display = 'none';
        logoutHeaderBtn.style.display = 'inline-flex';
        logoutHeaderBtn.onclick = logout;
    }
}

function initAuthEvents() {
    document.querySelectorAll('.auth-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => setAuthMode(btn.dataset.authTab === 'login'));
    });
    document.querySelectorAll('.login-method-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.login-method-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.login-method-content').forEach((panel) => {
                panel.classList.toggle('active', panel.dataset.loginPanel === btn.dataset.loginMethod);
            });
        });
    });
    authSwitchLink.addEventListener('click', (e) => {
        e.preventDefault();
        setAuthMode(!isLogin);
    });
    authSubmit.addEventListener('click', handleAuth);
    authPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAuth(); });
    guestLink.addEventListener('click', () => {
        authOverlay.classList.remove('show');
        isGuest = true;
        loadState();
        updateAuthUI();
        renderAll();
        showToast('Using guest mode (local storage)', 'info');
    });

    initRegisterEvents();
    initTelegramLoginEvents();
    initForgotPassword();
}

function initRegisterEvents() {
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const otpStatus = document.getElementById('otpStatus');
    const otpInputs = document.querySelectorAll('.otp-input');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const otpVerifyStatus = document.getElementById('otpVerifyStatus');
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    const resendCountdown = document.getElementById('resendCountdown');
    const usernameInput = document.getElementById('usernameInput');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const registerBtn = document.getElementById('registerBtn');
    const registerStatus = document.getElementById('registerStatus');
    const strengthBar = document.getElementById('strengthBar');
    const reqLength = document.getElementById('reqLength');
    const reqUpper = document.getElementById('reqUpper');
    const reqNumber = document.getElementById('reqNumber');

    wireOtpInputs(otpInputs);

    sendOtpBtn.addEventListener('click', () => {
        regState.otpVerified = true;
        setStatus(otpStatus, 'Supabase email/password registration is enabled. Continue to account details.', 'success');
        goToStep(3);
        startTimer(regState, resendOtpBtn, resendCountdown);
    });

    verifyOtpBtn.addEventListener('click', () => {
        regState.otpVerified = true;
        setStatus(otpVerifyStatus, 'Verified. Set your password.', 'success');
        goToStep(3);
    });

    resendOtpBtn.addEventListener('click', () => {
        setStatus(otpVerifyStatus, 'Supabase handles account verification by email.', 'info');
        startTimer(regState, resendOtpBtn, resendCountdown);
    });

    function checkPasswordStrength(password) {
        const hasLength = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        reqLength.classList.toggle('met', hasLength);
        reqUpper.classList.toggle('met', hasUpper);
        reqNumber.classList.toggle('met', hasNumber);
        const score = [hasLength, hasUpper, hasNumber].filter(Boolean).length;
        strengthBar.className = 'strength-bar';
        if (score === 1) strengthBar.classList.add('weak');
        if (score === 2) strengthBar.classList.add('medium');
        if (score === 3) strengthBar.classList.add('strong');
        return score === 3;
    }

    passwordInput.addEventListener('input', () => checkPasswordStrength(passwordInput.value));
    registerBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!username) return setStatus(registerStatus, 'Please enter a username', 'error');
        if (!email || !email.includes('@')) return setStatus(registerStatus, 'Please enter a valid email', 'error');
        if (!checkPasswordStrength(password)) return setStatus(registerStatus, 'Password does not meet requirements', 'error');
        if (password !== confirmPasswordInput.value) return setStatus(registerStatus, 'Passwords do not match', 'error');

        registerBtn.disabled = true;
        setStatus(registerStatus, 'Creating account...', 'info');
        try {
            const client = requireSupabaseClient();
            const { data, error } = await client.auth.signUp({
                email,
                password,
                options: { data: { username } }
            });
            if (error) throw error;
            if (!data.session) {
                setStatus(registerStatus, 'Account created. Check your email to confirm your login.', 'success');
                return;
            }
            await finishLogin(data.session, username);
            showToast('Registration successful!', 'success');
        } catch (err) {
            setStatus(registerStatus, err.message, 'error');
        } finally {
            registerBtn.disabled = false;
        }
    });
}

function initTelegramLoginEvents() {
    const loginTelegramIdInput = document.getElementById('loginTelegramIdInput');
    const loginSendOtpBtn = document.getElementById('loginSendOtpBtn');
    const loginOtpInputs = document.querySelectorAll('.login-otp-input');
    const loginVerifyOtpBtn = document.getElementById('loginVerifyOtpBtn');
    const loginOtpStatus = document.getElementById('loginOtpStatus');
    const loginResendOtpBtn = document.getElementById('loginResendOtpBtn');
    const loginResendCountdown = document.getElementById('loginResendCountdown');

    wireOtpInputs(loginOtpInputs);

    loginSendOtpBtn.addEventListener('click', () => {
        loginOtpState.telegramId = loginTelegramIdInput.value.trim();
        setStatus(loginOtpStatus, 'Telegram OTP requires a Supabase Edge Function or bot backend. Use email login for now.', 'info');
        startTimer(loginOtpState, loginResendOtpBtn, loginResendCountdown);
    });

    loginVerifyOtpBtn.addEventListener('click', () => {
        setStatus(loginOtpStatus, 'Use username/email login with Supabase authentication.', 'info');
    });

    loginResendOtpBtn.addEventListener('click', () => {
        setStatus(loginOtpStatus, 'Telegram OTP backend is not configured in this static integration.', 'info');
        startTimer(loginOtpState, loginResendOtpBtn, loginResendCountdown);
    });
}

function initForgotPassword() {
    document.getElementById('forgotPasswordLink').addEventListener('click', () => {
        openModal('Reset Password', `
            <label for="resetEmailInput">Email address</label>
            <input type="email" id="resetEmailInput" placeholder="Enter your account email" />
            <button class="btn-primary" id="resetPasswordBtn" style="width:100%; margin-top:8px;">Send Reset Link</button>
            <div id="resetStatus" style="margin-top:8px; font-size:0.85rem;"></div>
        `, () => { });
        setTimeout(() => {
            const resetStatus = document.getElementById('resetStatus');
            document.getElementById('resetPasswordBtn').addEventListener('click', async () => {
                const email = document.getElementById('resetEmailInput').value.trim();
                if (!email || !email.includes('@')) return setStatus(resetStatus, 'Please enter a valid email', 'error');
                try {
                    const client = requireSupabaseClient();
                    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
                    if (error) throw error;
                    setStatus(resetStatus, 'Password reset link sent to your email.', 'success');
                } catch (err) {
                    setStatus(resetStatus, err.message, 'error');
                }
            });
        }, 0);
    });
}

async function initAuth() {
    initAuthEvents();

    if (!isSupabaseConfigured()) {
        authOverlay.classList.add('show');
        setAuthMode(true);
        updateAuthUI();
        return;
    }

    const client = requireSupabaseClient();
    const { data } = await client.auth.getSession();
    if (data.session) {
        try {
            await finishLogin(data.session, data.session.user.email || 'User');
        } catch (err) {
            console.warn('Session restore failed:', err.message);
            await logout();
        }
    } else {
        authOverlay.classList.add('show');
        setAuthMode(true);
    }

    client.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session && (!currentUser || currentUser.id !== session.user.id)) {
            await finishLogin(session, session.user.email || 'User').catch((err) => console.warn(err.message));
        }
        if (event === 'SIGNED_OUT') {
            jwtToken = null;
            currentUser = null;
            isGuest = true;
            updateAuthUI();
        }
    });

    updateAuthUI();
}
