/**
 * XAYTHEON — Proposal Orchestrator Service
 * Manages the lifecycle of multi-sig governance resolutions.
 */

const govEngine = require('./governance-engine.service');

class ProposalOrchestratorService {
    constructor() {
        this.proposals = new Map(); // id -> proposal object
        this.counter = 1;
    }

    /**
     * Create a new spending resolution
     */
    createProposal(requesterId, teamId, amount, purpose) {
        const evaluation = govEngine.evaluateSpend(teamId, amount);

        const id = `RES_${String(this.counter++).padStart(4, '0')}`;
        const proposal = {
            id,
            teamId,
            requesterId,
            amount,
            purpose,
            status: 'PENDING',
            requiredVotes: evaluation.requiredQuorum || 0,
            currentVotes: 0,
            voters: new Set(),
            createdAt: Date.now(),
            expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24hr expiration
            bylawsTriggered: evaluation.triggeredBylaws || []
        };

        this.proposals.set(id, proposal);
        return proposal;
    }

    /**
     * Cast a vote
     */
    castVote(proposalId, userId) {
        const prop = this.proposals.get(proposalId);
        if (!prop) return { success: false, error: 'Proposal not found' };
        if (prop.status !== 'PENDING') return { success: false, error: 'Voting closed' };
        if (prop.voters.has(userId)) return { success: false, error: 'Already voted' };

        prop.voters.add(userId);
        prop.currentVotes++;

        if (prop.currentVotes >= prop.requiredVotes) {
            this.executeResolution(proposalId);
        }

        return {
            success: true,
            proposal: this.formatProposal(prop)
        };
    }

    /**
     * Execute approved resolution
     */
    executeResolution(proposalId) {
        const prop = this.proposals.get(proposalId);
        prop.status = 'APPROVED';
        prop.executedAt = Date.now();

        // Update team budget in engine
        const team = govEngine.teams.find(t => t.id === prop.teamId);
        if (team) {
            team.spent += prop.amount;
        }

        console.log(`⚖️ RESOLUTION EXECUTED: ${proposalId} - $${prop.amount} for ${prop.purpose}`);
    }

    getProposals() {
        return Array.from(this.proposals.values()).map(p => this.formatProposal(p));
    }

    formatProposal(p) {
        return {
            ...p,
            voters: Array.from(p.voters),
            progress: (p.currentVotes / p.requiredVotes) * 100
        };
    }
}

module.exports = new ProposalOrchestratorService();
