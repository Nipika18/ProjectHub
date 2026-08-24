// =====================================================================
// Workspace & Dashboard Handlers
// =====================================================================

function loadWorkspaceData() {
    loadDashboardStats();
    populateProjectDropdowns();
}

async function loadDashboardStats() {
    if (!state.token) return;

    try {
        // Fetch projects and logs in parallel
        const [projRes, logsRes] = await Promise.all([
            fetch(`${API_BASE}/api/projects`, { headers: { "Authorization": `Bearer ${state.token}` } }),
            fetch(`${API_BASE}/api/logs`, { headers: { "Authorization": `Bearer ${state.token}` } })
        ]);
        const [projs, allLogs] = await Promise.all([projRes.json(), logsRes.json()]);
        state.projects = projs;
        state.logs = allLogs;

        const selectedProjId = state.globalProjectId || "";

        // If a project is selected, filter logs to only show entries related to that project (keeping general auth/user logs always visible)
        let filteredLogs = allLogs;
        if (selectedProjId) {
            const selectedProj = projs.find(p => String(p.id) === String(selectedProjId));
            const projName = selectedProj ? selectedProj.name : "";
            filteredLogs = allLogs.filter(log => {
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

        // Render Dashboard Activity Feed
        renderDashboardTimeline(filteredLogs);

        let totalDocs = 0;
        let totalMilestones = 0;

        const projectsCard = document.getElementById("stat-card-projects");
        // Always show Total Projects card
        if (projectsCard) projectsCard.style.display = "flex";
        const statProjEl = document.getElementById("dash-stat-projects-count") || document.getElementById("stat-projects");
        if (statProjEl) statProjEl.textContent = projs.length;

        if (selectedProjId) {
            // Scoped: fetch stats only for the selected project
            const [mRes, docsRes] = await Promise.all([
                fetch(`${API_BASE}/api/milestones/project/${selectedProjId}`, { headers: { "Authorization": `Bearer ${state.token}` } }),
                fetch(`${API_BASE}/api/documents/project/${selectedProjId}`, { headers: { "Authorization": `Bearer ${state.token}` } })
            ]);
            if (mRes.ok) totalMilestones = (await mRes.json()).length;
            if (docsRes.ok) totalDocs = (await docsRes.json()).length;
        } else {
            // No project selected: aggregate stats
            if (state.milestones && state.milestones.length > 0) {
                totalMilestones = state.milestones.length;
            } else if (projs.length > 0) {
                const firstProj = projs[0];
                const [mRes, dRes] = await Promise.all([
                    fetch(`${API_BASE}/api/milestones/project/${firstProj.id}`, { headers: { "Authorization": `Bearer ${state.token}` } }).then(r => r.ok ? r.json() : []).catch(() => []),
                    fetch(`${API_BASE}/api/documents/project/${firstProj.id}`, { headers: { "Authorization": `Bearer ${state.token}` } }).then(r => r.ok ? r.json() : []).catch(() => [])
                ]);
                totalMilestones = mRes.length;
                totalDocs = dRes.length;
            }
        }

        const statMileEl = document.getElementById("dash-stat-milestones-count") || document.getElementById("stat-milestones");
        if (statMileEl) statMileEl.textContent = totalMilestones;

        const statDocsEl = document.getElementById("dash-stat-stories-count") || document.getElementById("stat-documents");
        if (statDocsEl) statDocsEl.textContent = totalDocs;

        // Calculate estimated RAG chunks (avg 8 chunks per doc index) if element exists
        const statChunksEl = document.getElementById("stat-chunks");
        if (statChunksEl) {
            statChunksEl.textContent = totalDocs * 8;
        }
    } catch (e) {
        console.error("Stats fetching error:", e);
    }
}

function renderDashboardTimeline(logs) {
    const container = document.getElementById("dash-activity-list") || document.getElementById("dash-timeline-list");
    if (!container) return;
    container.innerHTML = "";

    if (logs.length === 0) {
        container.innerHTML = '<p class="timeline-empty">No activity logged yet.</p>';
        return;
    }

    // Draw top 5 logs
    logs.slice(0, 5).forEach(log => {
        const item = document.createElement("div");
        item.className = "timeline-item";

        let markerClass = "action-update";
        if (log.action.startsWith("create") || log.action.startsWith("register")) markerClass = "action-create";
        if (log.action.startsWith("delete")) markerClass = "action-delete";

        const utcTime = log.created_at.endsWith("Z") ? log.created_at : log.created_at + "Z";
        const formattedTime = new Date(utcTime).toLocaleString();

        item.innerHTML = `
            <div class="timeline-marker">
                <div class="timeline-dot ${markerClass}"></div>
                <div class="timeline-line"></div>
            </div>
            <div class="timeline-content">
                <p>${log.details}</p>
                <div class="timeline-meta">
                    <span><i data-lucide="user" style="width:12px;height:12px;"></i> ${log.user_name}</span>
                    <span><i data-lucide="clock" style="width:12px;height:12px;"></i> ${formattedTime}</span>
                </div>
            </div>
        `;
        container.appendChild(item);
    });

    lucide.createIcons();
}

function bindSidebarEvents() {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const href = item.getAttribute("href");
            window.location.hash = href;
        });
    });

    const dashViewAllLogs = document.getElementById("dash-view-all-logs");
    if (dashViewAllLogs) {
        dashViewAllLogs.addEventListener("click", (e) => {
            e.preventDefault();
            window.location.hash = "#logs";
        });
    }

    const statProjectsCard = document.getElementById("stat-card-projects");
    if (statProjectsCard) {
        statProjectsCard.style.cursor = "pointer";
        statProjectsCard.addEventListener("click", () => {
            window.location.hash = "#projects";
        });
    }

    const statMilestonesEl = document.getElementById("stat-milestones");
    if (statMilestonesEl && statMilestonesEl.closest(".stat-card")) {
        const card = statMilestonesEl.closest(".stat-card");
        card.style.cursor = "pointer";
        card.addEventListener("click", () => {
            window.location.hash = "#milestones";
        });
    }

    const statDocumentsEl = document.getElementById("stat-documents");
    if (statDocumentsEl && statDocumentsEl.closest(".stat-card")) {
        const card = statDocumentsEl.closest(".stat-card");
        card.style.cursor = "pointer";
        card.addEventListener("click", () => {
            window.location.hash = "#projects";
            if (state.currentProject) {
                setTimeout(() => {
                    const docsTabBtn = document.getElementById("tab-docs-btn");
                    if (docsTabBtn) docsTabBtn.click();
                }, 100);
            }
        });
    }

    // Sidebar Responsive & Mini Icon Rail Toggle
    const btnCloseSidebar = document.getElementById("btn-sidebar-close");
    const btnOpenSidebar = document.getElementById("btn-sidebar-open");
    const btnMobileMenuToggle = document.getElementById("btn-mobile-menu-toggle");
    const sidebarOverlay = document.getElementById("sidebar-overlay");
    const appContainer = document.getElementById("app-container");

    const closeMobileSidebar = () => {
        if (appContainer) appContainer.classList.remove("sidebar-mobile-open");
    };

    if (appContainer) {
        if (localStorage.getItem("sidebar_collapsed") === "true") {
            appContainer.classList.add("sidebar-collapsed");
            if (btnCloseSidebar) btnCloseSidebar.setAttribute("title", "Expand sidebar");
        }

        if (btnCloseSidebar) {
            btnCloseSidebar.addEventListener("click", () => {
                if (window.innerWidth <= 1024) {
                    closeMobileSidebar();
                } else {
                    appContainer.classList.toggle("sidebar-collapsed");
                    const isCollapsed = appContainer.classList.contains("sidebar-collapsed");
                    localStorage.setItem("sidebar_collapsed", isCollapsed ? "true" : "false");
                    btnCloseSidebar.setAttribute("title", isCollapsed ? "Expand sidebar" : "Close sidebar");
                }
            });
        }

        if (btnOpenSidebar) {
            btnOpenSidebar.addEventListener("click", () => {
                if (window.innerWidth <= 1024) {
                    appContainer.classList.add("sidebar-mobile-open");
                } else {
                    appContainer.classList.remove("sidebar-collapsed");
                    localStorage.setItem("sidebar_collapsed", "false");
                    if (btnCloseSidebar) btnCloseSidebar.setAttribute("title", "Close sidebar");
                }
            });
        }

        if (btnMobileMenuToggle) {
            btnMobileMenuToggle.addEventListener("click", () => {
                appContainer.classList.toggle("sidebar-mobile-open");
            });
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener("click", closeMobileSidebar);
        }

        // Auto close mobile drawer when nav links are clicked
        document.querySelectorAll(".sidebar-nav .nav-item").forEach(item => {
            item.addEventListener("click", () => {
                if (window.innerWidth <= 1024) {
                    closeMobileSidebar();
                }
            });
        });
    }
}


