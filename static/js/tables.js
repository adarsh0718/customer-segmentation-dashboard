// Tables Module to handle customer directory rendering, searching, sorting, and pagination

let allCustomers = [];
let filteredCustomers = [];
let clusterNamesMap = {}; // Maps cluster IDs to profile names

let currentPage = 1;
const pageSize = 10;
let currentSortColumn = 'Customer_ID';
let isSortAscending = true;

/**
 * Initializes table event listeners for sorting and searching
 * @param {Function} onRowClick Optional callback when clicking a table row
 */
export function initTable(onRowClick) {
    const searchInput = document.querySelector("#table-search");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            handleSearch(e.target.value);
        });
    }

    const headers = document.querySelectorAll("#customer-table th");
    headers.forEach(header => {
        header.addEventListener("click", () => {
            const col = header.getAttribute("data-sort");
            if (col) {
                handleSort(col);
            }
        });
    });

    document.querySelector("#btn-prev-page").addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderTablePage();
        }
    });

    document.querySelector("#btn-next-page").addEventListener("click", () => {
        const maxPage = Math.ceil(filteredCustomers.length / pageSize);
        if (currentPage < maxPage) {
            currentPage++;
            renderTablePage();
        }
    });
}

/**
 * Set dataset and refresh directory view
 * @param {Array} customers List of customer records
 * @param {Array} summaries List of cluster summary definitions
 */
export function setTableData(customers, summaries) {
    allCustomers = customers;
    filteredCustomers = [...customers];
    
    // Build names map
    clusterNamesMap = {};
    summaries.forEach(s => {
        clusterNamesMap[s.cluster_id] = s.profile_name;
    });

    currentPage = 1;
    applySort();
    renderTablePage();
}

/**
 * Filter customers based on search text input
 * @param {string} text Search query
 */
function handleSearch(text) {
    const query = text.toLowerCase().trim();
    if (!query) {
        filteredCustomers = [...allCustomers];
    } else {
        filteredCustomers = allCustomers.filter(c => {
            const profile = clusterNamesMap[c.Cluster] || '';
            return c.Customer_ID.toLowerCase().includes(query) ||
                   c.Region.toLowerCase().includes(query) ||
                   c.Gender.toLowerCase().includes(query) ||
                   profile.toLowerCase().includes(query);
        });
    }
    currentPage = 1;
    renderTablePage();
}

/**
 * Trigger sort on a column and toggle order direction
 * @param {string} column Column attribute name
 */
function handleSort(column) {
    if (currentSortColumn === column) {
        isSortAscending = !isSortAscending;
    } else {
        currentSortColumn = column;
        isSortAscending = true;
    }
    
    // Update visual headers
    const headers = document.querySelectorAll("#customer-table th");
    headers.forEach(header => {
        const col = header.getAttribute("data-sort");
        const span = header.querySelector("span");
        if (col === column) {
            span.innerHTML = isSortAscending ? '▲' : '▼';
            header.style.color = '#fff';
        } else {
            span.innerHTML = '▲▼';
            header.style.color = '';
        }
    });

    applySort();
    renderTablePage();
}

/**
 * Sorts filtered data array based on active criteria
 */
function applySort() {
    filteredCustomers.sort((a, b) => {
        let valA = a[currentSortColumn];
        let valB = b[currentSortColumn];

        // Custom string/number comparison
        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        if (valA < valB) return isSortAscending ? -1 : 1;
        if (valA > valB) return isSortAscending ? 1 : -1;
        return 0;
    });
}

/**
 * Renders only the active page segment inside the tbody
 */
function renderTablePage() {
    const tbody = document.querySelector("#customer-table-body");
    tbody.innerHTML = "";

    if (filteredCustomers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">No matching customer profiles found.</td></tr>`;
        updatePaginationUI(0, 0, 0);
        return;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredCustomers.length);
    const pageData = filteredCustomers.slice(startIndex, endIndex);

    const clusterColors = [
        '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#a855f7', '#3b82f6', '#ef4444'
    ];

    pageData.forEach(cust => {
        const row = document.createElement("tr");
        const profileName = clusterNamesMap[cust.Cluster] || `Segment ${cust.Cluster}`;
        const color = clusterColors[cust.Cluster % 8];

        row.innerHTML = `
            <td style="font-weight: 600; color: #fff;">${cust.Customer_ID}</td>
            <td>
                <span class="cluster-pill" style="background: ${color}20; color: ${color}; border: 1px solid ${color}40;">
                    ${profileName}
                </span>
            </td>
            <td>${cust.Age}</td>
            <td>₹${cust.Annual_Income_INR.toLocaleString('en-IN')}</td>
            <td>${cust.Recency}</td>
            <td>${cust.Frequency}</td>
            <td>₹${cust.Monetary.toLocaleString('en-IN')}</td>
            <td>${cust.Region}</td>
        `;
        tbody.appendChild(row);
    });

    updatePaginationUI(startIndex + 1, endIndex, filteredCustomers.length);
}

/**
 * Updates pagination metadata text and button states
 */
function updatePaginationUI(start, end, total) {
    const info = document.querySelector("#pagination-info");
    const prevBtn = document.querySelector("#btn-prev-page");
    const nextBtn = document.querySelector("#btn-next-page");

    if (total === 0) {
        info.innerHTML = "Showing 0 to 0 of 0 customers";
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }

    info.innerHTML = `Showing <b>${start}</b> to <b>${end}</b> of <b>${total}</b> customers`;
    
    prevBtn.disabled = currentPage === 1;
    
    const maxPage = Math.ceil(total / pageSize);
    nextBtn.disabled = currentPage === maxPage || maxPage === 0;
}
