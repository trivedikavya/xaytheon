/**
 * XAYTHEON — Governance Engine Service
 * Implements spending bylaws, team-based budget caps, and quorum logic.
 */

class GovernanceEngineService {
    constructor() {
        this.teams = [
            { id: 'infra', name: 'Platform Infra', budget: 15000, spent: 4200, vaultMembers: 5 },
            { id: 'sec-ops', name: 'Security Ops', budget: 8000, spent: 1200, vaultMembers: 3 },
            { id: 'ai-rnd', name: 'AI Research', budget: 25000, spent: 18500, vaultMembers: 7 }
        ];

        // Bylaws defining limits that trigger a resolution
        this.bylaws = [
            { id: 'BL_001', type: 'threshold', amount: 1000, context: 'all', quorum: 0.60, description: 'Any spend over $1,000 requires 60% majority' },
            { id: 'BL_002', type: 'percentage', amount: 0.15, context: 'team', quorum: 0.75, description: 'Spend > 15% of team budget requires 75% majority' },
            { id: 'BL_003', type: 'critical', amount: 0, context: 'any', quorum: 1.00, description: 'Budget overrides require 100% quorum' }
        ];
    }

    /**
     * Check if a proposed spend requires a governance resolution.
     */
    evaluateSpend(teamId, amount) {
        const team = this.teams.find(t => t.id === teamId);
        if (!team) return { resolutionRequired: false, error: 'Team not found' };

        const results = [];

        // Check threshhold bylaw
        if (amount > 1000) {
            results.push(this.bylaws.find(b => b.id === 'BL_001'));
        }

        // Check percentage bylaw
        const perc = amount / team.budget;
        if (perc > 0.15) {
            results.push(this.bylaws.find(b => b.id === 'BL_002'));
        }

        // Check budget overflow
        if (team.spent + amount > team.budget) {
            results.push(this.bylaws.find(b => b.id === 'BL_003'));
        }

        if (results.length > 0) {
            // Pick the strictest quorum requirement
            const strictest = results.reduce((prev, curr) => (curr.quorum > prev.quorum ? curr : prev));
            return {
                resolutionRequired: true,
                requiredQuorum: strictlyDefinedQuorum(strictest.quorum, team.vaultMembers),
                percentageNeeded: strictest.quorum * 100,
                triggeredBylaws: results.map(r => r.id)
            };
        }

        return { resolutionRequired: false, message: 'Within delegated authority' };
    }

    getTeamStatus(teamId) {
        return this.teams.find(t => t.id === teamId);
    }

    allTeams() {
        return this.teams;
    }
}

function strictlyDefinedQuorum(ratio, totalMembers) {
    return Math.ceil(totalMembers * ratio);
}

module.exports = new GovernanceEngineService();
