# Quick Fix Reference - Developer ID Issues

## Problem: "My Games" showing empty or games not appearing

### Quick Fix (For Users)
1. Open `fix-frontend-developer-id.html` in your browser
2. Click "Check Current Status" to see the issue
3. Click "Fix Developer ID" to resolve it
4. Test with "Test /developers/games"
5. Return to dashboard - games should now appear

### Manual Fix (For Developers)
Open browser console and run:
```javascript
// Extract correct developer ID from token
const token = localStorage.getItem('developerToken');
const payload = JSON.parse(atob(token.split('.')[1]));
const correctDevId = payload['custom:developer_id'];

// Update storage
localStorage.setItem('developerId', correctDevId);
sessionStorage.setItem('developerId', correctDevId);

console.log('Fixed! Developer ID:', correctDevId);
```

## Problem: Frontend not using JWT token developer ID

### Implementation Fix
Add these functions to index.html:

```javascript
function getDeveloperIdFromToken() {
    const token = localStorage.getItem('developerToken') || sessionStorage.getItem('developerToken');
    if (!token) return null;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload['custom:developer_id'] || payload.preferred_username || null;
    } catch (e) {
        console.error('Error extracting developer ID from token:', e);
        return null;
    }
}

function getDeveloperId() {
    return getDeveloperIdFromToken();
}
```

Then replace all instances of:
- `localStorage.getItem('developerId')` with `getDeveloperId()`
- `sessionStorage.getItem('developerId')` with `getDeveloperId()`

## Testing Tools Available

1. **check-my-token.html** - Shows JWT token contents
2. **fix-frontend-developer-id.html** - One-click fix for users
3. **apply-developer-id-fixes.html** - Implementation guide with code snippets

## Common Scenarios

### Scenario 1: Fresh Login
- Token contains: `dev_c84a7e`
- localStorage had: `FreddieTrioll`
- Result: Games don't show
- Fix: Run fix-frontend-developer-id.html

### Scenario 2: After Fix
- Token contains: `dev_c84a7e`
- localStorage has: `dev_c84a7e`
- Result: Games show correctly

### Scenario 3: Implementation
- Before: Frontend stores whatever API returns
- After: Frontend always extracts from JWT token
- Result: Consistent developer ID usage

## Backend Information
- Lambda functions support both custom and standard attributes
- DynamoDB queries use developer ID from JWT token
- 9 historical games were updated from "FreddieTrioll" to "dev_c84a7e"

## Emergency Fixes

If nothing else works:
```javascript
// Clear everything and start fresh
localStorage.clear();
sessionStorage.clear();
window.location.href = '/'; // Redirect to login
```