// =====================================================================
// Document Uploads & Dropzone
// =====================================================================

function bindUploadEvents() {
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("file-input");
    const uploadModal = document.getElementById("milestone-upload-modal");
    const btnCloseUpload = document.getElementById("btn-close-milestone-upload-modal");

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener("click", () => {
        if (!state.isUploading) fileInput.click();
    });

    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
    });

    ["dragleave", "dragend"].forEach(type => {
        dropzone.addEventListener(type, () => {
            dropzone.classList.remove("dragover");
        });
    });

    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        if (e.dataTransfer.files.length) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener("change", () => {
        if (fileInput.files.length) {
            handleFileUpload(fileInput.files[0]);
        }
    });

    if (btnCloseUpload && uploadModal) {
        btnCloseUpload.addEventListener("click", () => {
            if (!state.isUploading) uploadModal.classList.remove("active");
        });
    }
}

async function handleFileUpload(file) {
    if (!checkAdminAccess("upload documents")) return;
    const allowedExts = ["pdf", "docx", "doc", "xlsx", "xls", "csv", "html", "htm", "txt"];
    const ext = file.name.split(".").pop().toLowerCase();
    if (!allowedExts.includes(ext)) {
        showToast("Only PDF, DOCX, XLSX, CSV, HTML, and TXT files are allowed. Image files (JPEG, PNG, etc.) are not supported.", "error");
        document.getElementById("file-input").value = "";
        return;
    }

    const projectId = state.uploadContext?.projectId || state.currentProject?.id || state.globalProjectId;
    const msSelectVal = document.getElementById("upload-milestone-select")?.value;
    const milestoneId = msSelectVal !== undefined && msSelectVal !== "" ? parseInt(msSelectVal) : (state.uploadContext?.milestoneId || null);
    const category = document.getElementById("upload-category") ? document.getElementById("upload-category").value : "team";

    if (!projectId) {
        showToast("Please select an Active Project before uploading.", "error");
        return;
    }

    if (state.isUploading) {
        showToast("An upload is already in progress. Please wait for it to finish!", "warning");
        return;
    }

    state.isUploading = true;
    const dropzone = document.getElementById("dropzone");
    if (dropzone) dropzone.classList.add("disabled");

    // Show Progress Indicator
    const progressContainer = document.getElementById("upload-progress-container");
    const percentLabel = document.getElementById("upload-percent");
    const fill = document.getElementById("progress-bar-fill");
    const filenameLabel = document.getElementById("upload-filename");
    const statusLabel = document.getElementById("upload-status-text");

    filenameLabel.textContent = file.name;
    percentLabel.textContent = "0%";
    fill.style.width = "0%";
    statusLabel.className = "progress-status"; // Reset class list
    statusLabel.innerHTML = '<i data-lucide="loader" class="spin"></i> Analyzing document with AI... Please wait.';
    progressContainer.classList.remove("hidden");
    lucide.createIcons();

    // Prepare Multipart Form
    const formData = new FormData();
    formData.append("project_id", projectId);
    if (milestoneId) formData.append("milestone_id", milestoneId);
    formData.append("category", category);
    formData.append("file", file);

    try {
        const abortController = new AbortController();
        state.uploadAbortController = abortController;

        // Mock progress bar while FastAPI processes backend vectors
        let fakePercent = 10;
        const interval = setInterval(() => {
            if (fakePercent < 90) {
                fakePercent += Math.floor(Math.random() * 8) + 2;
                fill.style.width = `${fakePercent}%`;
                percentLabel.textContent = `${fakePercent}%`;
            }
        }, 300);
        state.uploadProgressInterval = interval;

        const response = await fetch(`${API_BASE}/api/documents`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${state.token}` },
            body: formData,
            signal: abortController.signal
        });

        clearInterval(interval);
        state.uploadProgressInterval = null;
        state.uploadAbortController = null;

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Upload / processing failed.");
        }

        // Ingestion complete
        fill.style.width = "100%";
        percentLabel.textContent = "100%";
        statusLabel.className = "progress-status success";
        statusLabel.innerHTML = '<i data-lucide="check-circle"></i> Document uploaded';

        showToast("Document uploaded successfully!", "success");
        refreshMilestoneViewsForProject(parseInt(projectId));

        setTimeout(() => {
            const uploadModal = document.getElementById("milestone-upload-modal");
            if (uploadModal && !state.isUploading) uploadModal.classList.remove("active");
        }, 1200);

        loadWorkspaceData();

        // Reset file inputs
        document.getElementById("file-input").value = "";
    } catch (e) {
        if (e.name === "AbortError") {
            return;
        }
        fill.style.width = "0%";
        percentLabel.textContent = "0%";
        statusLabel.className = "progress-status error";
        statusLabel.innerHTML = `<i data-lucide="alert-triangle"></i> Error: ${e.message}`;
        showToast(e.message, "error");
    } finally {
        state.isUploading = false;
        const dropzone = document.getElementById("dropzone");
        if (dropzone) dropzone.classList.remove("disabled");
        lucide.createIcons();
    }
}

window.cancelDocumentUpload = function () {
    if (state.uploadAbortController) {
        state.uploadAbortController.abort();
        state.uploadAbortController = null;
    }
    if (state.uploadProgressInterval) {
        clearInterval(state.uploadProgressInterval);
        state.uploadProgressInterval = null;
    }
    state.isUploading = false;
    const dropzone = document.getElementById("dropzone");
    if (dropzone) dropzone.classList.remove("disabled");

    const progressContainer = document.getElementById("upload-progress-container");
    if (progressContainer) progressContainer.classList.add("hidden");
    const fileInput = document.getElementById("file-input");
    if (fileInput) fileInput.value = "";

    showToast("Upload cancelled.", "info");
};


