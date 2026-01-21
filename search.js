/**
 * Smart Search Frontend Logic
 */
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const resultsArea = document.getElementById('search-results');
    const autocompletePanel = document.getElementById('autocomplete-results');
    const resultsCount = document.getElementById('results-count');
    const activeFiltersRow = document.getElementById('active-filters');

    // Filters
    const langFilter = document.getElementById('lang-filter');
    const starsFilter = document.getElementById('stars-filter');
    const applyFiltersBtn = document.getElementById('apply-filters');

    let currentFilters = {};

    // --- Autocomplete ---
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const q = searchInput.value.trim();

        if (q.length < 2) {
            autocompletePanel.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(q)}`);
                const data = await res.json();
                renderAutocomplete(data.suggestions);
            } catch (e) { console.error(e); }
        }, 300);
    });

    function renderAutocomplete(suggestions) {
        if (!suggestions || suggestions.length === 0) {
            autocompletePanel.classList.add('hidden');
            return;
        }

        autocompletePanel.innerHTML = suggestions
            .map(s => `<div class="autocomplete-item">${s}</div>`)
            .join('');
        autocompletePanel.classList.remove('hidden');

        // Click on suggestion
        document.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                searchInput.value = item.textContent;
                autocompletePanel.classList.add('hidden');
                performSearch();
            });
        });
    }

    // --- Search Logic ---
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    async function performSearch() {
        const q = searchInput.value.trim();
        if (!q) return;

        autocompletePanel.classList.add('hidden');
        resultsArea.innerHTML = '<div class="loader"></div>';

        try {
            const filterStr = JSON.stringify(currentFilters);
            const res = await fetch(`/api/search/smart?q=${encodeURIComponent(q)}&filters=${encodeURIComponent(filterStr)}`);
            const data = await res.json();

            if (data.success) {
                renderResults(data.data);
                renderActiveFilters(data.data.filters);
            }
        } catch (e) {
            console.error(e);
            resultsArea.innerHTML = '<p class="error">Something went wrong. Please try again.</p>';
        }
    }

    function renderResults(data) {
        resultsCount.textContent = `Found ${data.results.length} results in ${data.stats.responseTime}`;

        if (data.results.length === 0) {
            resultsArea.innerHTML = `
                <div class="empty-results">
                    <i class="ri-search-eye-line"></i>
                    <p>No repositories found for this query.</p>
                </div>`;
            return;
        }

        resultsArea.innerHTML = data.results.map(repo => `
            <div class="repo-card">
                <div class="repo-card-header">
                    <a href="#" class="repo-name">${repo.name}</a>
                    <div class="repo-stats">
                        <span><i class="ri-star-fill"></i> ${repo.stars}</span>
                        <span><i class="ri-git-branch-line"></i> ${repo.lang}</span>
                    </div>
                </div>
                <p class="repo-description">${repo.desc}</p>
                <div class="repo-tags">
                    <span class="lang-tag">${repo.lang}</span>
                    <span class="lang-tag">v2.4.0</span>
                </div>
            </div>
        `).join('');
    }

    function renderActiveFilters(filters) {
        activeFiltersRow.innerHTML = '';
        Object.entries(filters).forEach(([key, value]) => {
            const chip = document.createElement('div');
            chip.className = 'filter-chip';
            chip.innerHTML = `${key}: ${value} <i class="ri-close-line" data-key="${key}"></i>`;
            activeFiltersRow.appendChild(chip);
        });
    }

    // --- Hints ---
    document.querySelectorAll('.hint-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            searchInput.value = btn.textContent;
            performSearch();
        });
    });

    // --- Filters ---
    applyFiltersBtn.addEventListener('click', () => {
        currentFilters = {};
        if (langFilter.value) currentFilters.language = langFilter.value;
        if (starsFilter.value) currentFilters.minStars = starsFilter.value;
        performSearch();
    });

    // Close autocomplete on blur
    document.addEventListener('click', (e) => {
        if (!autocompletePanel.contains(e.target) && e.target !== searchInput) {
            autocompletePanel.classList.add('hidden');
        }
    });
});
