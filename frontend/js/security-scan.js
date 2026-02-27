/**
 * XAYTHEON — Security Radar Frontend
 */

document.addEventListener('DOMContentLoaded', () => {
    let findings = [];
    let scanHistory = [];
    let socket;

    const MOCK_FILES = [
        { name: 'auth.controller.js', content: 'const user = req.body.user;\n db.query(`SELECT * FROM users WHERE name = "${user}"`);' },
        { name: 'dashboard.js', content: 'const bio = req.query.bio;\n document.getElementById("bio").innerHTML = bio;' },
        { name: 'secrets.py', content: 'api_key = "AKIA_MOCK_1234567890ABCDEF"' }
    ];

    init();

    async function init() {
        initSocket();
        await fetchHistory();
        renderHistory();
    }

    function initSocket() {
        if (typeof io !== 'undefined') {
            socket = io();
            socket.emit('join_security_radar');

            socket.on('vuln_alert', (data) => {
                showToast(`🛡️ Threat Detected`, `${data.type} found in ${data.file}`, 'error');
                fetchHistory();
            });

            socket.on('patch_alert', (data) => {
                showToast(`🔧 Patch Ready`, `Predictive patch available for ${data.id}`, 'info');
            });
        }
    }

    async function runScan() {
        const btn = document.getElementById('btn-scan');
        btn.disabled = true;
        btn.textContent = 'Scanning...';

        try {
            const res = await fetch('/api/security/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: MOCK_FILES })
            });
            const json = await res.json();
            if (json.success) {
                findings = json.findings;
                renderFindings();
                showToast('🚀 Scan Complete', `Found ${findings.length} potential vulnerabilities.`, 'warning');
                if (socket) {
                    findings.forEach(f => socket.emit('security_threat_detected', f));
                }
            }
        } catch (err) {
            showToast('❌ Scan Failed', 'Service unavailable', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Initiate Deep Scan';
        }
    }

    async function fetchHistory() {
        const res = await fetch('/api/security/history');
        const json = await res.json();
        if (json.success) scanHistory = json.history;
    }

    async function applyPatch(scanId, findingId) {
        const res = await fetch('/api/security/apply-patch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scanId, findingId })
        });
        const json = await res.json();
        if (json.success) {
            showToast('✅ Patch Applied', 'Proposing security fix via automated PR...', 'success');
        }
    }

    // ─── Renderers ───────────────────────────────────────────────────────────

    function renderFindings() {
        const el = document.getElementById('findings-list');
        if (!el) return;
        if (findings.length === 0) {
            el.innerHTML = '<div class="no-findings">✓ No critical taints detected.</div>';
            return;
        }

        el.innerHTML = findings.map(f => `
            <div class="finding-card ${f.severity.toLowerCase()}">
                <div class="finding-header">
                    <span class="severity-pill">${f.severity}</span>
                    <span class="file-path">${f.file}:${f.sinkLine}</span>
                </div>
                <h3>${f.type.replace('_', ' ')}</h3>
                <p>${f.description}</p>
                ${f.patch ? `
                <div class="patch-box">
                    <strong>Predictive Patch Proposal:</strong>
                    <pre><code>${f.patch.diff}</code></pre>
                    <button class="btn btn-patch" onclick="patch('LATEST','${f.id}')">Apply Self-Healing Patch</button>
                </div>` : ''}
            </div>
        `).join('');
    }

    function renderHistory() {
        const el = document.getElementById('scan-history-tbody');
        if (!el) return;
        el.innerHTML = scanHistory.map(h => `
            <tr>
                <td class="mono small">${h.id}</td>
                <td>${h.findings.length} findings</td>
                <td><span class="status-pill ok">${h.status}</span></td>
                <td class="muted">${new Date(h.timestamp).toLocaleTimeString()}</td>
            </tr>
        `).join('') || '<tr><td colspan="4" class="muted">No recent scans.</td></tr>';
    }

    function showToast(title, msg, type) {
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.innerHTML = `<strong>${title}</strong><p>${msg}</p>`;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('visible'), 100);
        setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 4000);
    }

    window.scan = runScan;
    window.patch = applyPatch;
});
