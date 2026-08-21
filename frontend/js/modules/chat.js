// =====================================================================
// Milestone-Scoped AI Chat (RAG)
// =====================================================================

function bindMilestoneChatEvents() {
    const form = document.getElementById("milestone-chat-input-form");
    const btnClose = document.getElementById("btn-close-milestone-chat-modal");
    const btnMaximize = document.getElementById("btn-maximize-milestone-chat-modal");
    const btnGlobalChat = document.getElementById("btn-open-global-milestone-chat");
    const chatModal = document.getElementById("milestone-chat-modal");

    if (btnGlobalChat) {
        btnGlobalChat.addEventListener("click", () => {
            const projId = state.globalProjectId || state.currentProject?.id || (state.projects && state.projects[0]?.id);
            openGlobalMilestoneChatModal(projId, null, "Project-wide Docs");
        });
    }

    if (form) form.addEventListener("submit", executeMilestoneChatQuery);
    if (btnClose && chatModal) {
        btnClose.addEventListener("click", () => {
            chatModal.classList.remove("active");
            chatModal.classList.remove("is-maximized");
            const glass = chatModal.querySelector(".milestone-chat-modal-glass");
            if (glass) glass.classList.remove("maximized");
        });
    }

    if (btnMaximize && chatModal) {
        btnMaximize.addEventListener("click", () => {
            const glass = chatModal.querySelector(".milestone-chat-modal-glass");
            const isMax = glass ? glass.classList.toggle("maximized") : false;
            chatModal.classList.toggle("is-maximized", isMax);
            btnMaximize.innerHTML = isMax ? '<i data-lucide="minimize-2"></i>' : '<i data-lucide="maximize-2"></i>';
            btnMaximize.title = isMax ? "Restore Compact Drawer" : "Maximize Broad View";
            if (window.lucide) lucide.createIcons();
        });
    }
}

function setupSearchableCombobox(inputId, hiddenValId, menuId, getOptionsFn, onSelectFn) {
    const input = document.getElementById(inputId);
    const hiddenVal = document.getElementById(hiddenValId);
    const menu = document.getElementById(menuId);
    const container = input?.closest(".searchable-select-container");
    if (!input || !hiddenVal || !menu) return;

    const renderMenu = (filterText = "") => {
        const query = filterText.toLowerCase().trim();
        const options = getOptionsFn(query);
        const currentVal = hiddenVal.value;

        menu.innerHTML = "";

        const clearOpt = document.createElement("div");
        clearOpt.className = `searchable-select-option ${!currentVal ? 'selected' : ''}`;
        clearOpt.innerHTML = `<span>-- All / Clear Selection --</span>`;
        clearOpt.onclick = (e) => {
            e.stopPropagation();
            hiddenVal.value = "";
            input.value = "";
            menu.classList.add("hidden");
            container?.classList.remove("open");
            if (onSelectFn) onSelectFn(null, "");
        };
        menu.appendChild(clearOpt);

        if (options.length === 0) {
            const emptyEl = document.createElement("div");
            emptyEl.className = "searchable-select-empty";
            emptyEl.textContent = "No matching options found";
            menu.appendChild(emptyEl);
        } else {
            options.forEach(opt => {
                const optEl = document.createElement("div");
                const isSelected = String(opt.id) === String(currentVal);
                optEl.className = `searchable-select-option ${isSelected ? 'selected' : ''}`;
                optEl.innerHTML = `<span>${escapeHTML(opt.label)}</span>${isSelected ? '<i data-lucide="check" style="width:14px;height:14px;color:#0ea5e9;"></i>' : ''}`;
                optEl.onclick = (e) => {
                    e.stopPropagation();
                    hiddenVal.value = opt.id;
                    input.value = opt.label;
                    menu.classList.add("hidden");
                    container?.classList.remove("open");
                    if (onSelectFn) onSelectFn(opt.id, opt.label);
                };
                menu.appendChild(optEl);
            });
        }
        if (window.lucide) lucide.createIcons();
    };

    input.onfocus = () => {
        document.querySelectorAll(".searchable-select-menu").forEach(m => m.classList.add("hidden"));
        document.querySelectorAll(".searchable-select-container").forEach(c => c.classList.remove("open"));

        renderMenu(input.value);
        menu.classList.remove("hidden");
        container?.classList.add("open");
    };

    input.oninput = () => {
        menu.classList.remove("hidden");
        container?.classList.add("open");
        renderMenu(input.value);
    };

    document.addEventListener("click", (e) => {
        if (container && !container.contains(e.target)) {
            menu.classList.add("hidden");
            container.classList.remove("open");
        }
    });
}

window.openGlobalMilestoneChatModal = async function (targetProjectId, milestoneId, milestoneTitle) {
    if (!targetProjectId) {
        showToast("Please select a project to open AI Knowledge Assistant.", "warning");
        return;
    }

    state.milestoneChatContext = { projectId: targetProjectId, milestoneId, milestoneTitle, hasDocs: true };

    const modal = document.getElementById("milestone-chat-modal");
    const titleEl = document.getElementById("milestone-chat-title");
    const subtitleEl = document.getElementById("milestone-chat-subtitle");
    const input = document.getElementById("milestone-chat-message-input");
    const sendBtn = document.getElementById("btn-milestone-chat-send");

    const msInput = document.getElementById("chat-milestone-input");
    const msVal = document.getElementById("chat-milestone-select-val");
    const docInput = document.getElementById("chat-doc-input");
    const docVal = document.getElementById("chat-doc-select-val");

    if (input) {
        input.disabled = false;
        input.value = "";
        input.placeholder = "Type your question about project documents...";
    }
    if (sendBtn) sendBtn.disabled = false;

    if (msInput) msInput.value = "";
    if (msVal) msVal.value = "";
    if (docInput) docInput.value = "";
    if (docVal) docVal.value = "";

    // Fetch fresh milestones and documents concurrently
    let milestones = [];
    let docs = [];
    try {
        const [mRes, dRes] = await Promise.all([
            fetch(`${API_BASE}/api/milestones/project/${targetProjectId}`, { headers: { "Authorization": `Bearer ${state.token}` } }).then(r => r.ok ? r.json() : []).catch(() => []),
            fetch(`${API_BASE}/api/documents/project/${targetProjectId}`, { headers: { "Authorization": `Bearer ${state.token}` } }).then(r => r.ok ? r.json() : []).catch(() => [])
        ]);
        milestones = mRes;
        docs = dRes;
        state.milestones = milestones;
        state.chatMilestonesList = milestones;
        state.chatDocsList = docs;
    } catch (e) {
        console.error("Error fetching milestones/docs for chat:", e);
    }

    if (milestoneId) {
        const foundMs = milestones.find(m => m.id === parseInt(milestoneId));
        if (foundMs && msInput && msVal) {
            msInput.value = foundMs.title;
            msVal.value = foundMs.id;
        }
    }

    // Setup Searchable Combobox for Milestones
    setupSearchableCombobox(
        "chat-milestone-input",
        "chat-milestone-select-val",
        "menu-chat-milestone",
        (query) => milestones.filter(m => !query || m.title.toLowerCase().includes(query)).map(m => ({ id: m.id, label: m.title })),
        (selectedMsId, selectedTitle) => {
            // Clear document selection when milestone changes
            if (docInput) docInput.value = "";
            if (docVal) docVal.value = "";
            const chosenMsId = selectedMsId ? parseInt(selectedMsId) : null;
            loadMilestoneChatHistory(targetProjectId, chosenMsId, selectedTitle || "Project-wide Docs", true);
        }
    );

    // Setup Searchable Combobox for Documents
    setupSearchableCombobox(
        "chat-doc-input",
        "chat-doc-select-val",
        "menu-chat-doc",
        (query) => {
            const selectedMsId = document.getElementById("chat-milestone-select-val")?.value;
            let availableDocs = docs;
            if (selectedMsId) {
                availableDocs = availableDocs.filter(d => d.milestone_id === parseInt(selectedMsId));
            }
            if (query) {
                availableDocs = availableDocs.filter(d => d.name.toLowerCase().includes(query));
            }
            return availableDocs.map(d => ({ id: d.id, label: d.name }));
        },
        (selectedDocId, selectedName) => {
            if (selectedName) {
                showToast(`Filter applied: ${selectedName}`, "info");
            }
        }
    );

    if (titleEl) {
        titleEl.innerHTML = `<i data-lucide="bot" style="color: #0ea5e9;"></i> AI Knowledge Assistant`;
    }
    if (subtitleEl) {
        subtitleEl.textContent = "Select or search a milestone or document to scope your AI assistant questions.";
    }

    const initialMsTitle = milestoneTitle || "Project-wide Docs";
    loadMilestoneChatHistory(targetProjectId, milestoneId, initialMsTitle, true);

    if (modal) modal.classList.add("active");
    if (input) {
        setTimeout(() => {
            input.disabled = false;
            input.focus();
        }, 150);
    }
    if (window.lucide) lucide.createIcons();
};

window.openMilestoneChat = window.openGlobalMilestoneChatModal;

function loadMilestoneChatHistory(projectId, milestoneId, milestoneTitle, hasDocs) {
    const container = document.getElementById("milestone-chat-conversation-container");
    if (!container) return;

    if (!state.chatSessions) state.chatSessions = {};
    const sessionKey = getMilestoneChatKey(projectId, milestoneId || 'global');
    if (!state.chatSessions[sessionKey]) state.chatSessions[sessionKey] = [];

    const messages = state.chatSessions[sessionKey];
    container.innerHTML = "";

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="chat-bubble bot-message">
                <div class="message-header">
                    <span class="bot-tag"><i data-lucide="bot"></i> AI Assistant</span>
                </div>
                <div class="message-content">
                    Ready! Ask me anything about ${milestoneId ? `the <strong>${escapeHTML(milestoneTitle)}</strong> milestone` : 'all project'} documents.
                </div>
            </div>`;
    } else {
        messages.forEach(msg => {
            appendChatBubble(msg.role === "assistant" ? "bot" : "user", formatMessageContent(msg.content));
        });
    }
    lucide.createIcons();
}

async function executeMilestoneChatQuery(e) {
    e.preventDefault();
    const ctx = state.milestoneChatContext;
    const projectId = ctx ? parseInt(ctx.projectId) : (state.globalProjectId || state.currentProject?.id);
    if (!projectId) {
        showToast("Please select a project first.", "error");
        return;
    }

    const msVal = document.getElementById("chat-milestone-select-val")?.value;
    const docVal = document.getElementById("chat-doc-select-val")?.value;

    const milestoneId = msVal ? parseInt(msVal) : null;
    const documentId = docVal ? parseInt(docVal) : null;

    const messageInput = document.getElementById("milestone-chat-message-input");
    const message = messageInput.value.trim();

    if (!message) return;

    messageInput.value = "";

    const sessionKey = getMilestoneChatKey(projectId, milestoneId || 'global');
    if (!state.chatSessions) state.chatSessions = {};
    if (!state.chatSessions[sessionKey]) state.chatSessions[sessionKey] = [];

    state.chatSessions[sessionKey].push({ role: "user", content: message });
    appendChatBubble("user", message);

    messageInput.disabled = true;
    document.getElementById("btn-milestone-chat-send").disabled = true;

    const botBubbleId = appendChatBubble("bot", '<span class="pulse">Thinking and retrieving files...</span>');
    const historyToSend = state.chatSessions[sessionKey].slice(0, -1).slice(-5);

    try {
        const response = await fetch(`${API_BASE}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${state.token}`
            },
            body: JSON.stringify({
                project_id: projectId,
                message: message,
                milestone_id: milestoneId,
                document_id: documentId,
                history: historyToSend
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to contact RAG engine.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let botMessageText = "";
        let sourcesData = [];
        let buffer = "";

        const botBubbleContent = document.getElementById(`msg-content-${botBubbleId}`);
        botBubbleContent.innerHTML = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                const cleanLine = line.trim();
                if (cleanLine.startsWith("data: ")) {
                    const jsonStr = cleanLine.slice(6);
                    try {
                        const payload = JSON.parse(jsonStr);
                        if (payload.type === "sources") {
                            sourcesData = payload.sources;
                        } else if (payload.type === "token") {
                            botMessageText += payload.content;
                            botBubbleContent.innerHTML = formatMessageContent(botMessageText);
                        } else if (payload.type === "done") {
                            if (sourcesData.length > 0) {
                                appendCitationsToBubble(botBubbleId, sourcesData);
                            }
                        }
                    } catch (err) {
                        // Ignore partial SSE chunks
                    }
                }
            }
        }

        state.chatSessions[sessionKey].push({ role: "assistant", content: botMessageText });
    } catch (err) {
        document.getElementById(`msg-content-${botBubbleId}`).textContent = `Error: ${err.message}`;
    } finally {
        messageInput.disabled = false;
        document.getElementById("btn-milestone-chat-send").disabled = false;
        messageInput.focus();
    }
}

let bubbleCounter = 0;
function appendChatBubble(role, htmlContent) {
    const container = document.getElementById("milestone-chat-conversation-container");
    if (!container) return null;
    bubbleCounter++;
    const bubbleId = `msg-${Date.now()}-${bubbleCounter}`;

    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${role}-message`;
    bubble.id = bubbleId;

    const titleStr = role === "bot" ? '<span class="bot-tag"><i data-lucide="bot"></i> AI Assistant</span>' : '<span class="user-tag">You</span>';

    bubble.innerHTML = `
        <div class="message-header">
            ${titleStr}
        </div>
        <div class="message-content" id="msg-content-${bubbleId}">
            ${htmlContent}
        </div>
    `;
    container.appendChild(bubble);

    // Auto-scroll chat window
    container.scrollTop = container.scrollHeight;

    lucide.createIcons();
    return bubbleId;
}

function formatMessageContent(text) {
    if (!text) return "";

    // Escape HTML to prevent XSS (but preserve line breaks we insert)
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Bullet points: lines starting with "***", "* ", or "- "
    html = html.split("\n").map(line => {
        const cleanLine = line.trim();
        if (cleanLine.startsWith("***")) {
            return `<li>**${cleanLine.slice(3)}</li>`;
        } else if (cleanLine.startsWith("* ")) {
            return `<li>${cleanLine.slice(2)}</li>`;
        } else if (cleanLine.startsWith("- ")) {
            return `<li>${cleanLine.slice(2)}</li>`;
        }
        return line;
    }).join("\n");

    // Wrap groups of <li> in <ul>
    html = html.replace(/(<li>.*?<\/li>\n?)+/g, match => `<ul>${match}</ul>`);

    // Bold: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Parse Inline Citations: [Filename, Page X], [Chunk 1], [Document.docx, Segment Y]
    html = html.replace(/\[((?:Chunk\s*\d+|[^\]]+?\.(?:pdf|docx|xlsx|csv|html|txt)|Refer to[^\]]*|Source[^\]]*))(?:\s*,\s*([^\]]+))?\]/gi, (match, docName, pageLabel) => {
        if (pageLabel) {
            const shortName = docName.length > 20 ? docName.substring(0, 17) + "..." : docName;
            return `<span class="inline-citation-badge" title="${docName}, ${pageLabel}">📌 ${shortName}, ${pageLabel}</span>`;
        }
        return `<span class="inline-citation-badge" title="${docName}">📌 ${docName}</span>`;
    });

    // Replace remaining newlines with <br>
    html = html.replace(/\n/g, "<br>");

    return html;
}

function renderRAGDebugSources(sources) {
    const debugList = document.getElementById("debug-sources-list");
    if (!debugList) return;
    debugList.innerHTML = "";

    const isDebugActive = document.getElementById("toggle-debug-mode")?.checked;
    const panel = document.getElementById("citation-explorer-panel");

    if (sources.length === 0) {
        debugList.innerHTML = '<p class="source-empty-state">No context sources were retrieved for this query.</p>';
        return;
    }

    sources.forEach((s, idx) => {
        const pageLabel = s.page ? s.page : `Segment ${s.chunk_index}`;
        const card = document.createElement("div");
        card.className = "source-card";
        card.innerHTML = `
            <div class="source-card-header">
                <span class="source-doc"><i data-lucide="file-text" style="width:12px;height:12px;"></i> ${s.document} (${pageLabel})</span>
            </div>
            <p class="source-snippet">${s.snippet}</p>
        `;
        debugList.appendChild(card);
    });

    lucide.createIcons();
}

function appendCitationsToBubble(bubbleId, sources) {
    const bubble = document.getElementById(bubbleId);
    const citContainer = document.createElement("div");
    citContainer.className = "chat-bubble-sources";

    // Deduplicate sources by filename
    const uniqueDocs = [];
    sources.forEach(s => {
        if (!uniqueDocs.includes(s.document)) {
            uniqueDocs.push(s.document);
        }
    });

    uniqueDocs.forEach(docName => {
        const tag = document.createElement("span");
        tag.className = "citation-tag";
        tag.innerHTML = `<i data-lucide="link" style="width:10px;height:10px;display:inline-block;margin-right:2px;"></i> ${docName}`;

        // Clicking citation opens RAG debugging / details
        tag.addEventListener("click", () => {
            const debugToggle = document.getElementById("toggle-debug-mode");
            if (debugToggle) debugToggle.checked = true;
            renderRAGDebugSources(sources);
            showToast(`Referenced: ${docName}`);
        });

        citContainer.appendChild(tag);
    });

    bubble.appendChild(citContainer);
    lucide.createIcons();
}


