# Token Expiration Process Explained

## Timeline of Your Token

```
Sept 4, 16:02:17 - You logged in
Sept 4, 17:02:17 - Token expired (1 hour later)
Sept 5, 12:31:30 - You tried to use expired token
                   ↓
                 401 Error
```

## How AWS Cognito Token Expiration Works

### 1. Token Types & Lifespans

| Token Type | Default Lifespan | Purpose | Can be Changed? |
|------------|-----------------|---------|-----------------|
| ID Token | 1 hour | Contains user identity info | Yes (5 min - 24 hours) |
| Access Token | 1 hour | API authorization | Yes (5 min - 24 hours) |
| Refresh Token | 30 days | Get new tokens without re-login | Yes (1 hour - 10 years) |

### 2. The Authentication Flow

```
Initial Login:
1. User enters username/password
2. Cognito validates credentials
3. Cognito generates 3 tokens with timestamps
4. Tokens sent to browser
5. Browser stores tokens

Using the App:
1. App includes ID token in API requests
2. API checks token signature (is it real?)
3. API checks expiration (is it still valid?)
4. If expired → 401 Unauthorized
5. If valid → Process request

Token Refresh (should happen automatically):
1. ID token expires
2. App uses Refresh token to get new ID token
3. No password needed
4. User stays logged in
```

### 3. Why 1 Hour Default?

AWS chose 1 hour as a balance between:
- **Security** - Short enough to limit damage from stolen tokens
- **Convenience** - Long enough for a typical work session
- **Performance** - Not too frequent token refreshes

### 4. Common Token Expiration Scenarios

**Scenario 1: Active User**
- User actively using app
- App refreshes token before expiry
- User never notices

**Scenario 2: Idle User (Your Case)**
- User logs in, then leaves
- Returns next day
- Token expired overnight
- Gets 401 error

**Scenario 3: Remember Me**
- Token stored in localStorage
- Browser closed and reopened
- Expired token still there
- Looks logged in but isn't

## The Fix

The portal should:
1. Check token expiry before each API call
2. If expired, try to refresh using Refresh Token
3. If refresh fails, redirect to login
4. Clear expired tokens from storage

## Current Issue in Trioll Portal

```javascript
// Current (problematic):
const token = localStorage.getItem('developerToken');
// Uses token without checking if expired

// Should be:
const token = validateAndGetToken();
if (!token) {
    // Token missing or expired
    redirectToLogin();
    return;
}
```

This is why you keep hitting the issue - the portal doesn't validate token expiry!