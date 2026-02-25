const axios = require('axios');

class GithubService {
    constructor() {
        this.baseUrl = 'https://api.github.com';
        this.headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Xaytheon-Analytics-Worker'
        };
    }

    async fetchUserData(username) {
        try {
            const response = await axios.get(`${this.baseUrl}/users/${username}`, { headers: this.headers });
            return response.data;
        } catch (error) {
            console.error(`Error fetching user data for ${username}:`, error.message);
            throw error;
        }
    }

    async exchangeCodeForToken(code) {
        try {
            const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = process.env;
            const clientId = GITHUB_CLIENT_ID || "YOUR_GITHUB_CLIENT_ID";
            const clientSecret = GITHUB_CLIENT_SECRET || "YOUR_GITHUB_CLIENT_SECRET";

            const response = await axios.post(
                'https://github.com/login/oauth/access_token',
                {
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                },
                {
                    headers: { Accept: 'application/json' }
                }
            );
            return response.data;
        } catch (error) {
            console.error('Error exchanging code for token:', error.message);
            throw error;
        }
    }

    async fetchUserProfile(accessToken) {
        try {
            const response = await axios.get(`${this.baseUrl}/user`, {
                headers: {
                    ...this.headers,
                    Authorization: `token ${accessToken}`
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching user profile:', error.message);
            throw error;
        }
    }

    // UPDATED: Added pagination handling to fetch all repositories
    async fetchUserRepos(username) {
        try {
            let allRepos = [];
            let nextUrl = `${this.baseUrl}/users/${username}/repos?per_page=100&sort=updated`;

            while (nextUrl) {
                const response = await axios.get(nextUrl, { headers: this.headers });
                allRepos = allRepos.concat(response.data);

                // Handle Pagination via Link Header
                const linkHeader = response.headers.link;
                nextUrl = null;

                if (linkHeader) {
                    const links = linkHeader.split(',');
                    const nextLink = links.find(link => link.includes('rel="next"'));
                    if (nextLink) {
                        const match = nextLink.match(/<(.*)>/);
                        if (match) nextUrl = match[1];
                    }
                }
            }
            return allRepos;
        } catch (error) {
            console.error(`Error fetching all repos for ${username}:`, error.message);
            throw error;
        }
    }

    async getAnalyticsData(username) {
        const [user, repos] = await Promise.all([
            this.fetchUserData(username),
            this.fetchUserRepos(username)
        ]);

        const stars = repos.reduce((acc, repo) => acc + repo.stargazers_count, 0);
        const forkCount = repos.reduce((acc, repo) => acc + repo.forks_count, 0);

        const languages = {};
        repos.forEach(repo => {
            if (repo.language) {
                languages[repo.language] = (languages[repo.language] || 0) + 1;
            }
        });

        return {
            stars,
            followers: user.followers,
            following: user.following,
            publicRepos: user.public_repos,
            totalCommits: 0,
            languageStats: languages,
            contributionCount: 0 
        };
    }
}

module.exports = new GithubService();