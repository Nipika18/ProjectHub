// =====================================================================
// WebSockets Connection Manager
// =====================================================================

let ws = null;
let reconnectInterval = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds max

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
        reconnectAttempts = 0; // Reset on successful connection
        if (reconnectInterval) {
            clearTimeout(reconnectInterval);
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
        // Attempt to reconnect with exponential backoff if we are still logged in
        if (state.token && !reconnectInterval) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
            console.log(`[WebSocket] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})`);
            reconnectInterval = setTimeout(() => {
                reconnectInterval = null;
                connectWebSocket();
            }, delay);
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
    } else if (data.type === "stories_generated") {
        const { milestone_id, document_id, status, count, error, source_name } = data;
        
        // Clear active generation state
        if (milestone_id && state.activeMilestoneGenerations) {
            delete state.activeMilestoneGenerations[milestone_id];
        }
        if (document_id && state.activeGenerations) {
            delete state.activeGenerations[document_id];
        }
        if (typeof window.updateGlobalGeneratingBanner === "function") {
            window.updateGlobalGeneratingBanner();
        }

        // Show toast and refresh UI
        if (status === 'success') {
            const suffix = source_name ? ` from ${source_name}` : "";
            showToast(`Successfully generated ${count} stories${suffix}!`, "success");
            
            // Reload if we are viewing the relevant project
            if (state.currentProject) {
                if (typeof refreshMilestoneViewsForProject === "function") {
                    refreshMilestoneViewsForProject(state.currentProject.id);
                }
                
                // If on the User Stories section, reload stories list
                const storyProjSelect = document.getElementById("story-project-select");
                if (state.activeSection === "stories" && storyProjSelect && parseInt(storyProjSelect.value) === state.currentProject.id) {
                    if (typeof loadStories === "function") loadStories();
                }
            }
            if (typeof loadWorkspaceData === "function") loadWorkspaceData();
        } else {
            showToast(`Failed to generate stories: ${error || 'Unknown error'}`, "error");
            
            // Re-enable button manually if we're not reloading the whole view
            if (document_id) {
                const btn = document.getElementById(`btn-gen-stories-${document_id}`);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i data-lucide="sparkles" style="width: 14px; height: 14px;"></i> Stories';
                }
                const btnTab = document.getElementById(`btn-gen-stories-tab-${document_id}`);
                if (btnTab) {
                    btnTab.disabled = false;
                    btnTab.innerHTML = '<i data-lucide="sparkles" style="width: 16px; height: 16px; color:#334155; stroke-width: 2;"></i> Stories';
                }
                if (window.lucide) lucide.createIcons();
            }
            if (milestone_id && state.currentProject) {
                if (typeof refreshMilestoneViewsForProject === "function") {
                    refreshMilestoneViewsForProject(state.currentProject.id);
                }
            }
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
