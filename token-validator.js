// Token validation utilities
function isTokenExpired(token) {
    if (!token) return true;
    
    try {
        // Decode JWT token
        const parts = token.split('.');
        if (parts.length !== 3) return true;
        
        const payload = JSON.parse(atob(parts[1]));
        const exp = payload.exp;
        
        if (!exp) return false; // No expiry set
        
        // Check if expired (exp is in seconds, Date.now() is in milliseconds)
        const now = Math.floor(Date.now() / 1000);
        return exp < now;
    } catch (error) {
        console.error('Error checking token expiry:', error);
        return true; // Treat as expired if we can't decode
    }
}

function validateAndGetToken() {
    // Check both storage locations
    let token = localStorage.getItem('developerToken') || sessionStorage.getItem('developerToken');
    
    if (!token) {
        console.log('No token found');
        return null;
    }
    
    if (isTokenExpired(token)) {
        console.log('Token expired, clearing storage');
        // Clear expired tokens
        localStorage.removeItem('developerToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('developerId');
        localStorage.removeItem('developerInfo');
        sessionStorage.removeItem('developerToken');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('developerId');
        sessionStorage.removeItem('developerInfo');
        return null;
    }
    
    return token;
}

// Add this to the beginning of any function that uses the token:
// const token = validateAndGetToken();
// if (!token) {
//     // Redirect to login or show login prompt
//     window.location.href = '#login';
//     return;
// }