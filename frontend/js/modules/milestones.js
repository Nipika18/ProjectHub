// =====================================================================
// Milestone Timeline Roadmaps
// =====================================================================

function bindMilestoneEvents() {
    const btnOpen = document.getElementById("btn-open-create-milestone-modal");
    const btnClose = document.getElementById("btn-close-milestone-modal");
    const btnCancel = document.getElementById("btn-cancel-milestone-modal");
    const modal = document.getElementById("create-milestone-modal");
    const form = document.getElementById("create-milestone-form");
    const filter = document.getElementById("milestone-project-filter");

    // Global Upload Logic
    const btnGlobalUpload = document.getElementById("btn-global-upload-doc");
    const choiceModal = document.getElementById("global-upload-choice-modal");
    const btnCloseChoice = document.getElementById("btn-close-global-upload-choice");
    const btnChoiceExisting = document.getElementById("btn-choice-existing-milestone");
    const btnChoiceNew = document.getElementById("btn-choice-new-milestone");

    if (btnGlobalUpload && choiceModal) {
        btnGlobalUpload.addEventListener("click", () => {
            if (!checkAdminAccess("upload documents")) return;
            choiceModal.classList.add("active");
        });
        
        btnCloseChoice.addEventListener("click", () => choiceModal.classList.remove("active"));
        
        btnChoiceExisting.addEventListener("click", () => {
            choiceModal.classList.remove("active");
            const projId = state.currentProject?.id || state.globalProjectId;
            openMilestoneUploadModal(projId, null, null);
        });
        
        btnChoiceNew.addEventListener("click", () => {
            choiceModal.classList.remove("active");
            if (!checkAdminAccess("create milestones")) return;
            state.autoOpenUploadOnCreate = true;
            populateProjectDropdowns();
            modal.classList.add("active");
        });
    }

    btnOpen.addEventListener("click", () => {
        if (!checkAdminAccess("create milestones")) return;
        state.autoOpenUploadOnCreate = false; // reset in case they click normal New Milestone
        populateProjectDropdowns();
        modal.classList.add("active");
    });
    btnClose.addEventListener("click", () => modal.classList.remove("active"));
    btnCancel.addEventListener("click", () => modal.classList.remove("active"));

    filter.addEventListener("change", loadMilestonesRoadmap);

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!checkAdminAccess("create milestones")) return;
        const project_id = parseInt(document.getElementById("milestone-project-id").value);
        const title = document.getElementById("milestone-title").value;
        const description = document.getElementById("milestone-desc").value;
        const due_date = document.getElementById("milestone-due").value;
        const submitBtn = form.querySelector('button[type="submit"]');

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Creating...";
        }

        try {
            const res = await fetch(`${API_BASE}/api/milestones`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${state.token}`
                },
                body: JSON.stringify({ project_id, title, description, due_date })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || "Failed to create milestone");
            }
            const newMilestone = await res.json();
            form.reset();
            modal.classList.remove("active");
            refreshMilestoneViewsForProject(project_id);
            if (typeof loadWorkspaceData === "function") loadWorkspaceData();
            
            if (state.autoOpenUploadOnCreate) {
                state.autoOpenUploadOnCreate = false;
                showToast("Milestone created successfully!", "success");
                openMilestoneUploadModal(project_id, newMilestone.id, newMilestone.title);
            } else {
                showToast(
                    "Milestone created successfully!",
                    "success",
                    "Upload document now",
                    null,
                    () => openMilestoneUploadModal(project_id, newMilestone.id, newMilestone.title)
                );
            }
        } catch (e) {
            showToast(e.message, "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Create Milestone";
            }
        }
    });

    // Edit Milestone Modal Handlers
    const editModal = document.getElementById("edit-milestone-modal");
    const editForm = document.getElementById("edit-milestone-form");
    const btnCloseEdit = document.getElementById("btn-close-edit-milestone-modal");
    const btnCancelEdit = document.getElementById("btn-cancel-edit-milestone-modal");

    if (btnCloseEdit && editModal) btnCloseEdit.addEventListener("click", () => editModal.classList.remove("active"));
    if (btnCancelEdit && editModal) btnCancelEdit.addEventListener("click", () => editModal.classList.remove("active"));

    if (editForm) {
        editForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!checkAdminAccess("edit milestones")) return;
            const id = document.getElementById("edit-milestone-id").value;
            const projectId = parseInt(document.getElementById("edit-milestone-project-id").value);
            const title = document.getElementById("edit-milestone-title").value.trim();
            const description = document.getElementById("edit-milestone-desc").value.trim();
            const due_date = document.getElementById("edit-milestone-due").value;
            const status = document.getElementById("edit-milestone-status").value;

            try {
                const res = await fetch(`${API_BASE}/api/milestones/${id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${state.token}`
                    },
                    body: JSON.stringify({ title, description, due_date, status })
                });

                if (res.ok) {
                    showToast(`Milestone '${title}' updated successfully!`, "success");
                    editModal.classList.remove("active");
                    refreshMilestoneViewsForProject(projectId);
                } else {
                    const err = await res.json();
                    showToast(err.detail || "Failed to update milestone", "error");
                }
            } catch (err) {
                showToast(`Network error: ${err.message}`, "error");
            }
        });
    }
}

window.openEditMilestoneModal = function (id, title, desc, dueDate, status, projectId) {
    const modal = document.getElementById("edit-milestone-modal");
    document.getElementById("edit-milestone-id").value = id;
    document.getElementById("edit-milestone-project-id").value = projectId;
    document.getElementById("edit-milestone-title").value = title || "";
    document.getElementById("edit-milestone-desc").value = desc || "";
    document.getElementById("edit-milestone-due").value = dueDate || "";
    document.getElementById("edit-milestone-status").value = status || "pending";

    if (modal) modal.classList.add("active");
    if (window.lucide) lucide.createIcons();
};

async function loadMilestonesRoadmap() {
    if (!state.token) return;

    const filterElem = document.getElementById("milestone-project-filter");
    if (filterElem && !filterElem.value && state.globalProjectId) {
        filterElem.value = state.globalProjectId;
    }
    const filterVal = filterElem ? filterElem.value : (state.globalProjectId || "");
    const container = document.getElementById("roadmap-timeline");

    if (!filterVal) {
        container.innerHTML = `
            <div class="timeline-empty-state">
                <i data-lucide="compass" class="icon-lg"></i>
                <h3>Select a project to view its roadmap timeline.</h3>
                <p>No project is selected or the selected project has no milestones yet.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const renderRoadmap = (milestonesList, docsMap, storiesMap) => {
        container.innerHTML = "";
        if (milestonesList.length === 0) {
            container.innerHTML = `
                <div class="timeline-empty-state">
                    <i data-lucide="milestone" class="icon-lg"></i>
                    <h3>No milestones found for this project</h3>
                    <p>Create a milestone above to start mapping deadlines.</p>
                </div>
            `;
            if (window.lucide) lucide.createIcons({ root: container });
            return;
        }

        const canManage = canManageProject(filterVal);
        const roadmapWrapper = document.createElement("div");
        roadmapWrapper.className = "milestones-timeline";

        milestonesList.forEach(milestone => {
            const card = document.createElement("div");
            card.className = "timeline-card";
            card.id = `milestone-card-${milestone.id}`;
            card.innerHTML = buildMilestoneCardHtml(
                milestone,
                milestone.project_id,
                docsMap[milestone.id] || [],
                storiesMap[milestone.id] || [],
                canManage,
                true // isRoadmapView = true, hides redundant redirect link
            );
            roadmapWrapper.appendChild(card);
        });

        container.appendChild(roadmapWrapper);
        if (window.lucide) lucide.createIcons({ root: container });
    };

    if (state._milestonesCache && state._milestonesCache.projectId === filterVal) {
        renderRoadmap(state._milestonesCache.milestones, state._milestonesCache.docs, state._milestonesCache.stories);
    } else if (!container.children.length || container.querySelector('.timeline-empty-state') || container.querySelector('.timeline-empty')) {
        container.innerHTML = '<p class="timeline-empty">Loading roadmap...</p>';
    }

    try {
        if (typeof window.syncActiveGenerations === "function") {
            await window.syncActiveGenerations(filterVal);
        }

        const [milestonesRes, docs, storiesRes] = await Promise.all([
            fetch(`${API_BASE}/api/milestones/project/${filterVal}`, {
                headers: { "Authorization": `Bearer ${state.token}` }
            }),
            fetchProjectDocuments(parseInt(filterVal)),
            fetch(`${API_BASE}/api/stories?project_id=${filterVal}`, {
                headers: { "Authorization": `Bearer ${state.token}` }
            })
        ]);
        const milestones = await milestonesRes.json();
        const stories = storiesRes.ok ? await storiesRes.json() : [];
        const docsByMilestone = groupDocsByMilestoneId(docs);
        const storiesByMilestone = groupStoriesByMilestoneId(stories);

        const newCache = { projectId: filterVal, milestones, docs: docsByMilestone, stories: storiesByMilestone };
        
        if (JSON.stringify(state._milestonesCache) !== JSON.stringify(newCache)) {
            state._milestonesCache = newCache;
            renderRoadmap(milestones, docsByMilestone, storiesByMilestone);
        }
    } catch (e) {
        if (!state._milestonesCache || state._milestonesCache.projectId !== filterVal) {
            container.innerHTML = `<p class="timeline-empty error">Error: ${e.message}</p>`;
        }
    }
}


