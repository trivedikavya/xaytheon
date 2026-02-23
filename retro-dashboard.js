/**
 * XAYTHEON - Retrospective & Velocity Calibration Dashboard
 * Issue #619: Adaptive Sprint Velocity Calibrator
 */

document.addEventListener('DOMContentLoaded', () => {
    // State
    let retroData = null;
    let capacityData = null;
    let calibrationData = null;
    let accuracyChart = null;
    let biasChart = null;

    init();

    async function init() {
        await Promise.all([loadRetrospective(), loadCapacityReport(), loadCalibrationReport()]);
    }

    // ─── Data Fetching ───────────────────────────────────────────────────────

    async function loadRetrospective() {
        try {
            const res = await fetch('/api/sprint/retrospective');
            const json = await res.json();
            if (json.success) {
                retroData = json.data;
                renderSprintHistoryChart(retroData.sprintHistory);
                renderFatigueBar(retroData.fatigueIndex);
                renderBiasChart(retroData.contributorBias);
                updateErrorRateBadge(retroData.rollingEstimationErrorRate);
            }
        } catch (err) {
            console.error('Retro API offline:', err);
        }
    }

    async function loadCapacityReport() {
        try {
            const res = await fetch('/api/sprint/capacity-report');
            const json = await res.json();
            if (json.success) {
                capacityData = json.data;
                renderCapacityTable(capacityData);
            }
        } catch (err) {
            console.error('Capacity API offline:', err);
        }
    }

    async function loadCalibrationReport() {
        try {
            const res = await fetch('/api/sprint/calibration-report');
            const json = await res.json();
            if (json.success) {
                calibrationData = json.data;
                renderCalibrationBadges(calibrationData);
            }
        } catch (err) {
            console.error('Calibration API offline:', err);
        }
    }

    // ─── Chart: Sprint History (Estimated vs Actual) ─────────────────────────

    function renderSprintHistoryChart(history) {
        const canvas = document.getElementById('accuracy-chart');
        if (!canvas) return;

        if (accuracyChart) accuracyChart.destroy();

        accuracyChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: history.map(s => s.sprint),
                datasets: [
                    {
                        label: 'Estimated Points',
                        data: history.map(s => s.estimated),
                        backgroundColor: 'rgba(99,102,241,0.5)',
                        borderColor: '#6366f1',
                        borderWidth: 1
                    },
                    {
                        label: 'Actual Points',
                        data: history.map(s => s.actual),
                        backgroundColor: 'rgba(16,185,129,0.5)',
                        borderColor: '#10b981',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { ticks: { color: '#94a3b8' } }
                },
                plugins: { legend: { labels: { color: '#fff' } } }
            }
        });
    }

    // ─── Chart: Contributor Bias ──────────────────────────────────────────────

    function renderBiasChart(biasData) {
        const canvas = document.getElementById('bias-chart');
        if (!canvas || !biasData || biasData.length === 0) return;

        if (biasChart) biasChart.destroy();

        biasChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: biasData.map(b => b.name),
                datasets: [{
                    label: 'Avg Points Bias (positive = under-estimated)',
                    data: biasData.map(b => b.avgBias),
                    backgroundColor: biasData.map(b =>
                        b.avgBias < 0 ? 'rgba(239,68,68,0.6)' : 'rgba(16,185,129,0.6)'
                    ),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'y',
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    y: { ticks: { color: '#94a3b8' } }
                },
                plugins: { legend: { labels: { color: '#fff' } } }
            }
        });
    }

    // ─── Fatigue Bar ──────────────────────────────────────────────────────────

    function renderFatigueBar(fatigue) {
        const fill = document.getElementById('fatigue-fill');
        const label = document.getElementById('fatigue-label');
        if (!fill || !fatigue) return;

        fill.style.width = fatigue.index + '%';
        fill.style.background = fatigue.status === 'CRITICAL' ? '#ef4444'
            : fatigue.status === 'WARNING' ? '#f59e0b' : '#10b981';

        if (label) label.textContent = `${fatigue.index}/100 — ${fatigue.status}: ${fatigue.recommendation}`;
    }

    // ─── Rolling Error Rate Badge ─────────────────────────────────────────────

    function updateErrorRateBadge(rate) {
        const badge = document.getElementById('error-rate-badge');
        if (!badge) return;
        badge.textContent = `${rate}% rolling 3-sprint error rate`;
        badge.className = `error-badge ${rate > 20 ? 'high' : rate > 10 ? 'mid' : 'low'}`;
    }

    // ─── Capacity Table ───────────────────────────────────────────────────────

    function renderCapacityTable(capacityArr) {
        const tbody = document.getElementById('capacity-tbody');
        if (!tbody || !capacityArr) return;

        tbody.innerHTML = capacityArr.map(dev => `
            <tr>
                <td>${dev.name || dev.id}</td>
                <td>${dev.rawVelocity}</td>
                <td>${dev.calibratedVelocity}</td>
                <td>${dev.ptoDays} days</td>
                <td>${(dev.contextSwitchPenalty * 100).toFixed(0)}%</td>
                <td class="eff">${dev.effectiveCapacity} pts</td>
            </tr>
        `).join('');
    }

    // ─── Calibration Badges ───────────────────────────────────────────────────

    function renderCalibrationBadges(calibData) {
        const container = document.getElementById('calibration-badges');
        if (!container || !calibData) return;

        if (calibData.length === 0) {
            container.innerHTML = '<p class="muted">No calibration data yet. Record sprint outcomes to begin.</p>';
            return;
        }

        container.innerHTML = calibData.map(c => `
            <div class="calib-badge ${c.status.toLowerCase()}">
                <span class="dev-name">${c.devId}</span>
                <span class="mult">&times;${c.calibrationMultiplier}</span>
                <span class="status-tag">${c.status}</span>
            </div>
        `).join('');
    }

    // ─── Calibrate Form Submit ────────────────────────────────────────────────

    const calibrateForm = document.getElementById('calibrate-form');
    if (calibrateForm) {
        calibrateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const devId = document.getElementById('calib-dev-id').value.trim();
            const estimated = parseFloat(document.getElementById('calib-estimated').value);
            const actual = parseFloat(document.getElementById('calib-actual').value);

            if (!devId || isNaN(estimated) || isNaN(actual)) {
                alert('Please fill all fields.');
                return;
            }

            try {
                const res = await fetch('/api/sprint/calibrate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ devId, estimated, actual })
                });
                const json = await res.json();
                if (json.success) {
                    alert(`Calibration updated for ${devId}. New multiplier: ×${json.data.multiplier}`);
                    await loadCalibrationReport();
                }
            } catch (err) {
                alert('Calibration request failed.');
            }
        });
    }

    // ─── PTO Form Submit ──────────────────────────────────────────────────────

    const ptoForm = document.getElementById('pto-form');
    if (ptoForm) {
        ptoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const devId = document.getElementById('pto-dev-id').value.trim();
            const ptoDays = parseFloat(document.getElementById('pto-days').value);

            try {
                const res = await fetch('/api/sprint/register-pto', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ devId, ptoDays })
                });
                const json = await res.json();
                if (json.success) {
                    alert(json.message);
                    await loadCapacityReport();
                }
            } catch (err) {
                alert('PTO registration failed.');
            }
        });
    }
});
