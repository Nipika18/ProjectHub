// =====================================================================
// Authentication Handlers
// =====================================================================

function showAuthModal(show) {
    const modal = document.getElementById("auth-modal");
    if (show) {
        modal.classList.add("active");
    } else {
        modal.classList.remove("active");
    }
}

function bindAuthEvents() {
    const goReg = document.getElementById("go-to-register");
    const goLogin = document.getElementById("go-to-login");
    const goAdminLogin = document.getElementById("go-to-admin-login");
    const goBackToUserLogin = document.getElementById("go-back-to-user-login");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const adminLoginForm = document.getElementById("admin-login-form");
    const btnSignout = document.getElementById("btn-signout");

    const forgotForm = document.getElementById("forgot-password-form");
    const resetForm = document.getElementById("reset-password-form");

    function showForm(formToShow) {
        loginForm.classList.remove("active");
        registerForm.classList.remove("active");
        adminLoginForm.classList.remove("active");
        if (forgotForm) forgotForm.classList.remove("active");
        if (resetForm) resetForm.classList.remove("active");
        formToShow.classList.add("active");
    }

    goReg.addEventListener("click", () => showForm(registerForm));
    goLogin.addEventListener("click", () => showForm(loginForm));
    goAdminLogin.addEventListener("click", () => showForm(adminLoginForm));
    goBackToUserLogin.addEventListener("click", () => showForm(loginForm));

    // Regular user login
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;
        const errorDiv = document.getElementById("login-error");

        errorDiv.style.display = "none";

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader" class="spin" style="width:16px;height:16px;margin-right:6px;"></i> Signing in...';
        lucide.createIcons();

        try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, full_name: "Login Attempt" })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Authentication failed.");
            }

            const data = await response.json();

            localStorage.setItem("token", data.access_token);
            if (data.refresh_token) {
                localStorage.setItem("refresh_token", data.refresh_token);
                state.refreshToken = data.refresh_token;
            }
            state.token = data.access_token;
            state.user = data.user;

            if (typeof window.initWebSocket === 'function') {
                window.initWebSocket();
            }

            showToast("Successfully signed in!", "success");
            window.location.hash = "#dashboard";
            setTimeout(() => {
                initApp();
            }, 0);
        } catch (err) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = "block";
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });

    // Admin login
    adminLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("admin-login-email").value;
        const password = document.getElementById("admin-login-password").value;
        const errorDiv = document.getElementById("admin-login-error");

        errorDiv.style.display = "none";

        const submitBtn = adminLoginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader" class="spin" style="width:16px;height:16px;margin-right:6px;"></i> Signing in...';
        lucide.createIcons();

        try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, full_name: "Admin Login Attempt" })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Authentication failed.");
            }

            const data = await response.json();

            if (!data.user.is_admin) {
                errorDiv.textContent = "Access Denied: This account does not have administrator privileges.";
                errorDiv.style.display = "block";
                return;
            }

            localStorage.setItem("token", data.access_token);
            if (data.refresh_token) {
                localStorage.setItem("refresh_token", data.refresh_token);
                state.refreshToken = data.refresh_token;
            }
            state.token = data.access_token;
            state.user = data.user;

            showToast("Welcome back, Admin!", "success");
            window.location.hash = "#dashboard";
            setTimeout(() => {
                initApp();
            }, 0);
        } catch (err) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = "block";
        } finally {
            if (typeof submitBtn !== 'undefined') {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
    });

    // Registration
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const full_name = document.getElementById("register-name").value;
        const email = document.getElementById("register-email").value;
        const password = document.getElementById("register-password").value;
        const errorDiv = document.getElementById("register-error");
        const submitBtn = registerForm.querySelector('button[type="submit"]');

        errorDiv.style.display = "none";

        if (password.length < 6) {
            errorDiv.textContent = "Password must be at least 6 characters.";
            errorDiv.style.display = "block";
            return;
        }

        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader" class="spin" style="width:16px;height:16px;margin-right:6px;"></i> Signing up...';
        lucide.createIcons();

        try {
            const response = await fetch(`${API_BASE}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, full_name })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Registration failed.");
            }

            showToast("Verification email sent! Please check your inbox and click the link to verify your account.", "success");
            registerForm.classList.remove("active");
            loginForm.classList.add("active");
        } catch (err) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = "block";
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });

    // Forgot / Reset Password Navigation
    const goForgotBtn = document.getElementById("go-to-forgot-password");
    const goBackFromForgot = document.getElementById("go-back-from-forgot");
    const goBackFromReset = document.getElementById("go-back-from-reset");

    if (goForgotBtn) goForgotBtn.addEventListener("click", (e) => { e.preventDefault(); if (forgotForm) showForm(forgotForm); });
    if (goBackFromForgot) goBackFromForgot.addEventListener("click", () => showForm(loginForm));
    if (goBackFromReset) goBackFromReset.addEventListener("click", () => showForm(loginForm));

    if (forgotForm) {
        forgotForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("forgot-email").value;
            const errorDiv = document.getElementById("forgot-error");
            const successDiv = document.getElementById("forgot-success");
            errorDiv.style.display = "none";
            successDiv.style.display = "none";

            const submitBtn = forgotForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="loader" class="spin" style="width:16px;height:16px;margin-right:6px;"></i> Sending...';
            lucide.createIcons();

            try {
                const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || "Failed to send reset link.");
                successDiv.textContent = data.detail || "Reset link sent to your email!";
                successDiv.style.display = "block";
            } catch (err) {
                errorDiv.textContent = err.message;
                errorDiv.style.display = "block";
            } finally {
                if (typeof submitBtn !== 'undefined') {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            }
        });
    }

    if (resetForm) {
        resetForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById("reset-new-password").value;
            const confirmPassword = document.getElementById("reset-confirm-password").value;
            const errorDiv = document.getElementById("reset-error");
            const successDiv = document.getElementById("reset-success");
            errorDiv.style.display = "none";
            successDiv.style.display = "none";

            const submitBtn = resetForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;

            if (newPassword !== confirmPassword) {
                errorDiv.textContent = "Passwords do not match.";
                errorDiv.style.display = "block";
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="loader" class="spin" style="width:16px;height:16px;margin-right:6px;"></i> Updating...';
            lucide.createIcons();

            try {
                let accessToken = window._resetAccessToken;
                let refreshToken = window._resetRefreshToken || "";
                if (!accessToken) {
                    const hashStr = window.location.hash + "&" + window.location.search;
                    const cleanQuery = hashStr.replace(/^[#?]/, "").replace(/[#?]/g, "&");
                    const params = new URLSearchParams(cleanQuery);
                    accessToken = params.get("access_token");
                    if (params.get("refresh_token")) refreshToken = params.get("refresh_token");
                }
                if (!accessToken) {
                    throw new Error("No password reset token found in URL. Please click the reset link in your email again.");
                }
                const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                        new_password: newPassword
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || "Failed to reset password.");
                successDiv.textContent = data.detail || "Password reset successfully!";
                successDiv.style.display = "block";
                showToast("Password updated successfully! Please log in with your new password.", "success");
                // Clear the URL hash and search parameters so initApp doesn't trigger the reset form again
                window.history.replaceState({}, document.title, window.location.pathname);
                setTimeout(() => {
                    showForm(loginForm);
                }, 2500);
            } catch (err) {
                errorDiv.textContent = err.message;
                errorDiv.style.display = "block";
            } finally {
                if (typeof submitBtn !== 'undefined') {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            }
        });
    }

    btnSignout.addEventListener("click", signOut);
}

async function fetchUserProfile() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                return false; // Actually expired or invalid token
            }
            throw new Error(`Server returned ${response.status}`);
        }

        state.user = await response.json();

        // Update sidebar profile
        const fullNameEl = document.getElementById("user-fullname");
        fullNameEl.textContent = state.user.is_admin ? `${state.user.full_name} [ADMIN]` : state.user.full_name;
        if (state.user.is_admin) fullNameEl.style.color = "#3b82f6";
        document.getElementById("user-email").textContent = state.user.email;
        const avatarChar = document.getElementById("user-avatar-char");
        const sidebarImg = document.getElementById("sidebar-avatar-img");
        if (state.user.profile_image) {
            if (sidebarImg) { sidebarImg.src = state.user.profile_image; sidebarImg.style.display = "block"; }
            if (avatarChar) avatarChar.style.display = "none";
        } else {
            if (avatarChar) { avatarChar.textContent = state.user.full_name[0].toUpperCase(); avatarChar.style.display = "flex"; }
            if (sidebarImg) sidebarImg.style.display = "none";
        }

        // Show and start notifications
        const notifContainer = document.getElementById("notif-container");
        if (notifContainer) notifContainer.style.display = "block";
        startNotificationPolling();

        return true;
    } catch (e) {
        console.error("fetchUserProfile error:", e);
        showToast("Connection issue: Could not reach server. Please wait a moment.", "error");
        return null; // Return null instead of false to prevent instant logout on network/rate-limit issues
    }
}

function checkAdminAccess(actionName = "do that") {
    const isAdmin = !!state.user?.is_admin;

    // Actions that are strictly global admin only
    const strictGlobalAdminActions = [
        "purge orphans",
        "view admin logs"
    ];
    if (strictGlobalAdminActions.includes(actionName.toLowerCase())) {
        if (!isAdmin) {
            showToast(`Only Global Administrators can ${actionName}`, "error");
            return false;
        }
        return true;
    }

    // Actions that allow ANY project manager
    const anyManagerActions = [
        "invite users",
        "assign administrator privileges",
        "assign admin"
    ];
    if (anyManagerActions.includes(actionName.toLowerCase())) {
        const isAnyProjManager = state.projects?.some(p => p.user_role === 'Manager' || p.user_role === 'Admin');
        if (!isAdmin && !isAnyProjManager) {
            showToast(`Only Admin or Manager can ${actionName}`, "error");
            return false;
        }
        return true;
    }

    // Actions that are open to everyone (e.g. creating projects)
    if (actionName.toLowerCase() === "create new projects") {
        return true;
    }

    // Project-specific actions: allowed for global Admin OR project Manager/Owner
    const activeProjectId = state.currentProject?.id || state.globalProjectId;
    const activeProj = state.projects?.find(p => p.id == activeProjectId);
    const isProjManager = activeProj && (activeProj.user_role === 'Manager' || activeProj.user_role === 'Admin');
    if (isAdmin || isProjManager) {
        return true;
    }

    showToast(`Only Admin or Project Manager can ${actionName}`, "error");
    return false;
}

function applyRBACUI() {
    const isAdmin = !!state.user?.is_admin;
    const activeProjectId = state.currentProject?.id || state.globalProjectId;
    const activeProj = state.projects?.find(p => p.id == activeProjectId);
    const isProjManager = activeProj && (activeProj.user_role === 'Manager' || activeProj.user_role === 'Admin');
    const hasManagerPrivileges = isAdmin || isProjManager;
    const isAnyProjManager = state.projects?.some(p => p.user_role === 'Manager' || p.user_role === 'Admin');
    const showManagementViews = isAdmin || isAnyProjManager;
    const hasProjectSelected = !!(state.globalProjectId);

    // Show admin-only buttons (Assign Admin, Invite Others) to Admins and Managers
    document.querySelectorAll(".admin-only-btn").forEach(btn => {
        btn.style.display = showManagementViews ? "flex" : "none";
    });

    // Sidebar nav visibility:
    // - Admins: always see everything
    // - Non-admins: see only Dashboard until a project is selected,
    //   then unlock all sidebar items
    const sidebarNavItems = document.querySelectorAll(".sidebar-nav .nav-item");
    sidebarNavItems.forEach(item => {
        const id = item.id;
        const href = item.getAttribute("href") || "";
        if (href === "#dashboard" || href === "#projects") {
            // Dashboard and Projects are always visible for everyone
            item.style.display = "flex";
        } else {
            // For non-admins: show other sections (Milestones, Stories, etc.) only after a project is selected
            item.style.display = (isAdmin || hasProjectSelected) ? "flex" : "none";
        }
    });

    // Hide team management controls for non-admin/non-manager users
    const teamControls = document.getElementById("team-management-controls");
    if (teamControls) {
        teamControls.style.display = hasManagerPrivileges ? "flex" : "none";
    }

    // Edit and Delete project buttons are visible for project management
    const editProjectBtn = document.getElementById("btn-edit-project");
    if (editProjectBtn) {
        editProjectBtn.style.display = hasManagerPrivileges ? "inline-flex" : "none";
    }

    const deleteProjectBtn = document.getElementById("btn-delete-project");
    if (deleteProjectBtn) {
        deleteProjectBtn.style.display = hasManagerPrivileges ? "inline-flex" : "none";
    }

    // Hide Upload Document and New Milestone buttons on the Milestones Roadmap for non-managers
    const uploadDocBtn = document.getElementById("btn-global-upload-doc");
    if (uploadDocBtn) {
        uploadDocBtn.style.display = hasManagerPrivileges ? "inline-flex" : "none";
    }

    const newMilestoneBtn = document.getElementById("btn-open-create-milestone-modal");
    if (newMilestoneBtn) {
        newMilestoneBtn.style.display = hasManagerPrivileges ? "inline-flex" : "none";
    }

    // "New Project" button is visible to all logged-in users
    const newProjectBtn = document.getElementById("btn-open-create-project-modal");
    if (newProjectBtn) {
        newProjectBtn.style.display = "inline-flex";
    }

    // Hide "Add Milestone" button for non-admin/non-manager users
    const addMilestoneBtn = document.getElementById("btn-add-milestone-direct");
    if (addMilestoneBtn) {
        addMilestoneBtn.style.display = hasManagerPrivileges ? "inline-flex" : "none";
    }

    // Hide "Add Team Member" button for non-admin/non-manager users
    const addTeamMemberBtn = document.getElementById("btn-add-team-member");
    if (addTeamMemberBtn) {
        addTeamMemberBtn.style.display = hasManagerPrivileges ? "inline-flex" : "none";
    }

    // Apply bold visual emphasis on the global project selector if a project is selected
    const globalSelect = document.getElementById("global-project-select");
    if (globalSelect) {
        if (globalSelect.value) {
            globalSelect.classList.add("selected-bold");
        } else {
            globalSelect.classList.remove("selected-bold");
        }
    }
}

function signOut() {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("globalProjectId");
    state.token = null;
    state.refreshToken = null;
    state.user = null;
    state.projects = [];
    state.currentProject = null;
    state.globalProjectId = null;
    state.chatSessions = {};

    // Clear display
    document.getElementById("user-fullname").textContent = "User Name";
    document.getElementById("user-email").textContent = "email@company.com";

    // Hide and stop notifications
    const notifContainer = document.getElementById("notif-container");
    if (notifContainer) notifContainer.style.display = "none";
    const notifDropdown = document.getElementById("notif-dropdown");
    if (notifDropdown) notifDropdown.style.display = "none";
    stopNotificationPolling();

    showToast("Signed out successfully.");
    window.location.hash = "#dashboard";
    showAuthModal(true);
}


