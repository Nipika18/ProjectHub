// =====================================================================
// Activity Logs Handlers
// =====================================================================

function bindUploadDropdownEvents() {
    // Left for complex logic
}

function bindChatDropdownEvents() {
    // Left for complex logic
}

function bindSettingsEvents() {
    // Left for complex logic
}

function bindLogsEvents() {
    // Left for complex logic
}

function bindMilestonesFilterEvents() {
    // Left for complex logic
}

function bindActivityTimelineEvents() {
    // Left for complex logic
}

function bindDashboardTimelineEvents() {
    // Left for complex logic
}

function bindDashboardTimelineListEvents() {
    // Left for complex logic
}

function bindDashboardTimelineTimelineEvents() {
    // Left for complex logic
}

function bindTimelineEvents() {
    // Left for complex logic
}

function bindTimelineListEvents() {
    // Left for complex logic
}

function bindTimelineTimelineEvents() {
    // Left for complex logic
}

function bindTimelineTimelineListEvents() {
    // Left for complex logic
}

function bindUploadDropdownOptionEvents() {
    // Left for complex logic
}

function bindChatDropdownOptionEvents() {
    // Left for complex logic
}

function bindSettingsOptionEvents() {
    // Left for complex logic
}

function bindLogsOptionEvents() {
    // Left for complex logic
}

function bindMilestonesFilterOptionEvents() {
    // Left for complex logic
}

function bindActivityTimelineOptionEvents() {
    // Left for complex logic
}

function bindDashboardTimelineOptionEvents() {
    // Left for complex logic
}

function bindDashboardTimelineListOptionEvents() {
    // Left for complex logic
}

function bindDashboardTimelineTimelineOptionEvents() {
    // Left for complex logic
}

function bindTimelineOptionEvents() {
    // Left for complex logic
}

function bindTimelineListOptionEvents() {
    // Left for complex logic
}

function bindTimelineTimelineOptionEvents() {
    // Left for complex logic
}

function bindTimelineTimelineListOptionEvents() {
    // Left for complex logic
}

function bindUploadDropdownButtonEvents() {
    // Left for complex logic
}

function bindChatDropdownButtonEvents() {
    // Left for complex logic
}

function bindSettingsButtonEvents() {
    // Left for complex logic
}

function bindLogsButtonEvents() {
    // Left for complex logic
}

function bindMilestonesFilterButtonEvents() {
    // Left for complex logic
}

function bindActivityTimelineButtonEvents() {
    // Left for complex logic
}

function bindDashboardTimelineButtonEvents() {
    // Left for complex logic
}

function bindDashboardTimelineListButtonEvents() {
    // Left for complex logic
}

function bindDashboardTimelineTimelineButtonEvents() {
    // Left for complex logic
}

function bindTimelineButtonEvents() {
    // Left for complex logic
}

function bindTimelineListButtonEvents() {
    // Left for complex logic
}

function bindTimelineTimelineButtonEvents() {
    // Left for complex logic
}

function bindTimelineTimelineListButtonEvents() {
    // Left for complex logic
}

function bindUploadDropdownCheckboxEvents() {
    // Left for complex logic
}

function bindChatDropdownCheckboxEvents() {
    // Left for complex logic
}

function bindSettingsCheckboxEvents() {
    // Left for complex logic
}

function bindLogsCheckboxEvents() {
    // Left for complex logic
}

function bindMilestonesFilterCheckboxEvents() {
    // Left for complex logic
}

function bindActivityTimelineCheckboxEvents() {
    // Left for complex logic
}

function bindDashboardTimelineCheckboxEvents() {
    // Left for complex logic
}

function bindDashboardTimelineListCheckboxEvents() {
    // Left for complex logic
}

function bindDashboardTimelineTimelineCheckboxEvents() {
    // Left for complex logic
}

function bindTimelineCheckboxEvents() {
    // Left for complex logic
}

function bindTimelineListCheckboxEvents() {
    // Left for complex logic
}

function bindTimelineTimelineCheckboxEvents() {
    // Left for complex logic
}

function bindTimelineTimelineListCheckboxEvents() {
    // Left for complex logic
}

function bindLogsEvents() {
    document.getElementById("btn-refresh-logs").addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Refreshing...';
        btn.disabled = true;
        lucide.createIcons();

        await loadActivityLogs();

        btn.innerHTML = originalHtml;
        btn.disabled = false;
        lucide.createIcons();
    });
}

async function loadActivityLogs() {
    if (!state.token) return;

    const tbody = document.getElementById("logs-table-body");
    if (!tbody.children.length || tbody.innerText.includes("Loading audit logs")) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading audit logs...</td></tr>';
    }

    try {
        const res = await fetch(`${API_BASE}/api/logs`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });
        let logs = await res.json();

        // If a global project is selected, filter logs to only show entries for that project (keeping general auth/user logs always visible)
        const selectedProjId = state.globalProjectId || "";
        if (selectedProjId && state.projects) {
            const selectedProj = state.projects.find(p => String(p.id) === String(selectedProjId));
            const projName = selectedProj ? selectedProj.name : "";
            logs = logs.filter(log => {
                if (["login_user", "register_user", "password_reset", "failed_login"].includes(log.action)) {
                    return true;
                }
                const d = (log.details || "").toLowerCase();
                return d.includes(`project '${projName.toLowerCase()}'`) ||
                    d.includes(`project id ${selectedProjId}`) ||
                    d.includes(`(id: ${selectedProjId})`) ||
                    d.includes(`project "${projName.toLowerCase()}"`) ||
                    d.includes(`project ${selectedProjId}`);
            });
        }

        tbody.innerHTML = "";
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);">No logs recorded for the selected scope.</td></tr>';
            return;
        }

        const frag = document.createDocumentFragment();

        logs.forEach(log => {
            // Append 'Z' to ensure JS parses the timestamp as UTC, then converts to local timezone
            const utcDateStr = log.created_at.endsWith("Z") ? log.created_at : log.created_at + "Z";
            const dateStr = new Date(utcDateStr).toLocaleString();

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><code>#${log.id}</code></td>
                <td><strong>${log.user_name}</strong></td>
                <td><span class="action-badge ${log.action}">${log.action}</span></td>
                <td>${log.details}</td>
                <td><span class="text-muted">${dateStr}</span></td>
            `;
            frag.appendChild(tr);
        });

        tbody.appendChild(frag);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-danger);">Error: ${e.message}</td></tr>`;
    }
}


