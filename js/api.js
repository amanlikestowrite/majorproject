const API = (function () {
  let guestToken = localStorage.getItem("nyaya_guest_token") || null;
  let guestSessionId = localStorage.getItem("nyaya_guest_session_id") || null;
  let authToken = localStorage.getItem("nyaya_auth_token") || null;

  function setGuestToken(token, sessionId) {
    guestToken = token;
    guestSessionId = sessionId;
    if (token) {
      localStorage.setItem("nyaya_guest_token", token);
      if (sessionId) localStorage.setItem("nyaya_guest_session_id", sessionId);
      authToken = null;
      localStorage.removeItem("nyaya_auth_token");
      document.cookie = 'nyaya_auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax;';
    } else {
      localStorage.removeItem("nyaya_guest_token");
      localStorage.removeItem("nyaya_guest_session_id");
      document.cookie = 'nyaya_guest_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax;';
    }
  }

  function setAuthToken(token) {
    authToken = token;
    if (token) {
      localStorage.setItem("nyaya_auth_token", token);
      guestToken = null;
      guestSessionId = null;
      localStorage.removeItem("nyaya_guest_token");
      localStorage.removeItem("nyaya_guest_session_id");
      document.cookie = 'nyaya_guest_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax;';
    } else {
      localStorage.removeItem("nyaya_auth_token");
      document.cookie = 'nyaya_auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax;';
    }
  }

  function getAuthHeaders() {
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
      headers["x-auth-token"] = authToken;
    } else if (guestToken) {
      headers["x-guest-token"] = guestToken;
      headers["Authorization"] = `Bearer ${guestToken}`;
    }
    return headers;
  }

  async function request(endpoint, options = {}) {
    const url = endpoint.startsWith("http") ? endpoint : endpoint;
    const fetchOptions = {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
      credentials: "include",
    };

    try {
      const response = await fetch(url, fetchOptions);
      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (!response.ok) {
        const error = new Error(
          (data && data.message) || `Request failed with status ${response.status}`
        );
        error.status = response.status;
        error.code = data && data.code;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  async function createGuestSession() {
    const res = await request("/api/guest/session", { method: "POST" });
    if (res && res.data && res.data.token) {
      setGuestToken(res.data.token, res.data.sessionId);
    }
    return res.data;
  }

  async function validateGuestSession() {
    if (!guestToken) return null;
    try {
      const res = await request("/api/guest/session", { method: "GET" });
      return res.data;
    } catch {
      setGuestToken(null, null);
      return null;
    }
  }

  async function register(email, password, name) {
    const res = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    if (res && res.data && res.data.session) {
      setAuthToken(res.data.session.token);
      setGuestToken(null, null);
    }
    return res.data;
  }

  async function login(email, password) {
    const res = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (res && res.data && res.data.session) {
      setAuthToken(res.data.session.token);
      setGuestToken(null, null);
    }
    return res.data;
  }

  async function googleLogin(idToken) {
    const res = await request("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    if (res && res.data && res.data.session) {
      setAuthToken(res.data.session.token);
      setGuestToken(null, null);
    }
    return res.data;
  }

  async function getCurrentUser() {
    if (!authToken) return null;
    try {
      const res = await request("/api/auth/me", { method: "GET" });
      return res.data;
    } catch {
      setAuthToken(null);
      return null;
    }
  }

  async function logout() {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } catch {
    } finally {
      setAuthToken(null);
      setGuestToken(null, null);
      document.cookie = 'nyaya_auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax;';
      document.cookie = 'nyaya_guest_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax;';
    }
  }

  async function listConversations() {
    const res = await request("/api/conversations", { method: "GET" });
    return res.data || [];
  }

  async function createConversation(title) {
    const res = await request("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    return res.data;
  }

  async function getConversation(id) {
    const res = await request(`/api/conversations/${encodeURIComponent(id)}`, {
      method: "GET",
    });
    return res.data;
  }

  async function deleteConversation(id) {
    const res = await request(`/api/conversations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return res;
  }

  async function sendMessage(message, conversationId = null, top_k = 3, language = "en") {
    const payload = {
      message,
      top_k,
      language,
    };
    if (conversationId) {
      payload.conversationId = conversationId;
    }

    const res = await request("/api/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  return {
    getGuestToken: () => guestToken,
    getAuthToken: () => authToken,
    setGuestToken,
    setAuthToken,
    createGuestSession,
    validateGuestSession,
    register,
    login,
    googleLogin,
    getCurrentUser,
    logout,
    listConversations,
    createConversation,
    getConversation,
    deleteConversation,
    sendMessage,
  };
})();
