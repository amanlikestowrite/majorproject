const AuthUI = (function () {
  let currentUser = null;
  let isGuest = false;

  const dom = {
    authModal: document.getElementById("authModal"),
    forgotModal: document.getElementById("forgotModal"),
    authOpenBtn: document.getElementById("authOpenBtn"),
    authModalClose: document.getElementById("authModalClose"),
    forgotModalClose: document.getElementById("forgotModalClose"),
    loginTabBtn: document.getElementById("loginTabBtn"),
    signupTabBtn: document.getElementById("signupTabBtn"),
    loginForm: document.getElementById("loginForm"),
    signupForm: document.getElementById("signupForm"),
    loginError: document.getElementById("loginError"),
    signupError: document.getElementById("signupError"),
    continueGuestBtn: document.getElementById("continueGuestBtn"),
    googleSignInBtn: document.getElementById("googleSignInBtn"),
    forgotPasswordLink: document.getElementById("forgotPasswordLink"),
    backToLoginBtn: document.getElementById("backToLoginBtn"),
    userProfileArea: document.getElementById("userProfileArea"),
    profileDropdown: document.getElementById("profileDropdown"),
    profileName: document.getElementById("profileName"),
    profileEmail: document.getElementById("profileEmail"),
    profileBadge: document.getElementById("profileBadge"),
    profileAvatar: document.getElementById("profileAvatar"),
    logoutBtn: document.getElementById("logoutBtn"),
    sidebarAuthStatus: document.getElementById("sidebarAuthStatus"),
  };

  function showToast(message) {
    if (window.UIInteractions && window.UIInteractions.showToast) {
      window.UIInteractions.showToast(message);
    } else {
      let toast = document.getElementById("toast");
      if (toast) {
        toast.textContent = message;
        toast.classList.add("active");
        setTimeout(() => toast.classList.remove("active"), 2800);
      }
    }
  }

  function openAuthModal(mode = "login") {
    if (!dom.authModal) return;
    dom.authModal.classList.add("active");
    switchTab(mode);
  }

  function closeAuthModal() {
    if (!dom.authModal) return;
    dom.authModal.classList.remove("active");
    clearErrors();
  }

  function openForgotModal() {
    closeAuthModal();
    if (dom.forgotModal) dom.forgotModal.classList.add("active");
  }

  function closeForgotModal() {
    if (dom.forgotModal) dom.forgotModal.classList.remove("active");
  }

  function switchTab(mode) {
    clearErrors();
    if (mode === "login") {
      dom.loginTabBtn.classList.add("active");
      dom.signupTabBtn.classList.remove("active");
      dom.loginForm.style.display = "block";
      dom.signupForm.style.display = "none";
    } else {
      dom.signupTabBtn.classList.add("active");
      dom.loginTabBtn.classList.remove("active");
      dom.signupForm.style.display = "block";
      dom.loginForm.style.display = "none";
    }
  }

  function clearErrors() {
    if (dom.loginError) {
      dom.loginError.textContent = "";
      dom.loginError.style.display = "none";
    }
    if (dom.signupError) {
      dom.signupError.textContent = "";
      dom.signupError.style.display = "none";
    }
  }

  function showLoginError(msg) {
    if (dom.loginError) {
      dom.loginError.textContent = msg;
      dom.loginError.style.display = "block";
    }
  }

  function showSignupError(msg) {
    if (dom.signupError) {
      dom.signupError.textContent = msg;
      dom.signupError.style.display = "block";
    }
  }

  function updateAuthUI() {
    if (currentUser) {
      isGuest = false;
      if (dom.authOpenBtn) dom.authOpenBtn.style.display = "none";
      if (dom.userProfileArea) dom.userProfileArea.style.display = "flex";
      if (dom.profileName) dom.profileName.textContent = currentUser.name || "Citizen User";
      if (dom.profileEmail) dom.profileEmail.textContent = currentUser.email || "";
      if (dom.profileBadge) dom.profileBadge.textContent = "Verified Account";
      if (dom.profileAvatar) {
        dom.profileAvatar.textContent = (currentUser.name || currentUser.email || "U").charAt(0).toUpperCase();
      }
      if (dom.sidebarAuthStatus) {
        dom.sidebarAuthStatus.innerHTML = `
          <div class="userChip">
            <div class="userChipAvatar">${(currentUser.name || currentUser.email || "U").charAt(0).toUpperCase()}</div>
            <div class="userChipInfo">
              <span class="userChipName">${currentUser.name || "Citizen User"}</span>
              <span class="userChipSub">${currentUser.email || "Active Session"}</span>
            </div>
            <button type="button" class="chipLogoutBtn" id="sidebarLogoutBtn" title="Log Out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        `;
        const sidebarLogoutBtn = document.getElementById("sidebarLogoutBtn");
        if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener("click", handleLogout);
      }
    } else if (isGuest) {
      if (dom.authOpenBtn) {
        dom.authOpenBtn.style.display = "inline-flex";
        dom.authOpenBtn.textContent = "Sign In / Register";
      }
      if (dom.userProfileArea) dom.userProfileArea.style.display = "none";
      if (dom.sidebarAuthStatus) {
        dom.sidebarAuthStatus.innerHTML = `
          <div class="guestChip">
            <span class="guestDot"></span>
            <div class="guestInfo">
              <span class="guestTitle">Guest Session Active</span>
              <span class="guestSub">History saved locally for 24 hours</span>
            </div>
            <button type="button" class="guestUpgradeBtn" id="guestUpgradeBtn">Sign In</button>
          </div>
        `;
        const guestUpgradeBtn = document.getElementById("guestUpgradeBtn");
        if (guestUpgradeBtn) guestUpgradeBtn.addEventListener("click", () => openAuthModal("login"));
      }
    } else {
      if (dom.authOpenBtn) {
        dom.authOpenBtn.style.display = "inline-flex";
        dom.authOpenBtn.textContent = "Sign In / Register";
      }
      if (dom.userProfileArea) dom.userProfileArea.style.display = "none";
      if (dom.sidebarAuthStatus) {
        dom.sidebarAuthStatus.innerHTML = `
          <div class="guestChip">
            <div class="guestInfo">
              <span class="guestTitle">Not Signed In</span>
              <span class="guestSub">Accessing public legal information</span>
            </div>
            <button type="button" class="guestUpgradeBtn" id="guestSignInBtn">Sign In</button>
          </div>
        `;
        const guestSignInBtn = document.getElementById("guestSignInBtn");
        if (guestSignInBtn) guestSignInBtn.addEventListener("click", () => openAuthModal("login"));
      }
    }
  }

  async function initAuth() {
    try {
      const user = await API.getCurrentUser();
      if (user) {
        currentUser = user;
        isGuest = false;
        updateAuthUI();
        if (window.ChatUI && window.ChatUI.loadConversations) {
          window.ChatUI.loadConversations();
        }
        return;
      }
    } catch {
    }

    try {
      const guestSession = await API.validateGuestSession();
      if (guestSession) {
        isGuest = true;
        currentUser = null;
        updateAuthUI();
        if (window.ChatUI && window.ChatUI.loadConversations) {
          window.ChatUI.loadConversations();
        }
        return;
      }
    } catch {
    }

    try {
      await API.createGuestSession();
      isGuest = true;
      currentUser = null;
      updateAuthUI();
      if (window.ChatUI && window.ChatUI.loadConversations) {
        window.ChatUI.loadConversations();
      }
    } catch (err) {
      console.warn("Could not auto-start guest session", err);
      updateAuthUI();
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    clearErrors();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
      showLoginError("Please enter both email and password.");
      return;
    }

    try {
      const btn = dom.loginForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Signing In...";

      const res = await API.login(email, password);
      currentUser = res.user;
      isGuest = false;
      updateAuthUI();
      closeAuthModal();
      showToast(`Welcome back, ${currentUser.name || currentUser.email}!`);
      if (window.ChatUI && window.ChatUI.loadConversations) {
        window.ChatUI.loadConversations();
      }
    } catch (err) {
      showLoginError(err.message || "Failed to sign in. Please verify credentials.");
    } finally {
      const btn = dom.loginForm.querySelector('button[type="submit"]');
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
  }

  async function handleSignupSubmit(e) {
    e.preventDefault();
    clearErrors();
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("signupConfirmPassword").value;

    if (!email || !password) {
      showSignupError("Email and password are required.");
      return;
    }
    if (password.length < 6) {
      showSignupError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      showSignupError("Passwords do not match.");
      return;
    }

    try {
      const btn = dom.signupForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Creating Account...";

      const res = await API.register(email, password, name);
      currentUser = res.user;
      isGuest = false;
      updateAuthUI();
      closeAuthModal();
      showToast(`Account created! Welcome, ${currentUser.name || currentUser.email}!`);
      if (window.ChatUI && window.ChatUI.loadConversations) {
        window.ChatUI.loadConversations();
      }
    } catch (err) {
      showSignupError(err.message || "Failed to create account. Email may already exist.");
    } finally {
      const btn = dom.signupForm.querySelector('button[type="submit"]');
      btn.disabled = false;
      btn.textContent = "Create Account";
    }
  }

  async function handleGuestContinue() {
    try {
      closeAuthModal();
      await API.createGuestSession();
      isGuest = true;
      currentUser = null;
      updateAuthUI();
      showToast("Continuing as Guest. Sessions remain valid for 24 hours.");
      if (window.ChatUI && window.ChatUI.loadConversations) {
        window.ChatUI.loadConversations();
      }
    } catch (err) {
      showToast(err.message || "Could not start guest session.");
    }
  }

  async function handleGoogleSignIn() {
    try {
      const email = prompt("Enter Google account email to sign in (or click OK for demo user):", "citizen.advocate@gmail.com");
      if (!email) return;

      const mockToken = `mock-google-token:${email.trim()}`;
      const res = await API.googleLogin(mockToken);
      currentUser = res.user;
      isGuest = false;
      updateAuthUI();
      closeAuthModal();
      showToast(`Google Sign-In verified: ${currentUser.email}`);
      if (window.ChatUI && window.ChatUI.loadConversations) {
        window.ChatUI.loadConversations();
      }
    } catch (err) {
      showToast(err.message || "Google sign-in failed.");
    }
  }

  async function handleLogout() {
    try {
      await API.logout();
      currentUser = null;
      isGuest = false;
      showToast("You have been signed out.");
      await initAuth();
    } catch (err) {
      showToast("Error during logout.");
    }
  }

  function bindEvents() {
    if (dom.authOpenBtn) {
      dom.authOpenBtn.addEventListener("click", () => openAuthModal("login"));
    }
    if (dom.authModalClose) {
      dom.authModalClose.addEventListener("click", closeAuthModal);
    }
    if (dom.forgotModalClose) {
      dom.forgotModalClose.addEventListener("click", closeForgotModal);
    }
    if (dom.loginTabBtn) {
      dom.loginTabBtn.addEventListener("click", () => switchTab("login"));
    }
    if (dom.signupTabBtn) {
      dom.signupTabBtn.addEventListener("click", () => switchTab("signup"));
    }
    if (dom.loginForm) {
      dom.loginForm.addEventListener("submit", handleLoginSubmit);
    }
    if (dom.signupForm) {
      dom.signupForm.addEventListener("submit", handleSignupSubmit);
    }
    if (dom.continueGuestBtn) {
      dom.continueGuestBtn.addEventListener("click", handleGuestContinue);
    }
    if (dom.googleSignInBtn) {
      dom.googleSignInBtn.addEventListener("click", handleGoogleSignIn);
    }
    if (dom.forgotPasswordLink) {
      dom.forgotPasswordLink.addEventListener("click", (e) => {
        e.preventDefault();
        openForgotModal();
      });
    }
    if (dom.backToLoginBtn) {
      dom.backToLoginBtn.addEventListener("click", () => {
        closeForgotModal();
        openAuthModal("login");
      });
    }
    if (dom.logoutBtn) {
      dom.logoutBtn.addEventListener("click", handleLogout);
    }
    if (dom.userProfileArea) {
      dom.userProfileArea.addEventListener("click", (e) => {
        e.stopPropagation();
        if (dom.profileDropdown) {
          dom.profileDropdown.classList.toggle("active");
        }
      });
    }
    document.addEventListener("click", () => {
      if (dom.profileDropdown) dom.profileDropdown.classList.remove("active");
    });
  }

  return {
    init: function () {
      bindEvents();
      initAuth();
    },
    getCurrentUser: () => currentUser,
    isGuest: () => isGuest,
    openAuthModal,
    handleLogout,
  };
})();
