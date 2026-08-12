// =====================================================================
// Team Management Handlers
// =====================================================================

async function loadTeamMembers(projectId) {
    const tbody = document.getElementById("team-members-list");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading team...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/team`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });
        const members = await res.json();

        tbody.innerHTML = "";
        if (members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--color-text-muted);">No team members added yet. Add members above to enable auto-assignment.</td></tr>';
            return;
        }

        const isGlobalAdmin = state.user?.is_admin;
        const selectedProj = state.projects?.find(p => p.id === parseInt(projectId));
        const isProjManager = selectedProj && (selectedProj.user_role === 'Manager' || selectedProj.user_role === 'Admin');
        const isAdmin = isGlobalAdmin || isProjManager;

        members.forEach(m => {
            let roleColor = '#2563eb';
            if (m.role === 'Frontend') roleColor = '#f59e0b';
            else if (m.role === 'AI') roleColor = '#10b981';
            else if (m.role === 'Manager') roleColor = '#8b5cf6';
            else if (m.role === 'QA') roleColor = '#E11D48';
            else if (m.role !== 'Backend') {
                let hash = 0;
                for (let i = 0; i < m.role.length; i++) hash = m.role.charCodeAt(i) + ((hash << 5) - hash);
                const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
                roleColor = '#' + "00000".substring(0, 6 - c.length) + c;
            }

            const dateStr = new Date(m.created_at).toLocaleDateString();
            const tr = document.createElement("tr");

            const isOwner = (selectedProj && selectedProj.owner_id === m.user_id) || (state.currentProject && state.currentProject.owner_id === m.user_id);
            const removeBtnHTML = isOwner ? `
                <span title="Project Admin cannot be removed" style="font-size: 0.75rem; color: #0284c7; font-weight: 600; background: #e0f2fe; border: 1px solid #bae6fd; padding: 4px 10px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="shield-check" style="width: 12px; height: 12px;"></i> Admin</span>
            ` : `
                <button class="btn-icon-danger" onclick="removeTeamMember(${projectId}, ${m.id})">
                    <i data-lucide="user-minus"></i>
                </button>
            `;

            let roleHTML = "";
            if (isAdmin) {
                roleHTML = `
                    <select onchange="if(this.value.startsWith('custom_')) { window.promptCustomRole(this, () => { if(this.value.startsWith('custom_')) return; updateMemberRole(${projectId}, ${m.id}, '${m.user_email}', this.value); }); } else { updateMemberRole(${projectId}, ${m.id}, '${m.user_email}', this.value); }" style="background: ${roleColor}15; color: ${roleColor}; border: 1px solid ${roleColor}40; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; outline: none; cursor: pointer;">
                        <option value="${m.role.replace(/"/g, '&quot;')}" selected>${m.role}</option>
                        ${['Frontend', 'Backend', 'AI', 'QA', 'Manager'].filter(x => x !== m.role).map(x => `<option value="${x}">${x}</option>`).join('')}
                        <option disabled>──────────</option>
                        <option value="custom_add_new" style="font-weight: 700; color: #0ea5e9;">+ Add Custom Role...</option>
                        <option value="custom_remove_role" style="font-weight: 700; color: #ef4444;">- Remove Custom Role...</option>
                    </select>
                `;
            } else {
                roleHTML = `
                    <span style="background: ${roleColor}22; color: ${roleColor}; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">
                        ${m.role}
                    </span>
                `;
            }

            tr.innerHTML = `
                <td><strong>${m.user_name}</strong></td>
                <td><span class="text-muted">${m.user_email}</span></td>
                <td>${roleHTML}</td>
                <td><span class="text-muted">${dateStr}</span></td>
                <td style="text-align: right;">
                    ${removeBtnHTML}
                </td>
            `;
            tbody.appendChild(tr);
        });

        lucide.createIcons();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="color: var(--color-danger);">Error: ${e.message}</td></tr>`;
    }
}

async function loadProjectDetailDocuments(projectId) {
    const listEl = document.getElementById("project-detail-documents-list");
    if (!listEl) return;

    listEl.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 20px;">Loading documents...</td></tr>';

    try {
        const [docs, milestones] = await Promise.all([
            fetchProjectDocuments(projectId),
            fetch(`${API_BASE}/api/milestones/project/${projectId}`, {
                headers: { "Authorization": `Bearer ${state.token}` }
            }).then(r => r.ok ? r.json() : []).catch(() => [])
        ]);

        if (!docs || docs.length === 0) {
            listEl.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 24px;">No documents uploaded to this project yet.</td></tr>';
            return;
        }

        const milestoneMap = {};
        (milestones || []).forEach(m => milestoneMap[m.id] = m.title);
        const canManage = canManageProject(projectId);

        listEl.innerHTML = docs.map(doc => {
            const safeName = escapeHTML(doc.name);
            const jsName = doc.name.replace(/'/g, "\\'");
            const sizeKB = (doc.file_size / 1024).toFixed(1) + " KB";

            // Associated Milestone text
            const milestoneTitle = doc.milestone_id && milestoneMap[doc.milestone_id]
                ? escapeHTML(milestoneMap[doc.milestone_id])
                : 'Global Project File';

            // Category text
            let categoryText = "Global Document";
            if (doc.category === "team") categoryText = "Team Document";
            else if (doc.category === "client") categoryText = "Client's Document";

            // Format badge (PDF, DOCX, XLSX, TXT, etc.)
            const ext = (doc.file_type || doc.name.split('.').pop() || 'PDF').toUpperCase();

            // Uploaded date (e.g. 8/4/2026)
            const uploadedDate = doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'N/A';
            const isGenerating = state.activeGenerations && state.activeGenerations[doc.id];

            let statusBadge = '';
            if (doc.status === 'processing') {
                statusBadge = `<span class="badge" style="background:#fef08a;color:#854d0e;margin-left:8px;font-size:0.75rem;padding:2px 6px;border-radius:12px;"><i data-lucide="loader" class="spin" style="width:10px;height:10px;margin-right:2px;"></i>Processing AI</span>`;
            } else if (doc.status === 'failed') {
                statusBadge = `<span class="badge" style="background:#fecdd3;color:#9f1239;margin-left:8px;font-size:0.75rem;padding:2px 6px;border-radius:12px;">Failed</span>`;
            }

            return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 16px;">
                        <a href="javascript:void(0)" onclick="downloadDocumentSecurely(${doc.id}, '${jsName}')" style="color: #0ea5e9; font-weight: 600; text-decoration: underline;" title="Download ${safeName}">
                            ${safeName}
                        </a>
                        <span id="doc-status-${doc.id}">${statusBadge}</span>
                    </td>
                    <td style="padding: 16px; color: #475569; font-size: 0.88rem;">${milestoneTitle}</td>
                    <td style="padding: 16px; color: #475569; font-size: 0.88rem;">${categoryText}</td>
                    <td style="padding: 16px; color: #475569; font-size: 0.88rem;">${sizeKB}</td>
                    <td style="padding: 16px;">
                        <span style="display: inline-block; background: #ffe4e6; color: #e11d48; font-weight: 700; font-size: 0.72rem; padding: 2px 7px; border-radius: 4px; text-transform: uppercase;">${ext}</span>
                    </td>
                    <td style="padding: 16px; color: #475569; font-size: 0.88rem;">${uploadedDate}</td>
                    <td style="padding: 16px; text-align: left;">
                        <div style="display: flex; gap: 10px; justify-content: flex-start; align-items: center;">
                            <button class="btn-icon-action" onclick="downloadDocumentSecurely(${doc.id}, '${jsName}')" title="Download Document" style="width: 32px; height: 32px; border-radius: 6px; background: #ffffff; border: 1px solid #cbd5e1; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s;">
                                <i data-lucide="download" style="width: 16px; height: 16px; color: #334155; stroke-width: 2;"></i>
                            </button>
                            ${canManage ? `
                            <button class="btn btn-secondary btn-sm" id="btn-gen-stories-tab-${doc.id}" ${isGenerating ? "disabled" : ""}
                                onclick="generateStoriesFromDocument(${projectId}, ${doc.id}, '${jsName}')" title="Generate User Stories with AI"
                                style="border-radius: 16px; padding: 6px 14px; font-size: 0.85rem; font-weight: 500; background: #ffffff; border: 1px solid #cbd5e1; color: #1e293b; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                                ${isGenerating ? '<i data-lucide="loader" class="spin" style="width:16px;height:16px;color:#334155;stroke-width: 2;"></i>' : '<i data-lucide="sparkles" style="width:16px;height:16px;color:#334155;stroke-width: 2;"></i>'} Stories
                            </button>
                            <button class="btn-icon-action danger" onclick="deleteDocumentDirect(${doc.id}, ${projectId}, this)" title="Delete Document" style="background: transparent; border: none; padding: 4px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;">
                                <i data-lucide="trash" style="width: 18px; height: 18px; color: #334155; stroke-width: 2;"></i>
                            </button>` : ""}
                        </div>
                    </td>
                </tr>`;
        }).join("");

        if (window.lucide) lucide.createIcons();
    } catch (e) {
        listEl.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 20px;">Failed to load documents: ${escapeHTML(e.message)}</td></tr>`;
    }
}


document.getElementById("btn-add-team-member")?.addEventListener("click", async () => {
    if (!checkAdminAccess("add team members")) return;
    if (!state.currentProject) {
        showToast("Open a project first", "error");
        return;
    }

    const addBtn = document.getElementById("btn-add-team-member");
    const originalText = addBtn ? addBtn.innerHTML : "";

    const emailInput = document.getElementById("team-member-email");
    const roleSelect = document.getElementById("team-member-role");
    const email = emailInput.value.trim();
    const role = roleSelect.value;

    if (!email) {
        showToast("Please enter a member email", "error");
        return;
    }

    try {
        if (addBtn) {
            addBtn.disabled = true;
            addBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Adding...';
        }

        const res = await fetch(`${API_BASE}/api/projects/${state.currentProject.id}/team`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${state.token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ user_email: email, role: role })
        });

        if (res.ok) {
            const data = await res.json();
            showToast(`Added ${data.user_name} as ${role} developer`, "success");
            emailInput.value = "";
            loadTeamMembers(state.currentProject.id);
        } else {
            const err = await res.json();
            showToast(err.detail || "Failed to add member", "error");
        }
    } catch (e) {
        showToast(`Network error: ${e.message}`, "error");
    } finally {
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.innerHTML = originalText;
            lucide.createIcons();
        }
    }
});

document.getElementById("btn-auto-assign")?.addEventListener("click", async (e) => {
    if (!checkAdminAccess("auto-assign tasks")) return;
    if (!state.currentProject) {
        showToast("Open a project first", "error");
        return;
    }

    showConfirmModal(
        "Auto-Assign Tasks",
        "This will automatically assign all <strong>unassigned</strong> tasks in this project to team members based on their roles.<br><br><small>Tasks that are already assigned manually will not be overwritten.</small>",
        "Yes, Auto-Assign",
        async () => {
            const btn = e.currentTarget;
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader" class="spin" style="width:16px;height:16px;margin-right:6px;"></i> Assigning...';
            lucide.createIcons();

            try {
                const res = await fetch(`${API_BASE}/api/projects/${state.currentProject.id}/team/auto-assign`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${state.token}`
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    showToast(data.detail || "Tasks successfully assigned!", "success");
                    await loadStories();
                } else {
                    const err = await res.json();
                    showToast(err.detail || "Failed to auto-assign tasks", "error");
                }
            } catch (error) {
                showToast(`Network error: ${error.message}`, "error");
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
                lucide.createIcons();
            }
        }
    );
});

window.removeTeamMember = async function (projectId, memberId) {
    if (!checkAdminAccess("remove team members")) return;

    showConfirmModal(
        "Remove Team Member?",
        "Are you sure you want to remove this team member? Their tasks will be unassigned.",
        "Remove",
        async () => {
            try {
                const res = await fetch(`${API_BASE}/api/projects/${projectId}/team/${memberId}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${state.token}` }
                });
                if (res.ok) {
                    showToast("Member removed", "success");
                    loadTeamMembers(projectId);
                } else {
                    const err = await res.json();
                    showToast(err.detail || "Failed to remove member", "error");
                }
            } catch (e) {
                showToast(e.message, "error");
            }
        },
        "danger"
    );
};

window.updateMemberRole = async function (projectId, memberId, email, newRole) {
    if (!checkAdminAccess("update team member role")) return;

    try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/team/${memberId}`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${state.token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_email: email,
                role: newRole
            })
        });
        if (res.ok) {
            showToast("Member role updated successfully", "success");
            loadTeamMembers(projectId);
            loadStories(); // Refresh stories list & details to show new task assignments
        } else {
            const err = await res.json();
            showToast(err.detail || "Failed to update member role", "error");
            loadTeamMembers(projectId);
        }
    } catch (e) {
        showToast(e.message, "error");
        loadTeamMembers(projectId);
    }
};


