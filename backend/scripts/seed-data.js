#!/usr/bin/env node

/**
 * Xaytheon — Seed Script
 * Creates a demo user and populates sample data so new users
 * can see dashboards immediately after setup.
 *
 * Usage:
 *   node scripts/seed-data.js          (from backend/)
 *   npm run seed                       (if package.json script is set)
 *
 * Safe to run multiple times — existing data is skipped.
 */

const path = require("path");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();

// ─── Config ───────────────────────────────────────────
const DB_PATH = path.join(__dirname, "..", "users.db");
const DEMO_EMAIL = "demo@xaytheon.dev";
const DEMO_PASSWORD = "demo1234";
const DEMO_USERNAME = "xaytheon-demo";
const DEMO_GITHUB_USERNAME = "octocat";

// ─── Helpers ──────────────────────────────────────────
function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// ─── Sample Data ──────────────────────────────────────
const SAMPLE_REPOS = [
    {
        repo_full_name: "facebook/react",
        repo_data: {
            full_name: "facebook/react",
            description: "The library for web and native user interfaces.",
            stargazers_count: 225000,
            forks_count: 46000,
            open_issues_count: 890,
            language: "JavaScript",
            html_url: "https://github.com/facebook/react",
            owner: { avatar_url: "https://avatars.githubusercontent.com/u/69631?v=4" },
        },
    },
    {
        repo_full_name: "vercel/next.js",
        repo_data: {
            full_name: "vercel/next.js",
            description: "The React Framework",
            stargazers_count: 128000,
            forks_count: 27000,
            open_issues_count: 3200,
            language: "JavaScript",
            html_url: "https://github.com/vercel/next.js",
            owner: { avatar_url: "https://avatars.githubusercontent.com/u/14985020?v=4" },
        },
    },
    {
        repo_full_name: "denoland/deno",
        repo_data: {
            full_name: "denoland/deno",
            description: "A modern runtime for JavaScript and TypeScript.",
            stargazers_count: 97000,
            forks_count: 5400,
            open_issues_count: 1800,
            language: "Rust",
            html_url: "https://github.com/denoland/deno",
            owner: { avatar_url: "https://avatars.githubusercontent.com/u/42048915?v=4" },
        },
    },
    {
        repo_full_name: "tailwindlabs/tailwindcss",
        repo_data: {
            full_name: "tailwindlabs/tailwindcss",
            description: "A utility-first CSS framework for rapid UI development.",
            stargazers_count: 83000,
            forks_count: 4200,
            open_issues_count: 60,
            language: "CSS",
            html_url: "https://github.com/tailwindlabs/tailwindcss",
            owner: { avatar_url: "https://avatars.githubusercontent.com/u/67109815?v=4" },
        },
    },
    {
        repo_full_name: "microsoft/vscode",
        repo_data: {
            full_name: "microsoft/vscode",
            description: "Visual Studio Code",
            stargazers_count: 166000,
            forks_count: 30000,
            open_issues_count: 8400,
            language: "TypeScript",
            html_url: "https://github.com/microsoft/vscode",
            owner: { avatar_url: "https://avatars.githubusercontent.com/u/6154722?v=4" },
        },
    },
];

function buildAnalyticsSnapshots() {
    const snapshots = [];
    const now = Date.now();
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now - i * 86400000);
        snapshots.push({
            date: date.toISOString(),
            stars: 120 + Math.floor(Math.random() * 40) + (30 - i) * 2,
            followers: 45 + Math.floor(Math.random() * 10) + Math.floor((30 - i) / 3),
            following: 30 + Math.floor(Math.random() * 5),
            public_repos: 18 + Math.floor((30 - i) / 10),
            total_commits: 350 + Math.floor(Math.random() * 50) + (30 - i) * 3,
            language_stats: JSON.stringify({
                JavaScript: 45,
                TypeScript: 25,
                Python: 15,
                CSS: 10,
                HTML: 5,
            }),
            contribution_count: Math.floor(Math.random() * 12) + 1,
        });
    }
    return snapshots;
}

const SAMPLE_NOTIFICATIONS = [
    { type: "star", title: "New Star on facebook/react", message: "octocat starred facebook/react" },
    { type: "fork", title: "New Fork of vercel/next.js", message: "dev-guru forked vercel/next.js" },
    { type: "issue", title: "New Issue on denoland/deno", message: 'code-wizard opened issue #432: "Performance regression in v2"' },
    { type: "pr", title: "New PR on tailwindlabs/tailwindcss", message: 'react-fan opened PR #789: "Add dark mode tokens"' },
    { type: "push", title: "New Push to microsoft/vscode", message: "3 new commits pushed to main branch" },
];

const SAMPLE_ACHIEVEMENTS = [
    { key: "first_login", title: "Welcome Aboard", description: "Logged in for the first time", icon: "🎉", xp: 10 },
    { key: "first_watchlist", title: "Watcher", description: "Created your first watchlist", icon: "👁️", xp: 20 },
    { key: "five_repos", title: "Collector", description: "Added 5 repos to watchlists", icon: "📦", xp: 30 },
    { key: "streak_7", title: "Weekly Warrior", description: "7-day login streak", icon: "🔥", xp: 50 },
    { key: "star_hunter", title: "Star Hunter", description: "Tracked a repo with 100k+ stars", icon: "⭐", xp: 40 },
];

// ─── Main ─────────────────────────────────────────────
async function seed() {
    console.log("\n🌱 Xaytheon Seed Script");
    console.log("========================\n");

    const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error("❌ Cannot open database:", err.message);
            process.exit(1);
        }
    });

    try {
        // ── 1. Create all tables ──
        console.log("📦 Ensuring tables exist...");

        // Users table (from config/db.js)
        await run(db, `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT,
        github_id TEXT UNIQUE,
        username TEXT,
        avatar_url TEXT,
        refresh_token TEXT,
        view_history TEXT DEFAULT '[]',
        password_reset_token TEXT,
        password_reset_expires DATETIME,
        preferred_language TEXT DEFAULT 'en',
        preferences TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Watchlists
        await run(db, `
      CREATE TABLE IF NOT EXISTS watchlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        owner_id INTEGER NOT NULL,
        is_public BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

        await run(db, `
      CREATE TABLE IF NOT EXISTS watchlist_repositories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        watchlist_id INTEGER NOT NULL,
        repo_full_name TEXT NOT NULL,
        repo_data TEXT,
        added_by INTEGER NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
        FOREIGN KEY (added_by) REFERENCES users(id),
        UNIQUE(watchlist_id, repo_full_name)
      )
    `);

        // Notifications (actual DB schema: id, user_id, type, title, message, metadata, is_read, created_at)
        await run(db, `
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        metadata TEXT DEFAULT '{}',
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

        // Analytics snapshots
        await run(db, `
      CREATE TABLE IF NOT EXISTS analytics_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        github_username TEXT NOT NULL,
        stars INTEGER DEFAULT 0,
        followers INTEGER DEFAULT 0,
        following INTEGER DEFAULT 0,
        public_repos INTEGER DEFAULT 0,
        total_commits INTEGER DEFAULT 0,
        language_stats TEXT DEFAULT '{}',
        contribution_count INTEGER DEFAULT 0,
        snapshot_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

        // User achievements (actual DB schema: id, user_id, achievement_key, title, description, icon, xp, unlocked_at)
        await run(db, `
      CREATE TABLE IF NOT EXISTS user_achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        achievement_key TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        icon TEXT DEFAULT '🏆',
        xp INTEGER DEFAULT 0,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

        // User XP
        await run(db, `
      CREATE TABLE IF NOT EXISTS user_xp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        total_xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_activity_date DATE,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

        // Achievements definitions (for the gamification system)
        await run(db, `
      CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL,
        icon VARCHAR(50) DEFAULT '🏆',
        xp_reward INTEGER DEFAULT 10,
        tier VARCHAR(20) DEFAULT 'bronze',
        requirement_type VARCHAR(50) NOT NULL,
        requirement_value INTEGER NOT NULL,
        is_secret BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        console.log("   ↳ All tables verified.");

        // ── 2. Create demo user ──
        console.log("👤 Creating demo user...");
        const existing = await get(db, "SELECT id FROM users WHERE email = ?", [DEMO_EMAIL]);

        let userId;
        if (existing) {
            userId = existing.id;
            console.log(`   ↳ Demo user already exists (id=${userId}), skipping creation.`);
        } else {
            const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
            const result = await run(
                db,
                `INSERT INTO users (email, password, username, avatar_url)
         VALUES (?, ?, ?, ?)`,
                [DEMO_EMAIL, hash, DEMO_USERNAME, "https://avatars.githubusercontent.com/u/583231?v=4"]
            );
            userId = result.lastID;
            console.log(`   ↳ Created demo user (id=${userId}).`);
        }

        // ── 3. Create demo watchlist & repos ──
        console.log("📋 Creating demo watchlist...");
        let watchlistId;
        const existingWl = await get(db, "SELECT id FROM watchlists WHERE owner_id = ? AND name = ?", [userId, "Trending Repos"]);

        if (existingWl) {
            watchlistId = existingWl.id;
            console.log(`   ↳ Watchlist already exists (id=${watchlistId}), skipping.`);
        } else {
            const wlResult = await run(
                db,
                `INSERT INTO watchlists (name, owner_id, description, is_public)
         VALUES (?, ?, ?, ?)`,
                ["Trending Repos", userId, "Top trending open-source repositories", 1]
            );
            watchlistId = wlResult.lastID;
            console.log(`   ↳ Created watchlist "Trending Repos" (id=${watchlistId}).`);

            for (const repo of SAMPLE_REPOS) {
                await run(
                    db,
                    `INSERT OR IGNORE INTO watchlist_repositories (watchlist_id, repo_full_name, repo_data, added_by)
           VALUES (?, ?, ?, ?)`,
                    [watchlistId, repo.repo_full_name, JSON.stringify(repo.repo_data), userId]
                );
            }
            console.log(`   ↳ Added ${SAMPLE_REPOS.length} sample repositories.`);
        }

        // ── 4. Seed analytics snapshots (30 days) ──
        console.log("📊 Seeding analytics snapshots (30 days)...");
        const existingSnaps = await get(db, "SELECT COUNT(*) as count FROM analytics_snapshots WHERE user_id = ?", [userId]);
        if (existingSnaps && existingSnaps.count > 0) {
            console.log(`   ↳ Snapshots already exist (${existingSnaps.count}), skipping.`);
        } else {
            const snapshots = buildAnalyticsSnapshots();
            for (const s of snapshots) {
                await run(
                    db,
                    `INSERT INTO analytics_snapshots
           (user_id, github_username, stars, followers, following, public_repos, total_commits, language_stats, contribution_count, snapshot_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, DEMO_GITHUB_USERNAME, s.stars, s.followers, s.following, s.public_repos, s.total_commits, s.language_stats, s.contribution_count, s.date]
                );
            }
            console.log(`   ↳ Inserted ${snapshots.length} snapshots.`);
        }

        // ── 5. Seed notifications ──
        // Actual schema: (user_id, type, title, message, metadata, is_read)
        console.log("🔔 Seeding notifications...");
        const existingNotifs = await get(db, "SELECT COUNT(*) as count FROM notifications WHERE user_id = ?", [userId]);
        if (existingNotifs && existingNotifs.count > 0) {
            console.log(`   ↳ Notifications already exist (${existingNotifs.count}), skipping.`);
        } else {
            for (const n of SAMPLE_NOTIFICATIONS) {
                await run(
                    db,
                    `INSERT INTO notifications (user_id, type, title, message, metadata)
           VALUES (?, ?, ?, ?, ?)`,
                    [userId, n.type, n.title, n.message, JSON.stringify({})]
                );
            }
            console.log(`   ↳ Inserted ${SAMPLE_NOTIFICATIONS.length} notifications.`);
        }

        // ── 6. Seed achievements ──
        // Actual schema: (user_id, achievement_key, title, description, icon, xp)
        console.log("🏆 Seeding achievements...");
        const existingAch = await get(db, "SELECT COUNT(*) as count FROM user_achievements WHERE user_id = ?", [userId]);
        if (existingAch && existingAch.count > 0) {
            console.log(`   ↳ Achievements already exist (${existingAch.count}), skipping.`);
        } else {
            for (const a of SAMPLE_ACHIEVEMENTS) {
                await run(
                    db,
                    `INSERT INTO user_achievements (user_id, achievement_key, title, description, icon, xp)
           VALUES (?, ?, ?, ?, ?, ?)`,
                    [userId, a.key, a.title, a.description, a.icon, a.xp]
                );
            }
            console.log(`   ↳ Unlocked ${SAMPLE_ACHIEVEMENTS.length} achievements.`);
        }

        // ── 7. Seed XP ──
        console.log("⚡ Seeding XP...");
        const existingXp = await get(db, "SELECT id FROM user_xp WHERE user_id = ?", [userId]);
        if (existingXp) {
            console.log(`   ↳ XP record already exists, skipping.`);
        } else {
            await run(
                db,
                `INSERT INTO user_xp (user_id, total_xp, level, current_streak, longest_streak, last_activity_date)
         VALUES (?, ?, ?, ?, ?, date('now'))`,
                [userId, 150, 3, 7, 14]
            );
            console.log(`   ↳ Created XP record (150 XP, level 3).`);
        }

        // Done!
        console.log("\n✅ Seed complete!\n");
        console.log("┌─────────────────────────────────────────┐");
        console.log("│  Demo Account Credentials               │");
        console.log("├─────────────────────────────────────────┤");
        console.log("│  Email:    demo@xaytheon.dev            │");
        console.log("│  Password: demo1234                     │");
        console.log("└─────────────────────────────────────────┘\n");

    } catch (err) {
        console.error("❌ Seed failed:", err);
        process.exit(1);
    } finally {
        db.close();
    }
}

seed();
