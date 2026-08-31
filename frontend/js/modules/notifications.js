// =====================================================================
// Team & Task Notifications Handlers
// =====================================================================

let notificationPollInterval = null;

function startNotificationPolling() {
    stopNotificationPolling();
    loadNotifications();
    // Removed 45-second polling interval to prevent serverless database from staying active 24/7
}

function stopNotificationPolling() {
    if (notificationPollInterval) {
        clearInterval(notificationPollInterval);
        notificationPollInterval = null;
    }
}

async function loadNotifications() {
    if (!state.token) return;

    try {
        const res = await fetch(`${API_BASE}/api/notifications`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });
        if (!res.ok) return;

        const notifs = await res.json();

        // Count unread notifications
        const unreadCount = notifs.filter(n => !n.is_read).length;

        // Update badge
        const badge = document.getElementById("notif-badge");
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = "flex";
        } else {
            badge.style.display = "none";
        }

        // Render in dropdown list
        const notifList = document.getElementById("notif-list");
        notifList.innerHTML = "";

        if (notifs.length === 0) {
            notifList.innerHTML = '<div class="notif-empty">No notifications yet.</div>';
            return;
        }

        notifs.forEach(n => {
            const utcNotifTime = n.created_at.endsWith("Z") ? n.created_at : n.created_at + "Z";
            const dateStr = new Date(utcNotifTime).toLocaleString();
            const div = document.createElement("div");
            div.className = `notif-item ${n.is_read ? 'read' : 'unread'}`;

            const titleEl = document.createElement("div");
            titleEl.className = "notif-title";
            titleEl.textContent = n.title;

            const messageEl = document.createElement("div");
            messageEl.className = "notif-message";
            messageEl.textContent = n.message;

            const timeEl = document.createElement("div");
            timeEl.className = "notif-time";
            timeEl.textContent = dateStr;

            div.appendChild(titleEl);
            div.appendChild(messageEl);
            div.appendChild(timeEl);

            // Mark as read when clicked
            div.addEventListener("click", async () => {
                if (!n.is_read) {
                    await fetch(`${API_BASE}/api/notifications/${n.id}/read`, {
                        method: "PUT",
                        headers: { "Authorization": `Bearer ${state.token}` }
                    });
                    loadNotifications();
                }
            });

            notifList.appendChild(div);
        });

    } catch (e) {
        console.error("Error loading notifications:", e);
    }
}

function bindNotificationEvents() {
    const bellBtn = document.getElementById("notif-bell-btn");
    const dropdown = document.getElementById("notif-dropdown");
    const readAllBtn = document.getElementById("btn-read-all-notifs");

    if (!bellBtn || !dropdown || !readAllBtn) return;

    // Toggle dropdown
    bellBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const show = dropdown.style.display === "none";
        dropdown.style.display = show ? "flex" : "none";
        if (show) {
            loadNotifications();
        }
    });

    // Close dropdown on click outside
    document.addEventListener("click", (e) => {
        if (!e.target.closest("#notif-container")) {
            dropdown.style.display = "none";
        }
    });

    // Mark all as read
    readAllBtn.addEventListener("click", async () => {
        try {
            await fetch(`${API_BASE}/api/notifications/read-all`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${state.token}` }
            });
            loadNotifications();
        } catch (e) {
            console.error("Error marking all notifications as read:", e);
        }
    });
}


