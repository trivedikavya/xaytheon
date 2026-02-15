document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-btn');
    const repoInput = document.getElementById('repo-input');
    let isAnalyzing = false;

    analyzeBtn.addEventListener('click', runAnalysis);

    repoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            runAnalysis();
        }
    });

    async function runAnalysis() {
        // 1. VALIDATE INPUT
        const repo = repoInput.value.trim();
        if (!repo) {
            repoInput.focus();
            repoInput.classList.add('error');
            setTimeout(() => repoInput.classList.remove('error'), 1000);
            return;
        }

        // 2. PREVENT SPAM CLICKS
        if (isAnalyzing) return;
        isAnalyzing = true;
        analyzeBtn.disabled = true;

        // 3. LOADING STATE
        const originalHTML = analyzeBtn.innerHTML;
        analyzeBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Analyzing...';

        try {
            // 4. ENCODED API CALLS
            const encodedRepo = encodeURIComponent(repo);

            const res = await fetch(`/api/analyzer/analyze?repo=${encodedRepo}`);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            const data = await res.json();
            renderDashboard(data);

            const recsRes = await fetch(`/api/analyzer/recommendations?repo=${encodedRepo}`);
            if (!recsRes.ok) {
                throw new Error(`Recommendations failed: ${recsRes.status}`);
            }
            const recsData = await recsRes.json();
            renderRecs(recsData.recommendations);

            analyzeBtn.innerHTML = '<i class="ri-check-line"></i> Updated!';
            setTimeout(() => {
                analyzeBtn.innerHTML = originalHTML;
            }, 1500);

        } catch (error) {
            console.error('Analysis failed:', error);
            analyzeBtn.innerHTML = '<i class="ri-error-warning-line"></i> Failed';
            analyzeBtn.classList.add('error');

            alert(`Analysis failed: ${error.message}\n\nPlease check the repository name and try again.`);

            setTimeout(() => {
                analyzeBtn.innerHTML = originalHTML;
                analyzeBtn.classList.remove('error');
            }, 2000);
        } finally {
            isAnalyzing = false;
            analyzeBtn.disabled = false;
        }
    }

    function renderDashboard(data) {
        if (!data || typeof data !== 'object') {
            console.warn('Invalid dashboard data');
            return;
        }

        document.getElementById('total-files')?.textContent = data.totalFiles || 0;
        document.getElementById('avg-complexity')?.textContent = data.avgComplexity?.toFixed(2) || '0.00';
        document.getElementById('maintainability')?.textContent =
            data.avgMaintainability ? `${Math.round(data.avgMaintainability)}%` : '0%';
        document.getElementById('total-debt')?.textContent =
            data.totalDebt ? `${Math.round(data.totalDebt / 60)}h` : '0h';

        const heatmap = document.getElementById('debt-heatmap');
        if (heatmap) {
            heatmap.innerHTML = '';
            const files = Array.isArray(data.files) ? data.files : [];

            files.slice(0, 50).forEach(file => {
                const block = document.createElement('div');
                block.className = `heat-block heat-${(file.rating || 'low').toLowerCase()}`;
                block.title = `${file.path || 'Unknown'}\nComplexity: ${file.cyclomaticComplexity || 0}`;
                block.textContent = file.rating?.slice(0, 3).toUpperCase() || 'LOW';
                heatmap.appendChild(block);
            });
        }

        const tbody = document.getElementById('files-table-body');
        if (tbody) {
            tbody.innerHTML = '';
            const files = Array.isArray(data.files) ? data.files : [];

            files.slice(0, 100).forEach(file => {
                const tr = document.createElement('tr');

                const pathTd = document.createElement('td');
                pathTd.title = file.path || '';
                pathTd.textContent = truncate(file.path || '', 40);

                const linesTd = document.createElement('td');
                linesTd.textContent = file.lines || 0;

                const complexityTd = document.createElement('td');
                complexityTd.textContent = file.cyclomaticComplexity || 0;

                const ratingTd = document.createElement('td');
                const badge = document.createElement('span');
                badge.className = `rating-badge rating-${(file.rating || 'low').toLowerCase()}`;
                badge.textContent = file.rating || 'LOW';
                ratingTd.appendChild(badge);

                const debtTd = document.createElement('td');
                debtTd.textContent = `${Math.round((file.debtMinutes || 0) / 60)}h`;

                tr.append(pathTd, linesTd, complexityTd, ratingTd, debtTd);
                tbody.appendChild(tr);
            });
        }

        const trendChart = document.getElementById('trend-chart');
        if (trendChart && Array.isArray(data.trends) && data.trends.length) {
            trendChart.innerHTML = '';
            const maxDebt = Math.max(...data.trends.map(t => t.debtHours || 0));

            data.trends.slice(0, 12).forEach(trend => {
                const bar = document.createElement('div');
                bar.className = 'trend-bar';
                bar.style.height = maxDebt
                    ? `${Math.max((trend.debtHours || 0) / maxDebt * 100, 5)}%`
                    : '5%';

                const label = document.createElement('span');
                label.textContent = (trend.date || '').slice(5, 10);
                bar.appendChild(label);

                trendChart.appendChild(bar);
            });
        }
    }

    function renderRecs(recommendations) {
        const container = document.getElementById('ai-recs');
        if (!container) return;

        if (!Array.isArray(recommendations)) {
            container.textContent = 'No recommendations available.';
            return;
        }

        if (recommendations.length === 0) {
            container.textContent = 'No critical issues detected. 🎉';
            return;
        }

        container.innerHTML = '';

        recommendations.slice(0, 10).forEach(rec => {
            const item = document.createElement('div');
            item.className = 'rec-item';

            const header = document.createElement('div');
            header.className = 'rec-header';

            const fileEl = document.createElement('strong');
            fileEl.title = rec.file || '';
            fileEl.textContent = truncate(rec.file || '', 50);

            const priority = document.createElement('span');
            priority.className = 'rec-priority';
            priority.textContent = rec.priority || 'MEDIUM';

            header.append(fileEl, priority);

            const text = document.createElement('p');
            text.textContent = rec.suggestion || '';

            item.append(header, text);
            container.appendChild(item);
        });
    }

    function truncate(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.slice(0, maxLength - 3) + '...';
    }
});
