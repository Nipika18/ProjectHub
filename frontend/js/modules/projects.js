// =====================================================================
// Project Management Handlers
// =====================================================================

function bindProjectEvents() {
    const btnOpen = document.getElementById("btn-open-create-project-modal");
    const btnClose = document.getElementById("btn-close-project-modal");
    const btnCancel = document.getElementById("btn-cancel-project-modal");
    const modal = document.getElementById("create-project-modal");
    const form = document.getElementById("create-project-form");

    // Detail Panel Back Button removed

    document.querySelectorAll(".btn-open-create-project-modal, #btn-open-create-project-modal").forEach(btn => {
        btn.addEventListener("click", () => {
            if (!checkAdminAccess("create new projects")) return;
            if (modal) modal.classList.add("active");
        });
    });
    if (btnClose) btnClose.addEventListener("click", () => modal && modal.classList.remove("active"));
    if (btnCancel) btnCancel.addEventListener("click", () => modal && modal.classList.remove("active"));

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!checkAdminAccess("create new projects")) return;
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn && submitBtn.disabled) return;

            const name = document.getElementById("project-name")?.value;
            const description = document.getElementById("project-desc")?.value;
            let due_date = document.getElementById("project-due-date")?.value;

            // Format due_date as ISO string if provided, else undefined
            due_date = due_date ? new Date(due_date).toISOString() : undefined;

            const origBtnText = submitBtn ? submitBtn.innerHTML : "Create Project";
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i data-lucide="loader" style="width: 14px; height: 14px;"></i> Creating...';
                if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
            }

            try {
                const response = await fetch(`${API_BASE}/api/projects`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${state.token}`
                    },
                    body: JSON.stringify({ name, description, due_date })
                });

                if (!response.ok) throw new Error("Could not create project.");

                showToast("Project created successfully!", "success");
                form.reset();
                if (modal) modal.classList.remove("active");
                loadProjects();
                loadWorkspaceData(); // Refresh counts
            } catch (e) {
                showToast(e.message, "error");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = origBtnText;
                }
            }
        });
    }

    // Detail Tab Buttons (Milestones, Team, Documents)
    const tabMilestones = document.getElementById("tab-milestones-btn");
    const tabTeam = document.getElementById("tab-team-btn");
    const tabDocs = document.getElementById("tab-docs-btn");

    if (tabTeam) {
        tabTeam.addEventListener("click", () => {
            state.activeProjectTab = "team";
            localStorage.setItem("activeProjectTab", "team");
            tabTeam.classList.add("active");
            if (tabMilestones) tabMilestones.classList.remove("active");
            if (tabDocs) tabDocs.classList.remove("active");
            document.getElementById("detail-tab-team")?.classList.add("active");
            document.getElementById("detail-tab-milestones")?.classList.remove("active");
            document.getElementById("detail-tab-docs")?.classList.remove("active");
            if (state.currentProject) loadTeamMembers(state.currentProject.id);
        });
    }

    if (tabMilestones) {
        tabMilestones.addEventListener("click", () => {
            state.activeProjectTab = "milestones";
            localStorage.setItem("activeProjectTab", "milestones");
            tabMilestones.classList.add("active");
            if (tabTeam) tabTeam.classList.remove("active");
            if (tabDocs) tabDocs.classList.remove("active");
            document.getElementById("detail-tab-milestones")?.classList.add("active");
            document.getElementById("detail-tab-team")?.classList.remove("active");
            document.getElementById("detail-tab-docs")?.classList.remove("active");
        });
    }

    if (tabDocs) {
        tabDocs.addEventListener("click", () => {
            state.activeProjectTab = "docs";
            localStorage.setItem("activeProjectTab", "docs");
            tabDocs.classList.add("active");
            if (tabMilestones) tabMilestones.classList.remove("active");
            if (tabTeam) tabTeam.classList.remove("active");
            document.getElementById("detail-tab-docs")?.classList.add("active");
            document.getElementById("detail-tab-milestones")?.classList.remove("active");
            document.getElementById("detail-tab-team")?.classList.remove("active");
            if (state.currentProject) loadProjectDetailDocuments(state.currentProject.id);
        });
    }

    const btnProjectUploadPrdTop = document.getElementById("btn-project-upload-prd-top");
    if (btnProjectUploadPrdTop) {
        btnProjectUploadPrdTop.addEventListener("click", () => {
            if (!checkAdminAccess("upload documents")) return;
            if (state.currentProject) {
                openMilestoneUploadModal(state.currentProject.id, null, state.currentProject.title);
            }
        });
    }

    const btnGlobalUploadPrdTop = document.getElementById("btn-global-upload-prd-top");
    if (btnGlobalUploadPrdTop) {
        btnGlobalUploadPrdTop.addEventListener("click", () => {
            if (!checkAdminAccess("upload documents")) return;
            const projId = state.globalProjectId || state.currentProject?.id;
            if (projId) {
                const proj = state.projects?.find(p => p.id === parseInt(projId)) || state.currentProject;
                openMilestoneUploadModal(projId, null, proj ? proj.title : 'Project');
            } else {
                showToast("Please select an Active Project first", "info");
            }
        });
    }

    const btnUploadDoc = document.getElementById("btn-project-detail-upload-doc");
    if (btnUploadDoc) {
        btnUploadDoc.addEventListener("click", async () => {
            if (!checkAdminAccess("upload documents")) return;
            if (state.currentProject) {
                openMilestoneUploadModal(state.currentProject.id, null, state.currentProject.title);
            }
        });
    }

    // Add Direct shortcuts
    const btnAddMilestonesDirect = document.getElementById("btn-add-milestone-direct");
    if (btnAddMilestonesDirect) {
        btnAddMilestonesDirect.addEventListener("click", async () => {
            if (!checkAdminAccess("add milestones")) return;
            await populateProjectDropdowns();
            const elId = document.getElementById("milestone-project-id");
            if (elId && state.currentProject) elId.value = state.currentProject.id;
            window.location.hash = "#milestones";
            document.getElementById("create-milestone-modal")?.classList.add("active");
        });
    }

    // Delete project modal is now handled by standalone inline script in index.html
}


async function loadProjects() {
    if (!state.token) return;

    const container = document.getElementById("project-cards-container");
    const renderCards = (data) => {
        container.innerHTML = "";
        let projectsToRender = data;
        if (state.globalProjectId) {
            projectsToRender = data.filter(p => p.id === parseInt(state.globalProjectId));
        }

        if (projectsToRender.length === 0) {
            container.innerHTML = '<p class="timeline-empty">No projects found.</p>';
            return;
        }

        const frag = document.createDocumentFragment();

        projectsToRender.forEach(project => {
            const card = document.createElement("div");
            card.className = "project-card glass-panel";
            card.setAttribute("data-id", project.id);

            const desc = project.description || "No description provided.";
            const created = new Date(project.created_at).toLocaleDateString();

            card.innerHTML = `
                <div class="project-card-header">
                    <h3>${escapeHTML(project.name)}</h3>
                    <p>${escapeHTML(desc)}</p>
                </div>
                <div class="project-card-footer">
                    <span><i data-lucide="calendar" style="width:12px;height:12px;"></i> Created: ${created}</span>
                    <span><i data-lucide="chevron-right" style="width:14px;height:14px;color:var(--color-primary);"></i></span>
                </div>
            `;

            card.addEventListener("click", () => {
                window.location.hash = `projects/${project.id}`;
            });

            frag.appendChild(card);
        });

        container.appendChild(frag);
        if (window.lucide) lucide.createIcons({ root: container });
    };

    // Stale-While-Revalidate: Render cache instantly
    if (state.projects && state.projects.length > 0) {
        renderCards(state.projects);
    } else if (!container.children.length || container.querySelector('.timeline-empty')) {
        container.innerHTML = '<p class="timeline-empty">Loading projects...</p>';
    }

    try {
        const response = await fetch(`${API_BASE}/api/projects`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });
        const projects = await response.json();

        // Check if we need to re-render
        const changed = JSON.stringify(state.projects) !== JSON.stringify(projects);
        const isLoading = container.innerHTML.includes("Loading projects");

        if (changed || isLoading) {
            state.projects = projects;
            populateProjectDropdowns("no-fetch");
            renderCards(projects);
        }
    } catch (e) {
        if (!state.projects || state.projects.length === 0) {
            container.innerHTML = `<p class="timeline-empty error">Failed to load projects: ${e.message}</p>`;
        }
    }
}

async function openProjectDetail(projectId) {
    if (!state.token) return;

    try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });
        if (!res.ok) throw new Error("Project not found");
        const project = await res.json();
        state.currentProject = project;
        updateSidebarProjectsLink();

        // Keep the global active project selector perfectly in sync
        const globalSelect = document.getElementById("global-project-select");
        if (globalSelect) {
            globalSelect.value = projectId;
            state.globalProjectId = projectId;
            localStorage.setItem("globalProjectId", projectId);
            globalSelect.classList.add("selected-bold");
        }

        // Populate detail panels
        document.getElementById("detail-project-title").textContent = project.name;
        document.getElementById("detail-project-desc").textContent = project.description || "No description provided.";

        const dueDateEl = document.getElementById("detail-project-due-date");
        if (dueDateEl) {
            const span = dueDateEl.querySelector("span");
            if (project.due_date) {
                span.textContent = `Due: ${new Date(project.due_date).toLocaleDateString()}`;
                dueDateEl.style.display = "flex";
            } else {
                span.textContent = "";
                dueDateEl.style.display = "none";
            }
        }

        // Hide grid, show detail panel
        document.getElementById("project-cards-container").classList.add("hidden");
        document.getElementById("project-detail-view").classList.remove("hidden");

        // Switch to the last active sub-tab (fallback to milestones)
        let activeTab = state.activeProjectTab || "milestones";
        if (activeTab === "documents") activeTab = "docs"; // Legacy fallback
        document.getElementById(`tab-${activeTab}-btn`)?.click();

        // Fetch detail lists
        loadProjectDetailMilestones(projectId);
        loadTeamMembers(projectId);
        loadProjectDetailDocuments(projectId);

        const teamControls = document.getElementById("team-management-controls");
        if (teamControls) {
            teamControls.style.display = "flex";
        }

        applyRBACUI();
    } catch (e) {
        showToast(e.message, "error");
        window.location.hash = "#projects";
    }
}

function getMilestoneChatKey(projectId, milestoneId) {
    return `${projectId}_${milestoneId}`;
}

function canManageProject(projectId) {
    if (state.user?.is_admin) return true;
    const proj = state.projects?.find(p => p.id === parseInt(projectId)) || state.currentProject;
    if (!proj) return false;
    return proj.user_role === "Manager" || proj.user_role === "Admin";
}

async function fetchProjectDocuments(projectId) {
    const res = await fetch(`${API_BASE}/api/documents/project/${projectId}`, {
        headers: { "Authorization": `Bearer ${state.token}` }
    });
    if (!res.ok) return [];
    return res.json();
}

function groupDocsByMilestoneId(docs) {
    const map = {};
    (docs || []).forEach(doc => {
        if (!doc.milestone_id) return;
        if (!map[doc.milestone_id]) map[doc.milestone_id] = [];
        map[doc.milestone_id].push(doc);
    });
    return map;
}

function groupStoriesByMilestoneId(stories) {
    const map = {};
    (stories || []).forEach(story => {
        if (!story.milestone_id) return;
        if (!map[story.milestone_id]) map[story.milestone_id] = [];
        map[story.milestone_id].push(story);
    });
    return map;
}

window.handleGenerateStoriesForMilestone = function (projectId, milestoneId, milestoneTitle, hasDocs) {
    if (!hasDocs) {
        showToast(`Please upload a PRD or spec document to milestone "${milestoneTitle}" to generate AI user stories.`, "info");
        openMilestoneUploadModal(projectId, milestoneId, milestoneTitle);
    } else {
        fetchProjectDocuments(projectId).then(docs => {
            const milestoneDocs = (docs || []).filter(d => d.milestone_id === milestoneId);
            if (milestoneDocs.length > 0) {
                generateStoriesFromDocument(projectId, milestoneDocs[0].id, milestoneDocs[0].name);
            } else {
                openMilestoneUploadModal(projectId, milestoneId, milestoneTitle);
            }
        });
    }
};

function renderMilestoneStoriesHtml(stories) {
    if (!stories || stories.length === 0) {
        return `
            <div class="milestone-empty-stories" style="padding: 12px 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; color: #64748b; font-size: 0.85rem; display: flex; align-items: center; gap: 10px;">
                <i data-lucide="sparkles" style="width: 16px; height: 16px; color: #0ea5e9; flex-shrink: 0;"></i>
                <span>No user stories generated for this milestone yet. Upload a PRD document to auto-generate AI user stories & tasks.</span>
            </div>`;
    }

    return `
        <div class="milestone-stories-list" style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
            ${stories.map(story => {
        const title = escapeHTML(story.title);
        const priorityClass = (story.priority || 'medium').toLowerCase();
        const storyPoints = story.story_points || 0;
        const taskCount = story.tasks ? story.tasks.length : 0;
        const completedTaskCount = story.tasks ? story.tasks.filter(t => t.status === 'Completed' || t.status === 'Done').length : 0;

        return `
                    <div class="milestone-story-item" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                        <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                            <span class="story-key-badge" style="background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 0.75rem; padding: 2px 8px; border-radius: 6px; white-space: nowrap;">NBL-${story.id}</span>
                            <span style="font-weight: 600; font-size: 0.88rem; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                            <span class="badge priority-${priorityClass}" style="font-size: 0.72rem; padding: 2px 8px; text-transform: capitalize;">${escapeHTML(story.priority || 'Medium')}</span>
                            <span style="font-size: 0.78rem; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 6px;"><i data-lucide="check-square" style="width: 12px; height: 12px; display: inline;"></i> ${completedTaskCount}/${taskCount} Tasks</span>
                            <span style="font-size: 0.78rem; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 2px 8px; border-radius: 6px;">${storyPoints} SP</span>
                        </div>
                    </div>`;
    }).join("")}
        </div>`;
}

function renderMilestoneDocumentsHtml(docs, projectId, milestoneId, safeTitle, canManage) {
    if (!docs || docs.length === 0) {
        return `
            <div class="milestone-empty-dropzone" onclick="${canManage ? `openMilestoneUploadModal(${projectId}, ${milestoneId}, '${safeTitle}')` : ''}" style="${canManage ? 'cursor: pointer;' : ''}">
                <div class="milestone-empty-icon-wrap">
                    <i data-lucide="file-up"></i>
                </div>
                <div class="milestone-empty-text-wrap">
                    <h5>No Documents Attached</h5>
                    <p>Click here or use <strong>"Upload"</strong> above to attach a document.</p>
                </div>
            </div>`;
    }

    return docs.map(doc => {
        const safeName = escapeHTML(doc.name);
        const jsName = doc.name.replace(/'/g, "\\'");
        const sizeKB = (doc.file_size / 1024).toFixed(1);
        const isGenerating = state.activeGenerations && state.activeGenerations[doc.id];
        const ext = (doc.file_type || doc.name.split('.').pop() || 'doc').toLowerCase();

        let typeBadgeClass = 'badge-doc';
        if (ext.includes('pdf')) typeBadgeClass = 'badge-pdf';
        else if (ext.includes('xls') || ext.includes('csv')) typeBadgeClass = 'badge-sheet';
        else if (ext.includes('txt') || ext.includes('html')) typeBadgeClass = 'badge-txt';

        let statusBadge = '';
        if (doc.status === 'processing') {
            statusBadge = `<span class="badge" style="background:#fef08a;color:#854d0e;margin-left:8px;font-size:0.75rem;padding:2px 6px;border-radius:12px;"><i data-lucide="loader" class="spin" style="width:10px;height:10px;margin-right:2px;"></i>Processing AI</span>`;
        } else if (doc.status === 'failed') {
            statusBadge = `<span class="badge" style="background:#fecdd3;color:#9f1239;margin-left:8px;font-size:0.75rem;padding:2px 6px;border-radius:12px;">Failed</span>`;
        }

        return `
            <div class="milestone-doc-row">
                <div class="milestone-doc-left">
                    <div class="doc-type-pill ${typeBadgeClass}">${ext.toUpperCase()}</div>
                    <div class="milestone-doc-info">
                        <div style="display: flex; align-items: center;">
                            <button class="milestone-doc-name" onclick="downloadDocumentSecurely(${doc.id}, '${jsName}')" title="Download ${safeName}">${safeName}</button>
                            <span id="doc-status-${doc.id}">${statusBadge}</span>
                        </div>
                        <span class="milestone-doc-meta">${sizeKB} KB · Added document</span>
                    </div>
                </div>
                <div class="milestone-doc-actions" style="display: flex; gap: 10px; align-items: center;">
                    <button class="btn-icon-action" onclick="downloadDocumentSecurely(${doc.id}, '${jsName}')" title="Download Document" style="width: 32px; height: 32px; border-radius: 6px; background: #ffffff; border: 1px solid #cbd5e1; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s;">
                        <i data-lucide="download" style="width: 16px; height: 16px; color: #334155; stroke-width: 2;"></i>
                    </button>
                    ${canManage ? `
                    <button class="btn btn-secondary btn-sm" id="btn-gen-stories-${doc.id}" ${isGenerating ? "disabled" : ""}
                        onclick="generateStoriesFromDocument(${projectId}, ${doc.id}, '${jsName}')" title="Generate User Stories with AI"
                        style="border-radius: 16px; padding: 6px 14px; font-size: 0.85rem; font-weight: 500; background: #ffffff; border: 1px solid #cbd5e1; color: #1e293b; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                        ${isGenerating ? '<i data-lucide="loader" class="spin" style="width:16px;height:16px;color:#334155;stroke-width: 2;"></i>' : '<i data-lucide="sparkles" style="width:16px;height:16px;color:#334155;stroke-width: 2;"></i>'} Stories
                    </button>
                    <button class="btn-icon-action danger" onclick="deleteDocumentDirect(${doc.id}, ${projectId}, this)" title="Delete Document" style="background: transparent; border: none; padding: 4px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;">
                        <i data-lucide="trash" style="width: 18px; height: 18px; color: #334155; stroke-width: 2;"></i>
                    </button>` : ""}
                </div>
            </div>`;
    }).join("");
}

function buildMilestoneCardHtml(milestone, projectId, docs, stories, canManage, isRoadmapView = false) {
    const isDone = milestone.status === "completed";
    const nodeClass = isDone ? "completed" : "";
    const formattedDate = milestone.due_date ? new Date(milestone.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "No due date";
    const title = escapeHTML(milestone.title);
    const desc = escapeHTML(milestone.description) || "No description provided for this milestone.";
    const safeTitle = milestone.title.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const docCount = docs ? docs.length : 0;
    const storyCount = stories ? stories.length : 0;
    const hasDocs = docCount > 0;

    return `
        <div class="timeline-card-node ${nodeClass}"></div>
        <div class="timeline-card-header">
            <div class="milestone-title-wrapper">
                ${!isRoadmapView ? `
                <h4 class="clickable-milestone-title" onclick="navigateToMilestoneOnRoadmap(${projectId}, ${milestone.id})" title="Click to view '${safeTitle}' on Milestones Roadmap">
                    ${title} <i data-lucide="external-link" class="milestone-ext-icon"></i>
                </h4>
                ` : `
                <h4>${title}</h4>
                `}
                <span class="status-badge-pill ${milestone.status}">${milestone.status === 'completed' ? '✓ Completed' : 'In Progress'}</span>
            </div>
            <div class="milestone-header-right" style="display: flex; align-items: center; gap: 8px;">
                ${canManage ? `
                <button class="btn btn-ask-ai-gradient btn-sm" onclick="generateStoriesForMilestone(${projectId}, ${milestone.id}, this)" title="Generate User Stories for Milestone" style="border-radius: 12px; font-weight: 600; padding: 4px 10px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px;">
                    <i data-lucide="sparkles" style="width: 12px; height: 12px;"></i> Generate Stories
                </button>
                ` : ''}
                ${docCount > 0 ? `
                <div class="milestone-due-pill" style="background: rgba(14, 165, 233, 0.1); color: #0ea5e9; border: 1px solid rgba(14, 165, 233, 0.2);">
                    <i data-lucide="paperclip"></i> ${docCount} Document
                </div>
                ` : ''}
                <div class="milestone-due-pill">
                    <i data-lucide="calendar"></i> Due ${formattedDate}
                </div>
            </div>
        </div>
        <p class="timeline-card-body">${desc}</p>

        ${storyCount > 0 ? `
        <div class="milestone-stories-section" style="margin-top: 16px;">
            <div class="milestone-docs-header">
                <span class="header-title"><i data-lucide="layout-template"></i> Milestone User Stories & Tasks</span>
                <span class="doc-count-badge" style="background: rgba(14, 165, 233, 0.1); color: #0ea5e9;">${storyCount} Stories</span>
            </div>
            ${renderMilestoneStoriesHtml(stories || [])}
        </div>` : ''}

        <div class="timeline-card-footer" style="display: flex; justify-content: flex-end; align-items: center;">
            <div class="timeline-card-actions">
                <button class="btn btn-secondary btn-sm" onclick="openEditMilestoneModal(${milestone.id}, '${safeTitle}', '${escapeHTML(milestone.description || '').replace(/'/g, "\\'").replace(/"/g, "&quot;")}', '${milestone.due_date ? milestone.due_date.split('T')[0] : ''}', '${milestone.status}', ${projectId})" title="Edit Milestone">
                    <i data-lucide="edit-3"></i> Edit
                </button>
                ${!isDone ? `<button class="btn btn-secondary btn-sm btn-success-light" onclick="toggleMilestoneStatus(${milestone.id}, 'completed', this)" title="Mark Completed"><i data-lucide="check-circle-2"></i> Complete</button>` : `<button class="btn btn-secondary btn-sm" onclick="toggleMilestoneStatus(${milestone.id}, 'pending', this)" title="Reopen Milestone"><i data-lucide="rotate-ccw"></i> Reopen</button>`}
                ${canManage ? `
                <button class="btn-icon-action danger" onclick="deleteMilestoneDirect(${milestone.id}, this)" title="Delete Milestone"><i data-lucide="trash-2"></i></button>
                ` : ""}
            </div>
        </div>`;
}

async function generateStoriesForMilestone(projectId, milestoneId, btnElement) {
    if (!checkAdminAccess("generate stories")) return;

    if (!confirm("Are you sure you want to generate stories for this milestone? This will process all attached documents using AI.")) {
        return;
    }

    const originalHtml = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = `<i data-lucide="loader" class="spin"></i> Generating...`;
    lucide.createIcons();

    try {
        const response = await fetch(`${API_BASE}/api/projects/${projectId}/stories/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${state.token}`
            },
            body: JSON.stringify({ milestone_id: milestoneId })
        });

        if (response.ok) {
            const data = await response.json();
            showToast(`Successfully generated ${data.count} stories for milestone!`, "success");
            refreshMilestoneViewsForProject(projectId);
            if (typeof loadWorkspaceData === "function") loadWorkspaceData();
        } else {
            const error = await response.json();
            showToast(error.detail || "Failed to generate stories", "error");
        }
    } catch (error) {
        console.error("Error generating stories:", error);
        showToast("Network error generating stories.", "error");
    } finally {
        btnElement.disabled = false;
        btnElement.innerHTML = originalHtml;
        lucide.createIcons();
    }
}

function refreshMilestoneViewsForProject(projectId) {
    if (state.currentProject && state.currentProject.id === projectId) {
        loadProjectDetailMilestones(projectId);
    }
    const filter = document.getElementById("milestone-project-filter");
    if (filter && parseInt(filter.value) === projectId) {
        loadMilestonesRoadmap();
    }
}

async function loadProjectDetailMilestones(projectId) {
    const container = document.getElementById("project-detail-milestones-list");
    if (!container) return; // Prevent exception if not on project details page
    container.innerHTML = '<p class="timeline-empty">Loading milestones...</p>';

    try {
        const [milestonesRes, docs, storiesRes] = await Promise.all([
            fetch(`${API_BASE}/api/milestones/project/${projectId}`, {
                headers: { "Authorization": `Bearer ${state.token}` }
            }),
            fetchProjectDocuments(projectId),
            fetch(`${API_BASE}/api/stories?project_id=${projectId}`, {
                headers: { "Authorization": `Bearer ${state.token}` }
            })
        ]);
        const milestones = await milestonesRes.json();
        const stories = storiesRes.ok ? await storiesRes.json() : [];
        const docsByMilestone = groupDocsByMilestoneId(docs);
        const storiesByMilestone = groupStoriesByMilestoneId(stories);
        const canManage = canManageProject(projectId);

        container.innerHTML = "";
        if (milestones.length === 0) {
            container.innerHTML = `
                <div class="timeline-empty-state" style="padding: 30px 0;">
                    <p>No milestones created for this project yet.</p>
                </div>
            `;
            return;
        }

        milestones.forEach(milestone => {
            const card = document.createElement("div");
            card.className = "timeline-card";
            card.id = `milestone-card-${milestone.id}`;
            card.innerHTML = buildMilestoneCardHtml(
                milestone,
                projectId,
                docsByMilestone[milestone.id] || [],
                storiesByMilestone[milestone.id] || [],
                canManage
            );
            container.appendChild(card);
        });

        if (window.lucide) lucide.createIcons();
    } catch (e) {
        container.innerHTML = `<p class="timeline-empty error">Error: ${e.message}</p>`;
    }
}

// Global scope bindings for inline calls
window.toggleMilestoneStatus = async function (milestoneId, newStatus, triggerBtn) {

    // --- Optimistic UI: update the card instantly without waiting for re-fetch ---
    const card = triggerBtn ? triggerBtn.closest(".timeline-card") : null;
    if (card) {
        const isDone = newStatus === "completed";
        // Update the status badge text + class
        const badge = card.querySelector(".status-badge-pill");
        if (badge) {
            badge.textContent = isDone ? "✓ Completed" : "In Progress";
            badge.className = `status-badge-pill ${newStatus}`;
        }
        // Update the node dot colour
        const node = card.querySelector(".timeline-card-node");
        if (node) {
            node.classList.toggle("completed", isDone);
        }
        // Swap the toggle button in place
        const actionsDiv = triggerBtn.parentElement;
        const newBtnHtml = isDone
            ? `<button class="btn btn-secondary btn-sm" onclick="toggleMilestoneStatus(${milestoneId}, 'pending', this)" title="Reopen Milestone"><i data-lucide="rotate-ccw"></i> Reopen</button>`
            : `<button class="btn btn-secondary btn-sm" onclick="toggleMilestoneStatus(${milestoneId}, 'completed', this)" title="Mark Completed"><i data-lucide="check"></i> Complete</button>`;
        triggerBtn.outerHTML = newBtnHtml;
        lucide.createIcons({ nodes: [actionsDiv] });
    }

    try {
        const res = await fetch(`${API_BASE}/api/milestones/${milestoneId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${state.token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error("Could not update milestone");
        showToast(`Milestone updated to ${newStatus}!`, "success");
        // Background sync — keeps data fresh without a visible reload flicker
        if (state.currentProject) {
            loadProjectDetailMilestones(state.currentProject.id);
        }
        // Always sync the roadmap if we are on the milestones view
        if (window.location.hash.includes("milestones")) {
            loadMilestonesRoadmap();
        }
        loadWorkspaceData();
    } catch (e) {
        showToast(e.message, "error");
        // On failure re-render to restore true server state
        if (state.currentProject) {
            loadProjectDetailMilestones(state.currentProject.id);
        } else {
            loadMilestonesRoadmap();
        }
    }
};

window.deleteMilestoneDirect = async function (milestoneId, triggerBtn) {
    if (!checkAdminAccess("delete milestones")) return;

    showConfirmModal(
        "Delete Milestone?",
        "Associated documents and user stories will also be permanently deleted.",
        "Delete Milestone",
        async () => {
            // --- Optimistic UI: remove the card instantly ---
            const card = triggerBtn ? triggerBtn.closest(".timeline-card") : null;
            if (card) {
                card.style.transition = "opacity 0.2s ease, transform 0.2s ease";
                card.style.opacity = "0";
                card.style.transform = "translateX(-8px)";
                setTimeout(() => card.remove(), 200);
            }

            try {
                const res = await fetch(`${API_BASE}/api/milestones/${milestoneId}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${state.token}` }
                });
                if (!res.ok) throw new Error("Failed to delete milestone");
                showToast("Milestone deleted.");
                if (state.currentProject) {
                    loadProjectDetailMilestones(state.currentProject.id);
                } else {
                    loadMilestonesRoadmap();
                }
                loadWorkspaceData();
            } catch (e) {
                showToast(e.message, "error");
                // On failure re-render to restore the card
                if (state.currentProject) {
                    loadProjectDetailMilestones(state.currentProject.id);
                } else {
                    loadMilestonesRoadmap();
                }
            }
        },
        "danger"
    );
};

window.deleteDocumentDirect = async function (documentId, projectId, triggerBtn) {
    if (!checkAdminAccess("delete documents")) return;

    showConfirmModal(
        "Delete Document?",
        "This will permanently delete the file and remove it from the system.",
        "Delete Document",
        async () => {
            const row = triggerBtn ? triggerBtn.closest("tr") : null;
            if (row) {
                row.style.transition = "opacity 0.2s ease";
                row.style.opacity = "0";
                setTimeout(() => row.remove(), 200);
            }

            try {
                const res = await fetch(`${API_BASE}/api/documents/${documentId}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${state.token}` }
                });
                if (!res.ok) throw new Error("Failed to delete document.");
                showToast("File deleted successfully.");
                refreshMilestoneViewsForProject(projectId);
                loadWorkspaceData();
                if (typeof loadProjectDetailDocuments === 'function') {
                    loadProjectDetailDocuments(projectId);
                }
            } catch (e) {
                showToast(e.message, "error");
                refreshMilestoneViewsForProject(projectId);
                if (typeof loadProjectDetailDocuments === 'function') {
                    loadProjectDetailDocuments(projectId);
                }
            }
        },
        "danger"
    );
};

// ─── Document Action Dropdown Helpers ─────────────────────────────────────────

window.closeAllDocMenus = function () {
    document.querySelectorAll(".doc-action-dropdown.open").forEach(d => d.classList.remove("open"));
};

window.toggleDocActionMenu = function (docId, event) {
    event.stopPropagation();
    const dropdown = document.getElementById(`doc-action-dropdown-${docId}`);
    if (!dropdown) return;
    const isOpen = dropdown.classList.contains("open");
    closeAllDocMenus();
    if (!isOpen) {
        dropdown.classList.add("open");
        if (window.lucide) lucide.createIcons({ nodes: [dropdown] });
    }
};

// Close menus when clicking anywhere outside
document.addEventListener("click", function (e) {
    if (!e.target.closest(".doc-action-menu-wrapper")) {
        closeAllDocMenus();
    }
});

// ─── Story Generation from Document ──────────────────────────────────────────

window.generateStoriesFromDocument = async function (projectId, documentId, docName) {
    if (!checkAdminAccess("generate user stories")) return;

    showConfirmModal(
        "Generate User Stories?",
        `AI will analyse <strong>"${docName}"</strong> and create Agile user stories.<br><br><small>Any duplicate stories will be skipped automatically.</small>`,
        "Generate Stories",
        async () => {
            if (!state.activeGenerations) state.activeGenerations = {};
            state.activeGenerations[documentId] = true;

            const btn = document.getElementById(`btn-gen-stories-${documentId}`);
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader" class="spin" style="width:14px;height:14px;"></i> Generating...';
                if (window.lucide) lucide.createIcons();
            }

            try {
                const res = await fetch(`${API_BASE}/api/projects/${projectId}/stories/generate-from-document`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${state.token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ document_id: documentId })
                });

                if (res.ok) {
                    const data = await res.json();
                    showToast(data.message || `Stories generated from "${docName}"`, "success");

                    // If the user is currently on the User Stories section viewing this project, auto-reload stories list!
                    const storyProjSelect = document.getElementById("story-project-select");
                    if (state.activeSection === "stories" && storyProjSelect && parseInt(storyProjSelect.value) === projectId) {
                        loadStories();
                    }
                } else {
                    const err = await res.json();
                    showToast(err.detail || "Failed to generate stories", "error");
                }
            } catch (e) {
                showToast(`Network error: ${e.message}`, "error");
            } finally {
                if (state.activeGenerations) {
                    delete state.activeGenerations[documentId];
                }

                refreshMilestoneViewsForProject(projectId);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i data-lucide="sparkles" style="width: 14px; height: 14px;"></i> Stories';
                    if (window.lucide) lucide.createIcons();
                }
            }
        },
        "primary"
    );
};

window.regenerateStoriesFromDocument = async function (projectId, documentId, docName) {
    if (!checkAdminAccess("regenerate user stories")) return;

    showConfirmModal(
        "Regenerate User Stories?",
        `Are you sure you want to regenerate stories from <strong>"${docName}"</strong>?<br><br><small>New stories will be added. Existing stories are kept but duplicates will be skipped automatically.</small>`,
        "Regenerate",
        async () => {
            showToast(`Regenerating stories from "${docName}"...`, "info");

            try {
                const res = await fetch(`${API_BASE}/api/projects/${projectId}/stories/generate-from-document`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${state.token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ document_id: documentId })
                });

                if (res.ok) {
                    const data = await res.json();
                    showToast(data.message || `Stories regenerated from "${docName}"`, "success");
                } else {
                    const err = await res.json();
                    showToast(err.detail || "Failed to regenerate stories", "error");
                }
            } catch (e) {
                showToast(`Network error: ${e.message}`, "error");
            }
        },
        "warning"
    );
};

window.downloadDocumentSecurely = async function (documentId, fileName) {
    if (!window.confirm(`Are you sure you want to download '${fileName}'?`)) {
        return;
    }
    showToast(`Starting secure download for ${fileName}...`);
    try {
        const res = await fetch(`${API_BASE}/api/documents/download/${documentId}`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });
        if (!res.ok) {
            let errorMsg = "Could not access private file server.";
            try {
                const errData = await res.json();
                if (errData.detail) errorMsg = errData.detail;
            } catch (e) {
                // If it's not JSON, stick to the default error message
            }
            throw new Error(errorMsg);
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast(`Downloaded: ${fileName}`, "success");
    } catch (e) {
        showToast(e.message, "error");
    }
};

window.openMilestoneUploadModal = async function (projectId, milestoneId, milestoneTitle) {
    if (!checkAdminAccess("upload documents")) return;

    state.uploadContext = { projectId, milestoneId, milestoneTitle };

    const modal = document.getElementById("milestone-upload-modal");
    const subtitle = document.getElementById("milestone-upload-subtitle");
    if (subtitle) {
        subtitle.textContent = milestoneTitle ? `Upload document to "${milestoneTitle}".` : "Upload document to project.";
    }

    // Populate Milestone Selector Dropdown in Modal
    const msSelect = document.getElementById("upload-milestone-select");
    if (msSelect) {
        msSelect.innerHTML = '<option value="">-- General Project Document --</option>';
        const targetProjId = projectId || state.currentProject?.id || state.globalProjectId;
        if (targetProjId) {
            try {
                const res = await fetch(`${API_BASE}/api/milestones/project/${targetProjId}`, {
                    headers: { "Authorization": `Bearer ${state.token}` }
                });
                if (res.ok) {
                    const milestones = await res.json();
                    milestones.forEach(m => {
                        const opt = document.createElement("option");
                        opt.value = m.id;
                        opt.textContent = m.title;
                        msSelect.appendChild(opt);
                    });
                }
            } catch (e) {
                console.error("Error populating milestone upload dropdown:", e);
            }
        }
        msSelect.value = milestoneId ? String(milestoneId) : "";
    }

    const progressContainer = document.getElementById("upload-progress-container");
    if (progressContainer) progressContainer.classList.add("hidden");

    const fileInput = document.getElementById("file-input");
    if (fileInput) fileInput.value = "";

    if (modal) modal.classList.add("active");
    lucide.createIcons();
};

window.uploadToMilestone = window.openMilestoneUploadModal;

window.navigateToMilestoneOnRoadmap = async function (projectId, milestoneId) {
    if (!milestoneId) return;

    if (projectId && state.currentProject?.id !== parseInt(projectId)) {
        await selectActiveProject(projectId);
    }

    window.location.hash = "#milestones";

    setTimeout(() => {
        const card = document.getElementById(`milestone-card-${milestoneId}`);
        if (card) {
            card.scrollIntoView({ behavior: "smooth", block: "center" });
            card.classList.add("milestone-highlight-pulse");
            setTimeout(() => {
                card.classList.remove("milestone-highlight-pulse");
            }, 2500);
        }
    }, 300);
};


// =====================================================================
// Global Edit Project Modal Handlers
// =====================================================================

document.addEventListener("click", (e) => {
    const btn = e.target.closest("#btn-edit-project");
    if (!btn) return;
    e.preventDefault();

    if (!checkAdminAccess("edit projects")) {
        // Only managers or admins can edit. Since we don't have a distinct "edit projects" RBAC entry in the default list for now, let's just use the current project user_role check.
        const isGlobalAdmin = state.user?.is_admin;
        const isProjManager = state.currentProject && (state.currentProject.user_role === 'Manager' || state.currentProject.user_role === 'Admin');
        if (!isGlobalAdmin && !isProjManager) {
            showToast("You don't have permission to edit this project.", "error");
            return;
        }
    }

    const editProjectModal = document.getElementById("edit-project-modal");
    if (!editProjectModal) return;

    if (!state.currentProject) {
        showToast("Please select a project first to edit.", "error");
        return;
    }

    document.getElementById("edit-project-name").value = state.currentProject.name || "";
    document.getElementById("edit-project-desc").value = state.currentProject.description || "";
    if (state.currentProject.due_date) {
        document.getElementById("edit-project-due-date").value = state.currentProject.due_date.split("T")[0];
    } else {
        document.getElementById("edit-project-due-date").value = "";
    }

    editProjectModal.style.display = "flex";
    editProjectModal.classList.add("active");
});

document.addEventListener("click", (e) => {
    if (e.target.closest("#btn-close-edit-project-modal") || e.target.closest("#btn-cancel-edit-project-modal")) {
        const modal = document.getElementById("edit-project-modal");
        if (modal) {
            modal.style.display = "none";
            modal.classList.remove("active");
        }
    }
});

document.addEventListener("submit", async (e) => {
    if (e.target.id === "edit-project-form") {
        e.preventDefault();

        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn && submitBtn.disabled) return;

        if (!state.currentProject) return;

        const name = document.getElementById("edit-project-name").value;
        const description = document.getElementById("edit-project-desc").value;
        let due_date = document.getElementById("edit-project-due-date").value;
        due_date = due_date ? new Date(due_date).toISOString() : undefined;

        const origBtnText = submitBtn ? submitBtn.innerHTML : "Save Changes";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="loader" style="width: 14px; height: 14px;"></i> Saving...';
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        }

        try {
            const response = await fetch(`${API_BASE}/api/projects/${state.currentProject.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${state.token}`
                },
                body: JSON.stringify({ name, description, due_date })
            });

            if (!response.ok) throw new Error("Could not update project.");

            showToast("Project updated successfully!", "success");
            const modal = document.getElementById("edit-project-modal");
            if (modal) {
                modal.style.display = "none";
                modal.classList.remove("active");
            }

            // Reload project details
            openProjectDetail(state.currentProject.id);
            loadWorkspaceData(); // Refresh sidebar project name
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origBtnText;
            }
        }
    }
});


// =====================================================================
// Global Delete Project Modal Handlers
// =====================================================================

document.addEventListener("click", (e) => {
    const btn = e.target.closest("#btn-delete-project");
    if (!btn) return;
    e.preventDefault();

    const deleteProjectModal = document.getElementById("delete-project-modal");
    if (!deleteProjectModal) return;

    const selProjId = document.getElementById("global-project-select")?.value;
    const detailTitle = document.getElementById("detail-project-title")?.textContent?.trim();

    let targetDeleteProject = state.currentProject
        || state.projects?.find(p => p.id == state.globalProjectId)
        || state.projects?.find(p => p.id == selProjId);

    if (!targetDeleteProject && detailTitle && detailTitle !== "Project Name") {
        targetDeleteProject = {
            id: state.globalProjectId || selProjId,
            name: detailTitle
        };
    }

    if (!targetDeleteProject || !targetDeleteProject.name) {
        showToast("Please select a project first to delete.", "error");
        return;
    }

    window._deleteTargetProject = targetDeleteProject;

    const nameDisplay = document.getElementById("delete-project-name-display");
    const codeConfirm = document.getElementById("delete-project-code-confirm");
    const deleteConfirmInput = document.getElementById("delete-project-input-confirm");
    const deleteConfirmSubmit = document.getElementById("btn-confirm-delete-project-submit");
    const deleteStatusMsg = document.getElementById("delete-confirm-status-msg");

    if (nameDisplay) nameDisplay.textContent = targetDeleteProject.name;
    if (codeConfirm) codeConfirm.textContent = targetDeleteProject.name;
    if (deleteConfirmInput) deleteConfirmInput.value = "";

    if (deleteStatusMsg) {
        deleteStatusMsg.innerHTML = `Type <strong>${targetDeleteProject.name}</strong> above to unlock the delete button.`;
        deleteStatusMsg.style.color = '#dc2626';
    }

    if (deleteConfirmSubmit) {
        deleteConfirmSubmit.disabled = true;
        deleteConfirmSubmit.style.opacity = "0.5";
        deleteConfirmSubmit.style.cursor = "not-allowed";
    }

    deleteProjectModal.style.display = "flex";
    deleteProjectModal.classList.add("active");
    if (deleteConfirmInput) setTimeout(() => deleteConfirmInput.focus(), 100);
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
});

document.addEventListener("DOMContentLoaded", () => {
    const deleteConfirmInput = document.getElementById("delete-project-input-confirm");
    const deleteConfirmSubmit = document.getElementById("btn-confirm-delete-project-submit");
    const deleteStatusMsg = document.getElementById("delete-confirm-status-msg");
    const deleteProjectForm = document.getElementById("delete-project-confirm-form");

    if (deleteConfirmInput) {
        deleteConfirmInput.addEventListener("input", () => {
            const proj = window._deleteTargetProject;
            if (!proj) return;
            const typed = deleteConfirmInput.value.trim().toLowerCase();
            const expected = proj.name.trim().toLowerCase();

            if (typed === expected) {
                if (deleteConfirmSubmit) {
                    deleteConfirmSubmit.disabled = false;
                    deleteConfirmSubmit.style.opacity = "1";
                    deleteConfirmSubmit.style.cursor = "pointer";
                }
                if (deleteStatusMsg) {
                    deleteStatusMsg.innerHTML = '✓ Name matched! Click Delete Project below.';
                    deleteStatusMsg.style.color = '#16a34a';
                }
            } else {
                if (deleteConfirmSubmit) {
                    deleteConfirmSubmit.disabled = true;
                    deleteConfirmSubmit.style.opacity = "0.5";
                    deleteConfirmSubmit.style.cursor = "not-allowed";
                }
                if (deleteStatusMsg) {
                    deleteStatusMsg.innerHTML = `Type <strong>${proj.name}</strong> above to unlock the delete button.`;
                    deleteStatusMsg.style.color = '#dc2626';
                }
            }
        });
    }

    const closeDeleteModal = () => {
        const modal = document.getElementById("delete-project-modal");
        if (modal) {
            modal.classList.remove("active");
            modal.style.display = "";
        }
        window._deleteTargetProject = null;
    };

    const btnCloseDeleteModal = document.getElementById("btn-close-delete-project-modal");
    const btnCancelDeleteModal = document.getElementById("btn-cancel-delete-project-modal");
    if (btnCloseDeleteModal) btnCloseDeleteModal.addEventListener("click", closeDeleteModal);
    if (btnCancelDeleteModal) btnCancelDeleteModal.addEventListener("click", closeDeleteModal);

    if (deleteProjectForm) {
        deleteProjectForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const proj = window._deleteTargetProject;
            if (!proj) return;
            if (!checkAdminAccess("delete projects")) return;

            const typed = deleteConfirmInput ? deleteConfirmInput.value.trim().toLowerCase() : "";
            const expected = proj.name.trim().toLowerCase();
            if (typed !== expected) return;

            const origBtnText = deleteConfirmSubmit ? deleteConfirmSubmit.innerHTML : "Delete Project";
            if (deleteConfirmSubmit) {
                deleteConfirmSubmit.disabled = true;
                deleteConfirmSubmit.innerHTML = '<i data-lucide="loader" style="width:14px;height:14px;"></i> Deleting...';
                if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
            }

            try {
                const res = await fetch(`${API_BASE}/api/projects/${proj.id}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${state.token}` }
                });

                if (!res.ok) throw new Error("Failed to delete project.");

                showToast(`Project '${proj.name}' and all associated files deleted successfully.`, "success");
                closeDeleteModal();
                state.currentProject = null;
                state.globalProjectId = "";
                window.location.hash = "#projects";
                loadProjects();
                loadWorkspaceData();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                if (deleteConfirmSubmit) {
                    deleteConfirmSubmit.disabled = false;
                    deleteConfirmSubmit.innerHTML = origBtnText;
                }
            }
        });
    }
});

function populateMilestoneDropdowns() {
    const milestones = state.milestones || [];
    const options = '<option value="">None</option>' + milestones.map(m => `<option value="${m.id}">${m.title}</option>`).join('');

    const createSelect = document.getElementById("story-milestone-select");
    if (createSelect) {
        // preserve selected if any
        const currentVal = createSelect.value;
        createSelect.innerHTML = options;
        if (currentVal && milestones.find(m => m.id == currentVal)) {
            createSelect.value = currentVal;
        }
    }

    const filterSelect = document.getElementById("board-milestone-filter");
    if (filterSelect) {
        const currentFilter = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Milestones</option>' + milestones.map(m => `<option value="${m.id}">${m.title}</option>`).join('');
        if (currentFilter && milestones.find(m => m.id == currentFilter)) {
            filterSelect.value = currentFilter;
        }
    }
}

