// Developer Portal Authentication Service
class AuthService {
    constructor() {
        this.apiEndpoint = 'https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod';
        this.clientId = '5joogquqr4jgukp7mncgp3g23h'; // Developer portal client ID
        
        // Check both localStorage (remember me) and sessionStorage
        this.token = localStorage.getItem('developerToken') || sessionStorage.getItem('developerToken');
        this.refreshToken = localStorage.getItem('developerRefreshToken') || sessionStorage.getItem('developerRefreshToken');
        
        // Developer info is always stored in localStorage
        this.developerInfo = JSON.parse(localStorage.getItem('developerInfo') || '{}');
        this.tokenRefreshInterval = null;
        
        this.init();
    }

    init() {
        // Check if token exists and is valid
        if (this.token) {
            console.log('Token found on init, loading developer profile...');
            this.startTokenRefreshTimer();
            this.loadDeveloperProfile().then(() => {
                console.log('Developer profile loaded on init:', this.developerInfo);
                // Update UI after profile loads
                if (this.developerInfo && this.developerInfo.developerId) {
                    this.updateDeveloperBadge();
                    this.populateUploadForm();
                    this.updateDashboardInfo();
                }
            });
        }
    }

    // Register new developer account
    async signup(email, password, companyName) {
        try {
            const response = await fetch(`${this.apiEndpoint}/developers/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-App-Client': 'developer-portal'
                },
                body: JSON.stringify({
                    email,
                    password,
                    companyName
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            // Store developer ID temporarily for verification
            sessionStorage.setItem('pendingDeveloperId', data.developerId);
            sessionStorage.setItem('pendingEmail', email);
            
            return {
                success: true,
                message: data.message,
                developerId: data.developerId,
                requiresVerification: data.requiresVerification
            };
        } catch (error) {
            console.error('Signup error:', error);
            return {
                success: false,
                message: error.message || 'Failed to create account'
            };
        }
    }

    // Login developer
    async login(email, password, rememberMe = false) {
        try {
            const response = await fetch(`${this.apiEndpoint}/developers/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-App-Client': 'developer-portal'
                },
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            // Store tokens
            console.log('[AUTH-SERVICE] Login response:', data);
            console.log('[AUTH-SERVICE] Tokens received:', {
                idToken: data.tokens?.idToken ? 'YES' : 'NO',
                accessToken: data.tokens?.accessToken ? 'YES' : 'NO',
                refreshToken: data.tokens?.refreshToken ? 'YES' : 'NO'
            });
            
            this.token = data.tokens.idToken;
            this.refreshToken = data.tokens.refreshToken;
            
            if (rememberMe) {
                console.log('[AUTH-SERVICE] Storing tokens in localStorage');
                localStorage.setItem('developerToken', this.token);
                localStorage.setItem('developerRefreshToken', this.refreshToken);
            } else {
                console.log('[AUTH-SERVICE] Storing tokens in sessionStorage');
                sessionStorage.setItem('developerToken', this.token);
                sessionStorage.setItem('developerRefreshToken', this.refreshToken);
            }
            
            // Verify storage
            console.log('[AUTH-SERVICE] Verification - Token stored:', {
                localStorage: !!localStorage.getItem('developerToken'),
                sessionStorage: !!sessionStorage.getItem('developerToken')
            });

            // Store developer info
            if (data.developer) {
                this.developerInfo = data.developer;
                localStorage.setItem('developerInfo', JSON.stringify(data.developer));
                console.log('Developer info saved from login:', this.developerInfo);
            } else {
                console.log('No developer info in login response, will load from profile');
            }

            // Start token refresh timer
            this.startTokenRefreshTimer();

            // Load full profile
            await this.loadDeveloperProfile();

            return {
                success: true,
                developer: this.developerInfo
            };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: error.message || 'Failed to login'
            };
        }
    }

    // Verify email with code
    async verifyEmail(email, code) {
        try {
            const response = await fetch(`${this.apiEndpoint}/users/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    code
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Verification failed');
            }

            // If tokens are returned, store them (auto-login after verification)
            if (data.tokens) {
                this.token = data.tokens.idToken;
                this.refreshToken = data.tokens.refreshToken;
                localStorage.setItem('developerToken', this.token);
                localStorage.setItem('developerRefreshToken', this.refreshToken);
                
                // Load developer profile
                await this.loadDeveloperProfile();
            }

            return {
                success: true,
                message: data.message,
                autoLoggedIn: !!data.tokens
            };
        } catch (error) {
            console.error('Verification error:', error);
            return {
                success: false,
                message: error.message || 'Failed to verify email'
            };
        }
    }

    // Resend verification code
    async resendVerificationCode(email) {
        try {
            const response = await fetch(`${this.apiEndpoint}/users/resend-verification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Failed to resend code');
            }

            return {
                success: true,
                message: data.message
            };
        } catch (error) {
            console.error('Resend code error:', error);
            return {
                success: false,
                message: error.message || 'Failed to resend verification code'
            };
        }
    }

    // Load developer profile
    async loadDeveloperProfile() {
        if (!this.token) {
            console.log('No token, cannot load profile');
            return null;
        }

        console.log('Loading developer profile from API...');
        try {
            const response = await fetch(`${this.apiEndpoint}/developers/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                    'X-App-Client': 'developer-portal'
                }
            });

            console.log('Profile response status:', response.status);
            
            if (response.status === 404) {
                console.log('Profile endpoint not found, trying /users/profile');
                // Try alternate endpoint
                const altResponse = await fetch(`${this.apiEndpoint}/users/profile`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (altResponse.ok) {
                    const altData = await altResponse.json();
                    this.developerInfo = altData.user || altData;
                    // Ensure we have a developerId
                    if (!this.developerInfo.developerId && this.developerInfo.userId) {
                        this.developerInfo.developerId = 'dev_' + this.developerInfo.userId.substring(0, 6);
                    }
                }
            } else if (response.ok) {
                const data = await response.json();
                this.developerInfo = data.developer || data;
            } else if (response.status === 401) {
                console.log('Unauthorized, logging out');
                this.logout();
                return null;
            }

            // Save to localStorage if we got data
            if (this.developerInfo && Object.keys(this.developerInfo).length > 0) {
                localStorage.setItem('developerInfo', JSON.stringify(this.developerInfo));
                console.log('Developer profile loaded and saved:', this.developerInfo);
                
                // Update UI with developer info
                this.updateDeveloperBadge();
                this.populateUploadForm();
                this.updateDashboardInfo();
                
                return this.developerInfo;
            } else {
                console.log('No developer info received');
                return null;
            }
        } catch (error) {
            console.error('Load profile error:', error);
            // Try to use cached developer info if available
            const cached = localStorage.getItem('developerInfo');
            if (cached) {
                try {
                    this.developerInfo = JSON.parse(cached);
                    console.log('Using cached developer info:', this.developerInfo);
                    this.updateDeveloperBadge();
                    this.populateUploadForm();
                    this.updateDashboardInfo();
                    return this.developerInfo;
                } catch (e) {
                    console.error('Failed to parse cached developer info');
                }
            }
            return null;
        }
    }

    // Get developer's games
    async getDeveloperGames() {
        if (!this.token) return [];

        try {
            const response = await fetch(`${this.apiEndpoint}/developers/games`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Failed to load games');
            }

            return data;
        } catch (error) {
            console.error('Load games error:', error);
            return { games: [], stats: {} };
        }
    }

    // Update developer badge in UI
    updateDeveloperBadge() {
        const badge = document.getElementById('developerBadge');
        const companyName = document.getElementById('badgeCompanyName');
        const developerId = document.getElementById('badgeDeveloperId');
        
        if (badge && this.developerInfo.developerId) {
            companyName.textContent = this.developerInfo.companyName || 'Developer';
            developerId.textContent = `ID: ${this.developerInfo.developerId}`;
            // Don't try to show the badge since it's hidden
            // badge.classList.add('show');
        }
        
        // Also update dashboard info if visible
        this.updateDashboardInfo();
    }
    
    // Update dashboard developer info
    updateDashboardInfo() {
        const dashboardInfo = document.getElementById('dashboardDeveloperInfo');
        const dashboardCompanyName = document.getElementById('dashboardCompanyName');
        const dashboardDeveloperId = document.getElementById('dashboardDeveloperId');
        const dashboardJoinDate = document.getElementById('dashboardJoinDate');
        
        if (!dashboardInfo || !dashboardCompanyName || !dashboardDeveloperId || !dashboardJoinDate) {
            console.log('Dashboard elements not found');
            return;
        }
        
        // Try to get developer info from multiple sources
        let developerInfo = this.developerInfo;
        
        // If not in auth service, try localStorage
        if (!developerInfo || !developerInfo.developerId) {
            const storedInfo = localStorage.getItem('developerInfo');
            if (storedInfo) {
                try {
                    developerInfo = JSON.parse(storedInfo);
                } catch (e) {
                    console.error('Error parsing stored developer info:', e);
                }
            }
        }
        
        // If still no info, try to generate from token
        if (!developerInfo || !developerInfo.developerId) {
            const token = this.token || localStorage.getItem('developerToken') || sessionStorage.getItem('developerToken');
            if (token) {
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    const email = payload.email || payload['cognito:username'] || '';
                    if (email) {
                        const username = email.split('@')[0];
                        const devId = 'dev_' + username.substring(0, 6).padEnd(6, '0').replace(/[^a-zA-Z0-9]/g, '0');
                        
                        developerInfo = {
                            developerId: devId,
                            companyName: username,
                            email: email,
                            username: username,
                            joinDate: new Date().toISOString()
                        };
                        
                        // Save it for next time
                        this.developerInfo = developerInfo;
                        localStorage.setItem('developerInfo', JSON.stringify(developerInfo));
                    }
                } catch (e) {
                    console.error('Error generating from token:', e);
                }
            }
        }
        
        // Update UI if we have info
        if (developerInfo && developerInfo.developerId) {
            dashboardCompanyName.textContent = developerInfo.companyName || 'Developer';
            dashboardDeveloperId.textContent = developerInfo.developerId;
            
            // Format join date if available
            if (developerInfo.joinDate) {
                const date = new Date(developerInfo.joinDate);
                dashboardJoinDate.textContent = date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            } else {
                dashboardJoinDate.textContent = 'Recently joined';
            }
            
            dashboardInfo.style.display = 'block';
        } else {
            console.log('No developer info available for dashboard');
            dashboardInfo.style.display = 'none';
        }
    }

    // Auto-populate developer info in upload form
    populateUploadForm() {
        console.log('Populating upload form with developer info:', this.developerInfo);
        
        const developerNameInput = document.getElementById('developerName');
        const developerIdInput = document.getElementById('developerId');
        const uploadInfo = document.getElementById('uploadDeveloperInfo');
        
        if (developerNameInput && this.developerInfo.companyName) {
            developerNameInput.value = this.developerInfo.companyName;
            developerNameInput.disabled = true;
        }
        
        // Add hidden developerId field if it doesn't exist
        if (!developerIdInput) {
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.id = 'developerId';
            hiddenInput.name = 'developerId';
            hiddenInput.value = this.developerInfo.developerId || '';
            document.getElementById('uploadForm').appendChild(hiddenInput);
        } else {
            developerIdInput.value = this.developerInfo.developerId || '';
        }
        
        // Show developer info and add developer ID field
        if (uploadInfo) {
            console.log('Found uploadDeveloperInfo element, adding developer ID field');
            if (this.developerInfo && this.developerInfo.developerId) {
                uploadInfo.innerHTML = `
                    <div class="form-group">
                        <label class="form-label">Developer ID</label>
                        <input type="text" class="form-input" id="developerIdDisplay" value="${this.developerInfo.developerId}" disabled style="background-color: rgba(255, 255, 255, 0.05); color: #9ca3af; cursor: not-allowed;">
                        <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">This ID will be automatically attached to your game</div>
                    </div>
                `;
            } else {
                console.log('No developer ID found in developerInfo');
            }
        } else {
            console.log('uploadDeveloperInfo element not found');
        }
    }

    // Add auth headers to API calls
    getAuthHeaders() {
        if (!this.token) return {};
        
        return {
            'Authorization': `Bearer ${this.token}`,
            'X-App-Client': 'developer-portal'
        };
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token;
    }

    // Get current developer info
    getCurrentDeveloper() {
        return this.developerInfo;
    }

    // Logout
    logout() {
        // Clear tokens and data
        this.token = null;
        this.refreshToken = null;
        this.developerInfo = {};
        
        // Clear storage
        localStorage.removeItem('developerToken');
        localStorage.removeItem('developerRefreshToken');
        localStorage.removeItem('developerInfo');
        sessionStorage.removeItem('developerToken');
        sessionStorage.removeItem('developerRefreshToken');
        
        // Clear refresh timer
        if (this.tokenRefreshInterval) {
            clearInterval(this.tokenRefreshInterval);
        }
        
        // Hide developer badge
        const badge = document.getElementById('developerBadge');
        if (badge) {
            badge.classList.remove('show');
        }
        
        // Show auth screen
        showAuthScreen();
    }

    // Start token refresh timer
    startTokenRefreshTimer() {
        // Refresh token every 50 minutes (tokens expire in 60 minutes)
        this.tokenRefreshInterval = setInterval(() => {
            this.refreshAuthToken();
        }, 50 * 60 * 1000);
    }

    // Refresh authentication token
    async refreshAuthToken() {
        if (!this.refreshToken) return;

        try {
            // Note: This would require a refresh endpoint in the backend
            // For now, we'll just log a message
            console.log('Token refresh would happen here');
            // In production, implement token refresh logic
        } catch (error) {
            console.error('Token refresh error:', error);
            // If refresh fails, logout user
            this.logout();
        }
    }
}

// Create global auth instance
const auth = new AuthService();