/**
 * XAYTHEON — Developer Burnout Monitor
 * Issue #616: Predictive Burnout Detection & Automated Workload Rebalancing
 */

document.addEventListener('DOMContentLoaded', () => {
    let burnoutData = null;
    let rebalanceData = null;
    let heatmapChart = null;
    let riskChart = null;

    init();

    async function init() {
        setStatus('Scanning team health signals...', 'loading');
        await Promise.all([fetchBurnoutRisk(), fetchRebalance()]);
    }

    // ─── API Calls ───────────────────────────────────────────────────────────

    async function fetchBurnoutRisk() {
        try {
            const res = await fetch('/api/predictive/burnout-risk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const json = await res.json();
            if (json.success) {
                burnoutData = json.data;
                renderSummaryBanner(burnoutData.summary);
                renderRiskHeatmap(burnoutData.riskProfiles);
                renderAtRiskCards(burnoutData.riskProfiles);
                renderRiskBarChart(burnoutData.riskProfiles);
                setStatus(`✅ Scan complete — ${burnoutData.summary.atRiskCount} at-risk developer(s) flagged`, 'ok');
            }
        } catch {
            setStatus('⚠️ API offline — showing demo data.', 'warn');
            renderMockBurnout();
        }
    }

    async function fetchRebalance() {
        try {
            const res = await fetch('/api/predictive/rebalance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const json = await res.json();
            if (json.success) {
                rebalanceData = json.data;
                renderRebalancePlan(rebalanceData);
            }
        } catch {
            renderMockRebalance();
        }
    }

    async function triggerRebalance() {
        document.getElementById('rebalance-btn').textContent = '⟳ Running...';
        await fetchRebalance();
        document.getElementById('rebalance-btn').textContent = '🔄 Auto-Rebalance';
    }

    // ─── Renderers ───────────────────────────────────────────────────────────

    function renderSummaryBanner(summary) {
        const el = document.getElementById('summary-banner');
        if (!el) return;

        const avgColor = summary.avgRiskScore >= 60 ? '#ef4444' : summary.avgRiskScore >= 40 ? '#f97316' : '#22c55e';
        el.innerHTML = `
            <div class="stat-box">
                <div class="stat-num">${summary.totalDevs}</div>
                <div class="stat-label">Total Devs</div>
            </div>
            <div class="stat-box danger">
                <div class="stat-num" style="color:#ef4444">${summary.atRiskCount}</div>
                <div class="stat-label">At Risk</div>
            </div>
            <div class="stat-box critical">
                <div class="stat-num" style="color:#f97316">${summary.criticalCount}</div>
                <div class="stat-label">Critical</div>
            </div>
            <div class="stat-box">
                <div class="stat-num" style="color:${avgColor}">${summary.avgRiskScore}</div>
                <div class="stat-label">Avg Risk Score</div>
            </div>
        `;
    }

    function renderRiskHeatmap(profiles) {
        const el = document.getElementById('heatmap-grid');
        if (!el) return;

        el.innerHTML = profiles.map(dev => {
            const color = dev.riskLevel === 'CRITICAL' ? '#ef4444'
                : dev.riskLevel === 'HIGH' ? '#f97316'
                    : dev.riskLevel === 'MODERATE' ? '#eab308'
                        : '#22c55e';
            const intensity = Math.max(10, dev.riskScore);
            return `
                <div class="heatmap-cell tooltip-wrap" style="--cell-color:${color}; --intensity:${intensity}%">
                    <div class="cell-avatar">${dev.name.charAt(0)}</div>
                    <div class="cell-name">${dev.name}</div>
                    <div class="cell-score">${dev.riskScore}</div>
                    <div class="cell-level" style="color:${color}">${dev.riskLevel}</div>
                    <div class="cell-tooltip">
                        <strong>${dev.name}</strong><br>
                        Velocity Decay: ${dev.signals?.velocityDecay?.signal || 'N/A'}<br>
                        Overload: ${dev.signals?.overload?.signal || 'N/A'}<br>
                        Mood: ${dev.signals?.moodFlag?.moodTrend || 'stable'}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderAtRiskCards(profiles) {
        const el = document.getElementById('at-risk-list');
        if (!el) return;

        const atRisk = profiles.filter(d => d.atRisk);
        if (atRisk.length === 0) {
            el.innerHTML = '<p class="ok-msg">✅ No developers are currently at high burnout risk.</p>';
            return;
        }

        el.innerHTML = atRisk.map(dev => {
            const color = dev.riskLevel === 'CRITICAL' ? '#ef4444' : '#f97316';
            const decay = dev.signals?.velocityDecay;
            const over = dev.signals?.overload;
            return `
                <div class="risk-card" style="border-color:${color}22; background:${color}0a">
                    <div class="risk-header">
                        <div class="risk-avatar" style="background:${color}22;color:${color}">${dev.name.charAt(0)}</div>
                        <div>
                            <div class="risk-name">${dev.name}</div>
                            <div class="risk-level" style="color:${color}">⚠️ ${dev.riskLevel} RISK — Score ${dev.riskScore}/100</div>
                        </div>
                    </div>
                    <div class="risk-signals">
                        <span class="signal-chip ${decay?.signal === 'STABLE' ? 'ok' : 'bad'}">📉 ${decay?.signal || 'N/A'} (decay ${decay?.decayRate || 0}%)</span>
                        <span class="signal-chip ${over?.signal === 'HEALTHY' ? 'ok' : 'bad'}">⚙️ ${over?.signal || 'N/A'} (×${over?.capacityRatio || 1} capacity)</span>
                        <span class="signal-chip ${dev.signals?.moodFlag?.burnoutFlag ? 'bad' : 'ok'}">😔 Mood: ${dev.signals?.moodFlag?.moodTrend || 'stable'}</span>
                        ${dev.signals?.spikeDetected ? '<span class="signal-chip bad">🔺 Contribution Spike</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderRiskBarChart(profiles) {
        const canvas = document.getElementById('risk-bar-chart');
        if (!canvas) return;
        if (riskChart) riskChart.destroy();

        const colors = profiles.map(d =>
            d.riskLevel === 'CRITICAL' ? '#ef4444'
                : d.riskLevel === 'HIGH' ? '#f97316'
                    : d.riskLevel === 'MODERATE' ? '#eab308'
                        : '#22c55e'
        );

        riskChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: profiles.map(d => d.name),
                datasets: [{
                    label: 'Burnout Risk Score',
                    data: profiles.map(d => d.riskScore),
                    backgroundColor: colors.map(c => c + '99'),
                    borderColor: colors,
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                scales: {
                    x: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    y: { ticks: { color: '#e2e8f0' }, grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderRebalancePlan(data) {
        const el = document.getElementById('rebalance-panel');
        if (!el) return;

        const { reassignments, rebalanceSummary, atRiskContributors } = data;

        if (!reassignments || reassignments.length === 0) {
            el.innerHTML = '<p class="ok-msg">✅ All workloads are within safe limits. No rebalancing needed.</p>';
            return;
        }

        el.innerHTML = `
            <div class="rebalance-summary">
                <span>🔀 <strong>${rebalanceSummary.totalMoved}</strong> ticket(s) moved</span>
                <span>From: <strong>${rebalanceSummary.fromDevs.join(', ')}</strong></span>
                <span>To: <strong>${rebalanceSummary.toDevs.join(', ')}</strong></span>
            </div>
            <div class="reassignment-list">
                ${reassignments.map(r => `
                    <div class="reassignment-row">
                        <div class="task-name">${r.taskName} <span class="points-chip">${r.points}pts</span></div>
                        <div class="transfer-arrow"><span class="from-dev">${r.from}</span> → <span class="to-dev">${r.to}</span></div>
                        <div class="reason">${r.reason}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderMockBurnout() {
        const mockProfiles = [
            { name: 'Alice', riskScore: 74, riskLevel: 'CRITICAL', atRisk: true, signals: { velocityDecay: { signal: 'SEVERE_DECAY', decayRate: 52 }, overload: { signal: 'OVERLOADED', capacityRatio: 1.4 }, moodFlag: { burnoutFlag: true, moodTrend: 'declining' }, spikeDetected: true } },
            { name: 'Charlie', riskScore: 58, riskLevel: 'HIGH', atRisk: true, signals: { velocityDecay: { signal: 'MILD_DECAY', decayRate: 22 }, overload: { signal: 'AT_CAPACITY', capacityRatio: 1.12 }, moodFlag: { burnoutFlag: false, moodTrend: 'stable' }, spikeDetected: false } },
            { name: 'Eve', riskScore: 32, riskLevel: 'MODERATE', atRisk: false, signals: { velocityDecay: { signal: 'STABLE', decayRate: 8 }, overload: { signal: 'HEALTHY', capacityRatio: 0.9 }, moodFlag: { burnoutFlag: false, moodTrend: 'improving' }, spikeDetected: false } },
            { name: 'Bob', riskScore: 12, riskLevel: 'LOW', atRisk: false, signals: { velocityDecay: { signal: 'ACCELERATING', decayRate: -18 }, overload: { signal: 'HEALTHY', capacityRatio: 0.7 }, moodFlag: { burnoutFlag: false, moodTrend: 'improving' }, spikeDetected: false } },
            { name: 'Dave', riskScore: 8, riskLevel: 'LOW', atRisk: false, signals: { velocityDecay: { signal: 'STABLE', decayRate: 2 }, overload: { signal: 'HEALTHY', capacityRatio: 0.65 }, moodFlag: { burnoutFlag: false, moodTrend: 'stable' }, spikeDetected: false } }
        ];
        const summary = { totalDevs: 5, atRiskCount: 2, criticalCount: 1, avgRiskScore: 36.8 };
        renderSummaryBanner(summary);
        renderRiskHeatmap(mockProfiles);
        renderAtRiskCards(mockProfiles);
        renderRiskBarChart(mockProfiles);
    }

    function renderMockRebalance() {
        renderRebalancePlan({
            reassignments: [
                { taskName: 'Refactor auth module', points: 13, from: 'alice', to: 'dave', reason: 'alice is at burnout risk (combinedRisk=71)' },
                { taskName: 'Fix API rate limiting', points: 8, from: 'alice', to: 'bob', reason: 'alice is at burnout risk (combinedRisk=71)' }
            ],
            rebalanceSummary: { totalMoved: 2, fromDevs: ['alice'], toDevs: ['dave', 'bob'] },
            atRiskContributors: []
        });
    }

    function setStatus(msg, type = 'ok') {
        const el = document.getElementById('scan-status');
        if (el) el.innerHTML = msg;
    }

    // ─── Event Handlers ──────────────────────────────────────────────────────
    const rebalanceBtn = document.getElementById('rebalance-btn');
    if (rebalanceBtn) rebalanceBtn.addEventListener('click', triggerRebalance);

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', init);
});
