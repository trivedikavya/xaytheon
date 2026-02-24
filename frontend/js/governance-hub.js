/**
 * XAYTHEON — Governance Hub
 */

document.addEventListener('DOMContentLoaded', () => {
    let teams = [];
    let proposals = [];
    let socket;

    init();

    async function init() {
        initSocket();
        await fetchData();
        render();

        // Refresh every 10s
        setInterval(fetchData, 10000);
    }

    function initSocket() {
        if (typeof io !== 'undefined') {
            socket = io();
            socket.emit('join_governance');

            socket.on('new_resolution', (prop) => {
                showToast('⚖️ New Resolution', `Team ${prop.teamId} requested $${prop.amount}`, 'info');
                fetchData();
            });

            socket.on('resolution_vote_update', (data) => {
                const p = proposals.find(pr => pr.id === data.proposalId);
                if (p) {
                    p.currentVotes = data.currentVotes;
                    renderProposals();
                }
            });
        }
    }

    async function fetchData() {
        try {
            const res = await fetch('/api/gov/status');
            const json = await res.json();
            if (json.success) {
                teams = json.teams;
                proposals = json.proposals;
                render();
            }
        } catch (err) {
            console.error("Gov API error:", err);
        }
    }

    async function submitProposal() {
        const teamId = document.getElementById('prop-team').value;
        const amount = parseFloat(document.getElementById('prop-amount').value);
        const purpose = document.getElementById('prop-purpose').value;

        if (!amount || !purpose) return showToast('⚠️ Invalid Proposal', 'Fill all fields', 'warning');

        try {
            const res = await fetch('/api/gov/propose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId, amount, purpose })
            });
            const json = await res.json();

            if (json.status === 'RESOLUTION_REQUIRED') {
                showToast('⚖️ Resolution Required', 'A multi-sig vote has been initiated.', 'warning');
                if (socket) socket.emit('proposal_created', json.proposal);
            } else {
                showToast('✅ Auto-Approved', 'Amount authorized under delegation.', 'success');
            }

            fetchData();
            // Clear form
            document.getElementById('prop-amount').value = '';
            document.getElementById('prop-purpose').value = '';
        } catch (err) {
            showToast('❌ Error', 'Could not submit proposal', 'error');
        }
    }

    async function castVote(proposalId) {
        try {
            const res = await fetch('/api/gov/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proposalId })
            });
            const json = await res.json();
            if (json.success) {
                showToast('🗳️ Vote Cast', 'Your cryptographic signature has been recorded.', 'success');
                if (socket) socket.emit('vote_cast', {
                    proposalId,
                    currentVotes: json.proposal.currentVotes,
                    totalNeeded: json.proposal.requiredVotes
                });
                fetchData();
            }
        } catch (err) {
            showToast('⚠️ Vote Failed', 'Maybe you already voted?', 'error');
        }
    }

    // ─── Renderers ───────────────────────────────────────────────────────────

    function render() {
        renderTeams();
        renderProposals();
    }

    function renderTeams() {
        const el = document.getElementById('team-grid');
        if (!el) return;
        el.innerHTML = teams.map(t => `
            <div class="team-card">
                <div class="team-header">
                    <h3>${t.name}</h3>
                    <span class="member-count">${t.vaultMembers} Signers</span>
                </div>
                <div class="budget-stat">
                    <span>Spent</span>
                    <strong>$${t.spent.toLocaleString()} / $${t.budget.toLocaleString()}</strong>
                </div>
                <div class="progress-container">
                    <div class="progress-fill" style="width: ${(t.spent / t.budget) * 100}%; background: ${getBudgetColor(t.spent / t.budget)}"></div>
                </div>
            </div>
        `).join('');
    }

    function renderProposals() {
        const el = document.getElementById('proposal-list');
        if (!el) return;
        if (proposals.length === 0) {
            el.innerHTML = '<div class="no-proposals">No active resolutions.</div>';
            return;
        }

        el.innerHTML = proposals.map(p => `
            <div class="proposal-card ${p.status.toLowerCase()}">
                <div class="prop-id">${p.id}</div>
                <div class="prop-info">
                    <h4>${p.purpose}</h4>
                    <p>${p.teamId.toUpperCase()} • $${p.amount} • Requested by ${p.requesterId}</p>
                </div>
                <div class="prop-votes">
                    <div class="vote-count">${p.currentVotes} / ${p.requiredVotes} ACKS</div>
                    <div class="vote-progress">
                        <div class="vote-fill" style="width: ${p.progress}%"></div>
                    </div>
                </div>
                <div class="prop-actions">
                    ${p.status === 'PENDING' ? `<button class="btn btn-vote" onclick="vote('${p.id}')">Vote Sign</button>` : `<span class="status-badge">${p.status}</span>`}
                </div>
            </div>
        `).join('');
    }

    function getBudgetColor(ratio) {
        if (ratio > 0.9) return '#ef4444';
        if (ratio > 0.7) return '#f59e0b';
        return '#6366f1';
    }

    function showToast(title, msg, type) {
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.innerHTML = `<strong>${title}</strong><p>${msg}</p>`;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('visible'), 100);
        setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 4000);
    }

    window.submitProp = submitProposal;
    window.vote = castVote;
});
