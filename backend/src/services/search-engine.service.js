/**
 * Search Engine Service
 * Handles natural language search and semantic filtering.
 */
const llmService = require('./llm.service');

class SearchEngineService {
    /**
     * Performs a semantic search based on natural language query.
     */
    async search(query, filters = {}) {
        // 1. Extract intent and entities using NLP/LLM
        const extraction = await this.parseNaturalLanguage(query);

        // 2. Combine extracted filters with manual filters
        const combinedFilters = {
            ...extraction.filters,
            ...filters
        };

        // 3. Perform mock search based on extracted criteria
        const results = this.getMockResults(extraction.intent, combinedFilters);

        return {
            query,
            parsedQuery: extraction,
            filters: combinedFilters,
            results,
            suggestions: this.getSearchSuggestions(query),
            stats: {
                totalCount: results.length,
                responseTime: '120ms'
            }
        };
    }

    async parseNaturalLanguage(query) {
        // In a real implementation, this would use an LLM or NLP library
        // For example: "Find React projects with good docs updated this month"
        const q = query.toLowerCase();
        const filters = {};

        if (q.includes('react')) filters.language = 'JavaScript';
        if (q.includes('python')) filters.language = 'Python';
        if (q.includes('updated this month')) filters.pushed = '>2026-01-01';
        if (q.includes('documentation') || q.includes('docs')) filters.topic = 'documentation';
        if (q.includes('stars')) {
            const starMatch = q.match(/(\d+)\s+stars/);
            if (starMatch) filters.stars = `>${starMatch[1]}`;
        }

        return {
            intent: "repository_search",
            filters,
            original: query
        };
    }

    getMockResults(intent, filters) {
        const allRepos = [
            { name: 'facebook/react', lang: 'JavaScript', stars: '210k', desc: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.' },
            { name: 'pallets/flask', lang: 'Python', stars: '65k', desc: 'The Python micro framework for building web applications.' },
            { name: 'microsoft/vscode', lang: 'TypeScript', stars: '155k', desc: 'Visual Studio Code' },
            { name: 'electron/electron', lang: 'JavaScript', stars: '110k', desc: 'Build cross-platform desktop apps with JavaScript, HTML, and CSS' },
            { name: 'tailwindlabs/tailwindcss', lang: 'CSS', stars: '75k', desc: 'A utility-first CSS framework for rapid UI development.' },
            { name: 'openai/whisper', lang: 'Python', stars: '45k', desc: 'Robust Speech Recognition via Large-Scale Weak Supervision' }
        ];

        return allRepos.filter(repo => {
            if (filters.language && repo.lang !== filters.language) return false;
            return true;
        });
    }

    getSearchSuggestions(query) {
        if (query.length < 3) return [];
        return [
            `${query} with documentation`,
            `popular ${query} repositories`,
            `${query} updated recently`
        ];
    }

    trackSearch(query, resultsCount) {
        console.log(`Search tracked: "${query}" - ${resultsCount} results found.`);
    }
}

module.exports = new SearchEngineService();
