/**
 * XAYTHEON — Impact Predictor Viz
 */

document.addEventListener('DOMContentLoaded', () => {
    let graph = { nodes: [], edges: [] };
    let linchpins = [];
    let canvas, ctx;
    let socket;
    let selectedNode = null;

    init();

    async function init() {
        initCanvas();
        initSocket();
        await fetchData();
        render();
    }

    function initCanvas() {
        canvas = document.getElementById('impact-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        resizeCanvas();
    }

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = 400;
        render();
    }

    function initSocket() {
        if (typeof io !== 'undefined') {
            socket = io();
            socket.emit('join_impact_monitor');

            socket.on('impact_calculated', (data) => {
                showToast('🚀 Global Impact Alert', `Change in ${data.source} affects ${data.impactedNodes.length} nodes.`, 'warning');
            });
        }
    }

    async function fetchData() {
        const [topo, pins] = await Promise.all([
            fetch('/api/graph/topology').then(r => r.json()),
            fetch('/api/graph/linchpins').then(r => r.json())
        ]);
        if (topo.success) graph = topo.graph;
        if (pins.success) linchpins = pins.linchpins;
        renderLinchpins();
    }

    async function runImpactAnalysis(nodeId) {
        selectedNode = nodeId;
        const res = await fetch('/api/graph/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodeId })
        });
        const json = await res.json();
        if (json.success) {
            renderAnalysis(json.analysis);
            if (socket) socket.emit('broadcast_impact', json.analysis);
            highlightImpact(json.analysis.impactedNodes);
        }
    }

    // ─── Renderers ───────────────────────────────────────────────────────────

    function render() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Simple force-ish layout or simple grid for demo
        const spacing = 120;
        graph.nodes.forEach((n, i) => {
            n.x = 100 + (i % 5) * spacing;
            n.y = 100 + Math.floor(i / 5) * spacing;
        });

        // Edges
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        graph.edges.forEach(e => {
            const from = graph.nodes.find(n => n.id === e.from);
            const to = graph.nodes.find(n => n.id === e.to);
            if (from && to) {
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
            }
        });

        // Nodes
        graph.nodes.forEach(n => {
            const isHighlight = n.highlighted;
            ctx.fillStyle = isHighlight ? '#f43f5e' : n.type === 'service' ? '#818cf8' : '#64748b';
            ctx.beginPath();
            ctx.arc(n.x, n.y, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#f8fafc';
            ctx.font = '10px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(n.id, n.x, n.y + 20);
        });
    }

    function highlightImpact(impactedIds) {
        graph.nodes.forEach(n => n.highlighted = impactedIds.includes(n.id) || n.id === selectedNode);
        render();
    }

    function renderLinchpins() {
        const el = document.getElementById('linchpins-list');
        if (!el) return;
        el.innerHTML = linchpins.map(p => `
            <div class="pin-row" onclick="analyze('${p.id}')">
                <span class="pin-id">${p.id}</span>
                <span class="pin-risk ${p.risk.toLowerCase()}">${p.risk}</span>
                <span class="pin-size">${p.impactSize} deps</span>
            </div>
        `).join('');
    }

    function renderAnalysis(a) {
        const el = document.getElementById('analysis-panel');
        if (!el) return;
        el.innerHTML = `
            <div class="analysis-card ${a.riskScore.toLowerCase()}">
                <h3>Blast Radius: ${a.impactedNodes.length} Downstreams</h3>
                <p>Affected: ${a.impactedNodes.join(', ') || 'None'}</p>
                <div class="est-work">Estimated Coverage Impact: <strong>${a.linesAffectedEstimated} units</strong></div>
                <div class="rec">Recommendation: <span>${a.recommendation}</span></div>
            </div>
        `;
    }

    function showToast(title, msg, type) {
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.innerHTML = `<strong>${title}</strong><p>${msg}</p>`;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('visible'), 100);
        setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 4000);
    }

    window.analyze = runImpactAnalysis;
});
