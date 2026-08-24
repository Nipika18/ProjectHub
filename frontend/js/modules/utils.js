// =====================================================================
// Generic Professional Confirmation Modal Helper
// =====================================================================

let pendingConfirmCallback = null;

window.showConfirmModal = function (title, message, confirmText, confirmCallback, intent = 'primary') {
    const modal = document.getElementById("generic-confirm-modal");
    if (!modal) {
        // Fallback to native
        if (confirm(message)) confirmCallback();
        return;
    }

    document.getElementById("generic-confirm-title").textContent = title;
    // We use innerHTML to allow basic bolding/formatting in the prompt
    document.getElementById("generic-confirm-message").innerHTML = message;

    const submitBtn = document.getElementById("btn-generic-confirm-submit");
    submitBtn.textContent = confirmText;

    const iconWrapper = document.getElementById("generic-confirm-icon-wrapper");
    const icon = document.getElementById("generic-confirm-icon");

    // Reset classes
    submitBtn.className = "btn";

    if (intent === 'danger') {
        submitBtn.classList.add("btn-danger");
        iconWrapper.style.background = "#fef2f2";
        iconWrapper.style.color = "#ef4444";
        icon.setAttribute("data-lucide", "alert-triangle");
    } else if (intent === 'warning') {
        submitBtn.classList.add("btn-warning");
        submitBtn.style.background = "#f59e0b";
        submitBtn.style.color = "#fff";
        iconWrapper.style.background = "#fffbeb";
        iconWrapper.style.color = "#f59e0b";
        icon.setAttribute("data-lucide", "alert-circle");
    } else {
        submitBtn.classList.add("btn-primary");
        iconWrapper.style.background = "#eff6ff";
        iconWrapper.style.color = "#3b82f6";
        icon.setAttribute("data-lucide", "info");
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons({ nodes: [modal] });

    pendingConfirmCallback = confirmCallback;
    modal.style.display = "flex";
    setTimeout(() => modal.classList.add("active"), 10);
};

window.closeGenericConfirmModal = function () {
    const modal = document.getElementById("generic-confirm-modal");
    if (modal) {
        modal.classList.remove("active");
        setTimeout(() => { modal.style.display = "none"; }, 200);
    }
    pendingConfirmCallback = null;
};

document.addEventListener("DOMContentLoaded", () => {
    const submitBtn = document.getElementById("btn-generic-confirm-submit");
    if (submitBtn) {
        submitBtn.addEventListener("click", () => {
            if (pendingConfirmCallback) pendingConfirmCallback();
            closeGenericConfirmModal();
        });
    }
});

// Professional inline text box for Custom Roles
window.promptCustomRole = function (selectObj, callback) {
    if (selectObj.value === 'custom_add_new') {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = selectObj.className;
        input.style.cssText = selectObj.style.cssText;
        input.style.width = '100%';
        input.placeholder = "Type role & press Enter...";

        let completed = false;
        const completeInput = () => {
            if (completed) return;
            completed = true;
            const val = input.value.trim();
            if (val) {
                const opt = document.createElement('option');
                opt.value = val;
                opt.text = val;
                opt.setAttribute('data-custom', 'true');
                selectObj.add(opt, selectObj.options[selectObj.options.length - 2]); // Insert before separator
                selectObj.value = val;
            } else {
                selectObj.selectedIndex = 0;
            }
            input.replaceWith(selectObj);
            if (val && callback) callback();
        };

        input.onkeydown = function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                completeInput();
            } else if (e.key === 'Escape') {
                completed = true;
                selectObj.selectedIndex = 0;
                input.replaceWith(selectObj);
            }
        };
        input.onblur = completeInput;

        selectObj.replaceWith(input);
        input.focus();
    } else if (selectObj.value === 'custom_remove_role') {
        const customOpts = Array.from(selectObj.options).filter(o =>
            o.getAttribute('data-custom') === 'true' ||
            (!['Frontend', 'Backend', 'AI', 'QA', 'Manager', 'custom_add_new', 'custom_remove_role', ''].includes(o.value) && !o.disabled)
        );

        if (customOpts.length === 0) {
            alert("No custom roles to remove.");
            selectObj.selectedIndex = 0;
            return;
        }

        const input = document.createElement('select');
        input.className = selectObj.className;
        input.style.cssText = selectObj.style.cssText;
        input.style.width = '100%';

        const defaultOpt = document.createElement('option');
        defaultOpt.text = "Select role to remove...";
        defaultOpt.value = "";
        input.add(defaultOpt);

        customOpts.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.text = o.text;
            input.add(opt);
        });

        input.onchange = function () {
            const val = input.value;
            if (val) {
                for (let i = 0; i < selectObj.options.length; i++) {
                    if (selectObj.options[i].value === val) {
                        selectObj.remove(i);
                        break;
                    }
                }
            }
            selectObj.selectedIndex = 0;
            input.replaceWith(selectObj);
        };

        input.onblur = function () {
            if (input.parentNode) {
                selectObj.selectedIndex = 0;
                input.replaceWith(selectObj);
            }
        };

        selectObj.replaceWith(input);
        input.focus();
    }
};


// =====================================================================
// Toast Notifications
// =====================================================================

function showToast(message, type = "info", linkText = null, linkHref = null, linkAction = null) {
    const toast = document.getElementById("toast");
    toast.className = `toast-card active ${type}`;

    // Backwards compatibility if 4th arg was passed as a function
    if (typeof linkHref === "function" && !linkAction) {
        linkAction = linkHref;
        linkHref = "javascript:void(0)";
    }

    window._toastLinkAction = linkAction || null;

    if (linkText && (linkHref || linkAction)) {
        const hrefAttr = linkHref && typeof linkHref === "string" ? linkHref : "javascript:void(0)";
        toast.innerHTML = `
            <span>${message}</span>
            <a class="toast-link" href="${hrefAttr}" onclick="if(window._toastLinkAction) { setTimeout(window._toastLinkAction, 50); }">${linkText} &rarr;</a>
        `;
    } else {
        toast.textContent = message;
    }

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.classList.remove("active");
        window._toastLinkAction = null;
    }, 15000);
}


// =====================================================================
// Dropdowns helper
// =====================================================================

async function populateProjectDropdowns(force = false) {
    if (!state.token) return;

    const filterProjSelect = document.getElementById("milestone-project-filter");
    const createMilestoneSelect = document.getElementById("milestone-project-id");
    const storyProjSelect = document.getElementById("story-project-select");
    const globalSelect = document.getElementById("global-project-select");

    const isPopulated = globalSelect && globalSelect.options.length > 1;

    try {
        if (!isPopulated || force || !state.projects || state.projects.length === 0) {
            if (force !== "no-fetch") {
                const res = await fetch(`${API_BASE}/api/projects`, {
                    headers: { "Authorization": `Bearer ${state.token}` }
                });
                state.projects = await res.json();
            }
            const projects = state.projects || [];
            const fragFilter = document.createDocumentFragment();
            const fragCreate = document.createDocumentFragment();
            const fragStory = document.createDocumentFragment();
            const fragGlobal = document.createDocumentFragment();

            projects.forEach(p => {
                const makeOpt = () => {
                    const o = document.createElement("option");
                    o.value = p.id;
                    o.textContent = p.name;
                    return o;
                };
                if (filterProjSelect) fragFilter.appendChild(makeOpt());
                if (createMilestoneSelect) fragCreate.appendChild(makeOpt());
                if (storyProjSelect) fragStory.appendChild(makeOpt());
                if (globalSelect) fragGlobal.appendChild(makeOpt());
            });

            if (filterProjSelect) filterProjSelect.innerHTML = '<option value="">-- Choose Project --</option>';
            if (createMilestoneSelect) createMilestoneSelect.innerHTML = '<option value="">-- Choose Project --</option>';
            if (storyProjSelect) storyProjSelect.innerHTML = '<option value="">-- Choose Project --</option>';
            if (globalSelect) globalSelect.innerHTML = '<option value="">— Select a project —</option>';

            if (filterProjSelect) filterProjSelect.appendChild(fragFilter);
            if (createMilestoneSelect) createMilestoneSelect.appendChild(fragCreate);
            if (storyProjSelect) storyProjSelect.appendChild(fragStory);
            if (globalSelect) globalSelect.appendChild(fragGlobal);
        }

        if (state.globalProjectId) {
            const projExists = state.projects && state.projects.some(p => p.id == state.globalProjectId);
            if (!projExists) {
                state.globalProjectId = null;
                localStorage.removeItem("globalProjectId");
            }
        }

        const effectiveGlobal = state.globalProjectId || (globalSelect ? globalSelect.value : "") || "";
        if (globalSelect) {
            globalSelect.value = effectiveGlobal;
            if (effectiveGlobal) {
                globalSelect.classList.add("selected-bold");
            } else {
                globalSelect.classList.remove("selected-bold");
            }
        }

        if (effectiveGlobal) {
            if (filterProjSelect) filterProjSelect.value = effectiveGlobal;
            if (createMilestoneSelect) createMilestoneSelect.value = effectiveGlobal;
            if (storyProjSelect) storyProjSelect.value = effectiveGlobal;
        }
        updateMobileProjectBadge();
    } catch (e) {
        console.error("Failed to fetch projects list for dropdowns:", e);
    }
}

function updateMobileProjectBadge() {
    const badge = document.getElementById("mobile-active-project-badge");
    const nameSpan = document.getElementById("mobile-project-name");
    const globalSelect = document.getElementById("global-project-select");
    if (!badge || !nameSpan || !globalSelect) return;

    if (globalSelect.value && globalSelect.selectedOptions && globalSelect.selectedOptions[0]) {
        const text = globalSelect.selectedOptions[0].text;
        if (text && !text.startsWith("—")) {
            nameSpan.textContent = text;
            badge.style.display = "flex";
            return;
        }
    }
    badge.style.display = "none";
}

// ── Global Project Selector: propagate selection to all page dropdowns ──
document.addEventListener("DOMContentLoaded", () => {
    const globalSelect = document.getElementById("global-project-select");
    if (!globalSelect) return;

    globalSelect.addEventListener("change", () => {
        const selectedId = globalSelect.value;
        state.globalProjectId = selectedId;
        if (selectedId) {
            localStorage.setItem("globalProjectId", selectedId);
        } else {
            localStorage.removeItem("globalProjectId");
        }

        // Toggle bold visual emphasis on the selector
        if (selectedId) {
            globalSelect.classList.add("selected-bold");
        } else {
            globalSelect.classList.remove("selected-bold");
        }
        updateMobileProjectBadge();

        // Update sidebar visibility for non-admin users (unlocks nav on project select)
        applyRBACUI();

        // Propagate to every page-level dropdown
        const ids = [
            "milestone-project-filter",
            "milestone-project-id",
            "story-project-select"
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.value = selectedId;
                // Dispatch change event to trigger local page event listeners
                el.dispatchEvent(new Event("change"));
            }
        });

        // Reload only the active section
        if (state.activeSection === "dashboard") loadDashboardStats();
        if (state.activeSection === "logs") loadActivityLogs();
        if (state.activeSection === "projects") {
            if (selectedId) {
                window.location.hash = `projects/${selectedId}`;
            } else {
                loadProjects();
            }
        }
        if (state.activeSection === "mytasks") loadMyTasks();
        if (state.activeSection === "milestones") loadMilestonesRoadmap();
        if (state.activeSection === "stories") loadStories();

        if (selectedId) {
            showToast(`Active project set — all fields updated`, "success");
        }
    });
});


// =====================================================================
// Custom Sleek Global Tooltip Controller
// =====================================================================

const customTooltipEl = document.createElement("div");
customTooltipEl.id = "app-custom-global-tooltip";
customTooltipEl.style.cssText = "position: fixed; background: rgba(15, 23, 42, 0.95); color: #f8fafc; font-size: 0.72rem; font-weight: 500; padding: 4px 8px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.12); z-index: 100000; pointer-events: none; opacity: 0; transition: opacity 0.15s ease, transform 0.15s ease; transform: translateY(4px); white-space: nowrap; line-height: 1.3;";

document.addEventListener("mouseover", (e) => {
    const target = e.target.closest("[title], [data-tooltip]");
    if (!target) return;
    if (target.hasAttribute("title")) {
        const titleText = target.getAttribute("title");
        if (titleText) {
            target.setAttribute("data-tooltip", titleText);
            target.removeAttribute("title");
        }
    }
    const text = target.getAttribute("data-tooltip");
    if (!text) return;

    // Skip targets that have their own custom CSS tooltips in the collapsed sidebar
    if (target.closest('.app-layout.sidebar-collapsed')) {
        if (target.classList.contains('nav-item') || target.classList.contains('user-badge')) {
            return;
        }
    }

    if (!customTooltipEl.parentNode) document.body.appendChild(customTooltipEl);
    customTooltipEl.textContent = text;
    customTooltipEl.style.opacity = "1";
    customTooltipEl.style.transform = "translateY(0)";

    const rect = target.getBoundingClientRect();
    const tooltipRect = customTooltipEl.getBoundingClientRect();

    let top = rect.top - tooltipRect.height - 6;
    if (top < 8) {
        top = rect.bottom + 6;
    }
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    if (left < 8) left = 8;
    if (left + tooltipRect.width > window.innerWidth - 8) {
        left = window.innerWidth - tooltipRect.width - 8;
    }

    customTooltipEl.style.top = `${top}px`;
    customTooltipEl.style.left = `${left}px`;
});

document.addEventListener("mouseout", (e) => {
    const target = e.target.closest("[data-tooltip]");
    if (target) {
        customTooltipEl.style.opacity = "0";
        customTooltipEl.style.transform = "translateY(4px)";
    }
});

document.addEventListener("mousedown", () => {
    customTooltipEl.style.opacity = "0";
});

// Enable horizontal click-and-drag (swipe) scrolling on Kanban grids
function enableDragScroll(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    let isDown = false;
    let startX;
    let scrollLeft;

    el.addEventListener('mousedown', (e) => {
        // Ignore dragging if clicking a card or button inside
        if (e.target.closest('.board-card') || e.target.closest('button') || e.target.closest('select')) return;
        isDown = true;
        el.style.cursor = 'grabbing';
        startX = e.pageX - el.offsetLeft;
        scrollLeft = el.scrollLeft;
    });
    el.addEventListener('mouseleave', () => {
        isDown = false;
        el.style.cursor = '';
    });
    el.addEventListener('mouseup', () => {
        isDown = false;
        el.style.cursor = '';
    });
    el.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - el.offsetLeft;
        const walk = (x - startX) * 1.5;
        el.scrollLeft = scrollLeft - walk;
    });
}

function setupKanbanScrollbars() {
    document.querySelectorAll('.kanban-scroll-range').forEach(slider => {
        const targetId = slider.getAttribute('data-target');
        const grid = document.getElementById(targetId);
        if (!grid) return;

        slider.addEventListener('input', () => {
            const maxScroll = grid.scrollWidth - grid.clientWidth;
            if (maxScroll > 0) {
                grid.scrollLeft = (slider.value / 1000) * maxScroll;
            }
        });

        grid.addEventListener('scroll', () => {
            const maxScroll = grid.scrollWidth - grid.clientWidth;
            if (maxScroll > 0) {
                slider.value = Math.round((grid.scrollLeft / maxScroll) * 1000);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    enableDragScroll('#stories-board-grid');
    enableDragScroll('#mytasks-board-grid');
    enableDragScroll('#stories-list-scroll-wrapper');
    setupKanbanScrollbars();
    bindNotificationEvents();
    bindUserProfileMenu();
});

function bindUserProfileMenu() {
    const toggleBtn = document.getElementById("user-badge-menu-toggle");
    const menu = document.getElementById("user-account-menu");

    if (!toggleBtn || !menu) return;

    toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = menu.style.display === "none";
        menu.style.display = isHidden ? "block" : "none";
        if (isHidden) {
            toggleBtn.style.background = "var(--bg-base)";
        } else {
            toggleBtn.style.background = "var(--bg-surface)";
        }
    });

    document.addEventListener("click", (e) => {
        if (!e.target.closest("#user-badge-menu-toggle") && !e.target.closest("#user-account-menu")) {
            menu.style.display = "none";
            toggleBtn.style.background = "var(--bg-surface)";
        }
    });
}



