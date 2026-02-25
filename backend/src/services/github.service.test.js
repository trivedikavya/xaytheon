const githubService = require('../../src/services/github.service');
const axios = require('axios');

jest.mock('axios');

describe('GithubService Pagination Test', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('fetchUserRepos should aggregate repositories from multiple pages', async () => {
        const username = 'senior-dev';

        // Mock Page 1 Response
        const page1Response = {
            data: [{ id: 1, name: 'repo1' }, { id: 2, name: 'repo2' }],
            headers: {
                link: '<https://api.github.com/users/senior-dev/repos?page=2&per_page=100>; rel="next"'
            }
        };

        // Mock Page 2 Response (Final)
        const page2Response = {
            data: [{ id: 3, name: 'repo3' }],
            headers: {}
        };

        axios.get
            .mockResolvedValueOnce(page1Response)
            .mockResolvedValueOnce(page2Response);

        const repos = await githubService.fetchUserRepos(username);

        expect(repos).toHaveLength(3);
        expect(repos[0].name).toBe('repo1');
        expect(repos[2].name).toBe('repo3');
        expect(axios.get).toHaveBeenCalledTimes(2);
    });
});