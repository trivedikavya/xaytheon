/**
 * Dependency Parser Service
 * Parses dependency files and generates a graph structure.
 */

class DependencyParserService {
    /**
     * Parses a package.json content and returns a graph structure.
     * @param {string} repoName 
     * @param {Object} packageJson 
     * @returns {Object} { nodes: [], links: [] }
     */
    parseNpmDependencies(repoName, packageJson) {
        const nodes = [];
        const links = [];

        // Root Node
        nodes.push({
            id: repoName,
            name: repoName,
            type: 'root',
            val: 20,
            color: '#10b981'
        });

        const dependencies = packageJson.dependencies || {};
        const devDependencies = packageJson.devDependencies || {};

        // Process Production Dependencies
        Object.entries(dependencies).forEach(([name, version]) => {
            nodes.push({
                id: name,
                name: name,
                version: version,
                type: 'dependency',
                val: 10,
                color: '#3b82f6'
            });
            links.push({
                source: repoName,
                target: name,
                type: 'production'
            });
        });

        // Process Dev Dependencies
        Object.entries(devDependencies).forEach(([name, version]) => {
            nodes.push({
                id: name,
                name: name,
                version: version,
                type: 'devDependency',
                val: 8,
                color: '#f59e0b'
            });
            links.push({
                source: repoName,
                target: name,
                type: 'dev'
            });
        });

        return { nodes, links };
    }

    /**
     * Mock fetching dependency data for a repository.
     */
    async getMockDependencies(repoName) {
        const mockPackageJson = {
            dependencies: {
                "express": "^4.18.2",
                "socket.io": "^4.7.2",
                "axios": "^1.6.0",
                "dotenv": "^16.3.1",
                "jsonwebtoken": "^9.0.2",
                "cors": "^2.8.5",
                "sentiment": "^5.0.2"
            },
            devDependencies: {
                "nodemon": "^3.0.1",
                "jest": "^29.7.0",
                "supertest": "^6.3.3"
            }
        };

        return this.parseNpmDependencies(repoName, mockPackageJson);
    }

    // ─── Issue #618: Version-Range Overlap Detection ──────────────────────

    /**
     * Parse a semver range string (e.g. "^4.18.2") into { major, minor, patch, operator }.
     * Handles: ^, ~, >=, <=, exact, *, x wildcards.
     */
    parseSemverRange(rangeStr) {
        if (!rangeStr || rangeStr === '*' || rangeStr === 'latest') {
            return { operator: 'any', major: null, minor: null, patch: null };
        }

        const op = rangeStr.match(/^(\^|~|>=|<=|>|<)/);
        const operator = op ? op[1] : 'exact';
        const version = rangeStr.replace(/^[\^~><= ]+/, '').trim();
        const parts = version.split('.').map(p => p === 'x' ? null : parseInt(p, 10));

        return {
            operator,
            major: parts[0] ?? null,
            minor: parts[1] ?? null,
            patch: parts[2] ?? null,
            raw: rangeStr
        };
    }

    /**
     * Checks if two semver range strings overlap — i.e., could they
     * both resolve to the same version and therefore share a vulnerable lib.
     * @param {string} rangeA  e.g. "^4.18.0"
     * @param {string} rangeB  e.g. "^4.17.0"
     * @returns {boolean}
     */
    doRangesOverlap(rangeA, rangeB) {
        const a = this.parseSemverRange(rangeA);
        const b = this.parseSemverRange(rangeB);

        // If either is 'any', they always overlap
        if (a.operator === 'any' || b.operator === 'any') return true;

        // Caret (^): compatible with major version
        if (a.operator === '^' && b.operator === '^') {
            return a.major === b.major;
        }

        // Tilde (~): compatible with minor version
        if (a.operator === '~' && b.operator === '~') {
            return a.major === b.major && a.minor === b.minor;
        }

        // Mix caret + tilde: overlap if majors match
        if ((a.operator === '^' && b.operator === '~') ||
            (a.operator === '~' && b.operator === '^')) {
            return a.major === b.major;
        }

        // Exact vs anything: check if exact falls in the other's range
        if (a.operator === 'exact') {
            return this._exactInRange(a, b);
        }
        if (b.operator === 'exact') {
            return this._exactInRange(b, a);
        }

        // Fallback: same major
        return a.major === b.major;
    }

    /**
     * Find all pairs of repos that share overlapping version ranges
     * for a given package name. Used to find which repos could all
     * be running the same vulnerable version.
     * @param {string} pkgName
     * @param {Array<{repoName, dependencies: Object}>} repoManifests
     * @returns {Array<{repoA, repoB, rangeA, rangeB, overlap}>}
     */
    findSharedLibraryMatches(pkgName, repoManifests) {
        const affected = repoManifests
            .filter(r => r.dependencies && r.dependencies[pkgName])
            .map(r => ({ repoName: r.repoName, range: r.dependencies[pkgName] }));

        const overlaps = [];
        for (let i = 0; i < affected.length; i++) {
            for (let j = i + 1; j < affected.length; j++) {
                const a = affected[i];
                const b = affected[j];
                const overlap = this.doRangesOverlap(a.range, b.range);
                overlaps.push({
                    repoA: a.repoName,
                    repoB: b.repoName,
                    rangeA: a.range,
                    rangeB: b.range,
                    overlap,
                    sharedVulnerabilityRisk: overlap ? 'CONFIRMED' : 'UNLIKELY'
                });
            }
        }

        return overlaps.filter(o => o.overlap);
    }

    _exactInRange(exact, range) {
        if (range.operator === '^') return exact.major === range.major;
        if (range.operator === '~') return exact.major === range.major && exact.minor === range.minor;
        return false;
    }
}

module.exports = new DependencyParserService();
