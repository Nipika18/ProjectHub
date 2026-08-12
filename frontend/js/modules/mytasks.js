// =====================================================================
// My Tasks Board Handlers
// =====================================================================

document.getElementById("btn-refresh-mytasks")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Refreshing...';
    btn.disabled = true;
    lucide.createIcons();

    await loadMyTasks();

    btn.innerHTML = originalHtml;
    btn.disabled = false;
    lucide.createIcons();
});

async function loadMyTasks() {
    if (!state.token) return;

    const todoCol = document.getElementById("mytasks-todo");
    const inprogCol = document.getElementById("mytasks-inprogress");
    const devdoneCol = document.getElementById("mytasks-devdone");
    const readyforqaCol = document.getElementById("mytasks-readyforqa");
    const qadoneCol = document.getElementById("mytasks-qadone");
    const completeCol = document.getElementById("mytasks-complete");

    if (!todoCol || !inprogCol || !devdoneCol || !readyforqaCol || !qadoneCol || !completeCol) return;

    const hasExistingTasks = todoCol.children.length > 0 || inprogCol.children.length > 0 || devdoneCol.children.length > 0;
    if (!hasExistingTasks) {
        todoCol.innerHTML = '<p style="color: var(--color-text-muted); text-align: center;">Loading...</p>';
        inprogCol.innerHTML = '';
        devdoneCol.innerHTML = '';
        readyforqaCol.innerHTML = '';
        qadoneCol.innerHTML = '';
        completeCol.innerHTML = '';
    }

    try {
        const res = await fetch(`${API_BASE}/api/my-tasks`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });

        if (!res.ok) throw new Error("Failed to load tasks");
        const tasks = await res.json();

        todoCol.innerHTML = '';
        inprogCol.innerHTML = '';
        devdoneCol.innerHTML = '';
        readyforqaCol.innerHTML = '';
        qadoneCol.innerHTML = '';
        completeCol.innerHTML = '';

        let tasksToRender = tasks;
        if (state.globalProjectId) {
            tasksToRender = tasks.filter(t => t.project_id === parseInt(state.globalProjectId));
        }

        if (tasksToRender.length === 0) {
            todoCol.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 20px;">No tasks assigned to you for this project.</p>';
            return;
        }

        tasksToRender.forEach(task => {
            const card = createMyTaskCard(task);
            if (task.status === 'In Progress') {
                inprogCol.appendChild(card);
            } else if (task.status === 'Dev Done') {
                devdoneCol.appendChild(card);
            } else if (task.status === 'Ready for QA') {
                readyforqaCol.appendChild(card);
            } else if (task.status === 'QA Done') {
                qadoneCol.appendChild(card);
            } else if (task.status === 'Complete' || task.status === 'Done') {
                completeCol.appendChild(card);
            } else {
                todoCol.appendChild(card);
            }
        });

        if (todoCol.children.length === 0) todoCol.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 10px; font-size: 0.85rem;">None</p>';
        if (inprogCol.children.length === 0) inprogCol.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 10px; font-size: 0.85rem;">None</p>';
        if (devdoneCol.children.length === 0) devdoneCol.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 10px; font-size: 0.85rem;">None</p>';
        if (readyforqaCol.children.length === 0) readyforqaCol.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 10px; font-size: 0.85rem;">None</p>';
        if (qadoneCol.children.length === 0) qadoneCol.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 10px; font-size: 0.85rem;">None</p>';
        if (completeCol.children.length === 0) completeCol.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 10px; font-size: 0.85rem;">None</p>';

        if (window.lucide) lucide.createIcons();

    } catch (e) {
        todoCol.innerHTML = `<p style="color: var(--color-danger);">Error: ${e.message}</p>`;
    }
}

function createMyTaskCard(task) {
    let typeColor = '#2563eb';
    if (task.task_type === 'Frontend') typeColor = '#f59e0b';
    else if (task.task_type === 'AI') typeColor = '#10b981';
    else if (task.task_type === 'Manager') typeColor = '#8b5cf6';
    else if (task.task_type === 'QA') typeColor = '#E11D48';
    else if (task.task_type !== 'Backend') {
        const str = task.task_type || "Task";
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        typeColor = '#' + "00000".substring(0, 6 - c.length) + c;
    }

    const card = document.createElement('div');
    card.id = `mytask-card-${task.id}`;
    card.style.cssText = `
        background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px;
        padding: 14px; display: flex; flex-direction: column; gap: 8px;
        border-left: 4px solid ${typeColor}; transition: transform 0.15s, box-shadow 0.15s;
        cursor: grab;
    `;
    card.onmouseover = () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    };
    card.onmouseout = () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
    };

    card.draggable = true;
    card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({
            projectId: task.project_id,
            storyId: task.story_id,
            taskId: task.id
        }));
        card.style.opacity = "0.5";
    });
    card.addEventListener("dragend", () => {
        card.style.opacity = "1";
    });

    card.innerHTML = `
        <div onclick="openStoryDetailModal(${task.project_id}, ${task.story_id})" style="font-weight: 600; font-size: 0.95rem; color: var(--color-text-main); cursor: pointer; transition: color 0.15s;" onmouseover="this.style.color='#2563EB'" onmouseout="this.style.color='var(--color-text-main)'">${task.title}</div>
        <div style="font-size: 0.8rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 6px;">
            <i data-lucide="bookmark" style="width: 12px; height: 12px;"></i>
            ${task.story_title.length > 50 ? task.story_title.substring(0, 47) + '...' : task.story_title}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; gap: 4px; flex-wrap: wrap;">
            <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                <span style="font-size: 0.7rem; padding: 3px 8px; border-radius: 8px; font-weight: 600; background: ${typeColor}22; color: ${typeColor}; text-transform: uppercase;">${task.task_type}</span>
                <span style="font-size: 0.7rem; padding: 3px 8px; border-radius: 8px; font-weight: 600; background: var(--bg-hover); color: var(--color-text-main); border: 1px solid var(--border-color); display: inline-flex; align-items: center; gap: 3px;">
                    <i data-lucide="${task.milestone_title ? 'flag' : 'globe'}" style="width: 10px; height: 10px;"></i>
                    ${task.milestone_title ? escapeHTML(task.milestone_title.length > 20 ? task.milestone_title.substring(0, 18) + '...' : task.milestone_title) : 'Global Project'}
                </span>
            </div>
            <span onclick="openStoryDetailModal(${task.project_id}, ${task.story_id})" style="font-family: monospace; font-size: 0.75rem; font-weight: 700; color: #2563EB; text-decoration: underline; cursor: pointer;">${getProjectKeyPrefix(task.project_id)}-${task.story_seq || task.story_id}-${task.task_seq || task.id}</span>
        </div>
        <div style="margin-top: 4px;">
            <select onchange="updateMyTaskStatus(${task.project_id}, ${task.story_id}, ${task.id}, this.value)" 
                style="width: 100%; background: var(--bg-body); border: 1px solid var(--border-color); padding: 6px 8px; border-radius: 6px; color: var(--color-text-main); font-size: 0.8rem; cursor: pointer;">
                <option value="To Do" ${task.status === 'To Do' ? 'selected' : ''}>To Do</option>
                <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Dev Done" ${task.status === 'Dev Done' ? 'selected' : ''}>Dev Done</option>
                <option value="Ready for QA" ${task.status === 'Ready for QA' ? 'selected' : ''}>Ready for QA</option>
                <option value="QA Done" ${task.status === 'QA Done' ? 'selected' : ''}>QA Done</option>
                <option value="Complete" ${task.status === 'Complete' || task.status === 'Done' ? 'selected' : ''}>Complete</option>
            </select>
        </div>
    `;

    return card;
}

function getMyTaskColumnId(status) {
    if (status === 'In Progress') return 'mytasks-inprogress';
    if (status === 'Dev Done') return 'mytasks-devdone';
    if (status === 'Ready for QA') return 'mytasks-readyforqa';
    if (status === 'QA Done') return 'mytasks-qadone';
    if (status === 'Complete' || status === 'Done') return 'mytasks-complete';
    return 'mytasks-todo';
}

window.updateMyTaskStatus = async function (projectId, storyId, taskId, newStatus) {
    const cardEl = document.getElementById(`mytask-card-${taskId}`);
    const newColId = getMyTaskColumnId(newStatus);
    const newColEl = document.getElementById(newColId);

    let oldParent = null;
    let oldStatusSelectVal = null;
    let selectEl = null;

    // 1. Optimistic Update: Move card in DOM instantly
    if (cardEl && newColEl && cardEl.parentNode !== newColEl) {
        oldParent = cardEl.parentNode;
        newColEl.appendChild(cardEl);

        selectEl = cardEl.querySelector("select");
        if (selectEl) {
            oldStatusSelectVal = selectEl.value;
            selectEl.value = newStatus;
        }

        // Remove empty placeholder from target column if present
        const placeholder = newColEl.querySelector("p");
        if (placeholder && (placeholder.textContent === "None" || placeholder.textContent.includes("No tasks assigned"))) {
            placeholder.remove();
        }

        // Add empty placeholder to source column if it's now empty
        if (oldParent && oldParent.children.length === 0) {
            oldParent.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 10px; font-size: 0.85rem;">None</p>';
        }
    }

    try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/stories/${storyId}/tasks/${taskId}`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${state.token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error("Failed to update task");
        showToast(`Task moved to ${newStatus}`, "success");
    } catch (e) {
        showToast(e.message, "error");
        // Rollback UI to original state on failure
        if (cardEl && oldParent) {
            oldParent.appendChild(cardEl);
            if (selectEl) selectEl.value = oldStatusSelectVal;
            // Clean up placeholders
            const placeholder = oldParent.querySelector("p");
            if (placeholder && (placeholder.textContent === "None" || placeholder.textContent.includes("No tasks assigned"))) {
                placeholder.remove();
            }
            if (newColEl && newColEl.children.length === 0) {
                newColEl.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 10px; font-size: 0.85rem;">None</p>';
            }
        }
    }
};

window.handleMyTaskBoardDrop = async function (e, newStatus) {
    e.preventDefault();
    try {
        const dragData = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (!dragData || !dragData.projectId || !dragData.storyId || !dragData.taskId) return;

        await window.updateMyTaskStatus(dragData.projectId, dragData.storyId, dragData.taskId, newStatus);
    } catch (err) {
        console.error("Failed to handle My Task drop:", err);
    }
};


