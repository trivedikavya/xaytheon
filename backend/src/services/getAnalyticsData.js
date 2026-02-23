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

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data.viewer.contributionsCollection;
}

async getAnalyticsData(accessToken) {
  try {
    // Fetch basic user data via REST API (existing logic — keep yours)
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const userData = await userResponse.json();

    // Fetch repos via REST API (existing logic — keep yours)
    const reposResponse = await fetch('https://api.github.com/user/repos?per_page=100', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const reposData = await reposResponse.json();

    // ✅ NEW: Fetch real contribution data via GraphQL
    const contributionData = await this.fetchContributionData(accessToken);

    const totalCommits = contributionData.totalCommitContributions;
    const contributionCount = contributionData.contributionCalendar.totalContributions;

    return {
      // ... your existing fields ...
      totalCommits,        // ✅ Now real data, not 0
      contributionCount,   // ✅ Now real data, not 0
      totalStars: Array.isArray(reposData)
        ? reposData.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0)
        : 0,
      totalRepos: userData.public_repos || 0,
      followers: userData.followers || 0,
      following: userData.following || 0,
    };
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    throw error;
    totalCommits: 0, // Requires more complex fetching
    contributionCount: 0 // Requires GraphQL or scraping
  }
}   
const { data } = await axios.post(
  'https://api.github.com/graphql',
  { query },
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
return data.data.viewer.contributionsCollection;

const { data } = await axios.post(
  'https://api.github.com/graphql',
  { query },
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
return data.data.viewer.contributionsCollection;