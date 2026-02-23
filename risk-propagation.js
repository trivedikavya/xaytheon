/**
 * XAYTHEON — Risk Propagation Dashboard
 * Issue #618: Cross-Repo Dependency Risk Propagation Engine
 */

document.addEventListener('DOMContentLoaded', () => {
    let propagationData = null;
    let blastData = null;
    let heatChart = null;

    init();

    async function init() {
        await runPropagationScan('lodash', 8.2);
    }

    // ─── API: Run Propagation Map ─────────────────────────────────────────────

    async function runPropagationScan(pkg, cvss) {
        setStatus(`Scanning propagation for <strong>${pkg}</strong> (CVSS ${cvss})...`);
        try {
            const res = await fetch('/api/diff/propagation-map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vulnerablePackage: pkg, cvssScore: cvss })
            });
            const json = await res.json();
            if (json.success) {
                propagationData = json.data;
                renderSummaryBanner(propagationData.propagationMap);
                renderHeatmap(propagationData.heatmap);
                renderChainTable(propagationData.scoredChain);
                renderSharedMatches(propagationData.sharedVersionMatches);
                setStatus(`✅ Scan complete — ${propagationData.propagationMap.totalAffectedRepos} repos affected.`);
            }
        } catch (err) {
            setStatus('⚠️ Propagation API offline — showing mock data.');
            renderMockData();
        }
    }

    async function runBlastRadius(pkg) {
        try {
            const res = await fetch('/api/diff/blast-radius', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vulnerablePackage: pkg })
            });
            const json = await res.json();
            if (json.success) {
                blastData = json.data;
                renderBlastTier(blastData);
            }
        } catch (err) {
            console.error('Blast radius API error:', err);
        }
    }

    // ─── Renderers ────────────────────────────────────────────────────────────

    function renderSummaryBanner(map) {
        const el = document.getElementById('summary-banner');
        if (!el) return;
        const sevClass = map.overallSeverity.toLowerCase();
        el.innerHTML = `
            <div class="banner-card ${sevClass}">
                <span class="pkg-name">📦 ${map.vulnerablePackage}</span>
                <span class="sev-badge">${map.overallSeverity}</span>
            </div>
            <div class="banner-stats">
                <div class="stat"><span class="label">CVSS Base</span><span class="val">${map.cvssBase}</span></div>
                <div class="stat"><span class="label">Repos Affected</span><span class="val">${map.totalAffectedRepos}</span></div>
                <div class="stat"><span class="label">Direct</span><span class="val">${map.directlyAffected.length}</span></div>
                <div class="stat"><span class="label">Transitive</span><span class="val">${map.transitivelyAffected.length}</span></div>
                <div class="stat"><span class="label">Max Impact</span><span class="val">${map.maxImpact}</span></div>
            </div>
        `;
    }

    function renderHeatmap(heatmap) {
        const canvas = document.getElementById('heatmap-chart');
        if (!canvas || !heatmap) return;
        if (heatChart) heatChart.destroy();

        heatChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: heatmap.nodes.map(n => n.label),
                datasets: [{
                    label: 'Propagation Weight',
                    data: heatmap.nodes.map(n => n.weight),
                    backgroundColor: heatmap.nodes.map(n => n.color + 'cc'),
                    borderColor: heatmap.nodes.map(n => n.color),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'y',
                scales: {
                    x: { beginAtZero: true, max: 10, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    y: { ticks: { color: '#94a3b8' } }
                },
                plugins: { legend: { labels: { color: '#fff' } } }
            }
        });
    }

    function renderChainTable(chain) {
        const tbody = document.getElementById('chain-tbody');
        if (!tbody || !chain) return;
        tbody.innerHTML = chain.map((n, i) => `
            <tr>
                <td>${i + 1}</td>
                <td class="repo-name">${n.repo}</td>
                <td>${n.exposedVia}</td>
                <td>${n.depth}</td>
                <td>${n.propagationWeight}</td>
                <td><span class="sev-chip ${n.propagationSeverity.toLowerCase()}">${n.propagationSeverity}</span></td>
                <td>${n.propagationPriority}</td>
            </tr>
        `).join('');
    }

    function renderSharedMatches(matches) {
        const container = document.getElementById('shared-matches');
        if (!container) return;
        if (!matches || matches.length === 0) {
            container.innerHTML = '<p class="muted">No overlapping version ranges detected.</p>';
            return;
        }
        container.innerHTML = matches.map(m => `
            <div class="match-card">
                <span class="repo">${m.repoA}</span>
                <span class="connector">↔</span>
                <span class="repo">${m.repoB}</span>
                <span class="ranges">${m.rangeA} / ${m.rangeB}</span>
                <span class="risk confirmed">SHARED RISK CONFIRMED</span>
            </div>
        `).join('');
    }

    function renderBlastTier(blast) {
        const el = document.getElementById('blast-tier');
        if (!el) return;
        const tier = blast.topBlastTier;
        el.innerHTML = `
            <div class="blast-tier-card ${tier.toLowerCase()}">
                <h3>💥 Blast Tier: ${tier}</h3>
                <p>${blast.criticalPathCount} critical exploit path(s) identified</p>
            </div>
        `;
    }

    function renderMockData() {
        document.getElementById('summary-banner').innerHTML = `
            <div class="banner-card critical">
                <span class="pkg-name">📦 lodash</span>
                <span class="sev-badge">CRITICAL</span>
            </div>
            <div class="banner-stats">
                <div class="stat"><span class="label">CVSS Base</span><span class="val">8.2</span></div>
                <div class="stat"><span class="label">Repos Affected</span><span class="val">4</span></div>
            </div>
        `;
    }

    function setStatus(msg) {
        const el = document.getElementById('scan-status');
        if (el) el.innerHTML = msg;
    }

    // ─── Scan Form ────────────────────────────────────────────────────────────

    const scanForm = document.getElementById('scan-form');
    if (scanForm) {
        scanForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pkg = document.getElementById('pkg-input').value.trim();
            const cvss = parseFloat(document.getElementById('cvss-input').value);
            if (!pkg || isNaN(cvss)) return;
            await runPropagationScan(pkg, cvss);
            await runBlastRadius(pkg);
        });
    }
});
