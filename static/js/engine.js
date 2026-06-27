// Pure JavaScript Customer Segmentation Engine
// Implements: CSV parsing, RFM calculation, K-Means clustering, PCA 2D projection, silhouette score
// Zero dependencies, zero download wait — runs instantly in-browser

// ─── CSV Parser ─────────────────────────────────────────────────────────────────

function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
    if (lines.length < 2) return [];
    function splitLine(line) {
        const result = []; let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"' && !inQ) { inQ = true; continue; }
            if (c === '"' && inQ) { inQ = false; continue; }
            if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; continue; }
            cur += c;
        }
        result.push(cur.trim()); return result;
    }
    const headers = splitLine(lines[0]);
    return lines.slice(1).filter(l => l.trim()).map(l => {
        const vals = splitLine(l);
        const row = {};
        headers.forEach((h, i) => { row[h.trim()] = vals[i] !== undefined ? vals[i] : ''; });
        return row;
    });
}

// ─── Math Helpers ────────────────────────────────────────────────────────────────

const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
const variance = arr => { const m = mean(arr); return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length; };
const stdDev = arr => Math.sqrt(variance(arr));

function normalize(matrix) {
    // Z-score standardize each column
    const nCols = matrix[0].length;
    const means = Array.from({ length: nCols }, (_, j) => mean(matrix.map(r => r[j])));
    const stds = Array.from({ length: nCols }, (_, j) => Math.max(stdDev(matrix.map(r => r[j])), 1e-10));
    return matrix.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
}

function dist(a, b) {
    return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
}

// ─── K-Means Clustering ──────────────────────────────────────────────────────────

function kMeans(data, k, maxIter = 150) {
    const n = data.length;
    const dims = data[0].length;

    // K-Means++ initialisation for better convergence
    const centroids = [data[Math.floor(Math.random() * n)].slice()];
    while (centroids.length < k) {
        const dists = data.map(pt => Math.min(...centroids.map(c => dist(pt, c))) ** 2);
        const total = dists.reduce((s, v) => s + v, 0);
        let r = Math.random() * total;
        for (let i = 0; i < n; i++) { r -= dists[i]; if (r <= 0) { centroids.push(data[i].slice()); break; } }
    }

    let labels = new Array(n).fill(0);

    for (let iter = 0; iter < maxIter; iter++) {
        // Assign
        const newLabels = data.map(pt => {
            let minD = Infinity, best = 0;
            centroids.forEach((c, ci) => { const d = dist(pt, c); if (d < minD) { minD = d; best = ci; } });
            return best;
        });

        // Check convergence
        const changed = newLabels.some((l, i) => l !== labels[i]);
        labels = newLabels;
        if (!changed) break;

        // Update centroids
        for (let ci = 0; ci < k; ci++) {
            const pts = data.filter((_, i) => labels[i] === ci);
            if (pts.length === 0) continue;
            for (let d = 0; d < dims; d++) {
                centroids[ci][d] = mean(pts.map(p => p[d]));
            }
        }
    }

    return { labels, centroids };
}

// ─── Silhouette Score ────────────────────────────────────────────────────────────

function silhouetteScore(data, labels, k) {
    if (k <= 1) return 0;
    // Sample max 200 points for speed
    const indices = data.length > 200
        ? Array.from({ length: 200 }, () => Math.floor(Math.random() * data.length))
        : data.map((_, i) => i);

    const scores = indices.map(i => {
        const myCluster = labels[i];
        const sameCluster = indices.filter(j => j !== i && labels[j] === myCluster);
        if (sameCluster.length === 0) return 0;
        const a = mean(sameCluster.map(j => dist(data[i], data[j])));
        let b = Infinity;
        for (let ci = 0; ci < k; ci++) {
            if (ci === myCluster) continue;
            const otherCluster = indices.filter(j => labels[j] === ci);
            if (otherCluster.length === 0) continue;
            const avgDist = mean(otherCluster.map(j => dist(data[i], data[j])));
            if (avgDist < b) b = avgDist;
        }
        return b === Infinity ? 0 : (b - a) / Math.max(a, b);
    });

    return mean(scores);
}

// ─── PCA (2D) via Covariance Matrix ─────────────────────────────────────────────

function pca2D(scaledMatrix) {
    const n = scaledMatrix.length;
    const dims = scaledMatrix[0].length;

    // Covariance matrix
    const cov = Array.from({ length: dims }, () => new Array(dims).fill(0));
    for (let i = 0; i < dims; i++) {
        for (let j = i; j < dims; j++) {
            let s = 0;
            for (let r = 0; r < n; r++) s += scaledMatrix[r][i] * scaledMatrix[r][j];
            cov[i][j] = s / n;
            cov[j][i] = s / n;
        }
    }

    // Power iteration for top-2 eigenvectors
    function powerIter(mat, deflate = null) {
        let v = Array.from({ length: dims }, () => Math.random() - 0.5);
        for (let iter = 0; iter < 200; iter++) {
            let mv = new Array(dims).fill(0);
            for (let i = 0; i < dims; i++)
                for (let j = 0; j < dims; j++)
                    mv[i] += mat[i][j] * v[j];
            if (deflate) {
                const dot = deflate.v.reduce((s, vj, j) => s + vj * mv[j], 0);
                mv = mv.map((m, i) => m - dot * deflate.v[i]);
            }
            const norm = Math.sqrt(mv.reduce((s, x) => s + x * x, 0)) || 1;
            v = mv.map(x => x / norm);
        }
        const eigenval = v.reduce((s, vi, i) => {
            let mv = 0; for (let j = 0; j < dims; j++) mv += mat[i][j] * v[j];
            return s + vi * mv;
        }, 0);
        return { v, eigenval };
    }

    const ev1 = powerIter(cov);
    const ev2 = powerIter(cov, ev1);

    return scaledMatrix.map(row => [
        row.reduce((s, v, i) => s + v * ev1.v[i], 0),
        row.reduce((s, v, i) => s + v * ev2.v[i], 0)
    ]);
}

// ─── RFM Computation ─────────────────────────────────────────────────────────────

function computeRFM(transactions) {
    // Parse dates in DD-MM-YYYY or ISO format
    function parseDate(s) {
        if (!s) return null;
        if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
            const [d, m, y] = s.split('-');
            return new Date(`${y}-${m}-${d}`);
        }
        return new Date(s);
    }

    const rfmMap = {};
    let maxDate = new Date(0);

    transactions.forEach(tx => {
        const id = tx['Customer_ID'] || tx['CustomerID'] || tx['customer_id'];
        const dateRaw = tx['Date'] || tx['date'] || tx['transaction_date'];
        const amount = parseFloat(tx['Amount_INR'] || tx['Amount'] || tx['amount'] || tx['revenue'] || 0);
        const date = parseDate(dateRaw);
        if (!id || !date || isNaN(date)) return;
        if (date > maxDate) maxDate = date;
        if (!rfmMap[id]) rfmMap[id] = { lastDate: date, count: 0, total: 0 };
        if (date > rfmMap[id].lastDate) rfmMap[id].lastDate = date;
        rfmMap[id].count++;
        rfmMap[id].total += amount;
    });

    const refDate = new Date(maxDate.getTime() + 86400000);
    const result = {};
    Object.entries(rfmMap).forEach(([id, v]) => {
        result[id] = {
            Recency: Math.round((refDate - v.lastDate) / 86400000),
            Frequency: v.count,
            Monetary: Math.round(v.total)
        };
    });
    return result;
}

// ─── Profile Name Assignment ─────────────────────────────────────────────────────

function assignProfileName(clusterMeans, overallMeans) {
    const dev = {};
    Object.keys(overallMeans).forEach(col => {
        dev[col] = overallMeans[col] !== 0 ? clusterMeans[col] / overallMeans[col] : 1;
    });
    const r = dev['Recency'] || 1, f = dev['Frequency'] || 1,
          m = dev['Monetary'] || 1, inc = dev['Annual_Income_INR'] || 1,
          age = dev['Age'] || 1;

    if (m > 1.3 && f > 1.2 && r < 0.6) return 'VIP Champions';
    if (f > 1.1 && r < 0.8 && m >= 0.8) return 'Loyal Spenders';
    if (r < 0.8 && f < 0.8 && m > 1.1) return 'New Big Spenders';
    if (r > 1.4 && f < 0.8) return 'Hibernating / At Risk';
    if (m < 0.7 && f > 0.8) return 'Frugal / Budget Shoppers';
    if (inc > 1.2 && m < 0.9) return 'High Income, Low Spend';
    if (age < 0.85) return 'Young Explorers';
    if (age > 1.15) return 'Senior Patrons';
    if (m > 1.0) return r < 1.0 ? 'Active Spenders' : 'Slipped Big Spenders';
    return r < 1.0 ? 'New Occasional' : 'Inactive Budget';
}

// ─── Core Segmentation Engine ─────────────────────────────────────────────────────

function runSegmentation(demoCSV, txCSV, opts) {
    const { nClusters, selectedFeatures } = opts;

    const demographics = parseCSV(demoCSV);
    const transactions = parseCSV(txCSV);

    // Build RFM
    const rfm = computeRFM(transactions);

    // Merge demographics + RFM
    const customers = demographics.map(d => {
        const id = d['Customer_ID'];
        const r = rfm[id] || { Recency: 30, Frequency: 1, Monetary: 0 };
        return {
            Customer_ID: id,
            Age: parseFloat(d['Age']) || 30,
            Annual_Income_INR: parseFloat(d['Annual_Income_INR']) || 500000,
            Gender: d['Gender'] || 'Unknown',
            Region: d['Region'] || 'Unknown',
            Recency: r.Recency,
            Frequency: r.Frequency,
            Monetary: r.Monetary
        };
    }).filter(c => rfm[c.Customer_ID]); // keep only customers with transactions

    if (customers.length === 0) throw new Error('No matching customers found after RFM merge.');

    // Build feature matrix
    const allFeatures = ['Recency', 'Frequency', 'Monetary', 'Age', 'Annual_Income_INR'];
    const features = selectedFeatures.filter(f => allFeatures.includes(f));
    const matrix = customers.map(c => features.map(f => c[f] || 0));

    // Scale
    const scaled = normalize(matrix);

    // K-Means
    const k = Math.min(nClusters, customers.length - 1);
    const { labels, centroids } = kMeans(scaled, k);

    // PCA 2D
    const pca = pca2D(scaled);

    // Silhouette
    const silScore = silhouetteScore(scaled, labels, k);

    // Attach labels and PCA to customers
    customers.forEach((c, i) => {
        c.Cluster = labels[i];
        c.PCA_1 = parseFloat(pca[i][0].toFixed(4));
        c.PCA_2 = parseFloat(pca[i][1].toFixed(4));
    });

    // Generate cluster summaries
    const overallMeans = {};
    features.forEach(f => { overallMeans[f] = mean(customers.map(c => c[f])); });

    const summaries = [];
    for (let ci = 0; ci < k; ci++) {
        const clusterCustomers = customers.filter(c => c.Cluster === ci);
        if (clusterCustomers.length === 0) continue;

        const clusterMeans = {};
        features.forEach(f => { clusterMeans[f] = mean(clusterCustomers.map(c => c[f])); });

        const genderCounts = {};
        clusterCustomers.forEach(c => { genderCounts[c.Gender] = (genderCounts[c.Gender] || 0) + 1; });
        const genderDist = {};
        Object.entries(genderCounts).forEach(([g, cnt]) => {
            genderDist[g] = parseFloat((cnt / clusterCustomers.length * 100).toFixed(1));
        });

        const regionCounts = {};
        clusterCustomers.forEach(c => { regionCounts[c.Region] = (regionCounts[c.Region] || 0) + 1; });
        const regionDist = {};
        Object.entries(regionCounts).forEach(([r, cnt]) => {
            regionDist[r] = parseFloat((cnt / clusterCustomers.length * 100).toFixed(1));
        });

        summaries.push({
            cluster_id: ci,
            profile_name: assignProfileName(clusterMeans, overallMeans),
            size: clusterCustomers.length,
            percentage: parseFloat((clusterCustomers.length / customers.length * 100).toFixed(1)),
            averages: Object.fromEntries(features.map(f => [f, parseFloat(clusterMeans[f].toFixed(2))])),
            gender_dist: genderDist,
            region_dist: regionDist
        });
    }

    return {
        status: 'success',
        silhouette_score: parseFloat(silScore.toFixed(4)),
        cluster_summaries: summaries,
        customers,
        features_used: features
    };
}

// ─── State ────────────────────────────────────────────────────────────────────────

let _demoCSV = null;
let _txCSV = null;
let _customDemoCSV = null;
let _customTxCSV = null;
let _useCustom = false;

const _originalFetch = window.fetch.bind(window);

// ─── Preload default data ─────────────────────────────────────────────────────────

async function preloadDefaultData() {
    try {
        const [demoResp, txResp] = await Promise.all([
            _originalFetch('data/customer_demographics.csv'),
            _originalFetch('data/customer_transactions.csv')
        ]);
        _demoCSV = await demoResp.text();
        _txCSV = await txResp.text();
    } catch (e) {
        console.error('[Engine] Failed to preload default CSVs:', e);
    }
}

// Start preloading immediately (runs in background while DOM loads)
const _preloadPromise = preloadDefaultData();

// ─── API Intercept Layer ──────────────────────────────────────────────────────────

window.fetch = async function(url, options = {}) {
    const urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : String(url));

    // ── POST /api/run-clustering ──────────────────────────────────────────────────
    if (urlStr.includes('/api/run-clustering')) {
        await _preloadPromise;
        const body = options.body ? JSON.parse(options.body) : {};
        const demoSrc = _useCustom && _customDemoCSV ? _customDemoCSV : _demoCSV;
        const txSrc = _useCustom && _customTxCSV ? _customTxCSV : _txCSV;
        if (!demoSrc || !txSrc) throw new Error('Data not loaded yet. Please wait a moment and try again.');
        const result = runSegmentation(demoSrc, txSrc, {
            nClusters: parseInt(body.n_clusters) || 4,
            selectedFeatures: body.features || ['Recency', 'Frequency', 'Monetary', 'Age', 'Annual_Income_INR']
        });
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // ── POST /api/upload ──────────────────────────────────────────────────────────
    if (urlStr.includes('/api/upload')) {
        const formData = options.body;
        const file = formData.get('file');
        const content = await file.text();
        // Treat uploaded file as either demographics (if it has Age/Income) or transactions
        const firstLine = content.split('\n')[0].toLowerCase();
        if (firstLine.includes('age') || firstLine.includes('income') || firstLine.includes('gender')) {
            _customDemoCSV = content;
            _customTxCSV = _txCSV; // reuse default transactions
        } else {
            _customTxCSV = content;
            _customDemoCSV = _demoCSV;
        }
        _useCustom = true;
        const result = runSegmentation(_customDemoCSV, _customTxCSV, {
            nClusters: 4,
            selectedFeatures: ['Recency', 'Frequency', 'Monetary', 'Age', 'Annual_Income_INR']
        });
        result.dataset_name = file.name;
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // ── POST /api/reset ───────────────────────────────────────────────────────────
    if (urlStr.includes('/api/reset')) {
        await _preloadPromise;
        _useCustom = false;
        _customDemoCSV = null;
        _customTxCSV = null;
        const result = runSegmentation(_demoCSV, _txCSV, {
            nClusters: 4,
            selectedFeatures: ['Recency', 'Frequency', 'Monetary', 'Age', 'Annual_Income_INR']
        });
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // ── GET /api/export ───────────────────────────────────────────────────────────
    if (urlStr.includes('/api/export')) {
        await _preloadPromise;
        const demoSrc = _useCustom && _customDemoCSV ? _customDemoCSV : _demoCSV;
        const txSrc = _useCustom && _customTxCSV ? _customTxCSV : _txCSV;
        const result = runSegmentation(demoSrc, txSrc, {
            nClusters: 4,
            selectedFeatures: ['Recency', 'Frequency', 'Monetary', 'Age', 'Annual_Income_INR']
        });
        const headers = ['Customer_ID', 'Age', 'Annual_Income_INR', 'Gender', 'Region',
                         'Recency', 'Frequency', 'Monetary', 'Cluster', 'PCA_1', 'PCA_2'];
        const rows = [headers.join(',')];
        result.customers.forEach(c => {
            rows.push(headers.map(h => c[h] !== undefined ? c[h] : '').join(','));
        });
        const csv = rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'segmented_customers.csv';
        link.click();
        return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return _originalFetch(url, options);
};
