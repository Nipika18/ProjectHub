// =====================================================================
// Global Token Refresh Interceptor
// =====================================================================

const originalFetch = window.fetch;
window.fetch = async function (...args) {
    let response = await originalFetch(...args);
    if (response.status === 401 && localStorage.getItem("refresh_token")) {
        const urlStr = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        if (!urlStr.includes('/api/auth/login') && !urlStr.includes('/api/auth/refresh') && !urlStr.includes('/api/auth/register')) {
            try {
                const refreshRes = await originalFetch(`${API_BASE}/api/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: localStorage.getItem("refresh_token") })
                });
                if (refreshRes.ok) {
                    const data = await refreshRes.json();
                    localStorage.setItem("token", data.access_token);
                    if (data.refresh_token) {
                        localStorage.setItem("refresh_token", data.refresh_token);
                        state.refreshToken = data.refresh_token;
                    }
                    state.token = data.access_token;
                    state.user = data.user;

                    // Retry original request with the renewed access token
                    let options = args[1] ? { ...args[1] } : {};
                    options.headers = options.headers ? { ...options.headers } : {};
                    options.headers["Authorization"] = `Bearer ${data.access_token}`;
                    return await originalFetch(args[0], options);
                } else {
                    localStorage.removeItem("refresh_token");
                    state.refreshToken = null;
                }
            } catch (e) {
                console.error("[Sprint AI] Background token refresh error:", e);
            }
        }
    }
    return response;
};


