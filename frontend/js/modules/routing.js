// =====================================================================
// Initializer & Routing
// =====================================================================

document.addEventListener("DOMContentLoaded", () => {
    // Refresh Icons
    lucide.createIcons();

    // Bind Event Listeners
    bindAuthEvents();
    bindSidebarEvents();
    bindProjectEvents();
    bindMilestoneEvents();
    bindUploadEvents();
    bindMilestoneChatEvents();
    bindLogsEvents();

    // Check Authentication
    initApp();

    // Listen to hash change for URL-based navigation
    window.addEventListener("hashchange", handleRouting);
});

async function initApp() {
    // Check if arriving from Supabase Auth password recovery email
    const hashStr = window.location.hash + "&" + window.location.search;
    if (hashStr.includes("reset-password") || hashStr.includes("type=recovery") || hashStr.includes("type=invite") || hashStr.includes("recovery=true")) {
        const cleanQuery = hashStr.replace(/^[#?]/, "").replace(/[#?]/g, "&");
        const params = new URLSearchParams(cleanQuery);
        if (params.get("access_token")) window._resetAccessToken = params.get("access_token");
        if (params.get("refresh_token")) window._resetRefreshToken = params.get("refresh_token");

        showAuthModal(true);
        setTimeout(() => {
            document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
            const resetForm = document.getElementById("reset-password-form");
            if (resetForm) resetForm.classList.add("active");
        }, 100);
        return;
    }

    if (!state.token) {
        showAuthModal(true);
    } else {
        showAuthModal(false);
        const success = await fetchUserProfile();
        if (success === true) {
            populateProjectDropdowns(); // Run in parallel
            handleRouting();
            loadWorkspaceData(); // Run in parallel
        } else if (success === false) {
            // Token expired or invalid
            signOut();
        } else {
            // Network issue, rate limit, or 500 error (returned null)
            // Do not sign out. Just hide modal so they see the toast and can manually refresh later.
            showAuthModal(false);
        }
    }
}

async function handleRouting() {
    const hash = window.location.hash.slice(1) || "dashboard";

    // Close any active modal overlays
    closeAllModals();

    // If navigating to main projects page, clear active project details
    if (hash === "projects") {
        state.currentProject = null;
        updateSidebarProjectsLink();
    }

    // Hide details view when navigating away from a specific project detail
    if (!hash.startsWith("projects/")) {
        document.getElementById("project-detail-view").classList.add("hidden");
        document.getElementById("project-cards-container").classList.remove("hidden");
    }

    const validSections = ["dashboard", "projects", "milestones", "logs", "stories", "mytasks"];
    let targetSection = hash;

    // Legacy routes redirect to milestones
    if (targetSection === "uploads" || targetSection === "chat") {
        targetSection = "milestones";
    }

    // Handle nested sub-hashes if any
    if (hash.startsWith("projects/")) {
        const projId = parseInt(hash.split("/")[1]);
        openProjectDetail(projId);
        targetSection = "projects";
    }

    if (!validSections.includes(targetSection)) {
        targetSection = "dashboard";
    }

    state.activeSection = targetSection;

    // Toggle active classes in sidebar
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
    });
    const navLink = document.getElementById(`nav-${targetSection}`);
    if (navLink) navLink.classList.add("active");

    // Toggle active sections in main contents
    document.querySelectorAll(".content-section").forEach(sec => {
        sec.classList.remove("active");
    });
    const section = document.getElementById(`section-${targetSection}`);
    if (section) section.classList.add("active");

    // Dynamic loads based on target section
    if (targetSection === "dashboard") loadDashboardStats();
    if (targetSection === "projects" && !hash.startsWith("projects/")) loadProjects();
    if (targetSection === "milestones") {
        await populateProjectDropdowns();
        loadMilestonesRoadmap();
    }
    if (targetSection === "logs") loadActivityLogs();
    if (targetSection === "stories") {
        await populateProjectDropdowns();
        loadStories();
    }
    if (targetSection === "mytasks") {
        await populateProjectDropdowns();
        loadMyTasks();
    }
    applyRBACUI();
}

function closeAllModals() {
    document.querySelectorAll(".modal-overlay").forEach(modal => {
        modal.classList.remove("active");
    });
}


