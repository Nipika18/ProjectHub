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
            handleFileUploads(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener("change", () => {
        if (fileInput.files.length) {
            handleFileUploads(fileInput.files);
        }
    });

    if (btnCloseUpload && uploadModal) {
        btnCloseUpload.addEventListener("click", () => {
            if (!state.isUploading) uploadModal.classList.remove("active");
        });
    }
}

async function handleFileUploads(files) {
    if (!checkAdminAccess("upload documents")) return;

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

    const allowedExts = ["pdf", "docx", "doc", "xlsx", "xls", "csv", "html", "htm", "txt"];
    const validFiles = Array.from(files).filter(f => {
        const ext = f.name.split(".").pop().toLowerCase();
        return allowedExts.includes(ext);
    });

    if (validFiles.length < files.length) {
        showToast("Some files were ignored. Only PDF, DOCX, XLSX, CSV, HTML, and TXT are allowed.", "warning");
    }

    if (validFiles.length === 0) {
        document.getElementById("file-input").value = "";
        return;
    }

    state.isUploading = true;
    const dropzone = document.getElementById("dropzone");
    if (dropzone) dropzone.classList.add("disabled");

    const progressContainer = document.getElementById("upload-progress-container");
    const percentLabel = document.getElementById("upload-percent");
    const fill = document.getElementById("progress-bar-fill");
    const filenameLabel = document.getElementById("upload-filename");
    const statusLabel = document.getElementById("upload-status-text");

    progressContainer.classList.remove("hidden");
    let hasError = false;
    let completedCount = 0;

    filenameLabel.textContent = validFiles.length > 1 ? `Uploading ${validFiles.length} document(s)...` : validFiles[0].name;
    percentLabel.textContent = "0%";
    fill.style.width = "0%";
    statusLabel.className = "progress-status"; 
    statusLabel.innerHTML = '<i data-lucide="loader" class="spin"></i> Uploading & Analyzing... Please wait.';
    lucide.createIcons();

    const abortController = new AbortController();
    state.uploadAbortController = abortController;

    let fakePercent = 5;
    const interval = setInterval(() => {
        if (fakePercent < 90) {
            fakePercent += Math.floor(Math.random() * 5) + 1;
            fill.style.width = `${fakePercent}%`;
            percentLabel.textContent = `${fakePercent}%`;
        }
    }, 300);
    state.uploadProgressInterval = interval;

    const uploadPromises = validFiles.map(async (file) => {
        const formData = new FormData();
        formData.append("project_id", projectId);
        if (milestoneId) formData.append("milestone_id", milestoneId);
        formData.append("category", category);
        formData.append("file", file);

        try {
            const response = await fetch(`${API_BASE}/api/documents`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${state.token}` },
                body: formData,
                signal: abortController.signal
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Upload / processing failed.");
            }
            completedCount++;
            showToast(`Uploaded ${file.name} successfully!`, "success");
        } catch (e) {
            hasError = true;
            if (e.name !== "AbortError") {
                showToast(`Failed to upload ${file.name}: ${e.message}`, "error");
            }
        }
    });

    await Promise.all(uploadPromises);

    clearInterval(interval);
    state.uploadProgressInterval = null;
    state.uploadAbortController = null;

    if (abortController.signal.aborted) {
        fill.style.width = "0%";
        percentLabel.textContent = "0%";
        statusLabel.className = "progress-status error";
        statusLabel.innerHTML = `<i data-lucide="alert-triangle"></i> Upload cancelled.`;
    } else if (hasError && completedCount === 0) {
        fill.style.width = "0%";
        percentLabel.textContent = "0%";
        statusLabel.className = "progress-status error";
        statusLabel.innerHTML = `<i data-lucide="alert-triangle"></i> Error during upload.`;
    } else {
        fill.style.width = "100%";
        percentLabel.textContent = "100%";
        statusLabel.className = "progress-status success";
        statusLabel.innerHTML = `<i data-lucide="check-circle"></i> ${completedCount}/${validFiles.length} uploaded successfully.`;
    }

    state.isUploading = false;
    if (dropzone) dropzone.classList.remove("disabled");
    document.getElementById("file-input").value = "";
    lucide.createIcons();

    if (completedCount > 0) {
        refreshMilestoneViewsForProject(parseInt(projectId));
        loadWorkspaceData();
    }

    if (!hasError || completedCount > 0) {
        setTimeout(() => {
            const uploadModal = document.getElementById("milestone-upload-modal");
            if (uploadModal && !state.isUploading) uploadModal.classList.remove("active");
        }, 1200);
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


