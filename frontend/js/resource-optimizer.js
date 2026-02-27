/**
 * XAYTHEON — Resource Optimizer
 */

document.addEventListener('DOMContentLoaded', () => {
    let nodes = [];
    let summary = {};
    let recommendations = [];
    let socket;

    init();

    async function init() {
        initSocket();
        await fetchData();
        render();
    }

    function initSocket() {
        if (typeof io !== 'undefined') {
            socket = io();
            socket.emit('join_efficiency_ops');

            socket.on('cost_alert', (data) => {
                showToast('💰 COST ALERT', `Node ${data.nodeId} exceeded threshold!`, 'error');
            });

            socket.on('scaling_event', (data) => {
                showToast('📈 Scaling Suggestion', `Right-sizing ${data.nodeId} could save $${data.savings}`, 'info');
            });
        }
    }

    async function fetchData() {
        const res = await fetch('/api/resource/efficiency');
        const json = await res.json();
        if (json.success) {
            nodes = json.nodes;
            summary = json.costs;
            render();
        }

        const recRes = await fetch('/api/resource/recommendations');
        const recJson = await recRes.json();
        if (recJson.success) {
            recommendations = recJson.recommendations;
            renderRecommendations();
        }
    }

    async function applyOptimization(nodeId, targetType) {
        try {
            const res = await fetch('/api/resource/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodeId, targetType })
            });
            const json = await res.json();
            if (json.success) {
                showToast('✅ Right-Sizing Initiated', `Orchestrating migration of ${nodeId} to ${targetType}`, 'success');
                await fetchData();
            }
        } catch (err) {
            showToast('❌ Failed', 'Optimization engine busy', 'error');
        }
    }

    // ─── Renderers ───────────────────────────────────────────────────────────

    function render() {
        renderSummary();
        renderGrid();
    }

    function renderSummary() {
        const el = document.getElementById('cost-summary');
        if (!el) return;
        el.innerHTML = `
            <div class="stat-card">
                <span class="label">Monthly Burn</span>
                <span class="value">$${summary.totalMonthly?.toLocaleString() || 0}</span>
            </div>
            <div class="stat-card">
                <span class="label">Daily Average</span>
                <span class="value">$${summary.dailyAverage?.toFixed(2) || 0}</span>
            </div>
            <div class="stat-card">
                <span class="label">Yearly Proj.</span>
                <span class="value">$${summary.projectedYearly?.toLocaleString() || 0}</span>
            </div>
        `;
    }

    function renderGrid() {
        const el = document.getElementById('node-grid');
        if (!el) return;
        el.innerHTML = nodes.map(n => `
            <div class="node-card ${n.status}">
                <div class="node-header">
                    <strong>${n.id}</strong>
                    <span class="type-badge">${n.type}</span>
                </div>
                <div class="usage-stats">
                    <div class="usage-row">
                        <span>CPU</span>
                        <div class="bar-wrap"><div class="bar-fill" style="width: ${n.cpu}%"></div></div>
                        <span>${n.cpu}%</span>
                    </div>
                    <div class="usage-row">
                        <span>MEM</span>
                        <div class="bar-wrap"><div class="bar-fill" style="width: ${n.mem}%"></div></div>
                        <span>${n.mem}%</span>
                    </div>
                </div>
                <div class="node-footer">
                    <span class="efficiency">Eff: ${n.efficiencyScore}%</span>
                    <span class="cost">$${n.cost}/mo</span>
                </div>
            </div>
        `).join('');
    }

    function renderRecommendations() {
        const el = document.getElementById('rec-list');
        if (!el) return;
        if (recommendations.length === 0) {
            el.innerHTML = '<p class="muted">No immediate optimizations needed.</p>';
            return;
        }
        el.innerHTML = recommendations.map(r => `
            <div class="rec-item">
                <div class="rec-desc">
                    <strong>${r.nodeId}</strong>
                    <p>${r.reason}</p>
                </div>
                <div class="rec-action">
                    <div class="savings">+$${r.potentialSavings.toFixed(0)} savings</div>
                    <button class="btn btn-opt" onclick="optimize('${r.nodeId}','${r.suggestedType}')">Apply Fix</button>
                </div>
            </div>
        `).join('');
    }

    function showToast(title, msg, type) {
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.innerHTML = `<strong>${title}</strong><p>${msg}</p>`;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('visible'), 100);
        setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 4000);
    }

    window.optimize = applyOptimization;
});
