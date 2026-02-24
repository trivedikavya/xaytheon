/**
 * XAYTHEON — Governance Controller
 */

const govEngine = require('../services/governance-engine.service');
const orchestrator = require('../services/proposal-orchestrator.service');

class GovernanceController {
    /**
     * GET /api/gov/status
     */
    async getStatus(req, res) {
        try {
            res.json({
                success: true,
                teams: govEngine.allTeams(),
                proposals: orchestrator.getProposals()
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/gov/propose
     */
    async proposeSpend(req, res) {
        try {
            const { teamId, amount, purpose } = req.body;
            if (!teamId || !amount || !purpose) {
                return res.status(400).json({ success: false, message: 'Missing required fields' });
            }

            const evalRes = govEngine.evaluateSpend(teamId, amount);

            if (!evalRes.resolutionRequired) {
                // Auto-approved
                const team = govEngine.teams.find(t => t.id === teamId);
                team.spent += amount;
                return res.json({
                    success: true,
                    status: 'AUTO_APPROVED',
                    message: `Spend of $${amount} authorized under delegation.`
                });
            }

            const proposal = orchestrator.createProposal(req.userId || 'system', teamId, amount, purpose);
            res.json({
                success: true,
                status: 'RESOLUTION_REQUIRED',
                proposal
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/gov/vote
     */
    async castVote(req, res) {
        try {
            const { proposalId } = req.body;
            const userId = req.userId || 'mock_user_' + Math.floor(Math.random() * 100);

            const result = orchestrator.castVote(proposalId, userId);
            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * GET /api/gov/audit-trail
     */
    async getAuditTrail(req, res) {
        try {
            const proposals = orchestrator.getProposals();
            const log = proposals.filter(p => p.status !== 'PENDING').map(p => ({
                id: p.id,
                status: p.status,
                finalizedAt: p.executedAt || p.expiredAt,
                summary: `${p.teamId}: $${p.amount} for ${p.purpose}`
            }));
            res.json({ success: true, log });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new GovernanceController();
