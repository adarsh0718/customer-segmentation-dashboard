import { initCharts, updateCharts } from './charts.js';
import { initTable, setTableData } from './tables.js';

// Global reference elements
const clusterSlider = document.querySelector("#cluster-slider");
const clusterSliderVal = document.querySelector("#cluster-slider-val");
const btnRun = document.querySelector("#btn-run-clustering");
const btnReset = document.querySelector("#btn-reset");
const btnExport = document.querySelector("#btn-export-data");
const dropZone = document.querySelector("#drop-zone");
const fileInput = document.querySelector("#file-input");
const spinner = document.querySelector("#loading-spinner");
const spinnerText = document.querySelector("#loading-spinner-text");

// Highlight cluster colors mapped
const clusterColors = [
    '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#a855f7', '#3b82f6', '#ef4444'
];

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize Components
    initCharts();
    initTable();
    setupEventListeners();

    // 2. Load Default Clustering Run
    fetchClusteringData(4, ["Recency", "Frequency", "Monetary", "Age", "Annual_Income_INR"]);
});

/**
 * Configure UI actions and bindings
 */
function setupEventListeners() {
    // Range Slider value update
    clusterSlider.addEventListener("input", (e) => {
        clusterSliderVal.innerText = e.target.value;
    });

    // Checkbox custom UI selection toggles
    const checkboxItems = document.querySelectorAll(".checkbox-item");
    checkboxItems.forEach(item => {
        const checkbox = item.querySelector("input[type='checkbox']");
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                item.classList.add("checked");
            } else {
                item.classList.remove("checked");
            }
        });
    });

    // Submit Action
    btnRun.addEventListener("click", () => {
        const k = parseInt(clusterSlider.value);
        const features = [];
        document.querySelectorAll("#feature-checkboxes input[type='checkbox']:checked").forEach(cb => {
            features.push(cb.value);
        });

        if (features.length === 0) {
            alert("Please select at least one feature for clustering.");
            return;
        }

        fetchClusteringData(k, features);
    });

    // Reset Data Action
    btnReset.addEventListener("click", () => {
        showLoading("Restoring default customer database...");
        fetch("/api/reset", { method: "POST" })
            .then(res => res.json())
            .then(data => {
                hideLoading();
                if (data.status === "success") {
                    updateDashboard(data);
                    // Reset slider & checkboxes
                    clusterSlider.value = 4;
                    clusterSliderVal.innerText = 4;
                    document.querySelectorAll("#feature-checkboxes input[type='checkbox']").forEach(cb => {
                        cb.checked = true;
                        cb.closest(".checkbox-item").classList.add("checked");
                    });
                } else {
                    alert("Reset failed: " + data.message);
                }
            })
            .catch(err => {
                hideLoading();
                console.error(err);
                alert("An error occurred during reset.");
            });
    });

    // Export Data Action
    btnExport.addEventListener("click", () => {
        window.location.href = "/api/export";
    });

    // File Drag and Drop Import
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    fileInput.addEventListener("change", (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });
}

/**
 * Sends request to cluster customer segments dynamically
 * @param {number} k Number of clusters
 * @param {Array} features List of features to run clustering
 */
function fetchClusteringData(k, features) {
    showLoading("Running K-Means Machine Learning engine...");
    
    fetch("/api/run-clustering", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            n_clusters: k,
            features: features
        })
    })
    .then(res => res.json())
    .then(data => {
        hideLoading();
        if (data.status === "success") {
            updateDashboard(data);
        } else {
            alert("Clustering error: " + data.message);
        }
    })
    .catch(err => {
        hideLoading();
        console.error(err);
        alert("An error occurred while processing machine learning segments.");
    });
}

/**
 * Handle CSV/Excel file uploads and auto-cluster
 * @param {File} file Selected spreadsheet file
 */
function handleFileUpload(file) {
    const formData = new FormData();
    formData.append("file", file);

    showLoading("Analyzing file structure and clustering custom dataset...");

    fetch("/api/upload", {
        method: "POST",
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        hideLoading();
        if (data.status === "success") {
            updateDashboard(data);
            // Sync K control UI back to default 4
            clusterSlider.value = 4;
            clusterSliderVal.innerText = 4;
            // Sync features to default
            document.querySelectorAll("#feature-checkboxes input[type='checkbox']").forEach(cb => {
                cb.checked = true;
                cb.closest(".checkbox-item").classList.add("checked");
            });
            alert("Successfully imported custom dataset! Visualizations updated.");
        } else {
            alert("File upload error: " + data.message);
        }
    })
    .catch(err => {
        hideLoading();
        console.error(err);
        alert("An error occurred during file upload.");
    });
}

/**
 * Updates KPIs, segment cards, table lists, and charts
 * @param {Object} data API return payload
 */
function updateDashboard(data) {
    // 1. Update KPI Values
    document.querySelector("#kpi-total-customers").innerText = data.customers.length.toLocaleString();
    document.querySelector("#kpi-segments").innerText = data.cluster_summaries.length;
    document.querySelector("#kpi-quality").innerText = data.silhouette_score.toFixed(3);
    
    // Average Spending calculation
    const totalSpend = data.customers.reduce((sum, c) => sum + (c.Monetary || 0), 0);
    const avgSpend = data.customers.length > 0 ? (totalSpend / data.customers.length) : 0;
    document.querySelector("#kpi-avg-spend").innerText = "₹" + Math.round(avgSpend).toLocaleString('en-IN');

    // 2. Render Segment Profile list
    renderSegmentProfiles(data.cluster_summaries);

    // 3. Update Charts
    updateCharts(data.customers, data.cluster_summaries);

    // 4. Update table directory
    setTableData(data.customers, data.cluster_summaries);
}

/**
 * Builds HTML profile summaries for each cluster
 * @param {Array} summaries List of summaries
 */
function renderSegmentProfiles(summaries) {
    const container = document.querySelector("#segment-profiles");
    container.innerHTML = "";

    summaries.forEach((sum) => {
        const color = clusterColors[sum.cluster_id % 8];
        const card = document.createElement("div");
        card.className = "profile-item";
        
        card.innerHTML = `
            <div class="profile-info">
                <div class="profile-name-tag">
                    <span class="profile-color-badge" style="background: ${color}; box-shadow: 0 0 8px ${color};"></span>
                    <span class="profile-title">${sum.profile_name}</span>
                </div>
                <div class="profile-meta">
                    Avg Age: <b>${Math.round(sum.averages.Age || 0)}</b> | Last Active: <b>${Math.round(sum.averages.Recency || 0)} days</b>
                </div>
            </div>
            <div class="profile-metrics">
                <div class="profile-spend-val" style="color: ${color}">₹${Math.round(sum.averages.Monetary || 0).toLocaleString('en-IN')}</div>
                <div class="profile-cust-count">${sum.size} customers (${sum.percentage}%)</div>
            </div>
        `;
        container.appendChild(card);
    });
}

function showLoading(message) {
    spinnerText.innerText = message || "Processing...";
    spinner.classList.add("active");
}

function hideLoading() {
    spinner.classList.remove("active");
}
