/**
 * XP Calculator Service
 * Calculates XP rewards and checks achievement unlock conditions
 */

const achievementsModel = require('../models/achievements.model');

// XP Rewards Configuration
const XP_CONFIG = {
    // Activity-based XP
    DAILY_LOGIN: 5,
    PROFILE_VIEW: 2,
    REPO_ADDED_TO_WATCHLIST: 10,
    ACHIEVEMENT_UNLOCK: 0, // XP comes from achievement itself

    // GitHub activity multipliers
    STAR_RECEIVED: 5,
    FOLLOWER_GAINED: 10,
    REPO_CREATED: 20,
    COMMIT_MADE: 1,

    // Streak bonuses
    STREAK_BONUS_MULTIPLIER: 0.1, // 10% bonus per streak day (max 100%)
    MAX_STREAK_BONUS: 1.0, // 100% max bonus
};

// Level thresholds (XP required for each level)
const calculateLevel = (totalXP) => {
    // Level = floor(sqrt(totalXP / 25)) + 1
    // This gives: Level 1 = 0-24 XP, Level 2 = 25-99 XP, Level 3 = 100-224 XP, etc.
    return Math.floor(Math.sqrt(totalXP / 25)) + 1;
};

const xpForNextLevel = (currentLevel) => {
    // XP needed for next level
    return Math.pow(currentLevel, 2) * 25;
};

/**
 * Check and unlock achievements based on user stats
 * @param {number} userId - User ID
 * @param {object} stats - User's GitHub stats { stars, repos, followers, commits, streak }
 * @returns {array} - List of newly unlocked achievements
 */
const checkAchievements = async (userId, stats) => {
    const unlockedAchievements = [];

    try {
        // Get all achievements
        const achievements = await achievementsModel.getAllAchievements(null, true);

        // Get user's current achievements
        const userAchievements = await achievementsModel.getUserAchievements(userId);
        const unlockedCodes = new Set(userAchievements.map(a => a.code));

        for (const achievement of achievements) {
            // Skip already unlocked
            if (unlockedCodes.has(achievement.code)) continue;

            // Check if requirement is met
            let currentValue = 0;

            switch (achievement.requirement_type) {
                case 'stars':
                    currentValue = stats.stars || 0;
                    break;
                case 'repos':
                    currentValue = stats.repos || 0;
                    break;
                case 'followers':
                    currentValue = stats.followers || 0;
                    break;
                case 'commits':
                    currentValue = stats.commits || 0;
                    break;
                case 'streak':
                    currentValue = stats.streak || 0;
                    break;
                case 'special':
                    // Special achievements are handled separately
                    continue;
            }

            // Check if requirement is met
            if (currentValue >= achievement.requirement_value) {
                // Unlock the achievement
                const result = await achievementsModel.unlockAchievement(userId, achievement.id);

                if (result.unlocked) {
                    // Award XP
                    await achievementsModel.addXP(
                        userId,
                        achievement.xp_reward,
                        'achievement',
                        `Unlocked: ${achievement.name}`
                    );

                    unlockedAchievements.push(achievement);
                }
            } else {
                // Update progress
                await achievementsModel.updateAchievementProgress(userId, achievement.id, currentValue);
            }
        }

        return unlockedAchievements;
    } catch (error) {
        console.error('Error checking achievements:', error);
        return [];
    }
};

/**
 * Award XP for an activity
 * @param {number} userId - User ID
 * @param {string} activity - Activity type
 * @param {object} context - Additional context
 */
const awardActivityXP = async (userId, activity, context = {}) => {
    let baseXP = 0;
    let description = '';

    switch (activity) {
        case 'daily_login':
            baseXP = XP_CONFIG.DAILY_LOGIN;
            description = 'Daily login bonus';
            break;
        case 'profile_view':
            baseXP = XP_CONFIG.PROFILE_VIEW;
            description = 'Profile viewed';
            break;
        case 'watchlist_add':
            baseXP = XP_CONFIG.REPO_ADDED_TO_WATCHLIST;
            description = `Added ${context.repoName || 'repo'} to watchlist`;
            break;
        case 'star_received':
            baseXP = XP_CONFIG.STAR_RECEIVED * (context.count || 1);
            description = `Received ${context.count || 1} new star(s)`;
            break;
        case 'follower_gained':
            baseXP = XP_CONFIG.FOLLOWER_GAINED * (context.count || 1);
            description = `Gained ${context.count || 1} new follower(s)`;
            break;
        default:
            return null;
    }

    // Apply streak bonus
    const userXP = await achievementsModel.getUserXP(userId);
    const streakBonus = Math.min(
        (userXP.current_streak || 0) * XP_CONFIG.STREAK_BONUS_MULTIPLIER,
        XP_CONFIG.MAX_STREAK_BONUS
    );

    const finalXP = Math.floor(baseXP * (1 + streakBonus));

    // Award XP
    const result = await achievementsModel.addXP(userId, finalXP, activity, description);

    // Update streak
    await achievementsModel.updateStreak(userId);

    return {
        xp_awarded: finalXP,
        base_xp: baseXP,
        streak_bonus: Math.floor(baseXP * streakBonus),
        new_total: result.total_xp,
        new_level: result.level
    };
};

/**
 * Get user's gamification summary
 */
const getUserGamificationSummary = async (userId) => {
    const [xpData, achievements, stats, rank] = await Promise.all([
        achievementsModel.getUserXP(userId),
        achievementsModel.getUserAchievements(userId),
        achievementsModel.getAchievementStats(userId),
        achievementsModel.getUserRank(userId)
    ]);

    const currentLevel = calculateLevel(xpData.total_xp || 0);
    const xpForCurrent = Math.pow(currentLevel - 1, 2) * 25;
    const xpForNext = xpForNextLevel(currentLevel);
    const progressPercent = ((xpData.total_xp - xpForCurrent) / (xpForNext - xpForCurrent)) * 100;

    return {
        xp: {
            total: xpData.total_xp || 0,
            level: currentLevel,
            xp_for_next_level: xpForNext,
            progress_percent: Math.min(100, Math.max(0, progressPercent))
        },
        streak: {
            current: xpData.current_streak || 0,
            longest: xpData.longest_streak || 0
        },
        achievements: {
            unlocked: stats.unlocked_achievements || 0,
            total: stats.total_achievements || 0,
            recent: achievements.slice(0, 5)
        },
        rank
    };
};

/**
 * Sprint Velocity Estimation Accuracy Scoring (Issue #619)
 * Scores how accurately a contributor estimated their sprint output.
 * @param {number} estimated - story points committed
 * @param {number} actual    - story points delivered
 * @returns {Object} estimation score and pattern tag
 */
const scoreEstimationAccuracy = (estimated, actual) => {
    if (!estimated || estimated === 0) return { score: 0, pattern: 'NO_DATA', xpPenalty: 0 };

    const ratio = actual / estimated;
    const errorPct = Math.abs(actual - estimated) / estimated * 100;

    let pattern = 'ACCURATE';
    let xpPenalty = 0;

    if (ratio < 0.7) {
        pattern = 'SEVERE_OVER_ESTIMATE';  // Committed way more than delivered
        xpPenalty = 15;
    } else if (ratio < 0.9) {
        pattern = 'MILD_OVER_ESTIMATE';
        xpPenalty = 5;
    } else if (ratio > 1.3) {
        pattern = 'SEVERE_UNDER_ESTIMATE'; // Delivered way more than committed
        xpPenalty = 0;                     // This is fine — under-promising
    } else if (ratio > 1.1) {
        pattern = 'MILD_UNDER_ESTIMATE';
        xpPenalty = 0;
    }

    // Score from 0-100 where 100 = perfect estimation
    const score = Math.max(0, Math.round(100 - errorPct * 1.5));

    return { score, pattern, xpPenalty, ratio: parseFloat(ratio.toFixed(3)) };
};

/**
 * Compute a contributor's historical estimation pattern
 * across multiple sprints.
 * @param {Array<{estimated, actual}>} history
 */
const computeEstimationPatternHistory = (history) => {
    if (!history || history.length === 0) return { trend: 'UNKNOWN', avgAccuracy: 0 };

    const scored = history.map(h => scoreEstimationAccuracy(h.estimated, h.actual));
    const avgScore = scored.reduce((a, b) => a + b.score, 0) / scored.length;
    const overCount = scored.filter(s => s.pattern.includes('OVER')).length;
    const underCount = scored.filter(s => s.pattern.includes('UNDER')).length;

    let trend = 'STABLE';
    if (overCount > history.length * 0.6) trend = 'CHRONICALLY_OVER_ESTIMATING';
    else if (underCount > history.length * 0.6) trend = 'CHRONICALLY_UNDER_ESTIMATING';

    return {
        trend,
        avgAccuracy: parseFloat(avgScore.toFixed(1)),
        sprintsAnalyzed: history.length,
        lastPattern: scored[scored.length - 1]?.pattern || 'UNKNOWN'
    };
};

module.exports = {
    XP_CONFIG,
    calculateLevel,
    xpForNextLevel,
    checkAchievements,
    awardActivityXP,
    getUserGamificationSummary,
    scoreEstimationAccuracy,
    computeEstimationPatternHistory
};
