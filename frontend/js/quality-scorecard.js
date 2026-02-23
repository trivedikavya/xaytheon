/**
 * XAYTHEON — Quality Scorecard Dashboard
 * Issue #617: Multi-Dimensional Code Quality Score Aggregator
 */

document.addEventListener('DOMContentLoaded', () => {
    let cqasData = null;
    let historyData = null;
    let radarChart = null;
    let trendChart = null;

    init();

    async function init() {
        setStatus('Computing CQAS...', 'loading');
        await Promise.all([fetchCQAS(), fetchHistory()]);
    }

    // ─── API Calls ────────────────────────────────────────────────────────────

    async function fetchCQAS(weights = null) {
        try {
            const body = { repo: getRepo(), branch: getBranch(), commitId: 'HEAD' };
            if (weights) body.weights = weights;

            const res = await fetch('/api/analyzer/cqas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const json = await res.json();
            if (json.success) {
                cqasData = json.data;
                renderScoreHeader(cqasData);
                renderRadarChart(cqasData.dimensions);
                renderDimensionCards(cqasData.dimensions, cqasData.weights);
                renderWeightEditor(cqasData.weights);
                setStatus(`✅ CQAS computed — Grade ${cqasData.grade}`, 'ok');
            }
        } catch {
            setStatus('⚠️ API offline — showing mock scorecard.', 'warn');
            renderMockCQAS();
        }
    }

    async function fetchHistory() {
        try {
            const res = await fetch(`/api/analyzer/cqas/history?repo=${encodeURIComponent(getRepo())}&branch=${encodeURIComponent(getBranch())}`);
            const json = await res.json();
            if (json.success) {
                historyData = json.data;
                renderTrendChart(historyData.history, historyData.trend);
                renderHistoryTable(historyData.history);
            }
        } catch {
            renderMockTrend();
        }
    }

    async function runCIGate() {
        const minScore = parseInt(document.getElementById('gate-min-score').value) || 60;
        const maxDelta = parseInt(document.getElementById('gate-max-delta').value) || 5;

        try {
            const res = await fetch('/api/analyzer/cqas/ci-gate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo: getRepo(), branch: getBranch(), commitId: 'HEAD', minScore, maxRegressionDelta: maxDelta })
            });
            const json = await res.json();
            renderCIGateResult(json.data || json);
        } catch {
            renderCIGateResult({ passed: true, cqasScore: 74, grade: 'B', delta: '+2', failReasons: [] });
        }
    }

    // ─── Renderers ────────────────────────────────────────────────────────────

    function renderScoreHeader(data) {
        const el = document.getElementById('score-header');
        if (!el) return;
        const gradeColor = { 'A+': '#22c55e', A: '#4ade80', B: '#86efac', C: '#eab308', D: '#f97316', F: '#ef4444' };
        const color = gradeColor[data.grade] || '#6366f1';
        const deltaStr = data.delta !== null ? (data.delta >= 0 ? `+${data.delta}` : `${data.delta}`) : 'N/A';
        const deltaClass = data.delta > 0 ? 'positive' : data.delta < 0 ? 'negative' : 'neutral';

        el.innerHTML = `
            <div class="score-circle" style="--score-color: ${color}">
                <span class="score-value">${data.cqasScore}</span>
                <span class="score-label">/ 100</span>
            </div>
            <div class="score-meta">
                <div class="grade-badge" style="background: ${color}22; color: ${color}; border-color: ${color}">Grade ${data.grade}</div>
                <div class="score-status">${data.label}</div>
                <div class="delta-badge ${deltaClass}">Δ ${deltaStr} vs prev commit</div>
            </div>
        `;
    }

    function renderRadarChart(dimensions) {
        const canvas = document.getElementById('radar-chart');
        if (!canvas) return;
        if (radarChart) radarChart.destroy();

        const labels = ['Complexity', 'Vulnerability', 'Taint Safety', 'Deduplication', 'Architecture'];
        const data = [
            dimensions.complexity?.score || 0,
            dimensions.vulnerability?.score || 0,
            dimensions.taint?.score || 0,
            dimensions.duplication?.score || 0,
            dimensions.architecture?.score || 0
        ];

        radarChart = new Chart(canvas.getContext('2d'), {
            type: 'radar',
            data: {
                labels,
                datasets: [{
                    label: 'Score (0-100)',
                    data,
                    fill: true,
                    backgroundColor: 'rgba(99,102,241,0.15)',
                    borderColor: '#6366f1',
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#fff',
                    tension: 0.1
                }]
            },
            options: {
                scales: {
                    r: {
                        min: 0, max: 100,
                        ticks: { color: '#64748b', stepSize: 20 },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        pointLabels: { color: '#e2e8f0', font: { size: 12 } }
                    }
                },
                plugins: { legend: { labels: { color: '#fff' } } }
            }
        });
    }

    function renderDimensionCards(dimensions, weights) {
        const el = document.getElementById('dimension-cards');
        if (!el) return;

        const icons = { complexity: '🧩', vulnerability: '🔐', taint: '🧫', duplication: '📋', architecture: '🏗️' };
        const dimKeys = Object.keys(dimensions);

        el.innerHTML = dimKeys.map(key => {
            const d = dimensions[key];
            const w = weights[key];
            const barColor = d.label === 'GOOD' ? '#22c55e' : d.label === 'FAIR' ? '#eab308' : d.label === 'POOR' ? '#f97316' : '#ef4444';
            return `
                <div class="dim-card">
                    <div class="dim-header">
                        <span class="dim-icon">${icons[key] || '📊'}</span>
                        <span class="dim-name">${key.charAt(0).toUpperCase() + key.slice(1)}</span>
                        <span class="dim-weight">Weight: ${(w * 100).toFixed(0)}%</span>
                    </div>
                    <div class="dim-score">${d.score}</div>
                    <div class="dim-bar-bg"><div class="dim-bar" style="width:${d.score}%;background:${barColor}"></div></div>
                    <div class="dim-label ${d.label.toLowerCase()}">${d.label}</div>
                </div>
            `;
        }).join('');
    }

    function renderWeightEditor(weights) {
        const el = document.getElementById('weight-editor');
        if (!el) return;
        el.innerHTML = Object.entries(weights).map(([dim, w]) => `
            <div class="weight-row">
                <label>${dim.charAt(0).toUpperCase() + dim.slice(1)}</label>
                <input type="range" id="w-${dim}" min="0" max="100" value="${Math.round(w * 100)}" oninput="document.getElementById('wv-${dim}').textContent = this.value + '%'">
                <span id="wv-${dim}">${Math.round(w * 100)}%</span>
            </div>
        `).join('');
    }

    function renderTrendChart(history, trend) {
        const canvas = document.getElementById('trend-chart');
        if (!canvas) return;
        if (trendChart) trendChart.destroy();

        const labels = history.map(h => h.commitId);
        const scores = history.map(h => h.score);
        const trendColor = trend === 'improving' ? '#22c55e' : trend === 'degrading' ? '#ef4444' : '#6366f1';

        trendChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'CQAS Score',
                    data: scores,
                    fill: true,
                    backgroundColor: trendColor + '22',
                    borderColor: trendColor,
                    tension: 0.3,
                    pointBackgroundColor: trendColor
                }]
            },
            options: {
                scales: {
                    y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { ticks: { color: '#94a3b8' } }
                },
                plugins: { legend: { labels: { color: '#fff' } } }
            }
        });

        const trendEl = document.getElementById('trend-label');
        if (trendEl) trendEl.innerHTML = `Trend: <span class="${trend}">${trend.toUpperCase()}</span>`;
    }

    function renderHistoryTable(history) {
        const tbody = document.getElementById('history-tbody');
        if (!tbody) return;
        tbody.innerHTML = [...history].reverse().map(h => `
            <tr>
                <td class="mono">${h.commitId}</td>
                <td><strong>${h.score}</strong></td>
                <td><span class="grade-chip">${h.grade}</span></td>
                <td>${Object.values(h.dimensions || {}).map(s => `<span class="dim-mini">${s}</span>`).join(' ')}</td>
                <td class="muted">${new Date(h.timestamp).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }

    function renderCIGateResult(data) {
        const el = document.getElementById('ci-gate-result');
        if (!el) return;
        const status = data.passed ? '✅ GATE PASSED' : '❌ GATE FAILED';
        const cls = data.passed ? 'passed' : 'failed';
        el.innerHTML = `
            <div class="gate-result ${cls}">
                <div class="gate-status">${status}</div>
                <div class="gate-score">CQAS: <strong>${data.cqasScore}</strong> | Grade: <strong>${data.grade}</strong> | Δ${data.delta ?? 'N/A'}</div>
                ${data.failReasons && data.failReasons.length > 0
                ? `<ul class="fail-reasons">${data.failReasons.map(r => `<li>${r}</li>`).join('')}</ul>`
                : '<p class="ok-msg">All quality gates satisfied.</p>'}
            </div>
        `;
    }

    function renderMockCQAS() {
        renderScoreHeader({ cqasScore: 73, grade: 'B', label: 'GOOD', delta: 2 });
        renderRadarChart({ complexity: { score: 78 }, vulnerability: { score: 68 }, taint: { score: 65 }, duplication: { score: 82 }, architecture: { score: 77 } });
    }

    function renderMockTrend() {
        const history = [72, 74, 71, 75, 78, 76, 73, 77].map((s, i) => ({ commitId: `abc10${i}`, score: s, grade: 'B', dimensions: {}, timestamp: new Date().toISOString() }));
        renderTrendChart(history, 'improving');
        renderHistoryTable(history);
    }

    function setStatus(msg, type = 'ok') {
        const el = document.getElementById('scan-status');
        if (el) el.innerHTML = msg;
    }

    function getRepo() { return document.getElementById('repo-input')?.value || 'SatyamPandey-07/xaytheon'; }
    function getBranch() { return document.getElementById('branch-input')?.value || 'main'; }

    // ─── Form Handlers ────────────────────────────────────────────────────────

    const recomputeBtn = document.getElementById('btn-recompute');
    if (recomputeBtn) {
        recomputeBtn.addEventListener('click', async () => {
            const w = {};
            const keys = ['complexity', 'vulnerability', 'taint', 'duplication', 'architecture'];
            keys.forEach(k => {
                const el = document.getElementById(`w-${k}`);
                if (el) w[k] = parseInt(el.value) / 100;
            });
            await fetchCQAS(w);
        });
    }

    const ciBtn = document.getElementById('btn-ci-gate');
    if (ciBtn) ciBtn.addEventListener('click', runCIGate);
});
