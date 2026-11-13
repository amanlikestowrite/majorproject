/**
 * Nyaya Sahayak — Citizen Authentication & Session Manager
 * Connects frontend to Express Gateway auth and guest endpoints.
 * Handles Google OAuth, Guest Sessions, and persistent session state.
 */

const AuthManager = (function () {
  'use strict';

  const STORAGE_KEYS = {
    AUTH_TOKEN: 'nyaya_auth_token',
    GUEST_TOKEN: 'nyaya_guest_token',
    SESSION_TYPE: 'nyaya_session_type', // 'user' | 'guest' | 'none'
    USER_DATA: 'nyaya_user_data',
    GUEST_DATA: 'nyaya_guest_data',
  };

  const state = {
    sessionType: 'none',
    user: null,
    guest: null,
    authToken: null,
    guestToken: null,
    isLoading: false,
  };

  function getBaseUrl() {
    if (window.NYAYA_API_BASE_URL) {
      return window.NYAYA_API_BASE_URL.replace(/\/+$/, '');
    }
    // If served directly by Express gateway on port 3000, use relative paths
    if (window.location.port === '3000' || window.location.hostname === 'localhost' && window.location.port === '3000') {
      return '';
    }
    // Otherwise fallback to local gateway port 3000
    return 'http://127.0.0.1:3000';
  }

  function getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (state.sessionType === 'user' && state.authToken) {
      headers['Authorization'] = `Bearer ${state.authToken}`;
      headers['x-auth-token'] = state.authToken;
    } else if (state.sessionType === 'guest' && state.guestToken) {
      headers['x-guest-token'] = state.guestToken;
      headers['Authorization'] = `Bearer ${state.guestToken}`;
    }
    return headers;
  }

  async function checkExistingSession() {
    state.isLoading = true;
    const storedAuthToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const storedGuestToken = localStorage.getItem(STORAGE_KEYS.GUEST_TOKEN);

    // 1. Try restoring authenticated user session only if auth token exists in storage
    if (storedAuthToken) {
      try {
        const headers = {
          'Accept': 'application/json',
          'Authorization': `Bearer ${storedAuthToken}`,
          'x-auth-token': storedAuthToken,
        };

        const res = await fetch(`${getBaseUrl()}/api/auth/me`, {
          method: 'GET',
          headers,
          credentials: 'include',
        });

        if (res.ok) {
          const body = await res.json();
          if (body.status === 'success' && body.data) {
            state.sessionType = 'user';
            state.user = body.data;
            state.authToken = storedAuthToken;
            localStorage.setItem(STORAGE_KEYS.SESSION_TYPE, 'user');
            localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(body.data));
            updateNavbarUI();
            if (window.ConversationManager && typeof window.ConversationManager.fetchConversations === 'function') {
              window.ConversationManager.fetchConversations();
            }
            state.isLoading = false;
            return { type: 'user', user: body.data };
          }
        } else {
          // Token is revoked or invalid on server
          localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.USER_DATA);
        }
      } catch (err) {
        console.warn('Authentication check failed or server unreachable:', err.message);
      }
    }

    // 2. If no user session, try validating existing guest session
    if (storedGuestToken) {
      if (storedGuestToken.startsWith('local-guest-')) {
        const storedGuestData = localStorage.getItem(STORAGE_KEYS.GUEST_DATA);
        state.sessionType = 'guest';
        state.guestToken = storedGuestToken;
        state.guest = storedGuestData ? JSON.parse(storedGuestData) : { active: true, sessionId: 'local' };
        updateNavbarUI();
        if (window.ConversationManager && typeof window.ConversationManager.fetchConversations === 'function') {
          window.ConversationManager.fetchConversations();
        }
        state.isLoading = false;
        return { type: 'guest', guest: state.guest };
      }

      try {
        const res = await fetch(`${getBaseUrl()}/api/guest/session`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'x-guest-token': storedGuestToken,
            'Authorization': `Bearer ${storedGuestToken}`,
          },
          credentials: 'include',
        });

        if (res.ok) {
          const body = await res.json();
          if (body.status === 'success' && body.data && body.data.active) {
            state.sessionType = 'guest';
            state.guestToken = storedGuestToken;
            state.guest = body.data;
            localStorage.setItem(STORAGE_KEYS.SESSION_TYPE, 'guest');
            localStorage.setItem(STORAGE_KEYS.GUEST_DATA, JSON.stringify(body.data));
            updateNavbarUI();
            if (window.ConversationManager && typeof window.ConversationManager.fetchConversations === 'function') {
              window.ConversationManager.fetchConversations();
            }
            state.isLoading = false;
            return { type: 'guest', guest: body.data };
          }
        } else {
          // Token expired or invalid on server
          localStorage.removeItem(STORAGE_KEYS.GUEST_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.GUEST_DATA);
        }
      } catch (err) {
        console.warn('Guest session check failed:', err.message);
      }
    }

    state.sessionType = 'none';
    state.user = null;
    state.guest = null;
    localStorage.removeItem(STORAGE_KEYS.SESSION_TYPE);
    document.cookie = 'nyaya_auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax;';
    document.cookie = 'nyaya_guest_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax;';
    if (window.ConversationManager && typeof window.ConversationManager.clearState === 'function') {
      window.ConversationManager.clearState();
    }
    updateNavbarUI();
    state.isLoading = false;
    return { type: 'none' };
  }

  async function startGuestSession() {
    state.isLoading = true;
    try {
      // 1. Immediately wipe any user auth tokens, cookies, and chat state
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      document.cookie = 'nyaya_auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax;';

      // 2. Clear conversation sidebar immediately so old user conversations disappear
      if (window.ConversationManager && typeof window.ConversationManager.clearState === 'function') {
        window.ConversationManager.clearState();
      }

      // 3. Reset chat viewport so user doesn't see old conversation messages
      if (typeof window.resetToNewConversation === 'function') {
        window.resetToNewConversation(true);
      }

      let guestData = null;
      try {
        const res = await fetch(`${getBaseUrl()}/api/guest/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include',
        });

        if (res.ok) {
          const body = await res.json();
          if (body.status === 'success' && body.data) {
            guestData = body.data;
          }
        }
      } catch (networkErr) {
        console.warn('Backend guest endpoint error, falling back to local ephemeral guest mode:', networkErr.message);
      }

      // If backend database is offline or endpoint unavailable, provide local ephemeral guest session
      if (!guestData) {
        const localToken = 'local-guest-' + Math.random().toString(36).substring(2, 10) + Date.now();
        guestData = {
          token: localToken,
          sessionId: 'local-' + Date.now().toString(36),
          active: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
      }

      state.sessionType = 'guest';
      state.guestToken = guestData.token;
      state.guest = guestData;
      state.user = null;
      state.authToken = null;

      localStorage.setItem(STORAGE_KEYS.GUEST_TOKEN, guestData.token);
      localStorage.setItem(STORAGE_KEYS.GUEST_DATA, JSON.stringify(guestData));
      localStorage.setItem(STORAGE_KEYS.SESSION_TYPE, 'guest');
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);

      if (window.API && typeof window.API.setGuestToken === 'function') {
        window.API.setGuestToken(guestData.token, guestData.sessionId);
      }

      updateNavbarUI();
      if (window.ConversationManager && typeof window.ConversationManager.fetchConversations === 'function') {
        window.ConversationManager.fetchConversations();
      }
      if (window.UIInteractions && window.UIInteractions.showToast) {
        window.UIInteractions.showToast('Citizen Guest Mode activated (24h ephemeral session)');
      }
      return guestData;
    } catch (err) {
      if (window.UIInteractions && window.UIInteractions.showToast) {
        window.UIInteractions.showToast(err.message || 'Guest session error');
      }
      throw err;
    } finally {
      state.isLoading = false;
    }
  }

  async function loginWithGoogle(idToken) {
    if (!idToken || !idToken.trim()) {
      throw new Error('A valid Google ID token is required.');
    }
    state.isLoading = true;
    try {
      // Clean up any guest cookies or residual chat state
      document.cookie = 'nyaya_guest_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax;';
      if (window.ConversationManager && typeof window.ConversationManager.clearState === 'function') {
        window.ConversationManager.clearState();
      }
      if (typeof window.resetToNewConversation === 'function') {
        window.resetToNewConversation(true);
      }

      const res = await fetch(`${getBaseUrl()}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ idToken: idToken.trim() }),
      });

      const body = await res.json();
      if (!res.ok || body.status !== 'success') {
        throw new Error(body.message || 'Google authentication failed.');
      }

      const { user, session } = body.data;
      state.sessionType = 'user';
      state.user = user;
      state.authToken = session.token;
      state.guest = null;
      state.guestToken = null;

      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, session.token);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.SESSION_TYPE, 'user');
      localStorage.removeItem(STORAGE_KEYS.GUEST_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.GUEST_DATA);

      if (window.API && typeof window.API.setAuthToken === 'function') {
        window.API.setAuthToken(session.token);
      }

      updateNavbarUI();
      if (window.ConversationManager && typeof window.ConversationManager.fetchConversations === 'function') {
        window.ConversationManager.fetchConversations();
      }
      if (window.UIInteractions && window.UIInteractions.showToast) {
        window.UIInteractions.showToast(`Welcome, ${user.name || 'Citizen'}!`);
      }
      return user;
    } catch (err) {
      if (window.UIInteractions && window.UIInteractions.showToast) {
        window.UIInteractions.showToast(err.message || 'Sign in error');
      }
      throw err;
    } finally {
      state.isLoading = false;
    }
  }

  async function loginWithPassword(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }
    state.isLoading = true;
    try {
      // 1. Clean up any guest cookies or residual chat state
      document.cookie = 'nyaya_guest_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax;';
      if (window.ConversationManager && typeof window.ConversationManager.clearState === 'function') {
        window.ConversationManager.clearState();
      }
      if (typeof window.resetToNewConversation === 'function') {
        window.resetToNewConversation(true);
      }

      const res = await fetch(`${getBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const body = await res.json();
      if (!res.ok || body.status !== 'success') {
        throw new Error(body.message || 'Login failed. Please verify credentials.');
      }

      const { user, session } = body.data;
      state.sessionType = 'user';
      state.user = user;
      state.authToken = session.token;
      state.guest = null;
      state.guestToken = null;

      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, session.token);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.SESSION_TYPE, 'user');
      localStorage.removeItem(STORAGE_KEYS.GUEST_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.GUEST_DATA);

      if (window.API && typeof window.API.setAuthToken === 'function') {
        window.API.setAuthToken(session.token);
      }

      if (window.API && typeof window.API.setAuthToken === 'function') {
        window.API.setAuthToken(session.token);
      }

      updateNavbarUI();
      if (window.ConversationManager && typeof window.ConversationManager.fetchConversations === 'function') {
        window.ConversationManager.fetchConversations();
      }
      if (window.UIInteractions && window.UIInteractions.showToast) {
        window.UIInteractions.showToast();
      }
      return user;
    } catch (err) {
      if (window.UIInteractions && window.UIInteractions.showToast) {
        window.UIInteractions.showToast(err.message || 'Login error');
      }
      throw err;
    } finally {
      state.isLoading = false;
    }
  }

  async function registerWithPassword(email, password, name) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }
    state.isLoading = true;
    try {
      // 1. Clean up any guest cookies or residual chat state
      document.cookie = 'nyaya_guest_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax;';
      if (window.ConversationManager && typeof window.ConversationManager.clearState === 'function') {
        window.ConversationManager.clearState();
      }
      if (typeof window.resetToNewConversation === 'function') {
        window.resetToNewConversation(true);
      }

      const res = await fetch(`${getBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password, name: name ? name.trim() : null }),
      });

      const body = await res.json();
      if (!res.ok || body.status !== 'success') {
        throw new Error(body.message || 'Registration failed. Please try again.');
      }

      const { user, session } = body.data;
      state.sessionType = 'user';
      state.user = user;
      state.authToken = session.token;
      state.guest = null;
      state.guestToken = null;

      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, session.token);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.SESSION_TYPE, 'user');
      localStorage.removeItem(STORAGE_KEYS.GUEST_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.GUEST_DATA);

      if (window.API && typeof window.API.setAuthToken === 'function') {
        window.API.setAuthToken(session.token);
      }

      if (window.API && typeof window.API.setAuthToken === 'function') {
        window.API.setAuthToken(session.token);
      }

      updateNavbarUI();
      if (window.ConversationManager && typeof window.ConversationManager.fetchConversations === 'function') {
        window.ConversationManager.fetchConversations();
      }
      if (window.UIInteractions && window.UIInteractions.showToast) {
        window.UIInteractions.showToast();
      }
      return user;
    } catch (err) {
      if (window.UIInteractions && window.UIInteractions.showToast) {
        window.UIInteractions.showToast(err.message || 'Registration error');
      }
      throw err;
    } finally {
      state.isLoading = false;
    }
  }


  async function logout() {
    state.isLoading = true;
    try {
      if (state.sessionType === 'user') {
        const headers = { 'Accept': 'application/json' };
        if (state.authToken) {
          headers['Authorization'] = `Bearer ${state.authToken}`;
        }
        await fetch(`${getBaseUrl()}/api/auth/logout`, {
          method: 'POST',
          headers,
          credentials: 'include',
        });
      }
    } catch (err) {
      console.warn('Logout request warning:', err);
    } finally {
      state.sessionType = 'none';
      state.user = null;
      state.guest = null;
      state.authToken = null;
      state.guestToken = null;

      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.GUEST_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.SESSION_TYPE);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      localStorage.removeItem(STORAGE_KEYS.GUEST_DATA);

      if (window.API) {
        if (typeof window.API.setAuthToken === 'function') window.API.setAuthToken(null);
        if (typeof window.API.setGuestToken === 'function') window.API.setGuestToken(null);
      }

      // Expire cookies explicitly client-side
      document.cookie = 'nyaya_auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax;';
      document.cookie = 'nyaya_guest_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax;';

      // Clear active conversation ID and wipe chat stream messages
      if (typeof window.resetToNewConversation === 'function') {
        window.resetToNewConversation(true);
      } else {
        const stream = document.getElementById('chatStream');
        if (stream) {
          stream.innerHTML = '';
          stream.style.display = 'none';
        }
        const empty = document.getElementById('emptyState');
        if (empty) empty.style.display = 'block';
        window.activeConversationId = null;
      }

      // Clear conversation sidebar state
      if (window.ConversationManager && typeof window.ConversationManager.clearState === 'function') {
        window.ConversationManager.clearState();
      }

      updateNavbarUI();
      if (window.UIInteractions && window.UIInteractions.showToast) {
        window.UIInteractions.showToast('You have been logged out.');
      }
      state.isLoading = false;
    }
  }

  function updateNavbarUI() {
    const navGuestBtn = document.getElementById('navGuestBtn');
    const navLoginBtn = document.getElementById('navLoginBtn');
    const navUserWidget = document.getElementById('navUserWidget');
    const navUserAvatar = document.getElementById('navUserAvatar');
    const navUserName = document.getElementById('navUserName');
    const navSessionBadge = document.getElementById('navSessionBadge');

    if (!navUserWidget) return;

    if (state.sessionType === 'user' && state.user) {
      if (navGuestBtn) navGuestBtn.style.display = 'none';
      if (navLoginBtn) navLoginBtn.style.display = 'none';
      navUserWidget.style.display = 'inline-flex';

      const initial = (state.user.name || state.user.email || 'U').charAt(0).toUpperCase();
      if (navUserAvatar) {
        if (state.user.avatarUrl) {
          navUserAvatar.innerHTML = `<img src="${state.user.avatarUrl}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        } else {
          navUserAvatar.textContent = initial;
        }
      }
      if (navUserName) {
        navUserName.textContent = state.user.name || state.user.email || 'Citizen Account';
      }
      if (navSessionBadge) {
        navSessionBadge.textContent = 'Verified';
        navSessionBadge.className = 'navSessionBadge';
      }
    } else if (state.sessionType === 'guest' && state.guest) {
      if (navGuestBtn) navGuestBtn.style.display = 'none';
      if (navLoginBtn) navLoginBtn.style.display = 'inline-flex';
      navUserWidget.style.display = 'inline-flex';

      if (navUserAvatar) navUserAvatar.textContent = 'G';
      if (navUserName) navUserName.textContent = 'Guest Citizen';
      if (navSessionBadge) {
        navSessionBadge.textContent = 'Guest';
        navSessionBadge.className = 'navSessionBadge guestBadge';
      }
    } else {
      if (navGuestBtn) navGuestBtn.style.display = 'inline-flex';
      if (navLoginBtn) navLoginBtn.style.display = 'inline-flex';
      navUserWidget.style.display = 'none';
    }
  }

  const AuthModal = {
    open(tab = 'signin') {
      const backdrop = document.getElementById('authModalBackdrop');
      if (!backdrop) return;
      this.clearError();
      const st = state.sessionType;
      const tabBtnAccount = document.getElementById('tabBtnAccount');
      if (tabBtnAccount) {
        tabBtnAccount.style.display = (st !== 'none') ? 'inline-flex' : 'none';
      }
      if (st !== 'none' && tab === 'signin') {
        this.switchTab('account');
      } else {
        this.switchTab(tab);
      }
      backdrop.classList.add('active');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    },

    close() {
      const backdrop = document.getElementById('authModalBackdrop');
      if (!backdrop) return;
      backdrop.classList.remove('active');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      this.clearError();
    },

    switchTab(tabName) {
      const tabs = {
        signin: { btn: document.getElementById('tabBtnSignIn'), panel: document.getElementById('panelSignIn') },
        guest: { btn: document.getElementById('tabBtnGuest'), panel: document.getElementById('panelGuest') },
        account: { btn: document.getElementById('tabBtnAccount'), panel: document.getElementById('panelAccount') },
      };

      Object.values(tabs).forEach(t => {
        if (t.btn) {
          t.btn.classList.remove('active');
          t.btn.setAttribute('aria-selected', 'false');
        }
        if (t.panel) {
          t.panel.classList.remove('active');
        }
      });

      const target = tabs[tabName] || tabs.signin;
      if (target.btn) {
        target.btn.classList.add('active');
        target.btn.setAttribute('aria-selected', 'true');
      }
      if (target.panel) {
        target.panel.classList.add('active');
      }

      if (tabName === 'account') {
        this.populateAccountPanel();
      }
    },

    showError(msg) {
      const box = document.getElementById('modalErrorBox');
      if (box) {
        box.textContent = msg;
        box.style.display = 'block';
      }
    },

    clearError() {
      const box = document.getElementById('modalErrorBox');
      if (box) {
        box.textContent = '';
        box.style.display = 'none';
      }
    },

    populateAccountPanel() {
      const avatar = document.getElementById('modalProfileAvatar');
      const name = document.getElementById('modalProfileName');
      const email = document.getElementById('modalProfileEmail');
      const badge = document.getElementById('modalProfileBadge');
      const expiry = document.getElementById('modalSessionExpiryNotice');

      if (state.sessionType === 'user' && state.user) {
        if (avatar) {
          if (state.user.avatarUrl) {
            avatar.innerHTML = `<img src="${state.user.avatarUrl}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
          } else {
            avatar.textContent = (state.user.name || 'U').charAt(0).toUpperCase();
          }
        }
        if (name) name.textContent = state.user.name || 'Citizen User';
        if (email) email.textContent = state.user.email || 'Verified Google Account';
        if (badge) {
          badge.textContent = 'Verified Citizen Account';
          badge.className = 'profileBadge';
        }
        if (expiry) expiry.textContent = 'Account Status: Active. Session token valid for 7 days with persistent history synchronization.';
      } else if (state.sessionType === 'guest' && state.guest) {
        if (avatar) avatar.textContent = 'G';
        if (name) name.textContent = 'Guest Citizen';
        if (email) email.textContent = 'Session ID: ' + (state.guest.sessionId ? state.guest.sessionId.slice(0, 12) + '...' : 'Active');
        if (badge) {
          badge.textContent = 'Ephemeral Guest (24 Hours)';
          badge.className = 'profileBadge guest';
        }
        if (expiry) expiry.textContent = 'Guest Mode Notice: Inquiries remain private on this browser. Sessions expire after 24 hours of inactivity.';
      }
    },

    async initGoogleIdentityServices() {
      let googleClientId = '';
      try {
        const res = await fetch(`${getBaseUrl()}/api/auth/config`);
        if (res.ok) {
          const body = await res.json();
          if (body.data && body.data.googleClientId) {
            googleClientId = body.data.googleClientId.trim();
          }
        }
      } catch (err) {
        console.warn('Unable to load auth config:', err.message);
      }

      const devBanner = document.getElementById('devAuthBanner');
      const fallbackBtn = document.getElementById('modalGoogleBtn');
      const container = document.getElementById('googleBtnContainer');

      if (googleClientId) {
        if (devBanner) devBanner.style.display = 'none';

        const tryRenderGis = () => {
          if (window.google && window.google.accounts && window.google.accounts.id) {
            try {
              window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: async (response) => {
                  if (response && response.credential) {
                    try {
                      AuthModal.clearError();
                      if (fallbackBtn) {
                        fallbackBtn.disabled = true;
                        fallbackBtn.textContent = 'Signing in with Google...';
                      }
                      await loginWithGoogle(response.credential);
                      AuthModal.close();
                    } catch (authErr) {
                      AuthModal.showError(authErr.message || 'Google authentication failed.');
                    } finally {
                      if (fallbackBtn) {
                        fallbackBtn.disabled = false;
                        fallbackBtn.innerHTML = `
                          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          <span id="googleBtnText">Sign In with Google</span>
                        `;
                      }
                    }
                  }
                },
                auto_select: false,
                cancel_on_tap_outside: true,
              });

              if (container) {
                container.innerHTML = '';
                window.google.accounts.id.renderButton(container, {
                  theme: 'outline',
                  size: 'large',
                  width: 320,
                  text: 'signin_with',
                  shape: 'rectangular',
                  logo_alignment: 'left',
                });
                if (fallbackBtn) fallbackBtn.style.display = 'none';
              }
            } catch (gisErr) {
              console.warn('GIS initialization error:', gisErr);
            }
          } else {
            setTimeout(tryRenderGis, 300);
          }
        };

        tryRenderGis();
      } else {
        // No Google Client ID configured in .env yet
        if (devBanner) devBanner.style.display = 'block';
        if (fallbackBtn) {
          fallbackBtn.style.display = 'flex';
          fallbackBtn.addEventListener('click', () => {
            this.showError('Google Client ID is not configured in .env yet. Click "1-Click Demo Citizen Sign-In" below or "Continue as Guest Citizen".');
          });
        }
      }
    },

    initModalListeners() {
      const backdrop = document.getElementById('authModalBackdrop');
      const closeBtn = document.getElementById('authModalCloseBtn');
      const tabSignIn = document.getElementById('tabBtnSignIn');
      const tabGuest = document.getElementById('tabBtnGuest');
      const tabAccount = document.getElementById('tabBtnAccount');
      const startGuestBtn = document.getElementById('modalStartGuestBtn');
      const quickGuestBtn = document.getElementById('quickGuestBtn');
      const demoLoginBtn = document.getElementById('demoLoginBtn');
      const logoutBtn = document.getElementById('modalLogoutBtn');
      const navUserWidget = document.getElementById('navUserWidget');

      if (closeBtn) closeBtn.addEventListener('click', () => this.close());
      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) this.close();
        });
      }
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && backdrop && backdrop.classList.contains('active')) {
          this.close();
        }
      });

      if (tabSignIn) tabSignIn.addEventListener('click', () => this.switchTab('signin'));
      if (tabGuest) tabGuest.addEventListener('click', () => this.switchTab('guest'));
      if (tabAccount) tabAccount.addEventListener('click', () => this.switchTab('account'));

      const triggerGuest = async (btn) => {
        try {
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'Initializing guest session...';
          }
          await startGuestSession();
          this.close();
        } catch (err) {
          this.showError(err.message || 'Failed to start guest session.');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span>Continue as Guest Citizen</span>
            `;
          }
        }
      };

      if (startGuestBtn) {
        startGuestBtn.addEventListener('click', () => triggerGuest(startGuestBtn));
      }

      if (quickGuestBtn) {
        quickGuestBtn.addEventListener('click', () => triggerGuest(quickGuestBtn));
      }

      if (demoLoginBtn) {
        demoLoginBtn.addEventListener('click', async () => {
          try {
            demoLoginBtn.disabled = true;
            demoLoginBtn.textContent = 'Signing in with Demo Citizen...';
            this.clearError();
            await loginWithGoogle('mock-google-token:citizen@example.com');
            this.close();
          } catch (err) {
            this.showError(err.message || 'Demo sign in failed.');
          } finally {
            demoLoginBtn.disabled = false;
            demoLoginBtn.textContent = '1-Click Demo Citizen Sign-In';
          }
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          try {
            await logout();
            this.close();
          } catch (err) {
            this.showError(err.message || 'Logout failed.');
          }
        });
      }

      if (navUserWidget) {
        navUserWidget.addEventListener('click', () => {
          this.open('account');
        });
      }

      // Member 2 Login & Signup Form Listeners
      const loginForm = document.getElementById('loginForm');
      const signupForm = document.getElementById('signupForm');
      const loginTabBtn = document.getElementById('loginTabBtn');
      const signupTabBtn = document.getElementById('signupTabBtn');
      const loginError = document.getElementById('loginError');
      const signupError = document.getElementById('signupError');
      const forgotPasswordLink = document.getElementById('forgotPasswordLink');
      const forgotModal = document.getElementById('forgotModal');
      const forgotModalClose = document.getElementById('forgotModalClose');
      const backToLoginBtn = document.getElementById('backToLoginBtn');
      const continueGuestBtn = document.getElementById('continueGuestBtn');
      const authOpenBtn = document.getElementById('authOpenBtn');
      const navLogoutBtn = document.getElementById('logoutBtn');

      if (navLogoutBtn) {
        navLogoutBtn.addEventListener('click', async () => {
          try {
            await logout();
            this.close();
          } catch (err) {
            this.showError(err.message || 'Logout failed.');
          }
        });
      }

      if (loginTabBtn && signupTabBtn) {
        loginTabBtn.addEventListener('click', () => {
          loginTabBtn.classList.add('active');
          signupTabBtn.classList.remove('active');
          loginTabBtn.style.background = 'var(--ivory)';
          signupTabBtn.style.background = 'var(--white)';
          if (loginForm) loginForm.style.display = 'block';
          if (signupForm) signupForm.style.display = 'none';
          if (loginError) loginError.textContent = '';
          if (signupError) signupError.textContent = '';
        });
        signupTabBtn.addEventListener('click', () => {
          signupTabBtn.classList.add('active');
          loginTabBtn.classList.remove('active');
          signupTabBtn.style.background = 'var(--ivory)';
          loginTabBtn.style.background = 'var(--white)';
          if (signupForm) signupForm.style.display = 'block';
          if (loginForm) loginForm.style.display = 'none';
          if (loginError) loginError.textContent = '';
          if (signupError) signupError.textContent = '';
        });
      }

      if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const emailInput = document.getElementById('loginEmail');
          const passInput = document.getElementById('loginPassword');
          const email = emailInput ? emailInput.value.trim() : '';
          const pass = passInput ? passInput.value : '';
          if (!email || !pass) {
            if (loginError) loginError.textContent = 'Please enter both email and password.';
            return;
          }
          const submitBtn = loginForm.querySelector('button[type="submit"]');
          try {
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Signing In...'; }
            if (loginError) loginError.textContent = '';
            await loginWithPassword(email, pass);
            this.close();
          } catch (err) {
            if (loginError) loginError.textContent = err.message || 'Login failed.';
          } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Sign In with Password'; }
          }
        });
      }

      if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const nameInput = document.getElementById('signupName');
          const emailInput = document.getElementById('signupEmail');
          const passInput = document.getElementById('signupPassword');
          const confirmInput = document.getElementById('signupConfirmPassword');
          const name = nameInput ? nameInput.value.trim() : '';
          const email = emailInput ? emailInput.value.trim() : '';
          const pass = passInput ? passInput.value : '';
          const confirm = confirmInput ? confirmInput.value : '';

          if (!email || !pass) {
            if (signupError) signupError.textContent = 'Email and password are required.';
            return;
          }
          if (pass.length < 6) {
            if (signupError) signupError.textContent = 'Password must be at least 6 characters.';
            return;
          }
          if (pass !== confirm) {
            if (signupError) signupError.textContent = 'Passwords do not match.';
            return;
          }
          const submitBtn = signupForm.querySelector('button[type="submit"]');
          try {
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating Account...'; }
            if (signupError) signupError.textContent = '';
            await registerWithPassword(email, pass, name);
            this.close();
          } catch (err) {
            if (signupError) signupError.textContent = err.message || 'Registration failed.';
          } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Account'; }
          }
        });
      }

      if (forgotPasswordLink && forgotModal) {
        forgotPasswordLink.addEventListener('click', (e) => {
          e.preventDefault();
          this.close();
          forgotModal.classList.add('active');
        });
      }
      if (forgotModalClose && forgotModal) {
        forgotModalClose.addEventListener('click', () => forgotModal.classList.remove('active'));
      }
      if (backToLoginBtn && forgotModal) {
        backToLoginBtn.addEventListener('click', () => {
          forgotModal.classList.remove('active');
          this.open('signin');
        });
      }
      if (continueGuestBtn) {
        continueGuestBtn.addEventListener('click', () => triggerGuest(continueGuestBtn));
      }
      if (authOpenBtn) {
        authOpenBtn.addEventListener('click', () => this.open('signin'));
      }

      this.initGoogleIdentityServices();
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    AuthModal.initModalListeners();
    checkExistingSession();
  });

  window.AuthModal = AuthModal;

  
  const AuthUI = {
    init: function () {
      AuthModal.initModalListeners();
      checkExistingSession();
    },
    openAuthModal: (mode = 'login') => AuthModal.open(mode === 'signup' ? 'signin' : 'signin'),
    closeAuthModal: () => AuthModal.close(),
    getCurrentUser: () => state.user,
    isGuest: () => state.sessionType === 'guest',
  };

  window.AuthUI = AuthUI;

  return {
    getBaseUrl,
    getAuthHeaders,
    checkExistingSession,
    startGuestSession,
    loginWithGoogle,
        loginWithPassword,
    registerWithPassword,
    logout,
    getState: () => ({ ...state }),
    updateNavbarUI,
    openModal: (tab) => AuthModal.open(tab),
  };
})();
