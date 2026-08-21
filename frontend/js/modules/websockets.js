// =====================================================================
// WebSockets Connection Manager
// =====================================================================

let ws = null;
let reconnectInterval = null;

function connectWebSocket() {
    // Only connect if we have a valid auth token
    if (!state.token) return;

    // Don't create multiple connections
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // API_BASE is likely 'http://localhost:8000' or similar, we must extract the hostname
    const host = window.location.host; 
    let wsBase = `${protocol}//${host}`;
    if (typeof API_BASE !== 'undefined' && API_BASE) {
        // If API_BASE is explicitly set (e.g. cross-origin), use its host
        const apiURL = new URL(API_BASE);
        wsBase = `${apiURL.protocol === 'https:' ? 'wss:' : 'ws:'}//${apiURL.host}`;
    }

    const wsUrl = `${wsBase}/api/ws?token=${state.token}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log("[WebSocket] Connected successfully");
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (e) {
            console.error("[WebSocket] Failed to parse message:", e);
        }
    };

    ws.onclose = (event) => {
        console.log("[WebSocket] Disconnected", event.code);
        // Attempt to reconnect every 5 seconds if we are still logged in
        if (state.token && !reconnectInterval) {
            reconnectInterval = setInterval(connectWebSocket, 5000);
        }
    };
}

function handleWebSocketMessage(data) {
    console.log("[WebSocket] Received:", data);

    if (data.type === "document_processed") {
        const { document_id, status, name, error } = data;
        
        // 1. Update the UI DOM instantly without reloading
        const statusSpanId = `doc-status-${document_id}`;
        const statusSpan = document.getElementById(statusSpanId);
        
        if (statusSpan) {
            if (status === 'ready') {
                statusSpan.innerHTML = ''; // Clear badge
            } else if (status === 'failed') {
                statusSpan.innerHTML = `<span class="badge" style="background:#fecdd3;color:#9f1239;margin-left:8px;font-size:0.75rem;padding:2px 6px;border-radius:12px;">Failed</span>`;
            }
        }

        // 2. Show a toast notification
        if (status === 'ready') {
            showToast(`Document "${name}" is now ready for AI Chat!`, "success");
            lucide.createIcons();
            
            // Optionally auto-reload the whole view if they are looking at the document list
            // to re-enable "Generate User Stories" buttons which might be disabled
            if (state.currentProject) {
                // If we want a soft refresh:
                // loadWorkspaceData(); 
                // Or just let the badge disappear and wait for their next interaction.
            }
        } else {
            showToast(`Failed to process document "${name}": ${error || 'Unknown error'}`, "error");
        }
    }
}

// Intercept login/logout to manage WebSocket lifecycle
document.addEventListener("DOMContentLoaded", () => {
    // If already logged in on page load, connect
    if (state.token) {
        connectWebSocket();
    }
});

// Since the original code relies on fetch wrappers or UI buttons to set the token,
// we can expose a global method to trigger WS connection after a successful login.
window.initWebSocket = connectWebSocket;
window.disconnectWebSocket = () => {
    if (ws) {
        ws.close();
        ws = null;
    }
};
