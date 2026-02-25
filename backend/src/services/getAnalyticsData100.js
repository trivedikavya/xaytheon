const axios = require('axios');

class AnalyticsService {
    async fetchContributionData(accessToken) {
        const query = `
          query {
            viewer {
              contributionsCollection {
                totalCommitContributions
                totalPullRequestContributions
                totalIssueContributions
                totalRepositoryContributions
                contributionCalendar {
                  totalContributions
                  weeks {
                    contributionDays {
                      contributionCount
                      date
                    }
                  }
                }
              }
            }
          }
        `;

        try {
            const { data } = await axios.post(
                'https://api.github.com/graphql',
                { query },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            return data.data.viewer.contributionsCollection;
        } catch (error) {
            console.error('GitHub GraphQL API error:', error.message);
            throw error;
        }
    }

    async getAnalyticsData(accessToken) {
        try {
            // Fetch basic user data
            const userResponse = await axios.get('https://api.github.com/user', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const userData = userResponse.data;

            // UPDATED: Fetch all repos using pagination
            let reposData = [];
            let nextUrl = 'https://api.github.com/user/repos?per_page=100';

            while (nextUrl) {
                const response = await axios.get(nextUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                reposData = reposData.concat(response.data);

                const linkHeader = response.headers.link;
                nextUrl = null;
                if (linkHeader) {
                    const nextLink = linkHeader.split(',').find(l => l.includes('rel="next"'));
                    if (nextLink) {
                        const match = nextLink.match(/<(.*)>/);
                        if (match) nextUrl = match[1];
                    }
                }
            }

            const contributionData = await this.fetchContributionData(accessToken);
            const totalCommits = contributionData.totalCommitContributions;
            const contributionCount = contributionData.contributionCalendar.totalContributions;

            return {
                totalCommits,
                contributionCount,
                totalStars: reposData.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0),
                totalRepos: userData.public_repos || 0,
                followers: userData.followers || 0,
                following: userData.following || 0,
            };
        } catch (error) {
            console.error('Error fetching analytics data:', error.message);
            throw error;
        }
    }
}

module.exports = new AnalyticsService();