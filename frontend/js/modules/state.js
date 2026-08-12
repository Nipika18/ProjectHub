// =====================================================================
// Global App State
// =====================================================================

const state = {
    token: localStorage.getItem("token") || null,
    refreshToken: localStorage.getItem("refresh_token") || null,
    user: null,
    projects: [],
    currentProject: null,
    logs: [],
    activeSection: "dashboard",
    isUploading: false,
    globalProjectId: localStorage.getItem("globalProjectId") || null,  // Globally selected project — auto-fills all page dropdowns
    chatSessions: {}, // key: `${projectId}_${milestoneId}`, value: chat messages
    uploadContext: null, // { projectId, milestoneId, milestoneTitle }
    milestoneChatContext: null, // { projectId, milestoneId, milestoneTitle, hasDocs }
    stories: [],
    activeGenerations: {}, // Track document ID -> boolean for active story generations
    activeProjectTab: localStorage.getItem("activeProjectTab") || "milestones"
};

function updateSidebarProjectsLink() {
    const navProjects = document.getElementById("nav-projects");
    if (!navProjects) return;
    if (state.currentProject) {
        navProjects.setAttribute("href", `#projects/${state.currentProject.id}`);
    } else {
        navProjects.setAttribute("href", "#projects");
    }
}

// API Base configuration
let API_BASE = "";
if ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && window.location.port !== "8000") {
    API_BASE = "http://localhost:8000";
}

function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}


