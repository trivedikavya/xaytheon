/**
 * XAYTHEON - Sentiment Analysis Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-btn');
    const exportBtn = document.getElementById('export-pdf');
    const repoInput = document.getElementById('repo-input');
    const resultsArea = document.getElementById('dashboard-content');
    const loadingArea = document.getElementById('loading-state');

    // Stats Elements
    const avgSentimentEl = document.getElementById('avg-sentiment');
    const sentimentLabelEl = document.getElementById('sentiment-label');
    const posRatioEl = document.getElementById('pos-ratio');
    const negRatioEl = document.getElementById('neg-ratio');

    let chartInstance = null;
    let analysisData = null;
    let currentRepo = null;

    analyzeBtn.addEventListener('click', handleAnalyze);
    exportBtn.addEventListener('click', handleExport);

    // Initial Load
    handleAnalyze();

    async function handleAnalyze() {
        currentRepo = repoInput.value.trim() || 'xaytheon/core';

        showLoading(true);
        try {
            const response = await fetch(
                `/api/sentiment/analyze?repo=${currentRepo}`
            );
            if (!response.ok) throw new Error('Analysis failed');

          analysisData = await response.json();
window.analysisData = analysisData; // 👈 add this line

            renderDashboard(analysisData);
        } catch (error) {
            console.error(error);
            alert('Failed to analyze repository. Please check the spelling.');
        } finally {
            showLoading(false);
        }
    }

    async function renderDashboard(data) {
        resultsArea.classList.remove('hidden');
        exportBtn.disabled = false;

        /* 1. Overview Cards */
        const avg = parseFloat(data.overview.averageSentiment);
        avgSentimentEl.textContent = avg > 0 ? `+${avg}` : avg;

        if (avg >= 2) {
            sentimentLabelEl.textContent = 'Very Positive 🚀';
            sentimentLabelEl.className = 'val-label positive';
        } else if (avg > 0) {
            sentimentLabelEl.textContent = 'Generally Positive 🙂';
            sentimentLabelEl.className = 'val-label positive';
        } else if (avg > -1) {
            sentimentLabelEl.textContent = 'Neutral 😐';
            sentimentLabelEl.className = 'val-label neutral';
        } else {
            sentimentLabelEl.textContent = 'Negative 😠';
            sentimentLabelEl.className = 'val-label negative';
        }

        posRatioEl.textContent = `${data.overview.positiveRatio}%`;
        negRatioEl.textContent = `${data.overview.negativeRatio}%`;

        /* 2. Timeline Chart */
        renderChart(data.timeline);

        /* 3. Heated Discussions */
        renderHeatedDiscussions(data.heatedDiscussions);

        /* 4. Contributors (WITH CONSISTENCY SCORE) */
        const enrichedContributors = data.topContributors.map(c => {
            // Simple, explainable consistency heuristic:
            // - More sustained participation → higher score
            // - One-time bursts → penalty

            const baseScore = Math.min(100, c.totalComments * 5);
            const burstPenalty = c.totalComments > 30 ? 0.7 : 1;

            return {
                ...c,
                consistencyScore: Math.round(baseScore * burstPenalty),
            };
        });

        renderContributors(enrichedContributors);
    }

    function renderChart(timeline) {
        const ctx = document.getElementById('sentimentChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeline.map(t => t.date),
                datasets: [{
                    label: 'Sentiment Score',
                    data: timeline.map(t => t.sentiment),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderHeatedDiscussions(items) {
        const container = document.getElementById('heated-list');
        container.innerHTML = '';

        if (items.length === 0) {
            container.innerHTML =
                '<li class="empty-state">No significantly negative discussions found.</li>';
            return;
        }

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'heated-item';
            li.innerHTML = `
                <div class="heated-header">
                    <span class="bad-score">${item.score}</span>
                    <span class="heated-date">${item.date}</span>
                </div>
                <div class="heated-title">${item.title}</div>
                <div class="heated-author">by @${item.author}</div>
            `;
            container.appendChild(li);
        });
    }

    function renderContributors(contributors) {
        const container = document.getElementById('contributors-table');
        container.innerHTML = '';

        contributors.forEach((c, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${idx + 1}</td>
                <td>
                    <div class="contributor-cell">
                        <img src="${c.avatar}" class="c-avatar"/>
                        <span>${c.user}</span>
                        <span
                          class="consistency-badge"
                          title="Measures how regularly a contributor participates over time"
                        >
                          Consistency: ${c.consistencyScore}
                        </span>
                    </div>
                </td>
                <td style="color:#10b981;font-weight:bold;">
                    ${c.averageScore}
                </td>
                <td class="text-right">
                    ${c.totalComments}
                </td>
            `;
            container.appendChild(tr);
        });
    }

    function showLoading(show) {
        if (show) {
            loadingArea.classList.remove('hidden');
            resultsArea.classList.add('hidden');
            analyzeBtn.disabled = true;
        } else {
            loadingArea.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    }

    async function handleExport() {
        const element = document.getElementById('capture-area');
        try {
            exportBtn.innerHTML = 'Generating...';
            const canvas = await html2canvas(element, { scale: 2 });
            const link = document.createElement('a');
            link.download = `sentiment-report-${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();
            exportBtn.innerHTML = 'Export Report';
        } catch (e) {
            console.error(e);
            alert('Export failed');
            exportBtn.innerHTML = 'Export Report';
        }
    }
});
