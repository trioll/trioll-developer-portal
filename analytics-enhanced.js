// Enhanced Analytics Module for Trioll Developer Portal
// Includes device/platform tracking and real-time data fetching

const AnalyticsEnhanced = {
    // Cache for analytics data
    cache: {
        games: [],
        interactions: {},
        lastFetch: null,
        cacheDuration: 5 * 60 * 1000 // 5 minutes
    },

    // Fetch interaction data for a specific game
    async fetchGameInteractions(gameId, token) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-App-Client': 'developer-portal'
        };

        const interactions = {
            plays: [],
            likes: [],
            ratings: [],
            comments: []
        };

        try {
            // Fetch plays with platform info
            const playsResponse = await fetch(`${AWS_CONFIG.apiEndpoint}/games/${gameId}/plays`, {
                headers: headers
            });
            if (playsResponse.ok) {
                const playsData = await playsResponse.json();
                interactions.plays = playsData.plays || [];
            }

            // Fetch likes
            const likesResponse = await fetch(`${AWS_CONFIG.apiEndpoint}/games/${gameId}/likes`, {
                headers: headers
            });
            if (likesResponse.ok) {
                const likesData = await likesResponse.json();
                interactions.likes = likesData.likes || [];
            }

            // Fetch ratings
            const ratingsResponse = await fetch(`${AWS_CONFIG.apiEndpoint}/games/${gameId}/ratings`, {
                headers: headers
            });
            if (ratingsResponse.ok) {
                const ratingsData = await ratingsResponse.json();
                interactions.ratings = ratingsData.ratings || [];
            }

            // Fetch comments
            const commentsResponse = await fetch(`${AWS_CONFIG.apiEndpoint}/games/${gameId}/comments`, {
                headers: headers
            });
            if (commentsResponse.ok) {
                const commentsData = await commentsResponse.json();
                interactions.comments = commentsData.comments || [];
            }
        } catch (error) {
            console.error(`Error fetching interactions for game ${gameId}:`, error);
        }

        return interactions;
    },

    // Process platform data from plays
    processPlatformData(plays) {
        const platformCounts = {
            mobile: 0,
            pc: 0,
            tablet: 0,
            unknown: 0
        };

        plays.forEach(play => {
            const platform = play.platform || play.deviceType || 'unknown';
            if (platform.toLowerCase().includes('mobile') || platform.toLowerCase().includes('android') || platform.toLowerCase().includes('ios')) {
                platformCounts.mobile++;
            } else if (platform.toLowerCase().includes('pc') || platform.toLowerCase().includes('desktop') || platform.toLowerCase().includes('web')) {
                platformCounts.pc++;
            } else if (platform.toLowerCase().includes('tablet') || platform.toLowerCase().includes('ipad')) {
                platformCounts.tablet++;
            } else {
                platformCounts.unknown++;
            }
        });

        return platformCounts;
    },

    // Enhanced load analytics data function
    async loadAnalyticsDataEnhanced() {
        const token = validateAndGetToken();
        if (!token) {
            return { success: false, error: 'No authentication token' };
        }

        try {
            // Check cache first
            if (this.cache.lastFetch && Date.now() - this.cache.lastFetch < this.cache.cacheDuration) {
                return { success: true, data: this.cache };
            }

            // Show loading state
            this.showLoadingState();

            // Fetch developer's games
            const response = await fetch(`${AWS_CONFIG.apiEndpoint}/developers/games`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-App-Client': 'developer-portal'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load games: ${response.status}`);
            }

            const data = await response.json();
            const games = data.games || [];

            // Fetch interaction data for each game
            const gamesWithAnalytics = [];
            for (const game of games) {
                const gameId = game.id || game.gameId;
                const interactions = await this.fetchGameInteractions(gameId, token);
                
                // Process platform data
                const platformData = this.processPlatformData(interactions.plays);
                
                // Calculate metrics
                const gameAnalytics = {
                    ...game,
                    playCount: interactions.plays.length,
                    likeCount: interactions.likes.length,
                    commentCount: interactions.comments.length,
                    rating: this.calculateAverageRating(interactions.ratings),
                    ratingCount: interactions.ratings.length,
                    platformBreakdown: platformData,
                    lastUpdated: new Date().toISOString()
                };

                gamesWithAnalytics.push(gameAnalytics);
                this.cache.interactions[gameId] = interactions;
            }

            // Update cache
            this.cache.games = gamesWithAnalytics;
            this.cache.lastFetch = Date.now();

            return { success: true, data: { games: gamesWithAnalytics } };
        } catch (error) {
            console.error('Error loading enhanced analytics:', error);
            return { success: false, error: error.message };
        }
    },

    // Calculate average rating
    calculateAverageRating(ratings) {
        if (!ratings || ratings.length === 0) return 0;
        const sum = ratings.reduce((acc, r) => acc + (r.rating || 0), 0);
        return (sum / ratings.length).toFixed(1);
    },

    // Display analytics table with platform data
    displayAnalyticsTableWithPlatforms(games) {
        if (!games || games.length === 0) {
            return `
                <div style="text-align: center; padding: 3rem; color: var(--text-gray-400);">
                    <h3 style="color: var(--text-gray-200);">No games found</h3>
                    <p>Upload games to see analytics data</p>
                </div>
            `;
        }

        const tableRows = games.map(game => {
            const platforms = game.platformBreakdown || {};
            const totalPlays = game.playCount || 0;

            return `
                <tr>
                    <td style="padding: 1rem;">
                        <div style="font-weight: 600;">${game.name || game.title}</div>
                        <div style="font-size: 0.75rem; color: var(--text-gray-500);">${game.category || 'Uncategorized'}</div>
                    </td>
                    <td style="text-align: center; padding: 1rem;">
                        <div style="font-weight: 600;">${totalPlays}</div>
                        <div style="font-size: 0.75rem; color: var(--text-gray-500);">
                            ${platforms.mobile > 0 ? `📱 ${platforms.mobile}` : ''}
                            ${platforms.pc > 0 ? `💻 ${platforms.pc}` : ''}
                            ${platforms.tablet > 0 ? `📋 ${platforms.tablet}` : ''}
                        </div>
                    </td>
                    <td style="text-align: center; padding: 1rem;">${game.likeCount || 0}</td>
                    <td style="text-align: center; padding: 1rem;">
                        ${game.rating > 0 ? `⭐ ${game.rating}` : 'N/A'}
                        ${game.ratingCount > 0 ? `<br><span style="font-size: 0.75rem; color: var(--text-gray-500);">(${game.ratingCount})</span>` : ''}
                    </td>
                    <td style="text-align: center; padding: 1rem;">${game.commentCount || 0}</td>
                    <td style="text-align: center; padding: 1rem;">
                        <div style="display: flex; gap: 0.5rem; justify-content: center;">
                            ${platforms.mobile > 0 ? '<span title="Mobile plays">📱</span>' : ''}
                            ${platforms.pc > 0 ? '<span title="PC/Web plays">💻</span>' : ''}
                            ${platforms.tablet > 0 ? '<span title="Tablet plays">📋</span>' : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--border-gray);">
                        <th style="text-align: left; padding: 1rem; font-weight: 600;">Game</th>
                        <th style="text-align: center; padding: 1rem; font-weight: 600;">Plays</th>
                        <th style="text-align: center; padding: 1rem; font-weight: 600;">Likes</th>
                        <th style="text-align: center; padding: 1rem; font-weight: 600;">Rating</th>
                        <th style="text-align: center; padding: 1rem; font-weight: 600;">Comments</th>
                        <th style="text-align: center; padding: 1rem; font-weight: 600;">Devices</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;
    },

    // Show loading state
    showLoadingState() {
        const container = document.getElementById('analyticsTableContainer');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-gray-400);">
                    <div class="spinner"></div>
                    <p>Loading analytics data...</p>
                    <p style="font-size: 0.875rem; margin-top: 0.5rem;">Fetching device and platform information...</p>
                </div>
            `;
        }
    },

    // Initialize enhanced analytics
    async init() {
        const result = await this.loadAnalyticsDataEnhanced();
        
        if (result.success) {
            const container = document.getElementById('analyticsTableContainer');
            if (container) {
                container.innerHTML = this.displayAnalyticsTableWithPlatforms(result.data.games);
            }

            // Update summary stats
            this.updateSummaryStats(result.data.games);
        } else {
            this.showError(result.error);
        }
    },

    // Update summary statistics
    updateSummaryStats(games) {
        const stats = {
            totalGames: games.length,
            totalPlays: games.reduce((sum, g) => sum + (g.playCount || 0), 0),
            totalLikes: games.reduce((sum, g) => sum + (g.likeCount || 0), 0),
            totalComments: games.reduce((sum, g) => sum + (g.commentCount || 0), 0),
            avgRating: 0
        };

        // Calculate average rating
        const ratedGames = games.filter(g => g.ratingCount > 0);
        if (ratedGames.length > 0) {
            const totalRating = ratedGames.reduce((sum, g) => sum + (parseFloat(g.rating) * g.ratingCount), 0);
            const totalRatings = ratedGames.reduce((sum, g) => sum + g.ratingCount, 0);
            stats.avgRating = (totalRating / totalRatings).toFixed(1);
        }

        // Update UI elements
        const elements = {
            'totalGamesAnalytics': stats.totalGames,
            'totalPlaysAnalytics': stats.totalPlays,
            'totalLikesAnalytics': stats.totalLikes,
            'avgRatingAnalytics': stats.avgRating || 'N/A',
            'totalCommentsAnalytics': stats.totalComments
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    },

    // Show error message
    showError(error) {
        const container = document.getElementById('analyticsTableContainer');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--accent-red);">
                    <p>Unable to load analytics data</p>
                    <p style="font-size: 0.875rem; margin-top: 0.5rem;">${error}</p>
                    <button class="btn btn-primary" onclick="AnalyticsEnhanced.init()" style="margin-top: 1rem;">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
};

// Export for use in main file
window.AnalyticsEnhanced = AnalyticsEnhanced;