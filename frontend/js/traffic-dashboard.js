/**
 * XAYTHEON — Service Mesh & Traffic Orchestration Hall
 * Issue: Autonomous service health monitoring and traffic rerouting.
 */

document.addEventListener('DOMContentLoaded', () => {
    let meshData = [];
    let orchestrations = [];
    let canvas, ctx;
    let socket;

    // Consts for rendering
    const NODE_RADIUS = 50;
    const padding = 100;

    init();

    async function init() {
        initCanvas();
        initSocket();
        await fetchMesh();
        render();

        // Auto-refresh every 5s
        setInterval(async () => {
            await fetchMesh();
            render();
        }, 5000);
    }

    function initCanvas() {
        canvas = document.getElementById('mesh-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = 500;
        render();
    }

    function initSocket() {
        if (typeof io !== 'undefined') {
            socket = io();
            socket.emit('join_mesh_monitor');

            socket.on('node_health_changed', (data) => {
                showToast(`Node Update: ${data.id}`, `Status shifted to ${data.status}`, 'info');
                fetchMesh();
            });

            socket.on('mesh_critical_incident', (data) => {
                showToast(`🚨 CRITICAL: ${data.consumer} is suffering`, `Cascading from ${data.bottleneck}`, 'error');
                fetchMesh();
            });
        }
    }

    async function fetchMesh() {
        try {
            const res = await fetch('/api/traffic/mesh');
            const json = await res.json();
            if (json.success) {
                meshData = json.data.nodes;
                renderStatusTable(meshData);
                renderLinchpins(json.data.linchpins);
                renderCascading(json.data.cascadingFailures);
            }
        } catch (err) {
            console.error("API error:", err);
            meshData = getMockData();
            renderStatusTable(meshData);
        }
    }

    async function triggerReroute(nodeId) {
        try {
            const res = await fetch('/api/traffic/reroute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodeId })
            });
            const json = await res.json();
            if (json.success) {
                showToast('🚀 Orchestration Applied', `Traffic shifted away from ${nodeId}. Upstreams affected: ${json.data.affectedUpstreams.join(', ')}`, 'success');
                orchestrations.unshift({
                    timestamp: new Date(),
                    node: nodeId,
                    summary: `Moved ${json.data.reassignments[0].weightShift} units to healthy nodes.`
                });
                renderOrchestrations();
                fetchMesh();
            }
        } catch (err) {
            showToast('⚠️ Failover Error', 'Could not complete rerout request.', 'error');
        }
    }

    async function injectFailure(nodeId, severity = 'high') {
        const res = await fetch('/api/traffic/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodeId, severity })
        });
        const json = await res.json();
        if (json.success) {
            showToast('💥 Failure Injected', `${nodeId} is now under simulated stress`, 'warning');
            fetchMesh();
        }
    }

    // ─── Renderers ───────────────────────────────────────────────────────────

    function render() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Simple ring layout for nodes
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - padding;

        meshData.forEach((node, i) => {
            const angle = (i / meshData.length) * Math.PI * 2;
            node.x = centerX + Math.cos(angle) * radius;
            node.y = centerY + Math.sin(angle) * radius;

            // Draw link to next (just for visual mesh feel)
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            ctx.moveTo(node.x, node.y);
            const nextNode = meshData[(i + 1) % meshData.length];
            const nextAngle = ((i + 1) / meshData.length) * Math.PI * 2;
            const nx = centerX + Math.cos(nextAngle) * radius;
            const ny = centerY + Math.sin(nextAngle) * radius;
            ctx.lineTo(nx, ny);
            ctx.stroke();

            // Draw Node
            const color = node.healthScore > 80 ? '#22c55e' : node.healthScore > 50 ? '#f59e0b' : '#ef4444';

            // Glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = color;

            ctx.beginPath();
            ctx.arc(node.x, node.y, 40, 0, Math.PI * 2);
            ctx.fillStyle = '#0f172a';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Health Meter Ring
            ctx.beginPath();
            ctx.arc(node.x, node.y, 35, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * (node.healthScore / 100)));
            ctx.strokeStyle = color;
            ctx.lineWidth = 6;
            ctx.stroke();

            // Label
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 11px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(node.id.toUpperCase(), node.x, node.y + 5);

            ctx.fillStyle = color;
            ctx.font = '10px JetBrains Mono';
            ctx.fillText(`${node.healthScore}%`, node.x, node.y + 20);
        });
    }

    function renderStatusTable(nodes) {
        const el = document.getElementById('mesh-status-body');
        if (!el) return;
        el.innerHTML = nodes.map(n => `
            <tr>
                <td class="mono">${n.id}</td>
                <td>
                    <div class="health-bar-wrap">
                        <div class="health-bar-fill" style="width: ${n.healthScore}%; background: ${getHealthColor(n.healthScore)}"></div>
                    </div>
                </td>
                <td>${n.latency}ms</td>
                <td>${((n.load / n.capacity) * 100).toFixed(1)}%</td>
                <td>
                    <button class="btn-action" onclick="reroute('${n.id}')">🔀</button>
                    <button class="btn-action btn-danger" onclick="simulate('${n.id}')">💥</button>
                </td>
            </tr>
        `).join('');
    }

    function renderLinchpins(pins) {
        const el = document.getElementById('linchpins-list');
        if (!el) return;
        el.innerHTML = pins.slice(0, 3).map(p => `
            <div class="linchpin-item">
                <div class="pin-header">
                    <span class="pin-id">${p.id}</span>
                    <span class="pin-radius">Blast Radius: ${p.radiusSize}</span>
                </div>
                <div class="pin-impact">${p.impacted.join(' → ')}</div>
            </div>
        `).join('');
    }

    function renderCascading(failures) {
        const el = document.getElementById('cascading-panel');
        if (!el) return;
        if (failures.length === 0) {
            el.innerHTML = '<div class="no-incidents">✓ All dependency flows nominal</div>';
            return;
        }
        el.innerHTML = failures.map(f => `
            <div class="incident-alert ${f.severity.toLowerCase()}">
                <strong>${f.severity} IMPACT</strong>
                <p>${f.consumer} is spiking due to degradation in upstream <span>${f.bottleneck}</span></p>
            </div>
        `).join('');
    }

    function renderOrchestrations() {
        const el = document.getElementById('orchestration-log');
        if (!el) return;
        el.innerHTML = orchestrations.map(o => `
            <div class="log-entry">
                <span class="log-time">${o.timestamp.toLocaleTimeString()}</span>
                <span class="log-node">${o.node}</span>
                <p>${o.summary}</p>
            </div>
        `).join('');
    }

    function getHealthColor(score) {
        return score > 80 ? '#22c55e' : score > 50 ? '#f59e0b' : '#ef4444';
    }

    function showToast(title, msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<strong>${title}</strong><p>${msg}</p>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('visible'), 100);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    function getMockData() {
        return [
            { id: 'auth-svc', healthScore: 92, latency: 12, load: 450, capacity: 1000 },
            { id: 'api-gtw', healthScore: 88, latency: 24, load: 1200, capacity: 5000 },
            { id: 'pay-svc', healthScore: 42, latency: 450, load: 80, capacity: 500 }
        ];
    }

    // Bind globally for onclick
    window.reroute = triggerReroute;
    window.simulate = injectFailure;
});
