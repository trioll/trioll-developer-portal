// Fix for Developer ID Usage in Frontend
// This script updates how the developer portal handles developer IDs

// Step 1: Add these utility functions to your index.html or a common JS file

/**
 * Extract developer ID from JWT token
 * This is the ONLY source of truth for the developer ID
 */
function getDeveloperIdFromToken() {
    const token = localStorage.getItem('developerToken') || sessionStorage.getItem('developerToken');
    if (!token) return null;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Check for custom attribute first, then standard attribute
        return payload['custom:developer_id'] || payload.preferred_username || null;
    } catch (e) {
        console.error('Error extracting developer ID from token:', e);
        return null;
    }
}

/**
 * Get company name from JWT token
 */
function getCompanyNameFromToken() {
    const token = localStorage.getItem('developerToken') || sessionStorage.getItem('developerToken');
    if (!token) return null;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload['custom:company_name'] || payload.website || null;
    } catch (e) {
        console.error('Error extracting company name from token:', e);
        return null;
    }
}

/**
 * Main function to get developer ID
 * Always use this instead of localStorage.getItem('developerId')
 */
function getDeveloperId() {
    // Always get from token, not from localStorage
    return getDeveloperIdFromToken();
}

/**
 * Sync developer ID from token to localStorage
 * Call this after login or when token is refreshed
 */
function syncDeveloperIdFromToken() {
    const developerId = getDeveloperIdFromToken();
    const companyName = getCompanyNameFromToken();
    
    if (developerId) {
        // Update localStorage with correct value
        localStorage.setItem('developerId', developerId);
        sessionStorage.setItem('developerId', developerId);
        
        // Update developerInfo if it exists
        const devInfoStr = localStorage.getItem('developerInfo');
        if (devInfoStr) {
            try {
                const devInfo = JSON.parse(devInfoStr);
                devInfo.developerId = developerId;
                devInfo.companyName = companyName;
                localStorage.setItem('developerInfo', JSON.stringify(devInfo));
                sessionStorage.setItem('developerInfo', JSON.stringify(devInfo));
            } catch (e) {
                console.error('Error updating developerInfo:', e);
            }
        }
        
        console.log('✅ Developer ID synced from token:', developerId);
        return true;
    }
    
    console.warn('⚠️ No developer ID found in token');
    return false;
}

// Step 2: Update the login success handler
// Find this pattern in your index.html and replace it:

/* OLD CODE:
if (developer && developer.developerId) {
    localStorage.setItem('developerId', developer.developerId);
    localStorage.setItem('developerInfo', JSON.stringify(developer));
}
*/

/* NEW CODE:
// After setting the token, sync developer ID from it
if (data.tokens && data.tokens.idToken) {
    localStorage.setItem('developerToken', data.tokens.idToken);
    if (data.tokens.refreshToken) {
        localStorage.setItem('developerRefreshToken', data.tokens.refreshToken);
    }
    
    // Sync developer ID from the JWT token
    syncDeveloperIdFromToken();
}
*/

// Step 3: Update all places that read developer ID
// Replace these patterns:

/* OLD: localStorage.getItem('developerId') */
/* NEW: getDeveloperId() */

/* OLD: sessionStorage.getItem('developerId') */
/* NEW: getDeveloperId() */

// Step 4: Update the loadMyGames function
/* OLD CODE:
const developerId = document.getElementById('developerId')?.value || 
                   localStorage.getItem('developerId') || 
                   sessionStorage.getItem('developerId');
*/

/* NEW CODE:
const developerId = getDeveloperId();
if (!developerId) {
    console.error('No developer ID found in token');
    // Show error to user
    return;
}
*/

// Step 5: Add token validation on page load
// Add this to your window.onload or DOMContentLoaded:

document.addEventListener('DOMContentLoaded', function() {
    // Check if we have a token and sync developer ID
    const token = localStorage.getItem('developerToken') || sessionStorage.getItem('developerToken');
    if (token) {
        // Validate token isn't expired
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const exp = payload.exp * 1000;
            const now = Date.now();
            
            if (exp > now) {
                // Token is valid, sync developer ID
                syncDeveloperIdFromToken();
            } else {
                // Token expired, clear everything
                console.warn('Token expired, clearing session');
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/login';
            }
        } catch (e) {
            console.error('Invalid token format:', e);
        }
    }
});

// Example of how to use in API calls:
async function loadDeveloperGames() {
    const token = localStorage.getItem('developerToken');
    const developerId = getDeveloperId(); // Always get from token
    
    if (!token || !developerId) {
        console.error('Missing authentication');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/developers/games`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-App-Client': 'developer-portal'
            }
        });
        
        const data = await response.json();
        // Process games...
    } catch (error) {
        console.error('Error loading games:', error);
    }
}

console.log('Developer ID fix functions loaded. Call syncDeveloperIdFromToken() to sync.');