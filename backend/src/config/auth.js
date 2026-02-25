(function () {
  const API_BASE_URL = "http://127.0.0.1:5000/api/auth";
  const REQUEST_TIMEOUT = 30000;

  // NEW: Supabase Client Initialization
  let supabaseClient = null;

  function ensureClient() {
    if (supabaseClient) return supabaseClient;
    
    // Replace with your actual project credentials
    const SUPABASE_URL = "https://your-project.supabase.co";
    const SUPABASE_KEY = "your-anon-key";
    
    if (typeof supabase === 'undefined') {
      console.error("Supabase SDK not loaded");
      return null;
    }
    
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supabaseClient;
  }

  function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  // ... (existing helper functions: fetchWithTimeout, isTokenExpired, setAccessToken)

  let accessToken = null;
  let currentUser = null;
  let tokenExpiryTime = null;
  let refreshTimer = null;

  function setAccessToken(token, expiresIn, user) {
    accessToken = token;
    currentUser = user || null;
    tokenExpiryTime = Date.now() + (expiresIn * 1000);
    scheduleTokenRefresh();

    window.dispatchEvent(
      new CustomEvent("xaytheon:authchange", { detail: { user: currentUser } })
    );
  }

  // ... (existing session management: getSession, refreshAccessToken, authenticatedFetch)

  async function logout() {
    try {
      await fetch(`${API_BASE_URL}/logout`, { method: "POST" });
    } catch { }
    accessToken = null;
    currentUser = null;
    localStorage.removeItem("x_refresh_token");
    window.location.reload();
  }

  // UPDATED: Expose ensureClient in the public API
  window.XAYTHEON_AUTH = {
    ensureClient,
    getSession,
    login: async (email, password) => { /* logic */ },
    register: async (email, password) => { /* logic */ },
    logout,
    authenticatedFetch,
    isAuthenticated: () => !!accessToken,
    getAccessToken: () => accessToken
  };

  // Init logic
  window.addEventListener("DOMContentLoaded", async () => {
    // Session restoration
    if (localStorage.getItem("x_refresh_token")) {
      await refreshAccessToken();
    }
    document.querySelectorAll("[data-requires-auth]").forEach(el => el.style.display = !!accessToken ? "" : "none");
    document.querySelectorAll("[data-requires-guest]").forEach(el => el.style.display = !!accessToken ? "none" : "");
  });
})();