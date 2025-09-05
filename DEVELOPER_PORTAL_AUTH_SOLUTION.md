# Developer Portal Authentication Solution

## The Issue
The developer portal (triolldev.com) needs its own authentication system, separate from the mobile app. Currently, the backend Lambda expects the mobile app's client ID, which is causing authentication failures.

## Understanding the Architecture

### Current Setup
1. **Shared User Pool**: Both mobile app and developer portal use `us-east-1_cLPH2acQd`
2. **Mobile App Client**: `bft50gui77sdq2n4lcio4onql` (for app users)
3. **Developer Portal Client**: `5joogquqr4jgukp7mncgp3g23h` (for game developers)
4. **Backend Lambda**: Currently only accepts mobile app client ID

### The Problem
- Developers uploading games are different from mobile app users
- The backend Lambda is hardcoded to expect the mobile app client ID
- This causes authentication to fail for developer portal users

## Solution Options

### Option 1: Quick Fix - Skip Authentication for Game Uploads
Since you're the only one uploading games right now, we could:
1. Remove authentication requirement from game upload endpoint
2. Add it back later when you have multiple developers

### Option 2: Update Backend Lambda (Recommended)
Modify the Lambda to accept both client IDs based on a header:

```javascript
// In Lambda function
const clientId = headers['X-App-Client'] === 'developer-portal' 
    ? '5joogquqr4jgukp7mncgp3g23h'  // Developer portal
    : 'bft50gui77sdq2n4lcio4onql';   // Mobile app
```

### Option 3: Create Separate Developer Lambda
1. Deploy a new Lambda specifically for developer authentication
2. Route `/developers/*` endpoints to this new Lambda
3. Keep mobile app endpoints separate

## Immediate Workaround

For now, you can:
1. Use the "Skip authentication" option in the portal
2. Or manually create a user in the mobile app's Cognito client

## Next Steps

1. Decide which option fits your architecture best
2. If Option 2, I can update the Lambda code
3. If Option 3, I can create a new developer-specific Lambda

What would you prefer?