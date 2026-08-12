// =====================================================================
// Jira User Stories Handlers
// =====================================================================

document.getElementById("story-project-select")?.addEventListener("change", loadStories);

// Manual Story / Subtask Creation
const btnOpenStoryModal = document.getElementById("btn-open-create-story-modal");
const btnCloseStoryModal = document.getElementById("btn-close-story-modal");
const btnCancelStoryModal = document.getElementById("btn-cancel-story-modal");
const storyModal = document.getElementById("create-story-modal");
const storyForm = document.getElementById("create-story-form");
const issueTypeSelect = document.getElementById("create-issue-type-select");

function updateIssueTypeFields() {
    const issueType = issueTypeSelect?.value || "story";
    const subtaskParentGroup = document.getElementById("subtask-parent-group");
    const subtaskRoleGroup = document.getElementById("subtask-role-group");
    const storyOnlyFields = document.querySelectorAll(".story-only-field");
    const modalTitle = document.getElementById("modal-create-issue-title");
    const submitBtn = document.getElementById("btn-submit-create-issue");

    if (issueType === "subtask") {
        if (subtaskParentGroup) subtaskParentGroup.style.display = "block";
        if (subtaskRoleGroup) subtaskRoleGroup.style.display = "block";
        storyOnlyFields.forEach(el => el.style.display = "none");
        if (modalTitle) modalTitle.textContent = "Create Subtask / Task";
        if (submitBtn) submitBtn.textContent = "Save Subtask";
    } else {
        if (subtaskParentGroup) subtaskParentGroup.style.display = "none";
        if (subtaskRoleGroup) subtaskRoleGroup.style.display = "none";
        storyOnlyFields.forEach(el => el.style.display = "");
        if (modalTitle) modalTitle.textContent = "Create User Story";
        if (submitBtn) submitBtn.textContent = "Save Story";
    }
}

if (issueTypeSelect) {
    issueTypeSelect.addEventListener("change", updateIssueTypeFields);
}

async function populateParentStorySelect(projectId) {
    const parentSelect = document.getElementById("subtask-parent-story-select");
    if (!parentSelect) return;
    parentSelect.innerHTML = '<option value="">-- Select Parent User Story --</option>';
    try {
        const response = await fetch(`${API_BASE}/api/projects/${projectId}/stories`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });
        if (response.ok) {
            const stories = await response.json();
            stories.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s.id;
                opt.textContent = `[ID: ${s.id}] ${s.title}`;
                parentSelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Error fetching stories for parent select:", err);
    }
}

if (btnOpenStoryModal) btnOpenStoryModal.addEventListener("click", async () => {
    const projectId = document.getElementById("story-project-select")?.value;
    if (!projectId) {
        showToast("Please select a project first", "error");
        return;
    }
    await populateParentStorySelect(projectId);
    if (issueTypeSelect) issueTypeSelect.value = "story";
    updateIssueTypeFields();
    storyModal.classList.add("active");
});
if (btnCloseStoryModal) btnCloseStoryModal.addEventListener("click", () => storyModal.classList.remove("active"));
if (btnCancelStoryModal) btnCancelStoryModal.addEventListener("click", () => storyModal.classList.remove("active"));

window.openSubtaskModal = async function (projectId, storyId) {
    if (!projectId) return;

    // Reset form
    if (storyForm) storyForm.reset();

    await populateParentStorySelect(projectId);

    if (issueTypeSelect) issueTypeSelect.value = "subtask";
    updateIssueTypeFields();

    const parentSelect = document.getElementById("subtask-parent-story-select");
    if (parentSelect) {
        parentSelect.value = storyId;
    }

    storyModal.classList.add("active");
};

window.openCreateStoryModalForMilestone = async function(milestoneId) {
    
    // Trigger the main button click to initialize project context & dropdowns
    const btn = document.getElementById("btn-open-create-story-modal");
    if (btn) btn.click();
    
    // Wait a tiny bit for the populateParentStorySelect async function to finish, 
    // then pre-fill the milestone select box
    setTimeout(() => {
        const msSelect = document.getElementById("story-milestone-select");
        if (msSelect) {
            msSelect.value = (milestoneId === 'unassigned') ? "" : milestoneId;
        }
    }, 150);
};

if (storyForm) storyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = storyForm.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.disabled) return;

    const projectId = document.getElementById("story-project-select")?.value;
    if (!projectId) return;

    const issueType = issueTypeSelect?.value || "story";
    const origBtnText = submitBtn ? submitBtn.innerHTML : "Save";
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader" style="width: 14px; height: 14px;"></i> Creating...';
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }

    try {
        if (issueType === "subtask") {
            const parentStoryId = document.getElementById("subtask-parent-story-select")?.value;
            if (!parentStoryId) {
                showToast("Please select a parent user story for this subtask", "error");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = origBtnText;
                }
                return;
            }
            const taskTitle = document.getElementById("story-title-input")?.value?.trim();
            const taskRole = document.getElementById("subtask-role-select")?.value || "Backend";

            const response = await fetch(`${API_BASE}/api/projects/${projectId}/stories/${parentStoryId}/tasks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${state.token}`
                },
                body: JSON.stringify({
                    title: taskTitle,
                    task_type: taskRole,
                    status: "To Do"
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Could not create subtask.");
            }

            showToast("Subtask created successfully!", "success");
        } else {
            const title = document.getElementById("story-title-input").value;
            const desc = document.getElementById("story-desc-input").value;
            const priority = document.getElementById("story-priority-input").value;
            const points = parseInt(document.getElementById("story-points-input").value);
            const milestoneIdRaw = document.getElementById("story-milestone-select")?.value;
            const milestoneId = milestoneIdRaw ? parseInt(milestoneIdRaw) : null;

            const acRaw = document.getElementById("story-ac-input")?.value || "";
            const acList = acRaw.split("\n").map(s => s.trim()).filter(s => s.length > 0);

            const subtasksRaw = document.getElementById("story-subtasks-input")?.value || "";
            const subtasksList = subtasksRaw.split("\n").map(s => s.trim()).filter(s => s.length > 0);

            const response = await fetch(`${API_BASE}/api/projects/${projectId}/stories`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${state.token}`
                },
                body: JSON.stringify({
                    title: title,
                    description: desc,
                    acceptance_criteria: acList,
                    priority: priority,
                    story_points: points,
                    status: "To Do",
                    comments: [],
                    milestone_id: milestoneId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Could not create story.");
            }

            const createdStory = await response.json();

            // Create inline subtasks if any were entered
            for (const line of subtasksList) {
                let role = "Backend";
                let titleText = line;
                const match = line.match(/^(.*?)\s*\[(.*?)\]\s*$/i);
                if (match) {
                    titleText = match[1].trim();
                    const matchedRole = match[2].trim();
                    if (matchedRole.toLowerCase() === "frontend") role = "Frontend";
                    else if (matchedRole.toLowerCase() === "backend") role = "Backend";
                    else if (matchedRole.toLowerCase() === "ai") role = "AI";
                    else if (matchedRole.toLowerCase() === "manager") role = "Manager";
                    else if (matchedRole.toLowerCase() === "qa") role = "QA";
                    else role = matchedRole.charAt(0).toUpperCase() + matchedRole.slice(1);
                }
                if (titleText) {
                    await fetch(`${API_BASE}/api/projects/${projectId}/stories/${createdStory.id}/tasks`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${state.token}`
                        },
                        body: JSON.stringify({
                            title: titleText,
                            task_type: role,
                            status: "To Do"
                        })
                    });
                }
            }

            showToast("User story created successfully!", "success");
        }

        storyForm.reset();
        storyModal.classList.remove("active");
        loadStories(); // Refresh list & board views
    } catch (e) {
        showToast(e.message, "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origBtnText;
        }
    }
});

// Edit Profile Modal
const editProfileModal = document.getElementById("edit-profile-modal");
const btnEditProfile = document.getElementById("btn-edit-profile");
const btnCloseEditProfileModal = document.getElementById("btn-close-edit-profile-modal");
const btnCancelEditProfileModal = document.getElementById("btn-cancel-edit-profile-modal");
const editProfileForm = document.getElementById("edit-profile-form");

if (btnEditProfile) {
    btnEditProfile.addEventListener("click", () => {
        if (!state.user) return;
        document.getElementById("edit-profile-name").value = state.user.full_name || "";
        // Pre-fill avatar preview
        const prevChar = document.getElementById("avatar-preview-char");
        const prevImg = document.getElementById("avatar-preview-img");
        if (state.user.profile_image && prevImg) {
            prevImg.src = state.user.profile_image;
            prevImg.style.display = "block";
            if (prevChar) prevChar.style.display = "none";
        } else {
            if (prevChar) { prevChar.textContent = (state.user.full_name?.[0] || "U").toUpperCase(); prevChar.style.display = "flex"; }
            if (prevImg) prevImg.style.display = "none";
        }
        if (window.lucide) window.lucide.createIcons();
        editProfileModal.classList.add("active");
    });
}

if (btnCloseEditProfileModal) {
    btnCloseEditProfileModal.addEventListener("click", () => {
        editProfileModal.classList.remove("active");
    });
}

if (btnCancelEditProfileModal) {
    btnCancelEditProfileModal.addEventListener("click", () => {
        editProfileModal.classList.remove("active");
    });
}

if (editProfileForm) {
    // Preview selected avatar
    const avatarInput = document.getElementById("edit-profile-avatar");
    if (avatarInput) {
        avatarInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const prevImg = document.getElementById("avatar-preview-img");
                const prevChar = document.getElementById("avatar-preview-char");
                if (prevImg) { prevImg.src = ev.target.result; prevImg.style.display = "block"; }
                if (prevChar) prevChar.style.display = "none";
            };
            reader.readAsDataURL(file);
        });
    }

    editProfileForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = editProfileForm.querySelector('button[type="submit"]');
        const origBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = "Saving...";

        const name = document.getElementById("edit-profile-name").value.trim();
        const avatarFile = document.getElementById("edit-profile-avatar")?.files[0];

        try {
            // 1. Upload avatar first if a new file was selected
            let newAvatarUrl = state.user.profile_image || null;
            if (avatarFile) {
                const formData = new FormData();
                formData.append("file", avatarFile);
                const avatarRes = await fetch(`${API_BASE}/api/auth/me/avatar`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${state.token}` },
                    body: formData
                });
                if (!avatarRes.ok) {
                    const d = await avatarRes.json();
                    throw new Error(d.detail || "Failed to upload profile photo");
                }
                const avatarData = await avatarRes.json();
                newAvatarUrl = avatarData.profile_image_url;
            }

            // 2. Save name via existing PUT /me
            const body = { full_name: name };
            const res = await fetch(`${API_BASE}/api/auth/me`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${state.token}`
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to update profile");
            }

            const updatedUser = await res.json();
            state.user = { ...updatedUser, profile_image: newAvatarUrl };

            // Update sidebar
            const nameEl = document.getElementById("user-fullname");
            const emailEl = document.getElementById("user-email");
            const avatarCharEl = document.getElementById("user-avatar-char");
            const sidebarImg = document.getElementById("sidebar-avatar-img");
            if (nameEl) nameEl.textContent = updatedUser.full_name;
            if (emailEl) emailEl.textContent = updatedUser.email;
            if (newAvatarUrl) {
                if (sidebarImg) { sidebarImg.src = newAvatarUrl; sidebarImg.style.display = "block"; }
                if (avatarCharEl) avatarCharEl.style.display = "none";
            } else {
                if (avatarCharEl) { avatarCharEl.textContent = updatedUser.full_name ? updatedUser.full_name.charAt(0).toUpperCase() : "U"; avatarCharEl.style.display = "flex"; }
                if (sidebarImg) sidebarImg.style.display = "none";
            }

            showToast("Profile updated successfully", "success");
            editProfileModal.classList.remove("active");

            // Reload active section so name updates propagate to UI lists immediately
            if (state.activeSection === "dashboard") loadDashboardStats();
            else if (state.activeSection === "projects") loadProjects();
            else if (state.activeSection === "stories") loadStories();
            else if (state.activeSection === "mytasks") loadMyTasks();
            else if (state.activeSection === "logs") loadActivityLogs();
            else if (state.activeSection === "milestones") loadMilestonesRoadmap();
        } catch (e) {
            showToast(e.message, "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origBtnText;
        }
    });
}

// Invite User Modal
const inviteModal = document.getElementById("invite-user-modal");
const btnCloseInviteModal = document.getElementById("btn-close-invite-modal");
const btnCancelInviteModal = document.getElementById("btn-cancel-invite-modal");
const inviteForm = document.getElementById("invite-user-form");

function triggerOpenInviteModal(e) {
    if (e) e.preventDefault();
    if (!checkAdminAccess("invite users")) return;
    const projectSelect = document.getElementById("invite-project-select");
    if (projectSelect) {
        projectSelect.innerHTML = '<option value="">-- None (Just Register) --</option>';
        if (state.projects && state.projects.length > 0) {
            state.projects.forEach(p => {
                const opt = document.createElement("option");
                opt.value = p.id;
                opt.textContent = p.name;
                if (state.currentProject && state.currentProject.id === p.id) {
                    opt.selected = true;
                }
                projectSelect.appendChild(opt);
            });
        }
    }
    const modalEl = document.getElementById("invite-user-modal");
    if (modalEl) modalEl.classList.add("active");
}

document.body.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-open-invite-modal");
    if (btn) {
        triggerOpenInviteModal(e);
    }
});

if (btnCloseInviteModal) btnCloseInviteModal.addEventListener("click", () => inviteModal.classList.remove("active"));
if (btnCancelInviteModal) btnCancelInviteModal.addEventListener("click", () => inviteModal.classList.remove("active"));

let isSubmittingInvite = false;
if (inviteForm) inviteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmittingInvite) return;
    if (!checkAdminAccess("invite users")) return;
    isSubmittingInvite = true;

    const submitBtn = inviteForm.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Sending...';
    }

    const email = document.getElementById("invite-email-input").value.trim();
    const fullName = document.getElementById("invite-fullname-input").value.trim();
    const projIdVal = document.getElementById("invite-project-select").value;
    const role = document.getElementById("invite-role-select").value;

    try {
        const response = await fetch(`${API_BASE}/api/auth/invite`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${state.token}`
            },
            body: JSON.stringify({
                email: email,
                full_name: fullName,
                project_id: projIdVal ? parseInt(projIdVal) : null,
                role: role
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Could not invite user.");
        }

        const data = await response.json();
        showToast(data.detail, "success");
        inviteForm.reset();
        inviteModal.classList.remove("active");

        if (state.currentProject && projIdVal && parseInt(projIdVal) === state.currentProject.id) {
            loadTeamMembers(state.currentProject.id);
        }
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        isSubmittingInvite = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-lucide="send"></i> Send Invite';
            lucide.createIcons();
        }
    }
});


// Assign Admin Modal
const assignAdminModal = document.getElementById("assign-admin-modal");
const btnCloseAssignAdminModal = document.getElementById("btn-close-assign-admin-modal");
const btnCancelAssignAdminModal = document.getElementById("btn-cancel-assign-admin-modal");
const assignAdminForm = document.getElementById("assign-admin-form");

async function triggerOpenAssignAdminModal(e) {
    if (e) e.preventDefault();
    if (!checkAdminAccess("assign administrator privileges")) return;

    const triggerEl = document.getElementById("assign-admin-trigger");
    const dropdownEl = document.getElementById("assign-admin-dropdown");
    const optionsEl = document.getElementById("assign-admin-options");
    const searchEl = document.getElementById("assign-admin-search");
    const hiddenInput = document.getElementById("assign-admin-select");
    const displayEl = document.getElementById("assign-admin-display");

    if (searchEl) searchEl.value = "";
    if (hiddenInput) hiddenInput.value = "";
    if (displayEl) displayEl.textContent = "-- Select Registered User --";
    if (displayEl) displayEl.style.color = "var(--color-text-muted)";
    if (dropdownEl) dropdownEl.style.display = "none";

    if (triggerEl && !triggerEl.dataset.bound) {
        triggerEl.addEventListener("click", () => {
            const isVisible = dropdownEl.style.display === "block";
            dropdownEl.style.display = isVisible ? "none" : "block";
            if (!isVisible && searchEl) {
                setTimeout(() => searchEl.focus(), 50);
            }
        });

        document.addEventListener("click", (e) => {
            const container = document.getElementById("assign-admin-custom-select");
            if (container && !container.contains(e.target)) {
                if (dropdownEl) dropdownEl.style.display = "none";
            }
        });
        triggerEl.dataset.bound = "true";
    }

    if (optionsEl) {
        optionsEl.innerHTML = '<div style="padding: 10px 14px; color: var(--color-text-muted);">Loading users...</div>';
        try {
            const res = await fetch(`${API_BASE}/api/auth/users`, {
                headers: { "Authorization": `Bearer ${state.token}` }
            });
            if (!res.ok) throw new Error("Could not fetch users list");
            const users = await res.json();

            window.renderAdminSelect = (filterText = "") => {
                optionsEl.innerHTML = '';
                const lowerFilter = filterText.toLowerCase();
                let hasResults = false;

                users.forEach(u => {
                    const adminTag = u.is_admin ? " [ADMIN]" : "";
                    const textContent = `${u.full_name} (${u.email})${adminTag}`;
                    if (textContent.toLowerCase().includes(lowerFilter)) {
                        hasResults = true;
                        const opt = document.createElement("div");
                        opt.textContent = textContent;
                        opt.style.padding = "10px 14px";
                        opt.style.borderBottom = "1px solid var(--border-color)";
                        opt.style.cursor = "pointer";
                        opt.style.fontSize = "14px";
                        opt.style.transition = "var(--transition-fast)";

                        opt.addEventListener("mouseenter", () => {
                            opt.style.backgroundColor = "var(--color-primary-glow)";
                            opt.style.color = "var(--color-primary)";
                        });
                        opt.addEventListener("mouseleave", () => {
                            opt.style.backgroundColor = "transparent";
                            opt.style.color = "var(--color-text-main)";
                        });

                        opt.addEventListener("click", () => {
                            hiddenInput.value = u.id;
                            displayEl.textContent = textContent;
                            displayEl.style.color = "var(--color-text-main)";
                            dropdownEl.style.display = "none";
                        });
                        optionsEl.appendChild(opt);
                    }
                });

                if (!hasResults) {
                    optionsEl.innerHTML = '<div style="padding: 10px 14px; color: var(--color-text-muted);">No users found.</div>';
                }
            };
            window.renderAdminSelect();

            if (searchEl && !searchEl.dataset.bound) {
                searchEl.addEventListener("input", (e) => {
                    window.renderAdminSelect(e.target.value);
                });
                searchEl.dataset.bound = "true";
            }
        } catch (err) {
            optionsEl.innerHTML = `<div style="padding: 10px 14px; color: var(--color-danger);">${err.message}</div>`;
            showToast(err.message, "error");
        }
    }

    const modalEl = document.getElementById("assign-admin-modal");
    if (modalEl) modalEl.classList.add("active");
}

document.body.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-open-assign-admin-modal");
    if (btn) {
        triggerOpenAssignAdminModal(e);
    }
});

if (btnCloseAssignAdminModal) btnCloseAssignAdminModal.addEventListener("click", () => assignAdminModal?.classList.remove("active"));
if (btnCancelAssignAdminModal) btnCancelAssignAdminModal.addEventListener("click", () => assignAdminModal?.classList.remove("active"));

if (assignAdminForm) assignAdminForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!checkAdminAccess("assign administrator privileges")) return;

    const userIdVal = document.getElementById("assign-admin-select").value;
    const isAdminVal = document.getElementById("assign-admin-action").value === "true";

    if (!userIdVal) {
        showToast("Please select a user.", "error");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/assign-admin`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${state.token}`
            },
            body: JSON.stringify({
                user_id: parseInt(userIdVal),
                is_admin: isAdminVal
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Could not update user privileges.");
        }

        const data = await response.json();
        showToast(data.detail, "success");
        assignAdminForm.reset();
        assignAdminModal?.classList.remove("active");

        // If updating current user's own privileges, update profile state
        if (state.user && state.user.id === parseInt(userIdVal)) {
            fetchUserProfile();
        }
    } catch (err) {
        showToast(err.message, "error");
    }
});


state.storyAssigneeFilter = "all";

state.tabFilters = {
    backlog: { query: "", priority: "", milestone: "" },
    board: { query: "", priority: "", milestone: "" },
    list: { query: "", priority: "", milestone: "" }
};

function syncFiltersToDOM(tabName) {
    if (!state.tabFilters) return;
    const f = state.tabFilters[tabName];
    const search = document.getElementById("story-search");
    const milestone = document.getElementById("board-milestone-filter");
    const priority = document.getElementById("story-filter-priority");
    if (search) search.value = f.query || "";
    if (milestone) milestone.value = f.milestone || "";
    if (priority) priority.value = f.priority || "";
}

document.getElementById("btn-toggle-backlog")?.addEventListener("click", () => {
    localStorage.setItem("stories_view_tab", "backlog");
    document.getElementById("btn-toggle-backlog").classList.add("active");
    document.getElementById("btn-toggle-backlog").style.color = "#2563eb";
    document.getElementById("btn-toggle-backlog").style.borderBottom = "2px solid #2563eb";

    document.getElementById("btn-toggle-board").classList.remove("active");
    document.getElementById("btn-toggle-board").style.color = "var(--color-text-muted)";
    document.getElementById("btn-toggle-board").style.borderBottom = "2px solid transparent";

    document.getElementById("btn-toggle-list")?.classList.remove("active");
    if (document.getElementById("btn-toggle-list")) {
        document.getElementById("btn-toggle-list").style.color = "var(--color-text-muted)";
        document.getElementById("btn-toggle-list").style.borderBottom = "2px solid transparent";
    }

    if (window.jiraListClearSelection) window.jiraListClearSelection();

    document.getElementById("stories-backlog-view").classList.remove("hidden");
    document.getElementById("stories-board-view").classList.add("hidden");
    document.getElementById("stories-list-view")?.classList.add("hidden");
    
    syncFiltersToDOM("backlog");
    applyStoriesFilters();
});

document.getElementById("btn-toggle-board")?.addEventListener("click", () => {
    localStorage.setItem("stories_view_tab", "board");
    document.getElementById("btn-toggle-board").classList.add("active");
    document.getElementById("btn-toggle-board").style.color = "#2563eb";
    document.getElementById("btn-toggle-board").style.borderBottom = "2px solid #2563eb";

    document.getElementById("btn-toggle-backlog").classList.remove("active");
    document.getElementById("btn-toggle-backlog").style.color = "var(--color-text-muted)";
    document.getElementById("btn-toggle-backlog").style.borderBottom = "2px solid transparent";

    document.getElementById("btn-toggle-list")?.classList.remove("active");
    if (document.getElementById("btn-toggle-list")) {
        document.getElementById("btn-toggle-list").style.color = "var(--color-text-muted)";
        document.getElementById("btn-toggle-list").style.borderBottom = "2px solid transparent";
    }

    if (window.jiraListClearSelection) window.jiraListClearSelection();

    document.getElementById("stories-backlog-view").classList.add("hidden");
    document.getElementById("stories-board-view").classList.remove("hidden");
    document.getElementById("stories-list-view")?.classList.add("hidden");

    syncFiltersToDOM("board");
    applyStoriesFilters();
});

document.getElementById("btn-toggle-list")?.addEventListener("click", () => {
    localStorage.setItem("stories_view_tab", "list");
    document.getElementById("btn-toggle-list").classList.add("active");
    document.getElementById("btn-toggle-list").style.color = "#2563eb";
    document.getElementById("btn-toggle-list").style.borderBottom = "2px solid #2563eb";

    document.getElementById("btn-toggle-backlog").classList.remove("active");
    document.getElementById("btn-toggle-backlog").style.color = "var(--color-text-muted)";
    document.getElementById("btn-toggle-backlog").style.borderBottom = "2px solid transparent";

    document.getElementById("btn-toggle-board").classList.remove("active");
    document.getElementById("btn-toggle-board").style.color = "var(--color-text-muted)";
    document.getElementById("btn-toggle-board").style.borderBottom = "2px solid transparent";

    document.getElementById("stories-backlog-view").classList.add("hidden");
    document.getElementById("stories-board-view").classList.add("hidden");
    document.getElementById("stories-list-view")?.classList.remove("hidden");

    syncFiltersToDOM("list");
    applyStoriesFilters();
});

document.getElementById("filter-all-work")?.addEventListener("click", () => {
    state.storyAssigneeFilter = "all";
    document.getElementById("filter-all-work").style.background = "#2563eb";
    document.getElementById("filter-all-work").style.color = "#fff";
    document.getElementById("filter-my-work").style.background = "transparent";
    document.getElementById("filter-my-work").style.color = "var(--color-text-main)";
    applyStoriesFilters();
});

document.getElementById("filter-my-work")?.addEventListener("click", () => {
    state.storyAssigneeFilter = "mine";
    document.getElementById("filter-my-work").style.background = "#2563eb";
    document.getElementById("filter-my-work").style.color = "#fff";
    document.getElementById("filter-all-work").style.background = "transparent";
    document.getElementById("filter-all-work").style.color = "var(--color-text-main)";
    applyStoriesFilters();
});

document.getElementById("story-search")?.addEventListener("input", applyStoriesFilters);
document.getElementById("story-filter-priority")?.addEventListener("change", applyStoriesFilters);
document.getElementById("board-milestone-filter")?.addEventListener("change", applyStoriesFilters);

document.getElementById("btn-generate-stories")?.addEventListener("click", async () => {
    if (!checkAdminAccess("generate user stories")) return;
    const projectId = document.getElementById("story-project-select")?.value || state.globalProjectId || state.currentProject?.id;
    if (!projectId) {
        showToast("Please select a project from the top bar first to generate stories.", "error");
        return;
    }

    let title = "Generate Stories with AI?";
    let msg = "Are you sure you want to generate user stories from this project's documents using AI? This will query the AI and incur API usage costs.";
    let intent = "primary";

    if (state.stories && state.stories.length > 0) {
        title = "Regenerate Stories?";
        msg = "User stories have already been generated/created for this project.<br><br>Are you sure you want to generate stories again? This will query the AI and may incur duplicate API costs.";
        intent = "warning";
    }

    showConfirmModal(
        title,
        msg,
        "Generate",
        async () => {
            const btn = document.getElementById("btn-generate-stories");
            btn.innerHTML = `<i class="lucide-loader animate-spin"></i> Generating...`;
            btn.disabled = true;

            try {
                const res = await fetch(`${API_BASE}/api/projects/${projectId}/stories/generate`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${state.token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({})
                });

                if (res.ok) {
                    const data = await res.json();
                    showToast(data.message || "Successfully generated stories", "success");
                    loadStories();
                } else {
                    const err = await res.json();
                    showToast(err.detail || "Failed to generate stories", "error");
                }
            } catch (e) {
                showToast("Network error generating stories", "error");
            } finally {
                btn.innerHTML = `<i data-lucide="sparkles"></i> Generate Stories with AI`;
                btn.disabled = false;
                if (window.lucide) lucide.createIcons();
            }
        },
        intent
    );
});

function getProjectKeyPrefix(projectId) {
    const pId = projectId || document.getElementById("story-project-select")?.value || state.currentProject?.id || state.globalProjectId || 1;
    let proj = null;
    if (state.currentProject && String(state.currentProject.id) === String(pId)) {
        proj = state.currentProject;
    } else if (state.projects && state.projects.length > 0) {
        proj = state.projects.find(p => String(p.id) === String(pId));
    }
    if (proj && proj.name) {
        const cleanName = proj.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (cleanName.length >= 3) {
            return cleanName.slice(0, 3);
        } else if (cleanName.length > 0) {
            return cleanName;
        }
    }
    return "PH0" + pId;
}

function formatStoryKey(story, projectId) {
    const projKey = getProjectKeyPrefix(projectId);
    let seq = story.seqNumber;
    if (!seq && state.stories && state.stories.length > 0) {
        const idx = state.stories.findIndex(s => String(s.id) === String(story.id));
        if (idx !== -1) seq = idx + 1;
    }
    return `${projKey}-${seq || story.id}`;
}

async function updateMilestoneField(projectId, milestoneId, field, value, element = null) {
    try {
        const payload = {};
        payload[field] = value;
        const response = await fetch(`${API_BASE}/api/milestones/${milestoneId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            showToast("Milestone updated", "success");
            
            // update state locally
            if (state.milestones) {
                const m = state.milestones.find(ms => ms.id === milestoneId || ms.id === parseInt(milestoneId));
                if (m) {
                    m[field] = value;
                    // Also update the human-readable name for assignee/reporter
                    if (field === 'assignee_id') {
                        const member = (state.projectMembers || []).find(mb => mb.user_id === value);
                        m.assignee_name = member ? member.user_name : (value ? String(value) : null);
                    } else if (field === 'reporter_id') {
                        const member = (state.projectMembers || []).find(mb => mb.user_id === value);
                        m.reporter_name = member ? member.user_name : (value ? String(value) : null);
                    }
                }
            }

            // update styling if element is provided or by ID
            let targetEl = element || document.getElementById(`milestone-status-select-${milestoneId}`);
            if (targetEl && field === 'status') {
                targetEl.style.background = value === 'completed' ? '#DCFCE7' : 'rgba(59, 130, 246, 0.15)';
                targetEl.style.color = value === 'completed' ? '#15803D' : '#2563eb';
                targetEl.value = value;
            }

            // Re-render the list view to show updated assignee/reporter names
            if (field === 'assignee_id' || field === 'reporter_id') {
                renderStoriesListView(state.storiesList, projectId);
            }

            if (typeof loadProjectDetailMilestones === 'function') {
                loadProjectDetailMilestones(projectId); // reload milestones
            }
        } else {
            const err = await response.json();
            showToast("Failed to update milestone: " + (err.detail || "Error"), "error");
        }
    } catch (e) {
        console.error("updateMilestoneField error:", e);
        showToast("Network error", "error");
    }
}

async function loadStories() {
    const storySelect = document.getElementById("story-project-select");
    if (storySelect && !storySelect.value && state.globalProjectId) {
        storySelect.value = state.globalProjectId;
    }
    const projectId = storySelect ? storySelect.value : (state.globalProjectId || "");
    const listContainer = document.getElementById("stories-backlog-list");
    const detailPanel = document.getElementById("story-detail-panel");

    if (!listContainer) return;

    if (!projectId) {
        listContainer.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--color-text-muted); background: #F1F5F9; border-radius: 8px;">Please select a project to view or generate its user stories.</div>`;
        showStoryDetailPlaceholder(detailPanel);
        state.stories = [];
        state.selectedStoryId = null;
        applyStoriesFilters();
        return;
    }

    // Stale-While-Revalidate: render cache instantly if we have it
    if (state.stories && state.stories.length > 0) {
        applyStoriesFilters();
    } else if (!listContainer.children.length || listContainer.innerText.includes("Loading stories")) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 20px;">Loading stories...</div>`;
    }

    try {
        const [storiesRes, teamRes, msRes] = await Promise.all([
            fetch(`${API_BASE}/api/projects/${projectId}/stories`, {
                headers: { "Authorization": `Bearer ${state.token}` }
            }),
            fetch(`${API_BASE}/api/projects/${projectId}/team`, {
                headers: { "Authorization": `Bearer ${state.token}` }
            }).catch(e => null),
            fetch(`${API_BASE}/api/milestones/project/${projectId}`, {
                headers: { "Authorization": `Bearer ${state.token}` }
            }).catch(e => null)
        ]);

        if (!storiesRes.ok) throw new Error("Failed to load stories");

        const stories = await storiesRes.json();
        stories.sort((a, b) => (a.id || 0) - (b.id || 0));
        stories.forEach((s, idx) => {
            s.seqNumber = idx + 1;
        });
        
        let shouldRender = false;
        if (JSON.stringify(state.stories) !== JSON.stringify(stories)) {
            state.stories = stories;
            shouldRender = true;
        }

        if (teamRes && teamRes.ok) {
            state.projectMembers = await teamRes.json();
        } else {
            state.projectMembers = [];
        }

        if (msRes && msRes.ok) {
            state.milestones = await msRes.json();
        } else {
            state.milestones = [];
        }

        populateMilestoneDropdowns();

        if (shouldRender || (!state.stories || state.stories.length === 0)) {
            applyStoriesFilters();
            const savedTab = localStorage.getItem("stories_view_tab");
            if (state.selectedStoryId) {
                document.getElementById("btn-toggle-backlog")?.click();
            } else if (savedTab === "list") {
                document.getElementById("btn-toggle-list")?.click();
            } else if (savedTab === "board") {
                document.getElementById("btn-toggle-board")?.click();
            } else {
                document.getElementById("btn-toggle-backlog")?.click();
            }
        }

    } catch (e) {
        listContainer.innerHTML = `<div style="color: var(--color-danger); text-align: center;">Error loading stories: ${e.message}<br><small style="font-size:0.8em;opacity:0.7;">${e.stack || ""}</small></div>`;
        console.error("Story load error:", e);
    }
}
function applyStoriesFilters() {
    window.applyStoriesFilters = applyStoriesFilters;
    const projectId = document.getElementById("story-project-select")?.value;
    const listContainer = document.getElementById("stories-backlog-list");
    const detailPanel = document.getElementById("story-detail-panel");
    if (!listContainer) return;

    // Determine which tab is currently active
    const activeTab = localStorage.getItem("stories_view_tab") || "backlog";
    const isBacklogVisible = activeTab === "backlog";
    const isBoardVisible = activeTab === "board";
    const isListVisible = activeTab === "list";

    // Update active tab's filter state from DOM
    if (!state.tabFilters) {
        state.tabFilters = { backlog: {query:"", priority:"", milestone:""}, board: {query:"", priority:"", milestone:""}, list: {query:"", priority:"", milestone:""} };
    }
    state.tabFilters[activeTab] = {
        query: document.getElementById("story-search")?.value?.toLowerCase() || "",
        priority: document.getElementById("story-filter-priority")?.value || "",
        milestone: document.getElementById("board-milestone-filter")?.value || ""
    };

    const getFilteredForTab = (tabName) => {
        const fState = state.tabFilters[tabName] || {};
        return (state.stories || []).filter(story => {
            const matchesQuery = !fState.query ||
                story.title.toLowerCase().includes(fState.query) ||
                (story.description && story.description.toLowerCase().includes(fState.query));
            const matchesPriority = !fState.priority || story.priority === fState.priority;
            let matchesAssignee = true;
            if (state.storyAssigneeFilter === "mine") {
                const myUserName = state.user?.full_name || "Unassigned";
                const isStoryAssignedToMe = story.assignee === myUserName;
                const hasMyTask = (story.tasks || []).some(t => t.assigned_to && t.assigned_to === state.user?.id);
                matchesAssignee = hasMyTask || isStoryAssignedToMe;
            }
            const matchesMilestone = !fState.milestone || story.milestone_id == fState.milestone;
            return matchesQuery && matchesPriority && matchesAssignee && matchesMilestone;
        }).sort((a, b) => (a.id || 0) - (b.id || 0));
    };

    const backlogFiltered = getFilteredForTab("backlog");
    const boardFiltered = getFilteredForTab("board");
    const listFiltered = getFilteredForTab("list");

    const tabCount = document.getElementById("tab-backlog-count");
    if (tabCount) tabCount.textContent = backlogFiltered.length;
    const panelCount = document.getElementById("panel-backlog-count");
    if (panelCount) panelCount.textContent = backlogFiltered.length;
    const listTabCount = document.getElementById("tab-list-count");
    if (listTabCount) listTabCount.textContent = listFiltered.length;

    if (backlogFiltered.length === 0) {
        if (!projectId) {
            listContainer.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--color-text-muted); background: #F1F5F9; border-radius: 8px;">Please select a project to view or generate its user stories.</div>`;
        } else {
            listContainer.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--color-text-muted); background: #F1F5F9; border-radius: 8px;">No matching stories found.</div>`;
        }
        showStoryDetailPlaceholder(detailPanel);
        renderBoardList([]);
        renderStoriesListView([], projectId);
        return;
    }

    const currentlySelectedStory = state.selectedStoryId ? (state.stories || []).find(s => s.id === state.selectedStoryId) : null;
    if (!currentlySelectedStory) {
        showStoryDetailPlaceholder(detailPanel);
    } else {
        renderStoryDetail(projectId, currentlySelectedStory);
    }

    // Always render backlog list (it's lightweight)
    listContainer.innerHTML = "";

    // Render Jira Layout via inline CSS for layout if not in CSS
    const jiraLayout = document.querySelector(".jira-layout");
    if (jiraLayout) {
        jiraLayout.style.display = "grid";
        jiraLayout.style.gridTemplateColumns = "1fr 1fr";
        jiraLayout.style.gap = "20px";
        jiraLayout.style.alignItems = "start";
    }

    const backlogFrag = document.createDocumentFragment();

    backlogFiltered.forEach(story => {
        const itemHTML = document.createElement("div");
        itemHTML.style.cssText = "padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;";
        itemHTML.onmouseover = () => itemHTML.style.background = "#F1F5F9";
        itemHTML.onmouseout = () => itemHTML.style.background = "var(--bg-card)";

        const storyKey = formatStoryKey(story, projectId);
        const isOnHold = story.is_on_hold || story.status === 'On Hold';
        const milestoneObj = (state.milestones || []).find(m => m.id == story.milestone_id);
        const milestoneName = milestoneObj ? milestoneObj.title : 'Backlog';

        itemHTML.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px; margin-right: 15px; flex-grow: 1; flex-direction: column;">
                <div style="display: flex; align-items: flex-start; gap: 8px;">
                    <div style="margin-top: 2px;"><i data-lucide="${isOnHold ? 'pause-circle' : 'bookmark'}" style="color: ${isOnHold ? '#d97706' : '#2563eb'}; width: 18px; height: 18px; flex-shrink: 0;"></i></div>
                    <span style="font-weight: 700; font-family: monospace; color: #2563EB; font-size: 0.85rem; text-decoration: underline; flex-shrink: 0; margin-top: 1px;">${storyKey}</span>
                    <span style="font-weight: 500; font-size: 0.95rem; color: var(--color-text-main); line-height: 1.4;">${story.title}</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center; margin-left: 26px; margin-top: 4px; flex-wrap: wrap;">
                    <span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; background: rgba(16, 185, 129, 0.1); color: #059669; display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="flag" style="width:10px;height:10px;"></i> ${milestoneName}</span>
                    <span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; background: rgba(107, 114, 128, 0.1); color: var(--color-text-muted);">${story.story_points || 1} SP</span>
                    <span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; background: ${story.priority === 'Critical' || story.priority === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)'}; color: ${story.priority === 'Critical' || story.priority === 'High' ? '#ef4444' : '#2563eb'};">${story.priority || 'Medium'}</span>
                    ${isOnHold ? `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 700; background: #FEF3C7; color: #D97706; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="pause-circle" style="width:11px;height:11px;"></i> ON HOLD</span>` : ''}
                </div>
            </div>
            <span style="font-size: 0.75rem; background: ${isOnHold ? '#FEF3C7' : 'rgba(59, 130, 246, 0.15)'}; color: ${isOnHold ? '#D97706' : '#2563eb'}; padding: 4px 8px; border-radius: 4px; font-weight: 600; white-space: nowrap; flex-shrink: 0;">${isOnHold ? 'On Hold' : story.status}</span>
        `;

        if (story.id === state.selectedStoryId) {
            itemHTML.style.borderLeft = "4px solid #2563eb";
            itemHTML.style.background = "#F1F5F9";
            itemHTML.onmouseout = null;
        }

        itemHTML.addEventListener("click", () => {
            // Highlight active item
            Array.from(listContainer.children).forEach(c => {
                c.style.borderLeft = "1px solid var(--border-color)";
                c.style.background = "var(--bg-card)";
                c.onmouseout = () => c.style.background = "var(--bg-card)";
            });
            itemHTML.style.borderLeft = "4px solid #2563eb";
            itemHTML.style.background = "#F1F5F9";
            itemHTML.onmouseout = null; // keep highlight

            renderStoryDetail(projectId, story);
        });

        backlogFrag.appendChild(itemHTML);
    });

    listContainer.appendChild(backlogFrag);

    if (window.lucide) lucide.createIcons({ root: listContainer });

    // Only render the currently visible heavy views (board & list) on demand
    if (isBoardVisible) {
        renderBoardList(boardFiltered);
    } else {
        // Mark board as needing refresh when switched to
        state._boardNeedsRender = true;
        state._boardFilteredData = boardFiltered;
    }

    if (isListVisible) {
        renderStoriesListView(listFiltered, projectId);
    } else {
        // Mark list as needing refresh when switched to
        state._listNeedsRender = true;
        state._listFilteredData = listFiltered;
        state._listProjectId = projectId;
    }
};

async function updateStoryField(projectId, storyId, field, value) {
    try {
        const body = {};
        body[field] = value;
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/stories/${storyId}`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${state.token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error("Failed to update story");
        showToast("Story updated", "success");
        loadStories(); // Refresh backlog list and potentially panel
    } catch (e) {
        showToast(e.message, "error");
    }
}

async function updateTaskField(projectId, storyId, taskId, field, value) {
    const isGlobalAdmin = state.user?.is_admin;
    const selectedProj = state.projects?.find(p => p.id === parseInt(projectId));
    const isProjManager = selectedProj && (selectedProj.user_role === 'Manager' || selectedProj.user_role === 'Admin');
    const isAdmin = isGlobalAdmin || isProjManager;
    const story = (state.stories || []).find(s => s.id === storyId);
    const task = story?.tasks?.find(t => t.id === taskId);

    if (!isAdmin) {
        if (field !== "status") {
            showToast("Only administrators can edit task details.", "error");
            return;
        }
        if (task && task.assigned_to !== state.user?.id) {
            showToast("You can only update the status of tasks assigned to you.", "error");
            return;
        }
    }

    try {
        const body = {};
        body[field] = value;
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/stories/${storyId}/tasks/${taskId}`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${state.token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error("Failed to update task");

        const updatedTask = await res.json();

        // Update local state
        const story = state.stories.find(s => s.id === storyId);
        if (story) {
            const task = story.tasks.find(t => t.id === taskId);
            if (task) {
                Object.assign(task, updatedTask);
            }
            // Re-render the detail panel to reflect changes
            renderStoryDetail(projectId, story);
        }

        showToast("Task updated", "success");
        applyStoriesFilters();
    } catch (e) {
        showToast(e.message, "error");
    }
}

function showStoryDetailPlaceholder(panel) {
    state.selectedStoryId = null;
    if (!panel) return;
    panel.innerHTML = `
        <div class="empty-state" style="padding: 40px; text-align: center; color: var(--color-text-muted); display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 300px;">
            <div style="opacity: 0.5; margin-bottom: 16px;"><i data-lucide="book-open" style="width: 48px; height: 48px;"></i></div>
            <h3 style="font-weight: 600; font-size: 1.1rem; margin: 0; color: var(--color-text-main);">No story selected</h3>
            <p style="margin-top: 8px; font-size: 0.9rem; max-width: 250px; margin-left: auto; margin-right: auto; line-height: 1.4;">Select a user story from the backlog to view and edit its details.</p>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function closeStoryDetail() {
    window.closeStoryDetail = closeStoryDetail;
    const panel = document.getElementById("story-detail-panel");
    showStoryDetailPlaceholder(panel);

    // Clear active backlog item highlights
    const listContainer = document.getElementById("stories-backlog-list");
    if (listContainer) {
        Array.from(listContainer.children).forEach(c => {
            c.style.borderLeft = "1px solid var(--border-color)";
            c.style.background = "var(--bg-card)";
            c.onmouseout = () => c.style.background = "var(--bg-card)";
        });
    }

    // Restore backlog view layout if it was maximized
    const view = document.getElementById("stories-backlog-view");
    const backlog = document.getElementById("backlog-list-container");
    if (view && backlog) {
        view.classList.remove("detail-maximized");
        backlog.style.removeProperty("display");
        view.style.gridTemplateColumns = "1fr 1fr";
    }
}

window.toggleStoryDetailMaximize = function () {
    const view = document.getElementById("stories-backlog-view");
    const backlog = document.getElementById("backlog-list-container");
    const detail = document.getElementById("story-detail-panel");
    const maxBtn = document.getElementById("btn-story-maximize");
    if (!view || !backlog || !detail) return;

    const isMaximized = view.classList.toggle("detail-maximized");

    if (isMaximized) {
        backlog.style.setProperty("display", "none", "important");
        view.style.gridTemplateColumns = "1fr";
        if (maxBtn) {
            maxBtn.title = "Minimize Details";
            maxBtn.innerHTML = '<i data-lucide="minimize-2" style="width: 16px; height: 16px;"></i>';
        }
    } else {
        backlog.style.removeProperty("display");
        view.style.gridTemplateColumns = "1fr 1fr";
        if (maxBtn) {
            maxBtn.title = "Maximize Details";
            maxBtn.innerHTML = '<i data-lucide="maximize-2" style="width: 16px; height: 16px;"></i>';
        }
    }
    if (window.lucide) lucide.createIcons();
};

window.toggleStoryOnHold = async function (projectId, storyId, isOnHold) {
    try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/stories/${storyId}`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${state.token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ is_on_hold: isOnHold })
        });
        if (!res.ok) throw new Error("Failed to update story hold status");
        const updatedStory = await res.json();
        if (state.stories) {
            const idx = state.stories.findIndex(s => s.id === storyId);
            if (idx !== -1) {
                state.stories[idx].is_on_hold = isOnHold;
            }
        }
        showToast(isOnHold ? "Story put ON HOLD" : "Story resumed ACTIVE status", "success");
        applyStoriesFilters();
    } catch (err) {
        console.error(err);
        showToast("Error toggling on hold status", "error");
    }
};

function renderStoryDetail(projectId, story) {
    state.selectedStoryId = story?.id || null;
    let panel = document.getElementById("story-detail-panel");
    const overlayContent = document.getElementById('story-modal-content');
    
    if (document.getElementById('story-fullpage-overlay') && overlayContent) {
        panel = overlayContent;
    } else if (panel) {
        panel.classList.remove("hidden");
    }

    if (!panel) return;

    const isMax = document.getElementById("stories-backlog-view")?.classList.contains("detail-maximized");
    const maxIcon = isMax ? "minimize-2" : "maximize-2";
    const maxTitle = isMax ? "Minimize Details" : "Maximize Details";
    const isGlobalAdmin = state.user?.is_admin;
    const selectedProj = state.projects?.find(p => p.id === parseInt(projectId));
    const isProjManager = selectedProj && (selectedProj.user_role === 'Manager' || selectedProj.user_role === 'Admin');
    const isAdmin = isGlobalAdmin || isProjManager;
    const isOnHold = story.is_on_hold || story.status === 'On Hold';

    const acList = (story.acceptance_criteria || []).map((ac, idx) => `
        <div style="display: flex; align-items: center; gap: 10px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; margin-bottom: 8px;">
            <span style="color: var(--color-primary); font-weight: 700; font-size: 0.85rem; min-width: 20px;">${idx + 1}.</span>
            <input type="text" class="editable-input" data-idx="${idx}" value="${(ac || '').replace(/"/g, '&quot;')}" style="flex-grow: 1; background: transparent; border: none; color: var(--color-text-main); font-size: 0.95rem; outline: none; font-family: inherit;">
            ${isAdmin ? `
            <button type="button" onclick="removeAcceptanceCriterion(${projectId}, ${story.id}, ${idx})" style="cursor: pointer; width: 26px; height: 26px; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: #EF4444; flex-shrink: 0; transition: background 0.15s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.1)'" onmouseout="this.style.background='transparent'" title="Delete Criterion">
                <i data-lucide="x" style="width: 16px; height: 16px;"></i>
            </button>
            ` : ''}
        </div>`).join("");

    const tasksList = (story.tasks || []).map((t, idx) => {
        let badgeBg = "#E0F2FE"; let badgeColor = "#0284C7";
        if (t.task_type === "Frontend") { badgeBg = "#FFEDD5"; badgeColor = "#C2410C"; }
        else if (t.task_type === "Backend") { badgeBg = "#DBEAFE"; badgeColor = "#1D4ED8"; }
        else if (t.task_type === "AI") { badgeBg = "#DCFCE7"; badgeColor = "#15803D"; }
        else if (t.task_type === "Manager") { badgeBg = "#F3E8FF"; badgeColor = "#7E22CE"; }
        else if (t.task_type === "QA") { badgeBg = "#FFE4E6"; badgeColor = "#E11D48"; }
        else {
            const str = t.task_type || "Task";
            let hash = 0;
            for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
            const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
            const hex = '#' + "00000".substring(0, 6 - c.length) + c;
            badgeBg = hex + "22";
            badgeColor = hex;
        }

        const membersOptions = (state.projectMembers || []).map(m => `
            <option value="${m.user_id}" ${t.assigned_to === m.user_id ? 'selected' : ''}>${m.user_name}</option>
        `).join("");

        const taskSeqText = formatStoryKey(story, projectId) + "-" + (idx + 1);
        return `
        <div class="subtask-item-row" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 14px; margin-bottom: 8px;">
            <!-- Left: Subtask Type Badge + Title -->
            <div class="subtask-item-left" style="display: flex; align-items: center; gap: 10px; flex: 1 1 250px; min-width: 0;">
                <span style="font-size: 0.75rem; color: var(--color-text-muted); font-weight: 700; flex-shrink: 0;">${taskSeqText}</span>
                <select onchange="updateTaskField(${projectId}, ${story.id}, ${t.id}, 'task_type', this.value)" style="font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; background: ${badgeBg}; color: ${badgeColor}; border: none; outline: none; text-transform: uppercase; cursor: pointer; flex-shrink: 0; font-family: inherit;" >
                    <option value="General" ${t.task_type === 'General' || !t.task_type ? 'selected' : ''} style="background: var(--bg-surface); color: var(--color-text-main);">General</option>
                    <option value="Frontend" ${t.task_type === 'Frontend' ? 'selected' : ''} style="background: var(--bg-surface); color: var(--color-text-main);">Frontend</option>
                    <option value="Backend" ${t.task_type === 'Backend' ? 'selected' : ''} style="background: var(--bg-surface); color: var(--color-text-main);">Backend</option>
                    <option value="AI" ${t.task_type === 'AI' ? 'selected' : ''} style="background: var(--bg-surface); color: var(--color-text-main);">AI</option>
                    <option value="QA" ${t.task_type === 'QA' ? 'selected' : ''} style="background: var(--bg-surface); color: var(--color-text-main);">QA</option>
                    <option value="Manager" ${t.task_type === 'Manager' ? 'selected' : ''} style="background: var(--bg-surface); color: var(--color-text-main);">Manager</option>
                    <option value="DevOps" ${t.task_type === 'DevOps' ? 'selected' : ''} style="background: var(--bg-surface); color: var(--color-text-main);">DevOps</option>
                </select>
                <input type="text" value="${(t.title || '').replace(/"/g, '&quot;')}" onchange="updateTaskField(${projectId}, ${story.id}, ${t.id}, 'title', this.value)" style="flex: 1 1 100px; min-width: 0; background: transparent; border: none; font-size: 0.95rem; font-weight: 500; color: var(--color-text-main); outline: none; text-overflow: ellipsis;" >
            </div>
            <!-- Right: Assignee, Status, Delete -->
            <div class="subtask-item-right" style="display: flex; align-items: center; gap: 8px; flex: 0 0 auto; flex-wrap: wrap;">
                <select onchange="updateTaskField(${projectId}, ${story.id}, ${t.id}, 'assigned_to', this.value ? parseInt(this.value) : null)" style="background: var(--bg-body); border: 1px solid var(--border-color); padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; color: var(--color-text-main); cursor: pointer;" >
                    <option value="">Unassigned</option>
                    ${membersOptions}
                </select>
                <select onchange="updateTaskField(${projectId}, ${story.id}, ${t.id}, 'status', this.value)" style="background: rgba(14, 165, 233, 0.12); color: #0284C7; border: 1px solid rgba(14, 165, 233, 0.3); padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
                    <option value="To Do" ${t.status === 'To Do' ? 'selected' : ''}>To Do</option>
                    <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Dev Done" ${t.status === 'Dev Done' ? 'selected' : ''}>Dev Done</option>
                    <option value="Ready for QA" ${t.status === 'Ready for QA' ? 'selected' : ''}>Ready for QA</option>
                    <option value="QA Done" ${t.status === 'QA Done' ? 'selected' : ''}>QA Done</option>
                    <option value="Complete" ${t.status === 'Complete' || t.status === 'Done' ? 'selected' : ''}>Complete</option>
                </select>
                ${isAdmin ? `
                <button type="button" onclick="deleteTask(${projectId}, ${story.id}, ${t.id})" style="width: 26px; height: 26px; border-radius: 4px; border: none; background: transparent; color: #EF4444; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Delete Subtask">
                    <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
                </button>
                ` : ''}
            </div>
        </div>
        `;
    }).join("");

    const commentsList = (story.comments || []).map(c => `
        <div style="background: var(--bg-body); border: 1px solid var(--border-color); padding: 10px 14px; border-radius: 8px; font-size: 0.9rem; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; align-items: center;">
                <strong style="color: var(--color-text-main); font-size: 0.85rem;">${c.author || 'Anonymous'}</strong>
                <span style="font-size: 0.75rem; color: var(--color-text-muted);">${c.timestamp || ''}</span>
            </div>
            <div style="color: var(--color-text-main); line-height: 1.4; margin-top: 4px;">${c.text}</div>
        </div>
    `).join("");

    panel.innerHTML = `
        <!-- Jira Header Bar -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 24px;">
            <!-- Left: Jira Issue Type Icon + Key -->
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #E0F2FE; color: #0284C7; border-radius: 6px;" title="User Story">
                    <i data-lucide="bookmark" style="width: 16px; height: 16px; fill: currentColor;"></i>
                </span>
                <span style="font-size: 0.95rem; font-weight: 700; color: #2563EB; font-family: monospace; letter-spacing: 0.4px;">
                    ${formatStoryKey(story, projectId)}
                </span>
                ${isOnHold ? '<span style="background: #FEF3C7; color: #D97706; font-size: 0.75rem; font-weight: 700; padding: 3px 10px; border-radius: 12px; border: 1px solid #FCD34D;">ON HOLD</span>' : ''}
            </div>
            <!-- Right: Action Buttons -->
            <div style="display: flex; align-items: center; gap: 8px;">
                ${isAdmin ? `
                <button onclick="deleteStory(${projectId}, ${story.id})" class="btn btn-secondary btn-sm" style="color: #EF4444; border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05); display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 6px;" title="Delete Story">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Delete
                </button>
                ` : ''}
                <button id="btn-story-maximize" onclick="toggleStoryDetailMaximize()" class="btn btn-secondary btn-sm" style="padding: 6px 10px; border-radius: 6px; display: flex; align-items: center;" title="${maxTitle}">
                    <i data-lucide="${maxIcon}" style="width: 16px; height: 16px;"></i>
                </button>
                <button onclick="closeStoryDetail()" class="btn btn-secondary btn-sm" style="padding: 6px 10px; border-radius: 6px; display: flex; align-items: center;" title="Close Details">
                    <i data-lucide="x" style="width: 16px; height: 16px;"></i>
                </button>
            </div>
        </div>

        <!-- Jira Two-Column Layout -->
        <div style="display: flex; flex-wrap: wrap; gap: 28px; align-items: flex-start;">
            <!-- Left Column: Main Issue Content -->
            <div style="flex: 1 1 440px; min-width: 0;">
                <!-- Summary / Title -->
                <div style="position: relative; margin-bottom: 24px;">
                    <textarea id="title-input-${story.id}" oninput="document.getElementById('title-save-btn-${story.id}').style.display = 'flex';" rows="1" style="font-size: 1.4rem; font-weight: 700; color: var(--color-text-main); background: transparent; border: 1px solid transparent; width: 100%; padding: 6px 8px; border-radius: 6px; resize: none; overflow: hidden; line-height: 1.35; font-family: inherit; transition: border-color 0.15s, background 0.15s;" onfocus="this.style.border='1px solid var(--border-color)'; this.style.background='var(--bg-card)';" onblur="this.style.border='1px solid transparent'; this.style.background='transparent';">${story.title}</textarea>
                    <div id="title-save-btn-${story.id}" style="display: none; margin-top: 8px; gap: 8px; justify-content: flex-end;">
                        <button type="button" onclick="updateStoryField(${projectId}, ${story.id}, 'title', document.getElementById('title-input-${story.id}').value); this.parentElement.style.display='none';" class="btn btn-primary" style="padding: 4px 12px; font-size: 0.85rem; font-weight: 600;">Save</button>
                        <button type="button" onclick="document.getElementById('title-input-${story.id}').value = \`${(story.title || '').replace(/`/g, '\`')}\`; this.parentElement.style.display='none';" class="btn btn-secondary" style="padding: 4px 12px; font-size: 0.85rem; font-weight: 600;">Cancel</button>
                    </div>
                </div>

                <!-- Description Section -->
                <div style="margin-bottom: 28px;">
                    <h4 style="font-size: 0.8rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="align-left" style="width: 16px; height: 16px; color: var(--color-primary);"></i> Description
                    </h4>
                    <div style="position: relative;">
                        <textarea id="desc-input-${story.id}" oninput="document.getElementById('desc-save-btn-${story.id}').style.display = 'flex';" placeholder="Add a description..." style="width: 100%; min-height: 90px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; color: var(--color-text-main); font-size: 0.95rem; line-height: 1.5; resize: vertical; font-family: inherit;">${story.description || ''}</textarea>
                        <div id="desc-save-btn-${story.id}" style="display: none; margin-top: 8px; gap: 8px; justify-content: flex-end;">
                            <button type="button" onclick="updateStoryField(${projectId}, ${story.id}, 'description', document.getElementById('desc-input-${story.id}').value); this.parentElement.style.display='none';" class="btn btn-primary" style="padding: 4px 12px; font-size: 0.85rem; font-weight: 600;">Save</button>
                            <button type="button" onclick="document.getElementById('desc-input-${story.id}').value = \`${(story.description || '').replace(/`/g, '\`')}\`; this.parentElement.style.display='none';" class="btn btn-secondary" style="padding: 4px 12px; font-size: 0.85rem; font-weight: 600;">Cancel</button>
                        </div>
                    </div>
                </div>

                <!-- Acceptance Criteria Section -->
                <div style="margin-bottom: 28px;">
                    <h4 style="font-size: 0.8rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="check-square" style="width: 16px; height: 16px; color: var(--color-primary);"></i> Acceptance Criteria
                    </h4>
                    <div id="ac-list-${story.id}">
                        ${acList || '<div style="color: var(--color-text-muted); font-size: 0.9rem; font-style: italic; margin-bottom: 10px;">No acceptance criteria yet.</div>'}
                    </div>
                    ${isAdmin ? `
                    <div style="display: flex; gap: 8px; margin-top: 12px;">
                        <input type="text" id="new-ac-input-${story.id}" placeholder="Add acceptance criterion..." style="flex-grow: 1; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-card); color: var(--color-text-main); font-size: 0.9rem;">
                        <button type="button" onclick="addAcceptanceCriterion(${projectId}, ${story.id})" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 6px; font-weight: 600; padding: 0 14px; height: 38px;">
                            <i data-lucide="plus" style="width: 14px; height: 14px;"></i> Add
                        </button>
                    </div>
                    ` : ''}
                </div>

                <!-- Subtasks Section -->
                <div style="margin-bottom: 28px;">
                    <h4 style="font-size: 0.8rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="layers" style="width: 16px; height: 16px; color: var(--color-primary);"></i> Subtasks
                    </h4>
                    <div id="tasks-list-${story.id}">
                        ${tasksList || '<div style="color: var(--color-text-muted); font-size: 0.9rem; font-style: italic; margin-bottom: 10px;">No subtasks yet. Create a subtask below.</div>'}
                    </div>
                    ${isAdmin ? `
                    <div style="margin-top: 12px;">
                        <button type="button" onclick="window.openSubtaskModal(${projectId}, ${story.id})" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 6px; font-weight: 600;">
                            <i data-lucide="plus" style="width: 14px; height: 14px;"></i> Create Subtask
                        </button>
                    </div>
                    ` : ''}
                </div>

                <!-- Comments Section -->
                <div style="border-top: 1px solid var(--border-color); padding-top: 24px;">
                    <h4 style="font-size: 0.8rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 14px 0; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="message-square" style="width: 16px; height: 16px; color: var(--color-primary);"></i> Comments
                    </h4>
                    <div id="story-comments-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px; max-height: 240px; overflow-y: auto;">
                        ${commentsList || '<div style="color: var(--color-text-muted); font-size: 0.9rem; font-style: italic;">No comments yet.</div>'}
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="new-comment-text" placeholder="Add a comment..." style="flex-grow: 1; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); color: var(--color-text-main); font-size: 0.9rem;">
                        <button type="button" onclick="addStoryComment(${projectId}, ${story.id})" class="btn btn-primary" style="padding: 8px 16px; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; font-weight: 600;">
                            <i data-lucide="send" style="width: 14px; height: 14px;"></i> Send
                        </button>
                    </div>
                </div>
            </div>

            <!-- Right Column: Jira Details Sidebar -->
            <div style="width: 280px; flex-shrink: 0; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 18px;">
                <!-- Status Dropdown Pill -->
                <div style="margin-bottom: 20px;">
                    <label style="font-size: 0.72rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
                        Status
                    </label>
                    <select onchange="updateStoryField(${projectId}, ${story.id}, 'status', this.value)" style="width: 100%; background: #E0F2FE; color: #0284C7; border: 1px solid #BAE6FD; padding: 8px 12px; border-radius: 6px; font-weight: 700; font-size: 0.9rem; cursor: pointer;">
                        <option value="To Do" ${story.status === 'To Do' ? 'selected' : ''}>TO DO</option>
                        <option value="In Progress" ${story.status === 'In Progress' ? 'selected' : ''}>IN PROGRESS</option>
                        <option value="Dev Done" ${story.status === 'Dev Done' ? 'selected' : ''}>DEV DONE</option>
                        <option value="Ready for QA" ${story.status === 'Ready for QA' ? 'selected' : ''}>READY FOR QA</option>
                        <option value="QA Done" ${story.status === 'QA Done' ? 'selected' : ''}>QA DONE</option>
                        <option value="Complete" ${story.status === 'Complete' || story.status === 'Done' ? 'selected' : ''}>COMPLETE</option>
                        <option value="On Hold" ${story.status === 'On Hold' ? 'selected' : ''}>ON HOLD</option>
                    </select>
                </div>

                <!-- Details List -->
                <div style="border-top: 1px solid var(--border-color); padding-top: 16px;">
                    <h4 style="font-size: 0.78rem; font-weight: 700; color: var(--color-text-main); text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 14px 0;">
                        Details
                    </h4>

                    <!-- Priority -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                        <span style="font-size: 0.85rem; color: var(--color-text-muted); font-weight: 600;">Priority</span>
                        <select onchange="updateStoryField(${projectId}, ${story.id}, 'priority', this.value)" style="background: var(--bg-body); border: 1px solid var(--border-color); padding: 5px 10px; border-radius: 6px; color: var(--color-text-main); font-size: 0.85rem; font-weight: 600; cursor: pointer;">
                            <option value="Low" ${story.priority === 'Low' ? 'selected' : ''}>Low</option>
                            <option value="Medium" ${story.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                            <option value="High" ${story.priority === 'High' ? 'selected' : ''}>High</option>
                            <option value="Critical" ${story.priority === 'Critical' ? 'selected' : ''}>Critical</option>
                        </select>
                    </div>

                    <!-- Epic / Milestone -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                        <span style="font-size: 0.85rem; color: var(--color-text-muted); font-weight: 600;">Milestone</span>
                        <select id="detail-milestone-select-${story.id}" onchange="updateStoryField(${projectId}, ${story.id}, 'milestone_id', this.value ? parseInt(this.value) : null)" style="background: var(--bg-body); border: 1px solid var(--border-color); padding: 5px 10px; border-radius: 6px; color: var(--color-text-main); font-size: 0.85rem; font-weight: 600; cursor: pointer; max-width: 140px; text-overflow: ellipsis;">
                            <option value="">None</option>
                            ${(state.milestones || []).map(function (m) { return '<option value="' + m.id + '"' + (story.milestone_id === m.id ? ' selected' : '') + '>' + m.title + '</option>'; }).join('')}
                        </select>
                    </div>

                    <!-- Story Points -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                        <span style="font-size: 0.85rem; color: var(--color-text-muted); font-weight: 600;">Story Points</span>
                        <select onchange="updateStoryField(${projectId}, ${story.id}, 'story_points', parseInt(this.value))" style="background: var(--bg-body); border: 1px solid var(--border-color); padding: 5px 10px; border-radius: 6px; color: var(--color-text-main); font-size: 0.85rem; font-weight: 600; cursor: pointer;">
                            <option value="1" ${story.story_points === 1 ? 'selected' : ''}>1 SP</option>
                            <option value="2" ${story.story_points === 2 ? 'selected' : ''}>2 SP</option>
                            <option value="3" ${story.story_points === 3 ? 'selected' : ''}>3 SP</option>
                            <option value="5" ${story.story_points === 5 ? 'selected' : ''}>5 SP</option>
                            <option value="8" ${story.story_points === 8 ? 'selected' : ''}>8 SP</option>
                        </select>
                    </div>

                    <!-- On Hold Toggle -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                        <span style="font-size: 0.85rem; color: var(--color-text-muted); font-weight: 600;">On Hold</span>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <span style="background: ${isOnHold ? '#F59E0B' : 'var(--border-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 700;">
                                ${isOnHold ? 'ON HOLD' : 'ACTIVE'}
                            </span>
                            <input type="checkbox" ${isOnHold ? 'checked' : ''} onchange="toggleStoryOnHold(${projectId}, ${story.id}, this.checked)" style="width: 16px; height: 16px; accent-color: #F59E0B; cursor: pointer;">
                        </label>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add event listeners for Acceptance Criteria changes
    const inputs = panel.querySelectorAll('.editable-input');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            const newACs = Array.from(inputs).map(inp => inp.value);
            updateStoryField(projectId, story.id, 'acceptance_criteria', newACs);
        });
    });

    panel.querySelector("#new-comment-text")?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            addStoryComment(projectId, story.id);
        }
    });

    panel.querySelector(`#new-ac-input-${story.id}`)?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addAcceptanceCriterion(projectId, story.id);
        }
    });

    panel.querySelector(`#new-task-title-${story.id}`)?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addStoryTask(projectId, story.id);
        }
    });

    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        panel.querySelectorAll("textarea").forEach(ta => {
            ta.style.height = 'auto';
            ta.style.height = (ta.scrollHeight) + 'px';
        });
    }, 10);
}

window.addStoryComment = async function (projectId, storyId) {
    const input = document.getElementById("new-comment-text");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    // Create new comment object
    const newComment = {
        id: Math.random().toString(36).substr(2, 9),
        author: state.user ? state.user.full_name : "Anonymous",
        text: text,
        timestamp: new Date().toLocaleString()
    };

    // Find story in state to get existing comments
    const story = (state.stories || []).find(s => s.id === storyId);
    if (!story) return;

    const existingComments = story.comments || [];
    const updatedComments = [...existingComments, newComment];

    try {
        const body = { comments: updatedComments };
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/stories/${storyId}`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${state.token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error("Failed to add comment");

        showToast("Comment added", "success");
        input.value = "";

        // Reload all stories and render story detail
        await loadStories();

        const refreshedStory = (state.stories || []).find(s => s.id === storyId);
        if (refreshedStory) {
            renderStoryDetail(projectId, refreshedStory);
        }
    } catch (e) {
        showToast(e.message, "error");
    }
};

window.deleteStory = async function (projectId, storyId, skipConfirm = false, skipReload = false) {
    if (!checkAdminAccess("delete user stories")) return;

    const doDelete = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/projects/${projectId}/stories/${storyId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${state.token}` }
            });
            if (res.ok) {
                if (!skipConfirm) showToast("User story deleted", "success");
                closeStoryDetail();
                if (!skipReload) loadStories();
            } else {
                const err = await res.json();
                showToast(err.detail || "Failed to delete story", "error");
            }
        } catch (e) {
            showToast(e.message, "error");
        }
    };

    if (skipConfirm) {
        doDelete();
    } else {
        showConfirmModal(
            "Delete User Story?",
            "Are you sure you want to delete this user story? This will also delete all of its tasks.",
            "Delete Story",
            doDelete,
            "danger"
        );
    }
};

window.deleteTask = async function (projectId, storyId, taskId) {
    if (!checkAdminAccess("delete tasks")) return;

    showConfirmModal(
        "Delete Task?",
        "Are you sure you want to delete this task?",
        "Delete",
        async () => {
            try {
                const res = await fetch(`${API_BASE}/api/projects/${projectId}/stories/${storyId}/tasks/${taskId}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${state.token}` }
                });
                if (res.ok) {
                    showToast("Task deleted", "success");
                    await loadStories();

                    // Reload story details panel
                    const sRes = await fetch(`${API_BASE}/api/projects/${projectId}/stories`, {
                        headers: { "Authorization": `Bearer ${state.token}` }
                    });
                    if (sRes.ok) {
                        const stories = await sRes.json();
                        const currentStory = stories.find(s => s.id === storyId);
                        if (currentStory) {
                            renderStoryDetail(projectId, currentStory);
                        } else {
                            document.getElementById("story-detail-panel").classList.add("hidden");
                        }
                    }
                } else {
                    const err = await res.json();
                    showToast(err.detail || "Failed to delete task", "error");
                }
            } catch (e) {
                showToast(e.message, "error");
            }
        },
        "danger"
    );
};

window.addAcceptanceCriterion = async function (projectId, storyId) {
    const input = document.getElementById(`new-ac-input-${storyId}`);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const story = (state.stories || []).find(s => s.id === storyId);
    if (!story) return;

    const existingACs = story.acceptance_criteria || [];
    const updatedACs = [...existingACs, text];

    try {
        await updateStoryField(projectId, storyId, 'acceptance_criteria', updatedACs);
        input.value = "";

        await loadStories();
        const refreshedStory = (state.stories || []).find(s => s.id === storyId);
        if (refreshedStory) {
            renderStoryDetail(projectId, refreshedStory);
        }
    } catch (e) {
        showToast(e.message, "error");
    }
};

window.removeAcceptanceCriterion = async function (projectId, storyId, idx) {

    showConfirmModal(
        "Delete Criterion?",
        "Are you sure you want to delete this acceptance criterion?",
        "Delete",
        async () => {
            const story = (state.stories || []).find(s => s.id === storyId);
            if (!story) return;
            const updatedACs = (story.acceptance_criteria || []).filter((_, i) => i !== idx);
            try {
                await updateStoryField(projectId, storyId, 'acceptance_criteria', updatedACs);
                await loadStories();
                const refreshedStory = (state.stories || []).find(s => s.id === storyId);
                if (refreshedStory) {
                    renderStoryDetail(projectId, refreshedStory);
                }
            } catch (e) {
                showToast(e.message, "error");
            }
        },
        "danger"
    );
};

window.addStoryTask = async function (projectId, storyId) {
    const titleInput = document.getElementById(`new-task-title-${storyId}`);
    const typeSelect = document.getElementById(`new-task-type-${storyId}`);
    if (!titleInput || !typeSelect) return;

    const title = titleInput.value.trim();
    if (!title) {
        showToast("Please enter a subtask title", "error");
        return;
    }

    const taskType = typeSelect.value;

    try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/stories/${storyId}/tasks`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${state.token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: title,
                task_type: taskType,
                status: "To Do"
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to create subtask");
        }

        showToast("Subtask created", "success");
        titleInput.value = "";

        await loadStories();
        const refreshedStory = (state.stories || []).find(s => s.id === storyId);
        if (refreshedStory) {
            renderStoryDetail(projectId, refreshedStory);
        }
    } catch (e) {
        showToast(e.message, "error");
    }
};

window.renderBoard = function () {
    applyStoriesFilters();
};

function renderBoardList(storiesList) {
    window.renderBoardList = renderBoardList;
    const projectId = document.getElementById("story-project-select")?.value;
    const todoContainer = document.getElementById("cards-todo");
    const inprogressContainer = document.getElementById("cards-inprogress");
    const devdoneContainer = document.getElementById("cards-devdone");
    const readyforqaContainer = document.getElementById("cards-readyforqa");
    const qadoneContainer = document.getElementById("cards-qadone");
    const completeContainer = document.getElementById("cards-complete");

    if (!todoContainer || !inprogressContainer || !devdoneContainer || !readyforqaContainer || !qadoneContainer || !completeContainer) return;

    todoContainer.innerHTML = "";
    inprogressContainer.innerHTML = "";
    devdoneContainer.innerHTML = "";
    readyforqaContainer.innerHTML = "";
    qadoneContainer.innerHTML = "";
    completeContainer.innerHTML = "";

    if (!projectId || !storiesList || storiesList.length === 0) {
        document.getElementById("badge-todo-count").textContent = "0";
        document.getElementById("badge-inprogress-count").textContent = "0";
        document.getElementById("badge-devdone-count").textContent = "0";
        document.getElementById("badge-readyforqa-count").textContent = "0";
        document.getElementById("badge-qadone-count").textContent = "0";
        document.getElementById("badge-complete-count").textContent = "0";
        return;
    }

    let todoCount = 0;
    let inprogressCount = 0;
    let devdoneCount = 0;
    let readyforqaCount = 0;
    let qadoneCount = 0;
    let completeCount = 0;

    const priorityWeights = { 'Critical': 1, 'High': 2, 'Medium': 3, 'Low': 4 };
    const sortedStories = [...storiesList].sort((a, b) => {
        const wA = priorityWeights[a.priority] || 5;
        const wB = priorityWeights[b.priority] || 5;
        if (wA !== wB) return wA - wB;
        return (b.id || 0) - (a.id || 0);
    });

    sortedStories.forEach(story => {
        const card = document.createElement("div");
        card.className = "board-card";
        card.draggable = true;
        card.dataset.storyId = story.id;
        card.dataset.projectId = projectId;

        card.style.cssText = "background: var(--bg-body); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; cursor: grab; display: flex; flex-direction: column; gap: 8px; transition: transform 0.15s, box-shadow 0.15s;";
        card.onmouseover = () => { card.style.transform = 'translateY(-2px)'; card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; };
        card.onmouseout = () => { card.style.transform = 'none'; card.style.boxShadow = 'none'; };

        card.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", story.id);
            card.style.opacity = "0.5";
        });
        card.addEventListener("dragend", () => {
            card.style.opacity = "1";
        });

        // Count subtasks completed vs total
        const totalTasks = story.tasks ? story.tasks.length : 0;
        const completedTasks = story.tasks ? story.tasks.filter(t => t.status === "Complete" || t.status === "Done").length : 0;
        const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Priority color style
        let priorityColor = "#2563eb";
        let priorityBg = "rgba(59, 130, 246, 0.1)";
        if (story.priority === "Critical" || story.priority === "High") {
            priorityColor = "#ef4444";
            priorityBg = "rgba(239, 68, 68, 0.1)";
        } else if (story.priority === "Low") {
            priorityColor = "#6b7280";
            priorityBg = "rgba(107, 114, 128, 0.1)";
        }

        const bStoryKey = formatStoryKey(story, projectId);
        const milestoneObj = (state.milestones || []).find(m => m.id == story.milestone_id);
        const milestoneBadge = milestoneObj ? `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: #f1f5f9; color: #475569; font-weight: 600; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;" title="${milestoneObj.title}"><i data-lucide="milestone" style="width: 10px; height: 10px;"></i> ${milestoneObj.title}</span>` : '';

        card.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span onclick="openStoryDetailModal(${projectId}, ${story.id})" style="font-weight: 700; font-family: monospace; color: #2563EB; font-size: 0.78rem; text-decoration: underline; cursor: pointer;">${bStoryKey}</span>
                ${milestoneBadge}
            </div>
            <div onclick="openStoryDetailModal(${projectId}, ${story.id})" style="font-weight: 600; font-size: 0.9rem; color: var(--color-text-main); line-height: 1.4; cursor: pointer; transition: color 0.15s;" onmouseover="this.style.color='#2563EB'" onmouseout="this.style.color='var(--color-text-main)'">${story.title}</div>
            
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                <div style="display: flex; gap: 6px; align-items: center;">
                    <span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; background: ${priorityBg}; color: ${priorityColor};">${story.priority || 'Medium'}</span>
                    <span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; background: rgba(139, 92, 246, 0.15); color: #8b5cf6; display: flex; align-items: center; gap: 3px;"><i data-lucide="layers" style="width: 10px; height: 10px;"></i> ${completedTasks}/${totalTasks} Tasks</span>
                </div>
                <span style="font-size: 0.75rem; padding: 2px 6px; border-radius: 12px; background: rgba(107, 114, 128, 0.15); color: var(--color-text-muted); font-weight: 700;">${story.story_points || 1} SP</span>
            </div>
            
            ${totalTasks > 0 ? `
            <div style="width: 100%; height: 4px; background: var(--border-color); border-radius: 2px; margin-top: 4px; overflow: hidden;">
                <div style="width: ${progressPercent}%; height: 100%; background: #10b981; border-radius: 2px;"></div>
            </div>
            ` : ''}
        `;

        if (story.status === "In Progress") {
            inprogressContainer.appendChild(card);
            inprogressCount++;
        } else if (story.status === "Dev Done") {
            devdoneContainer.appendChild(card);
            devdoneCount++;
        } else if (story.status === "Ready for QA") {
            readyforqaContainer.appendChild(card);
            readyforqaCount++;
        } else if (story.status === "QA Done") {
            qadoneContainer.appendChild(card);
            qadoneCount++;
        } else if (story.status === "Complete" || story.status === "Done") {
            completeContainer.appendChild(card);
            completeCount++;
        } else {
            todoContainer.appendChild(card);
            todoCount++;
        }
    });

    document.getElementById("badge-todo-count").textContent = todoCount;
    document.getElementById("badge-inprogress-count").textContent = inprogressCount;
    document.getElementById("badge-devdone-count").textContent = devdoneCount;
    document.getElementById("badge-readyforqa-count").textContent = readyforqaCount;
    document.getElementById("badge-qadone-count").textContent = qadoneCount;
    document.getElementById("badge-complete-count").textContent = completeCount;

    if (window.lucide) lucide.createIcons();
};

window.toggleJiraListHierarchy = function (storyId, projectId) {
    state.jiraListCollapsed = state.jiraListCollapsed || new Set();
    const strId = String(storyId);
    let isNowCollapsed;
    if (state.jiraListCollapsed.has(strId)) {
        state.jiraListCollapsed.delete(strId);
        isNowCollapsed = false;
    } else {
        state.jiraListCollapsed.add(strId);
        isNowCollapsed = true;
    }

    // Toggle DOM elements directly to avoid resetting list view states (like milestone collapses)
    const iconBtn = document.querySelector(`button[onclick="toggleJiraListHierarchy('${storyId}', '${projectId}')"] i`);
    if (iconBtn) {
        iconBtn.setAttribute('data-lucide', isNowCollapsed ? 'chevron-right' : 'chevron-down');
        if (window.lucide) lucide.createIcons();
    }

    const subtaskRows = document.querySelectorAll(`.subtask-row-${storyId}`);
    subtaskRows.forEach(row => {
        row.style.display = isNowCollapsed ? 'none' : 'table-row';
    });
};

window.toggleMilestoneGroup = function(headerElem) {
    const icon = headerElem.querySelector('.group-toggle-icon');
    let isCollapsed = false;
    if (icon) {
        if (icon.style.transform === "rotate(-90deg)") {
            icon.style.transform = "rotate(0deg)";
            isCollapsed = false;
        } else {
            icon.style.transform = "rotate(-90deg)";
            isCollapsed = true;
        }
    }
    
    let nextRow = headerElem.nextElementSibling;
    while (nextRow && !nextRow.classList.contains("milestone-group-header")) {
        if (isCollapsed) {
            nextRow.style.display = "none";
        } else {
            // We are expanding the milestone group.
            if (nextRow.hasAttribute('data-parent-story-id')) {
                // This is a subtask row. Only show it if its parent story is expanded.
                const parentId = nextRow.getAttribute('data-parent-story-id');
                const isParentCollapsed = state.jiraListCollapsed && state.jiraListCollapsed.has(String(parentId));
                nextRow.style.display = isParentCollapsed ? "none" : "table-row";
            } else {
                // This is a story row. Show it.
                nextRow.style.display = "table-row";
            }
        }
        nextRow = nextRow.nextElementSibling;
    }
};

function renderStoriesListView(storiesList, projectId) {
    const tableBody = document.getElementById("stories-list-table-body");
    if (!tableBody) return;

    storiesList = storiesList || state.storiesList || state.stories || [];
    state.storiesList = storiesList;

    if (!projectId) {
        projectId = state.globalProjectId || document.getElementById("story-project-select")?.value || "";
    }

    if (!storiesList || storiesList.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="padding: 30px; text-align: center; color: var(--color-text-muted); font-style: italic;">
                    No work items to display in List View.
                </td>
            </tr>
        `;
        const footerCount = document.getElementById("jira-list-footer-count");
        if (footerCount) footerCount.textContent = "0 of 0";
        return;
    }

    if (!state.jiraListCollapsed || String(state.jiraListInitializedProject) !== String(projectId)) {
        state.jiraListCollapsed = new Set(storiesList.map(s => String(s.id)));
        state.jiraListInitializedProject = projectId;
    }
    const projKey = getProjectKeyPrefix(projectId);
    let html = "";
    let totalRowsDisplayed = 0;

    const isGlobalAdmin = state.user?.is_admin;
    const selectedProj = state.projects?.find(p => p.id === parseInt(projectId));
    const isProjManager = selectedProj && (selectedProj.user_role === 'Manager' || selectedProj.user_role === 'Admin');
    const isAdmin = isGlobalAdmin || isProjManager;
    const members = state.projectMembers || [];
    const currentUserName = state.user?.full_name || "Unassigned";

    const milestones = state.milestones || [];
    const grouped = { unassigned: [] };
    milestones.forEach(ms => grouped[ms.id] = { ms, stories: [] });

    storiesList.forEach(story => {
        const mId = story.milestone_id;
        if (mId && grouped[mId]) grouped[mId].stories.push(story);
        else grouped["unassigned"].push(story);
    });

    const renderGroupStories = (groupStories) => {
        groupStories.forEach(story => {
            const storyKey = formatStoryKey(story, projectId);
        const createdDate = story.created_at ? new Date(story.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : "Jul 09, 2026, 3:26 PM";
        const isCollapsed = state.jiraListCollapsed.has(String(story.id));
        const tasks = story.tasks || [];
        const hasChildren = tasks.length > 0;

        // Status pill styling
        const statusVal = story.status || "To Do";
        let statusBg = "#E2E8F0"; let statusText = "#475569";
        if (statusVal === "In Progress") { statusBg = "#DBEAFE"; statusText = "#1E40AF"; }
        else if (statusVal === "Dev Done") { statusBg = "#CCFBF1"; statusText = "#0F766E"; }
        else if (statusVal === "Ready for QA") { statusBg = "#E0E7FF"; statusText = "#3730A3"; }
        else if (statusVal === "QA Done") { statusBg = "#F3E8FF"; statusText = "#6B21A8"; }
        else if (statusVal === "Complete" || statusVal === "Done") { statusBg = "#DCFCE7"; statusText = "#15803D"; }
        else if (statusVal === "On Hold") { statusBg = "#FEF3C7"; statusText = "#9A3412"; }

        // Priority icon & color
        let priorityIconHtml = `<span style="color: #F59E0B; font-weight: 800; margin-right: 4px;">=</span>`;
        if (story.priority === "High" || story.priority === "Critical") {
            priorityIconHtml = `<span style="color: #EF4444; font-weight: 800; margin-right: 4px;">▲</span>`;
        } else if (story.priority === "Low") {
            priorityIconHtml = `<span style="color: #6B7280; font-weight: 800; margin-right: 4px;">▼</span>`;
        }

        const resolutionVal = (statusVal === "Complete" || statusVal === "Done") ? "Done" : "Unresolved";

        // Reporter: auto-match to team member whose role matches the story's primary task_type
        const storyTasks = story.tasks || [];
        const taskTypeCounts = {};
        storyTasks.forEach(t => { taskTypeCounts[t.task_type] = (taskTypeCounts[t.task_type] || 0) + 1; });
        const primaryTaskType = Object.keys(taskTypeCounts).sort((a, b) => taskTypeCounts[b] - taskTypeCounts[a])[0] || null;
        const matchedReporter = primaryTaskType ? members.find(m => m.role === primaryTaskType) : null;
        const autoReporter = matchedReporter ? matchedReporter.user_name : "Unassigned";
        const reporterName = story.reporter || autoReporter;
        const reporterInitial = reporterName && reporterName !== "Unassigned" ? reporterName.charAt(0).toUpperCase() : "";
        const reporterOptionsHtml = members.length > 0
            ? `<option value="Unassigned" ${reporterName === 'Unassigned' ? 'selected' : ''}>Unassigned</option>` + members.map(m => `<option value="${m.user_name}" ${reporterName === m.user_name ? 'selected' : ''}>${m.user_name}</option>`).join("")
            : `<option value="Unassigned" selected>Unassigned</option>`;

        // Assignee: default to the Project Manager (admin who created the project)
        const projectManager = members.find(m => m.role === "Manager");
        const defaultAssignee = projectManager ? projectManager.user_name : "Unassigned";
        const assigneeName = story.assignee !== undefined ? story.assignee : defaultAssignee;
        if (story.assignee === undefined) story.assignee = defaultAssignee;
        const assigneeInitial = assigneeName && assigneeName !== "Unassigned" ? assigneeName.charAt(0).toUpperCase() : "";
        const isAssigneeInMembers = members.some(m => m.user_name === assigneeName);
        let assigneeOptionsHtml = members.map(m => `<option value="${m.user_name}" ${assigneeName === m.user_name ? 'selected' : ''}>${m.user_name}</option>`).join("");
        if (assigneeName && assigneeName !== "Unassigned" && !isAssigneeInMembers) {
            assigneeOptionsHtml = `<option value="${assigneeName}" selected>${assigneeName}</option>` + assigneeOptionsHtml;
        }

        html += `
            <tr data-story-id="${story.id}" style="display: none; border-bottom: 1px solid var(--border-color); background: var(--bg-card); transition: background 0.15s;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='var(--bg-card)'">
                <!-- Checkbox -->
                <td style="padding: 10px 12px; text-align: center;">
                    <input type="checkbox" class="jira-row-checkbox" data-type="story" data-id="${story.id}" onchange="jiraListUpdateSelection()" style="cursor: pointer; width: 14px; height: 14px; accent-color: var(--color-primary);">
                </td>

                <!-- Work (Expand Hierarchy + Key + Title) -->
                <td style="padding: 10px 14px; min-width: 280px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${hasChildren ? `
                        <button type="button" onclick="toggleJiraListHierarchy('${story.id}', '${projectId}')" title="${isCollapsed ? 'Expand hierarchy' : 'Collapse hierarchy'}" style="width: 20px; height: 20px; border-radius: 4px; border: none; background: transparent; color: var(--color-text-muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;">
                            <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" style="width: 14px; height: 14px;"></i>
                        </button>
                        ` : `<div style="width: 20px; height: 20px; display: inline-flex;"></div>`}
                        <span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; background: #EDE9FE; color: #7C3AED; border-radius: 3px;" title="Epic / Story">
                            <i data-lucide="zap" style="width: 12px; height: 12px; fill: currentColor;"></i>
                        </span>
                        <span onclick="openStoryDetailModal(${projectId}, ${story.id})" style="color: #2563EB; font-weight: 700; font-family: monospace; text-decoration: underline; cursor: pointer; font-size: 0.82rem;">
                            ${storyKey}
                        </span>
                        <span onclick="enableInlineTitleEdit(${story.id}, ${projectId}, this)" style="font-weight: 600; color: var(--color-text-main); cursor: text; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 220px; padding: 2px 4px; border-radius: 4px;" title="Click to edit" onmouseover="this.style.background='var(--bg-base)'" onmouseout="this.style.background='transparent'">
                            ${escapeHTML(story.title)}
                        </span>
                        <button type="button" onclick="openStoryDetailModal(${projectId}, ${story.id})" title="Open detail view" style="border: none; background: transparent; color: var(--color-text-muted); cursor: pointer; padding: 2px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; margin-left: 4px;" onmouseover="this.style.background='var(--bg-base)'; this.style.color='var(--color-primary)';" onmouseout="this.style.background='transparent'; this.style.color='var(--color-text-muted)';">
                            <i data-lucide="external-link" style="width: 15px; height: 15px;"></i>
                        </button>
                        <button type="button" onclick="openInlineTaskCreate(${story.id}, ${projectId}, event)" title="Create child item" style="border: none; background: transparent; color: var(--color-text-muted); cursor: pointer; padding: 2px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; margin-left: 2px;" onmouseover="this.style.background='var(--bg-base)'; this.style.color='var(--color-primary)';" onmouseout="this.style.background='transparent'; this.style.color='var(--color-text-muted)';">
                            <i data-lucide="plus" style="width: 15px; height: 15px;"></i>
                        </button>
                    </div>
                </td>

                <!-- Assignee -->
                <td style="padding: 10px 14px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="width: 20px; height: 20px; border-radius: 50%; background: ${assigneeName ? '#10B981' : '#E2E8F0'}; color: ${assigneeName ? '#fff' : '#475569'}; display: inline-flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700;">
                            ${assigneeName ? assigneeInitial : '<i data-lucide="user" style="width: 12px; height: 12px;"></i>'}
                        </span>
                        <div ${isAdmin ? `onclick="openInlineUserPicker(event, 'assignee', ${story.id}, null, ${projectId}, true)"` : ''} style="background: transparent; border: none; font-size: 0.85rem; color: var(--color-text-main); font-weight: 500; cursor: ${isAdmin ? 'pointer' : 'default'}; outline: none; padding: 2px 4px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: space-between; min-width: 110px;" onmouseover="if(${isAdmin}) this.style.background='var(--bg-base)'" onmouseout="if(${isAdmin}) this.style.background='transparent'">
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${assigneeName || 'Unassigned'}</span>
                            ${isAdmin ? '<i data-lucide="chevron-down" style="width: 14px; height: 14px; color: var(--color-text-muted);"></i>' : ''}
                        </div>
                    </div>
                </td>

                <!-- Reporter -->
                <td style="padding: 10px 14px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="width: 20px; height: 20px; border-radius: 50%; background: #2563EB; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 700;">
                            ${reporterInitial}
                        </span>
                        <div ${isAdmin ? `onclick="openInlineUserPicker(event, 'reporter', ${story.id}, null, ${projectId}, true)"` : ''} style="background: transparent; border: none; font-size: 0.85rem; color: var(--color-text-main); font-weight: 500; cursor: ${isAdmin ? 'pointer' : 'default'}; outline: none; padding: 2px 4px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: space-between; min-width: 110px;" onmouseover="if(${isAdmin}) this.style.background='var(--bg-base)'" onmouseout="if(${isAdmin}) this.style.background='transparent'">
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${reporterName || 'Unassigned'}</span>
                            ${isAdmin ? '<i data-lucide="chevron-down" style="width: 14px; height: 14px; color: var(--color-text-muted);"></i>' : ''}
                        </div>
                    </div>
                </td>

                <!-- Due date -->
                <td style="padding: 10px 14px;">
                    <input type="date"
                        value="${story.due_date ? story.due_date.split('T')[0] : ''}"
                        
                        onchange="updateStoryField(${projectId}, ${story.id}, 'due_date', this.value || null)"
                        style="border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.82rem; color: var(--color-text-main); background: var(--bg-card); cursor: pointer; outline: none; width: 130px; ${story.due_date && new Date(story.due_date) < new Date() && statusVal !== 'Complete' ? 'border-color: #EF4444; color: #EF4444;' : ''}"
                        onfocus="this.style.borderColor='var(--color-primary)'"
                        onblur="this.style.borderColor='${story.due_date && new Date(story.due_date) < new Date() && statusVal !== 'Complete' ? '#EF4444' : 'var(--border-color)'}'"
                    >
                </td>

                <!-- Priority Dropdown -->
                <td style="padding: 10px 14px;">
                    <div style="display: flex; align-items: center;">
                        ${priorityIconHtml}
                        <select  onchange="updateStoryField(${projectId}, ${story.id}, 'priority', this.value)" style="background: transparent; border: none; font-size: 0.84rem; color: var(--color-text-main); font-weight: 600; cursor: pointer; outline: none;">
                            <option value="Low" ${story.priority === 'Low' ? 'selected' : ''}>Low</option>
                            <option value="Medium" ${story.priority === 'Medium' || !story.priority ? 'selected' : ''}>Medium</option>
                            <option value="High" ${story.priority === 'High' ? 'selected' : ''}>High</option>
                            <option value="Critical" ${story.priority === 'Critical' ? 'selected' : ''}>Critical</option>
                        </select>
                    </div>
                </td>

                <!-- Status Dropdown Pill -->
                <td style="padding: 10px 14px;">
                    <select onchange="updateStoryField(${projectId}, ${story.id}, 'status', this.value)" style="background: ${statusBg}; color: ${statusText}; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; cursor: pointer; outline: none;">
                        <option value="To Do" ${statusVal === 'To Do' ? 'selected' : ''}>TO DO</option>
                        <option value="In Progress" ${statusVal === 'In Progress' ? 'selected' : ''}>IN PROGRESS</option>
                        <option value="Dev Done" ${statusVal === 'Dev Done' ? 'selected' : ''}>DEV DONE</option>
                        <option value="Ready for QA" ${statusVal === 'Ready for QA' ? 'selected' : ''}>READY FOR QA</option>
                        <option value="QA Done" ${statusVal === 'QA Done' ? 'selected' : ''}>QA DONE</option>
                        <option value="Complete" ${statusVal === 'Complete' || statusVal === 'Done' ? 'selected' : ''}>COMPLETE</option>
                        <option value="On Hold" ${statusVal === 'On Hold' ? 'selected' : ''}>ON HOLD</option>
                    </select>
                </td>
                <!-- Created -->
                <td style="padding: 10px 14px; color: var(--color-text-muted); font-size: 0.82rem; white-space: nowrap;">
                    ${createdDate}
                </td>
            </tr>
        `;
        totalRowsDisplayed++;

        // Child subtasks
        if (tasks.length > 0) {
            let subtaskIndex = 1;
            tasks.forEach(t => {
                if (state.storyAssigneeFilter === "mine" && t.assigned_to !== state.user?.id) {
                    return;
                }
                const taskKey = `${storyKey}-${subtaskIndex++}`;
                // Subtask Assignee
                const explicitAssignee = t.assigned_to ? members.find(m => m.user_id === t.assigned_to) : null;
                const assigneeName = explicitAssignee ? explicitAssignee.user_name : "Unassigned";
                const effectiveAssigneeId = explicitAssignee ? explicitAssignee.user_id : "";
                const initial = assigneeName !== "Unassigned" ? assigneeName.charAt(0).toUpperCase() : "";

                const taskStatusVal = t.status || "To Do";
                let tStatusBg = "#E2E8F0"; let tStatusText = "#475569";
                if (taskStatusVal === "In Progress") { tStatusBg = "#DBEAFE"; tStatusText = "#1E40AF"; }
                else if (taskStatusVal === "Dev Done") { tStatusBg = "#CCFBF1"; tStatusText = "#0F766E"; }
                else if (taskStatusVal === "Ready for QA") { tStatusBg = "#E0E7FF"; tStatusText = "#3730A3"; }
                else if (taskStatusVal === "QA Done") { tStatusBg = "#F3E8FF"; tStatusText = "#6B21A8"; }
                else if (taskStatusVal === "Complete" || taskStatusVal === "Done") { tStatusBg = "#DCFCE7"; tStatusText = "#15803D"; }

                const tResolutionVal = (taskStatusVal === "Complete" || taskStatusVal === "Done") ? "Done" : "Unresolved";

                const membersOptions = members.map(m => `
                    <option value="${m.user_id}" ${effectiveAssigneeId === m.user_id ? 'selected' : ''}>${m.user_name}</option>
                `).join("");

                // Subtask Reporter: auto-match task_type to team member role
                const tMatchedReporter = t.task_type ? members.find(m => m.role === t.task_type) : null;
                const tAutoReporter = tMatchedReporter ? tMatchedReporter.user_name : "Unassigned";
                const tReporterName = t.reporter || tAutoReporter;
                const tReporterInitial = tReporterName && tReporterName !== "Unassigned" ? tReporterName.charAt(0).toUpperCase() : "";
                const tReporterOptionsHtml = members.length > 0
                    ? `<option value="Unassigned" ${tReporterName === 'Unassigned' ? 'selected' : ''}>Unassigned</option>` + members.map(m => `<option value="${m.user_name}" ${tReporterName === m.user_name ? 'selected' : ''}>${m.user_name}</option>`).join("")
                    : `<option value="Unassigned" selected>Unassigned</option>`;

                html += `
                    <tr class="subtask-row-${story.id}" data-task-id="${t.id}" data-parent-story-id="${story.id}" style="${isCollapsed ? 'display: none;' : ''} border-bottom: 1px solid var(--border-color); background: #FAFAFB; transition: background 0.15s;" onmouseover="this.style.background='#F1F5F9'" onmouseout="this.style.background='#FAFAFB'">
                        <!-- Checkbox -->
                        <td style="padding: 8px 12px; text-align: center;">
                            <input type="checkbox" class="jira-row-checkbox" data-type="task" data-id="${t.id}" data-story-id="${story.id}" onchange="jiraListUpdateSelection()" style="cursor: pointer; width: 14px; height: 14px; accent-color: var(--color-primary);">
                        </td>

                        <!-- Work (Indented Child Key + Title) -->
                        <td style="padding: 8px 14px; padding-left: 36px; min-width: 280px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; background: #E0F2FE; color: #0284C7; border-radius: 3px;" title="Subtask">
                                    <i data-lucide="check-square" style="width: 11px; height: 11px;"></i>
                                </span>
                                <span onclick="openStoryDetailModal(${projectId}, ${story.id})" style="color: #2563EB; font-weight: 700; font-family: monospace; text-decoration: underline; cursor: pointer; font-size: 0.8rem;">
                                    ${taskKey}
                                </span>
                                <span onclick="openStoryDetailModal(${projectId}, ${story.id})" style="font-weight: 500; color: var(--color-text-main); cursor: pointer; font-size: 0.88rem;">
                                    ${t.title}
                                </span>
                                <button type="button" onclick="openStoryDetailModal(${projectId}, ${story.id})" title="Open detail view" style="border: none; background: transparent; color: var(--color-text-muted); cursor: pointer; padding: 2px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; margin-left: 4px;" onmouseover="this.style.background='var(--bg-base)'; this.style.color='var(--color-primary)';" onmouseout="this.style.background='transparent'; this.style.color='var(--color-text-muted)';">
                                    <i data-lucide="external-link" style="width: 14px; height: 14px;"></i>
                                </button>
                            </div>
                        </td>

                        <!-- Assignee Dropdown -->
                        <td style="padding: 8px 14px;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="width: 20px; height: 20px; border-radius: 50%; background: ${explicitAssignee ? '#10B981' : '#E2E8F0'}; color: ${explicitAssignee ? '#fff' : '#475569'}; display: inline-flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700;">
                                    ${explicitAssignee ? initial : '<i data-lucide="user" style="width: 11px; height: 11px;"></i>'}
                                </span>
                                <div ${isAdmin ? `onclick="openInlineUserPicker(event, 'assignee', ${story.id}, ${t.id}, ${projectId}, true)"` : ''} style="background: transparent; border: none; font-size: 0.84rem; color: var(--color-text-main); font-weight: 500; cursor: ${isAdmin ? 'pointer' : 'default'}; outline: none; padding: 2px 4px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: space-between; min-width: 110px;" onmouseover="if(${isAdmin}) this.style.background='var(--bg-base)'" onmouseout="if(${isAdmin}) this.style.background='transparent'">
                                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${assigneeName || 'Unassigned'}</span>
                                    ${isAdmin ? '<i data-lucide="chevron-down" style="width: 14px; height: 14px; color: var(--color-text-muted);"></i>' : ''}
                                </div>
                            </div>
                        </td>

                        <!-- Reporter -->
                        <td style="padding: 8px 14px;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="width: 20px; height: 20px; border-radius: 50%; background: #2563EB; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 700;">
                                    ${tReporterInitial}
                                </span>
                                <div ${isAdmin ? `onclick="openInlineUserPicker(event, 'reporter', ${story.id}, ${t.id}, ${projectId}, true)"` : ''} style="background: transparent; border: none; font-size: 0.85rem; color: var(--color-text-main); font-weight: 500; cursor: ${isAdmin ? 'pointer' : 'default'}; outline: none; padding: 2px 4px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: space-between; min-width: 110px;" onmouseover="if(${isAdmin}) this.style.background='var(--bg-base)'" onmouseout="if(${isAdmin}) this.style.background='transparent'">
                                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${tReporterName || 'Unassigned'}</span>
                                    ${isAdmin ? '<i data-lucide="chevron-down" style="width: 14px; height: 14px; color: var(--color-text-muted);"></i>' : ''}
                                </div>
                            </div>
                        </td>

                        <!-- Due date -->
                        <td style="padding: 8px 14px;">
                            <input type="date"
                                value="${t.due_date ? t.due_date.split('T')[0] : ''}"
                                
                                onchange="updateTaskField(${projectId}, ${story.id}, ${t.id}, 'due_date', this.value || null)"
                                style="border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 0.82rem; color: var(--color-text-main); background: var(--bg-card); cursor: pointer; outline: none; width: 130px; ${t.due_date && new Date(t.due_date) < new Date() && taskStatusVal !== 'Complete' ? 'border-color: #EF4444; color: #EF4444;' : ''}"
                                onfocus="this.style.borderColor='var(--color-primary)'"
                                onblur="this.style.borderColor='${t.due_date && new Date(t.due_date) < new Date() && taskStatusVal !== 'Complete' ? '#EF4444' : 'var(--border-color)'}'"
                            >
                        </td>

                        <!-- Priority -->
                        <td style="padding: 8px 14px;">
                            <span style="color: #F59E0B; font-weight: 800; margin-right: 4px;">=</span>
                            <span style="font-size: 0.84rem; color: var(--color-text-main);">Medium</span>
                        </td>

                        <!-- Status Dropdown Pill -->
                        <td style="padding: 8px 14px;">
                            <select onchange="updateTaskField(${projectId}, ${story.id}, ${t.id}, 'status', this.value)" style="background: ${tStatusBg}; color: ${tStatusText}; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; cursor: pointer; outline: none;">
                                <option value="To Do" ${taskStatusVal === 'To Do' ? 'selected' : ''}>TO DO</option>
                                <option value="In Progress" ${taskStatusVal === 'In Progress' ? 'selected' : ''}>IN PROGRESS</option>
                                <option value="Dev Done" ${taskStatusVal === 'Dev Done' ? 'selected' : ''}>DEV DONE</option>
                                <option value="Ready for QA" ${taskStatusVal === 'Ready for QA' ? 'selected' : ''}>READY FOR QA</option>
                                <option value="QA Done" ${taskStatusVal === 'QA Done' ? 'selected' : ''}>QA DONE</option>
                                <option value="Complete" ${taskStatusVal === 'Complete' || taskStatusVal === 'Done' ? 'selected' : ''}>COMPLETE</option>
                            </select>
                        </td>
                        <!-- Created -->
                        <td style="padding: 8px 14px; color: var(--color-text-muted); font-size: 0.82rem; white-space: nowrap;">
                            ${createdDate}
                        </td>
                    </tr>
                `;
                totalRowsDisplayed++;
            });
        }
    });
    };

    milestones.forEach(ms => {
        const msData = grouped[ms.id];
        const isGlobalAdmin = state.user?.is_admin;
        const selectedProj = state.projects?.find(p => p.id === parseInt(state.globalProjectId));
        const isProjManager = selectedProj && (selectedProj.user_role === 'Manager' || selectedProj.user_role === 'Admin');
        const isAdmin = isGlobalAdmin || isProjManager;

        const assigneeName = ms.assignee_name || (ms.assignee_id ? (state.projectMembers?.find(m => m.user_id === ms.assignee_id)?.user_name) : "Unassigned");
        const reporterName = ms.reporter_name || (ms.reporter_id ? (state.projectMembers?.find(m => m.user_id === ms.reporter_id)?.user_name) : "Unassigned");
        const assigneeInitial = assigneeName && assigneeName !== "Unassigned" ? assigneeName.charAt(0).toUpperCase() : "";
        const reporterInitial = reporterName && reporterName !== "Unassigned" ? reporterName.charAt(0).toUpperCase() : "";

        let priorityIconHtml = `<span style="color: #F59E0B; font-weight: 800; margin-right: 4px;">=</span>`;
        if (ms.priority === "High" || ms.priority === "Critical") {
            priorityIconHtml = `<span style="color: #EF4444; font-weight: 800; margin-right: 4px;">▲</span>`;
        } else if (ms.priority === "Low") {
            priorityIconHtml = `<span style="color: #6B7280; font-weight: 800; margin-right: 4px;">▼</span>`;
        }

        html += `<tr class="milestone-group-header" onclick="toggleMilestoneGroup(this)" style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; cursor: pointer;">
            <td style="padding: 12px 16px;"></td>
            <td style="padding: 12px 16px; font-weight: 600; color: #334155;">
                <div style="display: flex; align-items: center; white-space: nowrap;">
                    <i data-lucide="chevron-down" class="group-toggle-icon" style="width: 16px; margin-right: 8px; transition: transform 0.2s; transform: rotate(-90deg);"></i>
                    <i data-lucide="milestone" style="width: 16px; margin-right: 8px; color: #64748b;"></i>
                    <span style="color: #6366f1; font-weight: 700; margin-right: 8px; white-space: nowrap;">${escapeHTML(ms.title)}</span>
                    <span style="font-size: 0.8rem; background: #e2e8f0; padding: 2px 8px; border-radius: 12px; font-weight: 500; white-space: nowrap; margin-right: 6px;">${msData.stories.length} Stories</span>
                    <button onclick="event.stopPropagation(); window.openInlineStoryCreate(${ms.id}, event)" style="background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 4px; border-radius: 4px; display: inline-flex; align-items: center; transition: all 0.2s;" onmouseover="this.style.background='#e2e8f0'; this.style.color='#2563eb'" onmouseout="this.style.background='none'; this.style.color='var(--color-text-muted)'" title="Create story in this milestone">
                        <i data-lucide="plus" style="width: 16px; height: 16px;"></i>
                    </button>
                </div>
            </td>
            <!-- Assignee -->
            <td style="padding: 12px 16px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 20px; height: 20px; border-radius: 50%; background: ${assigneeName !== 'Unassigned' ? '#10B981' : '#E2E8F0'}; color: ${assigneeName !== 'Unassigned' ? '#fff' : '#475569'}; display: inline-flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700;">
                        ${assigneeName !== 'Unassigned' ? assigneeInitial : '<i data-lucide="user" style="width: 12px; height: 12px;"></i>'}
                    </span>
                    <div ${isAdmin ? `onclick="openInlineUserPicker(event, 'assignee', ${ms.id}, null, ${state.globalProjectId}, true, true)"` : ''} style="background: transparent; border: none; font-size: 0.85rem; color: var(--color-text-main); font-weight: 500; cursor: ${isAdmin ? 'pointer' : 'default'}; outline: none; padding: 2px 4px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: space-between; min-width: 110px;" onmouseover="if(${isAdmin}) this.style.background='var(--bg-base)'" onmouseout="if(${isAdmin}) this.style.background='transparent'">
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${assigneeName}</span>
                        ${isAdmin ? '<i data-lucide="chevron-down" style="width: 14px; height: 14px; color: var(--color-text-muted);"></i>' : ''}
                    </div>
                </div>
            </td>
            <!-- Reporter -->
            <td style="padding: 12px 16px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 20px; height: 20px; border-radius: 50%; background: ${reporterName !== 'Unassigned' ? '#2563EB' : '#E2E8F0'}; color: ${reporterName !== 'Unassigned' ? '#fff' : '#475569'}; display: inline-flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 700;">
                        ${reporterName !== 'Unassigned' ? reporterInitial : '<i data-lucide="user" style="width: 12px; height: 12px;"></i>'}
                    </span>
                    <div ${isAdmin ? `onclick="openInlineUserPicker(event, 'reporter', ${ms.id}, null, ${state.globalProjectId}, true, true)"` : ''} style="background: transparent; border: none; font-size: 0.85rem; color: var(--color-text-main); font-weight: 500; cursor: ${isAdmin ? 'pointer' : 'default'}; outline: none; padding: 2px 4px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: space-between; min-width: 110px;" onmouseover="if(${isAdmin}) this.style.background='var(--bg-base)'" onmouseout="if(${isAdmin}) this.style.background='transparent'">
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${reporterName}</span>
                        ${isAdmin ? '<i data-lucide="chevron-down" style="width: 14px; height: 14px; color: var(--color-text-muted);"></i>' : ''}
                    </div>
                </div>
            </td>
            <td style="padding: 12px 16px; font-size: 0.85rem; font-weight: 500;">${ms.due_date ? new Date(ms.due_date).toLocaleDateString() : '-'}</td>
            <!-- Priority Dropdown -->
            <td style="padding: 12px 16px;" onclick="event.stopPropagation()">
                <div style="display: flex; align-items: center;">
                    ${priorityIconHtml}
                    <select  onchange="updateMilestoneField(${state.globalProjectId}, ${ms.id}, 'priority', this.value)" style="background: transparent; border: none; font-size: 0.84rem; color: var(--color-text-main); font-weight: 600; cursor: pointer; outline: none;">
                        <option value="Low" ${ms.priority === 'Low' ? 'selected' : ''}>Low</option>
                        <option value="Medium" ${ms.priority === 'Medium' || !ms.priority ? 'selected' : ''}>Medium</option>
                        <option value="High" ${ms.priority === 'High' ? 'selected' : ''}>High</option>
                        <option value="Critical" ${ms.priority === 'Critical' ? 'selected' : ''}>Critical</option>
                    </select>
                </div>
            </td>
            <td style="padding: 12px 16px;" onclick="event.stopPropagation()">
                <select id="milestone-status-select-${ms.id}" onchange="updateMilestoneField(${state.globalProjectId}, ${ms.id}, 'status', this.value, this)" style="background: ${ms.status === 'completed' ? '#DCFCE7' : 'rgba(59, 130, 246, 0.15)'}; color: ${ms.status === 'completed' ? '#15803D' : '#2563eb'}; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; cursor: pointer; outline: none;">
                    <option value="pending" ${ms.status === 'pending' ? 'selected' : ''}>IN PROGRESS</option>
                    <option value="completed" ${ms.status === 'completed' ? 'selected' : ''}>COMPLETED</option>
                </select>
            </td>
            <td style="padding: 12px 16px; color: var(--color-text-muted); font-size: 0.85rem;">
                ${ms.created_at ? new Date(ms.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '-'}
            </td>
        </tr>`;
        renderGroupStories(msData.stories);
    });

    const unassigned = grouped["unassigned"];
    if (unassigned.length > 0) {
        html += `<tr class="milestone-group-header" onclick="toggleMilestoneGroup(this)" style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; cursor: pointer;">
            <td style="padding: 12px 16px;"></td>
            <td style="padding: 12px 16px; font-weight: 600; color: #334155;">
                <div style="display: flex; align-items: center; white-space: nowrap;">
                    <i data-lucide="chevron-down" class="group-toggle-icon" style="width: 16px; margin-right: 8px; transition: transform 0.2s; transform: rotate(-90deg);"></i>
                    <i data-lucide="inbox" style="width: 16px; margin-right: 8px; color: #64748b;"></i>
                    <span style="font-weight: 700; margin-right: 8px; white-space: nowrap;">Unassigned / Backlog</span>
                    <span style="font-size: 0.8rem; background: #e2e8f0; padding: 2px 8px; border-radius: 12px; font-weight: 500; white-space: nowrap; margin-right: 6px;">${unassigned.length} Stories</span>
                    <button onclick="event.stopPropagation(); window.openInlineStoryCreate('unassigned', event)" style="background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 4px; border-radius: 4px; display: inline-flex; align-items: center; transition: all 0.2s;" onmouseover="this.style.background='#e2e8f0'; this.style.color='#2563eb'" onmouseout="this.style.background='none'; this.style.color='var(--color-text-muted)'" title="Create unassigned story">
                        <i data-lucide="plus" style="width: 16px; height: 16px;"></i>
                    </button>
                </div>
            </td>
            <td colspan="6"></td>
        </tr>`;
        renderGroupStories(unassigned);
    }

    tableBody.innerHTML = html;
    const footerCount = document.getElementById("jira-list-footer-count");
    if (footerCount) footerCount.textContent = `${totalRowsDisplayed} of ${totalRowsDisplayed}`;
    if (window.lucide) lucide.createIcons();
}

window.openStoryDetailModal = async function(projectId, storyId) {
    let story = (state.storiesList || state.stories || []).find(s => String(s.id) === String(storyId));
    
    if (!story) {
        try {
            const res = await fetch(`${API_BASE}/api/projects/${projectId}/stories`, {
                headers: { "Authorization": `Bearer ${state.token}` }
            });
            if (res.ok) {
                const fetchedStories = await res.json();
                story = fetchedStories.find(s => String(s.id) === String(storyId));
            }
        } catch (e) {
            console.error("Failed to fetch story details:", e);
        }
    }

    if (!story) {
        showToast("Story details not found", "error");
        return;
    }

    let overlay = document.getElementById('story-fullpage-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'story-fullpage-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2000; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px;';
        
        const modalContent = document.createElement('div');
        modalContent.id = 'story-modal-content';
        modalContent.style.cssText = 'width: 100%; max-width: 1200px; max-height: 95vh; background: var(--bg-surface, #fff); border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow-y: auto; padding: 30px; border: 1px solid var(--border-color); position: relative;';
        
        overlay.appendChild(modalContent);
        document.body.appendChild(overlay);

        const closeHandler = (e) => {
            if (e.target === overlay || e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', closeHandler);
            }
        };
        overlay.addEventListener('click', closeHandler);
        document.addEventListener('keydown', closeHandler);
    }

    // Call renderStoryDetail. It will automatically detect 'story-fullpage-overlay' and use 'story-modal-content' as the panel.
    renderStoryDetail(projectId, story);

    // After rendering, hide the maximize button since we are already full-page
    setTimeout(() => {
        const maxBtn = document.getElementById("btn-story-maximize");
        if (maxBtn) maxBtn.style.display = 'none';
        
        // Also override the close button to close the modal
        const closeBtn = document.querySelector('#story-modal-content button[onclick="closeStoryDetail()"]');
        if (closeBtn) {
            closeBtn.onclick = function(e) {
                e.preventDefault();
                const ol = document.getElementById('story-fullpage-overlay');
                if (ol) ol.remove();
            };
        }
    }, 50);
};

window.enableInlineTitleEdit = function(storyId, projectId, spanElem) {
    if (spanElem.querySelector('input')) return;
    
    const currentTitle = spanElem.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.style.cssText = 'width: 100%; border: 1px solid var(--color-primary); border-radius: 4px; padding: 2px 4px; outline: none; font-size: 0.82rem; font-weight: 600; font-family: inherit; color: var(--color-text-main); background: #fff; box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);';
    
    spanElem.innerHTML = '';
    spanElem.appendChild(input);
    input.focus();
    
    const saveTitle = async () => {
        const newTitle = input.value.trim();
        if (!newTitle || newTitle === currentTitle) {
            spanElem.textContent = currentTitle;
            return;
        }
        
        spanElem.innerHTML = '<i data-lucide="loader" class="spin" style="width: 12px; height: 12px;"></i> Saving...';
        if (window.lucide) lucide.createIcons();
        
        try {
            const response = await fetch(`${API_BASE}/api/stories/${storyId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.token}` },
                body: JSON.stringify({ title: newTitle })
            });
            
            if (response.ok) {
                const updatedStory = await response.json();
                const sIdx = (state.stories || []).findIndex(s => String(s.id) === String(storyId));
                if (sIdx !== -1) state.stories[sIdx].title = updatedStory.title;
                const slIdx = (state.storiesList || []).findIndex(s => String(s.id) === String(storyId));
                if (slIdx !== -1) state.storiesList[slIdx].title = updatedStory.title;
                
                spanElem.textContent = updatedStory.title;
                showToast("Title updated", "success");
            } else {
                spanElem.textContent = currentTitle;
                showToast("Failed to update title", "error");
            }
        } catch (e) {
            spanElem.textContent = currentTitle;
            showToast("Network error", "error");
        }
    };
    
    input.addEventListener('blur', saveTitle);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        else if (e.key === 'Escape') spanElem.textContent = currentTitle;
    });
};

window.openInlineTaskCreate = function(storyId, projectId, event) {
    event.stopPropagation();
    
    const tr = event.currentTarget.closest('tr');
    if (!tr) return;
    
    if (tr.nextElementSibling && tr.nextElementSibling.classList.contains('inline-task-create-row')) {
        tr.nextElementSibling.querySelector('input').focus();
        return;
    }
    
    const newTr = document.createElement('tr');
    newTr.className = 'inline-task-create-row';
    newTr.style.cssText = 'background: #F8FAFC; border-bottom: 1px solid var(--border-color);';
    
    newTr.innerHTML = `
        <td></td>
        <td colspan="7" style="padding: 8px 14px 8px 46px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <i data-lucide="corner-down-right" style="width: 14px; height: 14px; color: var(--color-text-muted);"></i>
                <input type="text" class="inline-task-input" placeholder="What needs to be done? (Press Enter to save)" style="width: 100%; max-width: 500px; border: 1px solid var(--color-primary); border-radius: 4px; padding: 6px 10px; outline: none; font-size: 0.85rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <button type="button" class="btn-save-inline-task" style="padding: 6px 12px; background: var(--color-primary); color: white; border: none; border-radius: 4px; font-size: 0.8rem; cursor: pointer; font-weight: 600;">Save</button>
                <button type="button" class="btn-cancel-inline-task" style="padding: 6px; background: transparent; color: var(--color-text-muted); border: none; cursor: pointer; border-radius: 4px;" onmouseover="this.style.background='#E2E8F0'" onmouseout="this.style.background='transparent'"><i data-lucide="x" style="width: 14px; height: 14px;"></i></button>
            </div>
        </td>
    `;
    
    tr.after(newTr);
    if (window.lucide) lucide.createIcons();
    
    const input = newTr.querySelector('.inline-task-input');
    const saveBtn = newTr.querySelector('.btn-save-inline-task');
    const cancelBtn = newTr.querySelector('.btn-cancel-inline-task');
    
    input.focus();
    
    const closeRow = () => newTr.remove();
    cancelBtn.onclick = closeRow;
    
    const saveTask = async () => {
        const title = input.value.trim();
        if (!title) {
            closeRow();
            return;
        }
        
        input.disabled = true;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i data-lucide="loader" class="spin" style="width: 12px;"></i>';
        if (window.lucide) lucide.createIcons();
        
        try {
            const response = await fetch(`${API_BASE}/api/projects/${projectId}/stories/${storyId}/tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.token}` },
                body: JSON.stringify({ title: title, status: "To Do", task_type: "General" })
            });
            
            if (response.ok) {
                showToast("Subtask created", "success");
                await loadStories();
            } else {
                const errData = await response.json().catch(() => ({}));
                showToast(errData.detail || "Failed to create subtask", "error");
                input.disabled = false;
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Save';
            }
        } catch (e) {
            showToast("Network error", "error");
            input.disabled = false;
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save';
        }
    };
    
    saveBtn.onclick = saveTask;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveTask();
        else if (e.key === 'Escape') closeRow();
    });
};

window.openInlineStoryCreate = function(milestoneId, event) {
    event.stopPropagation();
    
    const tr = event.currentTarget.closest('tr');
    if (!tr) return;
    
    if (tr.nextElementSibling && tr.nextElementSibling.classList.contains('inline-story-create-row')) {
        tr.nextElementSibling.querySelector('input').focus();
        return;
    }
    
    const newTr = document.createElement('tr');
    newTr.className = 'inline-story-create-row';
    // Style it like Jira's inline create (blue border outline)
    newTr.style.cssText = 'background: #fff; box-shadow: inset 0 0 0 2px #3b82f6;';
    
    newTr.innerHTML = `
        <td style="padding: 10px 12px; text-align: center;">
            <input type="checkbox" disabled style="width: 14px; height: 14px; opacity: 0.5;">
        </td>
        <td colspan="7" style="padding: 4px 14px 4px 4px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <i data-lucide="bookmark" style="width: 16px; height: 16px; color: #10b981; margin-left: 4px;"></i>
                <input type="text" class="inline-story-input" placeholder="What needs to be done?" style="width: 100%; border: none; padding: 8px; outline: none; font-size: 0.9rem; font-weight: 500; color: #334155; background: transparent;">
                <button type="button" class="btn-save-inline-story" style="padding: 6px 12px; background: #e2e8f0; color: #475569; border: none; border-radius: 4px; font-size: 0.8rem; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 4px; transition: all 0.2s;">Create <span style="font-size: 0.7rem; background: #cbd5e1; padding: 2px 4px; border-radius: 3px; transition: all 0.2s;">↵</span></button>
                <button type="button" class="btn-cancel-inline-story" style="padding: 6px; background: transparent; color: var(--color-text-muted); border: none; cursor: pointer; border-radius: 4px;" onmouseover="this.style.background='#E2E8F0'" onmouseout="this.style.background='transparent'"><i data-lucide="x" style="width: 14px; height: 14px;"></i></button>
            </div>
        </td>
    `;
    
    tr.after(newTr);
    if (window.lucide) lucide.createIcons();
    
    const input = newTr.querySelector('.inline-story-input');
    const saveBtn = newTr.querySelector('.btn-save-inline-story');
    const cancelBtn = newTr.querySelector('.btn-cancel-inline-story');
    
    input.addEventListener('input', () => {
        if (input.value.trim().length > 0) {
            saveBtn.style.background = '#2563eb';
            saveBtn.style.color = '#fff';
            saveBtn.querySelector('span').style.background = 'rgba(255,255,255,0.2)';
        } else {
            saveBtn.style.background = '#e2e8f0';
            saveBtn.style.color = '#475569';
            saveBtn.querySelector('span').style.background = '#cbd5e1';
        }
    });

    input.focus();
    
    const closeRow = () => newTr.remove();
    cancelBtn.onclick = closeRow;
    
    const saveStory = async () => {
        const title = input.value.trim();
        if (!title) {
            closeRow();
            return;
        }
        
        input.disabled = true;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i data-lucide="loader" class="spin" style="width: 12px;"></i>';
        if (window.lucide) lucide.createIcons();
        
        const projectId = document.getElementById("story-project-select")?.value || state.globalProjectId;
        
        if (!projectId) {
            showToast("No project selected", "error");
            closeRow();
            return;
        }

        try {
            const bodyData = { 
                title: title, 
                priority: "Medium", 
                acceptance_criteria: ["Done when requirements are met"] 
            };
            if (milestoneId !== 'unassigned') {
                bodyData.milestone_id = milestoneId;
            }

            const response = await fetch(`${API_BASE}/api/projects/${projectId}/stories`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.token}` },
                body: JSON.stringify(bodyData)
            });
            
            if (response.ok) {
                showToast("Story created", "success");
                // keep the row open but reset it to allow multiple quick creations!
                input.value = '';
                input.disabled = false;
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Create <span style="font-size: 0.7rem; background: #cbd5e1; padding: 2px 4px; border-radius: 3px;">↵</span>';
                saveBtn.style.background = '#e2e8f0';
                saveBtn.style.color = '#475569';
                saveBtn.querySelector('span').style.background = '#cbd5e1';
                input.focus();
                
                // Refresh list
                loadStories(); 
            } else {
                showToast("Failed to create story", "error");
                input.disabled = false;
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Create <span style="font-size: 0.7rem; background: #cbd5e1; padding: 2px 4px; border-radius: 3px;">↵</span>';
            }
        } catch (e) {
            showToast("Network error", "error");
            input.disabled = false;
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Create <span style="font-size: 0.7rem; background: #cbd5e1; padding: 2px 4px; border-radius: 3px;">↵</span>';
        }
    };
    
    saveBtn.onclick = saveStory;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveStory();
        } else if (e.key === 'Escape') {
            closeRow();
        }
    });
};

window.openInlineUserPicker = function (event, roleType, storyId, taskId, projectId, isAdmin, isMilestone = false) {
    if (!isAdmin) return;

    event.stopPropagation();

    const existing = document.getElementById('inline-user-picker');
    if (existing) existing.remove();

    const picker = document.createElement('div');
    picker.id = 'inline-user-picker';
    picker.style.cssText = 'position: absolute; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px; z-index: 1050; box-shadow: var(--shadow-premium); display: flex; flex-direction: column; width: 220px; font-family: var(--font-family);';

    const rect = event.currentTarget.getBoundingClientRect();
    picker.style.top = (window.scrollY + rect.bottom + 4) + 'px';
    picker.style.left = (window.scrollX + rect.left) + 'px';

    const searchWrapper = document.createElement('div');
    searchWrapper.style.cssText = 'padding: 8px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 8px;';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'user');
    icon.style.cssText = 'width: 14px; height: 14px; color: var(--color-text-muted);';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search users...';
    input.style.cssText = 'border: none; background: transparent; outline: none; width: 100%; font-size: 0.85rem; color: var(--color-text-main);';

    searchWrapper.appendChild(icon);
    searchWrapper.appendChild(input);
    picker.appendChild(searchWrapper);

    const optionsContainer = document.createElement('div');
    optionsContainer.style.cssText = 'max-height: 200px; overflow-y: auto; padding: 4px 0;';
    picker.appendChild(optionsContainer);

    const members = state.projectMembers || [];
    const isTaskAssignee = taskId && roleType === 'assignee';
    const useId = isTaskAssignee || isMilestone;

    const options = [
        { name: "Unassigned", value: "", icon: "user" }
    ];

    const currentUser = state.user?.full_name;
    const currentUserId = state.user?.id;

    if (currentUser) {
        options.push({
            name: `${currentUser} (Assign to me)`,
            value: useId ? currentUserId : currentUser,
            initial: currentUser.charAt(0).toUpperCase()
        });
    }

    members.forEach(m => {
        if (m.user_name !== currentUser) {
            options.push({
                name: m.user_name,
                value: useId ? m.user_id : m.user_name,
                initial: m.user_name.charAt(0).toUpperCase()
            });
        }
    });

    const renderOptions = (filterText) => {
        optionsContainer.innerHTML = '';
        const filtered = options.filter(o => o.name.toLowerCase().includes(filterText.toLowerCase()));
        if (filtered.length === 0) {
            optionsContainer.innerHTML = '<div style="padding: 8px 12px; color: var(--color-text-muted); font-size: 0.85rem;">No matches</div>';
            return;
        }
        filtered.forEach(o => {
            const optDiv = document.createElement('div');
            optDiv.style.cssText = `padding: 8px 12px; font-size: 0.85rem; color: var(--color-text-main); cursor: pointer; display: flex; align-items: center; gap: 8px;`;
            optDiv.onmouseover = () => { optDiv.style.background = 'var(--bg-base)'; };
            optDiv.onmouseout = () => { optDiv.style.background = 'transparent'; };

            const avatarBg = o.value !== "" ? (roleType === 'assignee' ? '#10B981' : '#2563EB') : '#E2E8F0';
            const avatarColor = o.value !== "" ? '#fff' : '#475569';

            const avatarHtml = `<span style="width: 20px; height: 20px; border-radius: 50%; background: ${avatarBg}; color: ${avatarColor}; display: inline-flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; flex-shrink: 0;">
                ${o.value !== "" ? o.initial : '<i data-lucide="user" style="width: 12px; height: 12px;"></i>'}
            </span>`;

            optDiv.innerHTML = `${avatarHtml} <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${o.name}</span>`;

            optDiv.onclick = (e) => {
                e.stopPropagation();
                picker.remove();
                if (isMilestone) {
                    const fieldName = roleType === 'assignee' ? 'assignee_id' : 'reporter_id';
                    updateMilestoneField(projectId, storyId, fieldName, o.value ? parseInt(o.value) : null);
                } else if (taskId) {
                    if (roleType === 'assignee') {
                        updateTaskField(projectId, storyId, taskId, 'assigned_to', o.value ? parseInt(o.value) : null);
                    } else {
                        const story = state.storiesList.find(x => x.id === storyId);
                        if (story) {
                            const task = story.tasks.find(x => x.id === taskId);
                            if (task) {
                                task.reporter = o.value || 'Unassigned';
                                showToast(`Reporter updated to ${o.name.split(' ')[0]}`, 'success');
                                renderStoriesListView(state.storiesList, projectId);
                            }
                        }
                    }
                } else {
                    const story = state.storiesList.find(x => x.id === storyId);
                    if (story) {
                        story[roleType] = o.value || 'Unassigned';
                        showToast(`${roleType.charAt(0).toUpperCase() + roleType.slice(1)} updated to ${o.name.split(' ')[0]}`, 'success');
                        renderStoriesListView(state.storiesList, projectId);
                    }
                }
            };
            optionsContainer.appendChild(optDiv);
        });
        if (window.lucide) lucide.createIcons({ root: optionsContainer });
    };

    input.oninput = (e) => renderOptions(e.target.value);
    picker.onclick = (e) => e.stopPropagation();

    document.body.appendChild(picker);
    renderOptions("");
    input.focus();
    if (window.lucide) {
        lucide.createIcons({ root: searchWrapper });
    }

    setTimeout(() => {
        const closePicker = (e) => {
            if (document.getElementById('inline-user-picker')) {
                document.getElementById('inline-user-picker').remove();
            }
            document.removeEventListener('click', closePicker);
        };
        document.addEventListener('click', closePicker);
    }, 10);
};

// ===== Jira List View Selection Logic =====
window.jiraListUpdateSelection = function () {
    const checkboxes = document.querySelectorAll('.jira-row-checkbox');
    const checked = document.querySelectorAll('.jira-row-checkbox:checked');
    const bar = document.getElementById('jira-selection-bar');
    const countEl = document.getElementById('jira-selection-count');
    const selectAllCb = document.getElementById('jira-list-select-all');

    if (checked.length > 0) {
        bar.style.display = 'flex';
        countEl.textContent = checked.length;
        
        // Hide delete for non-admins
        const isGlobalAdmin = state.user?.is_admin;
        const isProjManager = ['Owner', 'Manager'].includes(state.currentProjectRole);
        const isAdmin = isGlobalAdmin || isProjManager;
        const deleteBtn = document.getElementById('bulk-delete-btn');
        const deleteDiv = document.getElementById('bulk-delete-divider');
        if (deleteBtn && deleteDiv) {
            deleteBtn.style.display = isAdmin ? 'flex' : 'none';
            deleteDiv.style.display = isAdmin ? 'inline' : 'none';
        }
    } else {
        bar.style.display = 'none';
    }

    // Update header checkbox state
    if (selectAllCb) {
        selectAllCb.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
        selectAllCb.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
    }

    // Highlight selected rows
    checkboxes.forEach(cb => {
        const row = cb.closest('tr');
        if (row) {
            if (cb.checked) {
                row.style.background = '#EFF6FF';
                row.onmouseover = () => row.style.background = '#DBEAFE';
                row.onmouseout = () => row.style.background = '#EFF6FF';
            } else {
                const isChild = cb.dataset.type === 'task';
                const defaultBg = isChild ? '#FAFAFB' : 'var(--bg-card)';
                row.style.background = defaultBg;
                row.onmouseover = () => row.style.background = isChild ? '#F1F5F9' : '#F8FAFC';
                row.onmouseout = () => row.style.background = defaultBg;
            }
        }
    });

    if (window.lucide) lucide.createIcons();
};

window.jiraListToggleSelectAll = function (isChecked) {
    const checkboxes = document.querySelectorAll('.jira-row-checkbox');
    checkboxes.forEach(cb => { cb.checked = isChecked; });
    jiraListUpdateSelection();
};

window.jiraListSelectAll = function () {
    const checkboxes = document.querySelectorAll('.jira-row-checkbox');
    checkboxes.forEach(cb => { cb.checked = true; });
    const selectAllCb = document.getElementById('jira-list-select-all');
    if (selectAllCb) selectAllCb.checked = true;
    jiraListUpdateSelection();
};

window.jiraListClearSelection = function () {
    const checkboxes = document.querySelectorAll('.jira-row-checkbox');
    checkboxes.forEach(cb => { cb.checked = false; });
    const selectAllCb = document.getElementById('jira-list-select-all');
    if (selectAllCb) { selectAllCb.checked = false; selectAllCb.indeterminate = false; }
    jiraListUpdateSelection();
};

window.jiraListBulkChangeStatus = function () {
    const checked = document.querySelectorAll('.jira-row-checkbox:checked');
    if (checked.length === 0) return;

    // Create a floating status picker
    const existing = document.getElementById('jira-bulk-status-picker');
    if (existing) existing.remove();

    const statuses = ['To Do', 'In Progress', 'Dev Done', 'Ready for QA', 'QA Done', 'Complete', 'On Hold'];
    const statusColors = {
        'To Do': { bg: '#E2E8F0', text: '#475569' },
        'In Progress': { bg: '#DBEAFE', text: '#1E40AF' },
        'Dev Done': { bg: '#CCFBF1', text: '#0F766E' },
        'Ready for QA': { bg: '#E0E7FF', text: '#3730A3' },
        'QA Done': { bg: '#F3E8FF', text: '#6B21A8' },
        'Complete': { bg: '#DCFCE7', text: '#15803D' },
        'On Hold': { bg: '#FEF3C7', text: '#9A3412' }
    };

    const picker = document.createElement('div');
    picker.id = 'jira-bulk-status-picker';
    picker.style.cssText = 'position: fixed; bottom: 56px; left: 50%; transform: translateX(-50%); background: #fff; border: 1px solid var(--border-color); border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); padding: 8px; z-index: 1000; display: flex; flex-direction: column; gap: 2px; min-width: 180px; animation: jiraBarSlideUp 0.15s ease-out;';

    statuses.forEach(s => {
        const colors = statusColors[s];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = s.toUpperCase();
        btn.style.cssText = `background: ${colors.bg}; color: ${colors.text}; border: none; padding: 8px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; cursor: pointer; text-align: left; transition: filter 0.15s;`;
        btn.onmouseover = () => btn.style.filter = 'brightness(0.95)';
        btn.onmouseout = () => btn.style.filter = 'none';
        btn.onclick = async () => {
            picker.remove();
            const projectId = document.getElementById('story-project-select')?.value;
            if (!projectId) return;

            let updatedCount = 0;
            for (const cb of checked) {
                try {
                    if (cb.dataset.type === 'story') {
                        await updateStoryField(projectId, parseInt(cb.dataset.id), 'status', s);
                        updatedCount++;
                    } else if (cb.dataset.type === 'task') {
                        await updateTaskField(projectId, parseInt(cb.dataset.storyId), parseInt(cb.dataset.id), 'status', s);
                        updatedCount++;
                    }
                } catch (err) { console.error('Bulk status error:', err); }
            }
            showToast(`Updated ${updatedCount} items to "${s}"`, 'success');
            jiraListClearSelection();
        };
        picker.appendChild(btn);
    });

    document.body.appendChild(picker);

    // Close on outside click
    const closeHandler = (e) => {
        if (!picker.contains(e.target)) {
            picker.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 100);
};

window.jiraListBulkDelete = async function () {
    const checked = document.querySelectorAll('.jira-row-checkbox:checked');
    if (checked.length === 0) return;

    const storyChecked = Array.from(checked).filter(cb => cb.dataset.type === 'story');
    const taskChecked = Array.from(checked).filter(cb => cb.dataset.type === 'task');

    // Count cascaded and independent tasks
    const selectedStoryIds = new Set(storyChecked.map(cb => String(cb.dataset.id)));
    const storiesList = state.storiesList || state.stories || [];
    let cascadedTasksCount = 0;
    storiesList.forEach(s => {
        if (selectedStoryIds.has(String(s.id))) {
            cascadedTasksCount += (s.tasks || []).length;
        }
    });

    const independentTasks = taskChecked.filter(cb => !selectedStoryIds.has(String(cb.dataset.storyId)));
    const totalSubtasksToDelete = cascadedTasksCount + independentTasks.length;

    showConfirmModal(
        "Bulk Delete?",
        `Are you sure you want to delete <strong>${storyChecked.length}</strong> stories and <strong>${totalSubtasksToDelete}</strong> subtasks?<br><br><small>This cannot be undone.</small>`,
        "Delete All",
        async () => {
            const projectId = document.getElementById('story-project-select')?.value;
            if (!projectId) return;

            let deletedStoriesCount = 0;
            let deletedTasksCount = 0;

            // Delete stories (this deletes their child tasks too)
            for (const cb of storyChecked) {
                try {
                    await deleteStory(projectId, parseInt(cb.dataset.id), true, true);
                    deletedStoriesCount++;
                } catch (err) { console.error('Bulk delete story error:', err); }
            }

            // Delete individual tasks (only if their parent story wasn't already deleted)
            for (const cb of independentTasks) {
                try {
                    const res = await fetch(`${API_BASE}/api/projects/${projectId}/stories/${cb.dataset.storyId}/tasks/${cb.dataset.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${state.token}` }
                    });
                    if (res.ok) deletedTasksCount++;
                } catch (err) { console.error('Bulk delete task error:', err); }
            }

            const toastMsg = `Deleted ${deletedStoriesCount} stories (including ${cascadedTasksCount} subtasks)` +
                (deletedTasksCount > 0 ? ` and ${deletedTasksCount} other subtasks` : '');
            showToast(toastMsg, 'success');
            jiraListClearSelection();

            // Refresh the stories list
            const btn = document.getElementById('btn-load-stories');
            if (btn) btn.click();
        },
        "danger"
    );
};

window.handleBoardDrop = async function (e, newStatus) {
    e.preventDefault();
    const storyId = e.dataTransfer.getData("text/plain");
    const projectId = document.getElementById("story-project-select")?.value;
    if (!storyId || !projectId) return;

    // 1. Optimistic UI update: Move card and update counts immediately
    const card = document.querySelector(`.board-card[data-story-id="${storyId}"]`);
    const containerId = "cards-" + newStatus.toLowerCase().replace(/\s+/g, '');
    const targetContainer = document.getElementById(containerId);
    let oldContainer = null;

    if (card && targetContainer) {
        oldContainer = card.parentElement;
        if (oldContainer && oldContainer !== targetContainer) {
            targetContainer.appendChild(card);

            // Helper to update column counts
            const updateCount = (container) => {
                const suffix = container.id.replace("cards-", "");
                const badge = document.getElementById(`badge-${suffix}-count`);
                if (badge) {
                    badge.textContent = container.querySelectorAll(".board-card").length;
                }
            };
            updateCount(oldContainer);
            updateCount(targetContainer);
        }
    }

    // 2. Perform API call in the background without blocking the UI
    try {
        const body = { status: newStatus };
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/stories/${storyId}`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${state.token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error("Failed to update story status");

        showToast(`Story moved to ${newStatus}`, "success");
        // Sync full state in background
        loadStories();
    } catch (err) {
        showToast(err.message, "error");
        // Revert UI on failure
        if (card && oldContainer) {
            oldContainer.appendChild(card);
            const updateCount = (container) => {
                const suffix = container.id.replace("cards-", "");
                const badge = document.getElementById(`badge-${suffix}-count`);
                if (badge) {
                    badge.textContent = container.querySelectorAll(".board-card").length;
                }
            };
            updateCount(oldContainer);
            if (targetContainer) updateCount(targetContainer);
        }
        loadStories();
    }
};


