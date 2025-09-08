# 🎮 Trioll Mobile App Integration Guide

## Overview
This document contains all the necessary information for integrating the Trioll Mobile app with the backend services, ensuring proper synchronization of games, analytics, and user interactions.

**Last Updated**: January 8, 2025

## Table of Contents
1. [API Endpoints](#1-api-endpoints-production---us-east-1)
2. [Authentication Headers](#2-authentication-headers)
3. [AWS Configuration](#3-aws-configuration)
4. [Developer ID Format](#4-developer-id-format)
5. [Game Data Structure](#5-game-data-structure)
6. [Analytics Events Format](#6-analytics-events-format)
7. [Game Interactions](#7-game-interactions)
8. [Comments System](#8-comments-system)
9. [Important IAM Role Names](#9-important-iam-role-names)
10. [WebView Game Loading](#10-webview-game-loading)
11. [Error Handling](#11-error-handling)
12. [Testing Your Integration](#12-testing-your-integration)
13. [Critical Recent Fixes](#13-critical-recent-fixes-as-of-january-8-2025)
14. [Mobile App Specific Headers](#14-mobile-app-specific-headers)

---

## 1. API Endpoints (Production - us-east-1)

```javascript
const API_BASE_URL = 'https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod';

// Game Endpoints
GET    /games                        // List all games
GET    /games/{gameId}              // Get single game (Note: Currently returns 500)
POST   /games                       // Create new game
PUT    /games/{gameId}              // Update game
GET    /developers/games            // Get games for authenticated developer

// Game Interaction Endpoints
POST   /games/{gameId}/likes        // Like/unlike a game
POST   /games/{gameId}/ratings      // Rate a game (1-5 stars)
POST   /games/{gameId}/plays       // Track game play
GET    /games/{gameId}/plays       // Get play count

// Comments System (Backend Ready)
GET    /games/{gameId}/comments     // Get comments for a game
POST   /games/{gameId}/comments     // Post a comment
PUT    /comments/{commentId}        // Edit comment
DELETE /comments/{commentId}        // Delete comment
PUT    /comments/{commentId}/like   // Like a comment

// User/Profile Endpoints
GET    /users/profile              // Get user profile
PUT    /users/profile              // Update user profile
GET    /developers/profile         // Get developer profile

// Analytics Endpoint
POST   /analytics/events           // Send analytics events (batch supported)
```

## 2. Authentication Headers

```javascript
// For all authenticated requests
const headers = {
    'Authorization': `Bearer ${userToken}`,  // Cognito ID token
    'Content-Type': 'application/json',
    'X-App-Client': 'mobile-app'            // Important: Identifies request source
};

// For guest users
const guestHeaders = {
    'X-Guest-Mode': 'true',
    'X-Identity-Id': cognitoIdentityId,     // From AWS.config.credentials.identityId
    'Content-Type': 'application/json',
    'X-App-Client': 'mobile-app'
};
```

## 3. AWS Configuration

```javascript
// Cognito Configuration
const AWS_CONFIG = {
    region: 'us-east-1',
    userPoolId: 'us-east-1_cLPH2acQd',
    userPoolWebClientId: 'bft50gui77sdq2n4lcio4onql',
    identityPoolId: 'us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268'
};

// S3 Buckets
const S3_BUCKETS = {
    games: 'trioll-prod-games-us-east-1',        // Game files
    uploads: 'trioll-prod-uploads-us-east-1',    // User uploads
    analytics: 'trioll-prod-analytics-us-east-1'  // Analytics logs
};

// CloudFront CDN
const CDN_URL = 'https://d2wg7sn99og2se.cloudfront.net';  // For game assets
```

## 4. Developer ID Format

```javascript
// CRITICAL: Developer IDs follow this format
// Example: "dev_c84a7e" (NOT "FreddieTrioll" or email addresses)

// Extract developer ID from JWT token
function getDeveloperIdFromToken(token) {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Note: Since custom attributes don't exist, we use preferred_username
    return payload.preferred_username || payload['custom:developer_id'] || null;
}
```

## 5. Game Data Structure

```javascript
// When creating/updating games, use these field names:
const gameData = {
    gameId: 'unique-game-id',              // Required for updates
    name: 'Game Title',                    // NOT 'title' - API expects 'name'
    description: 'Game description',       // Required field
    category: 'Action',                    // Game category
    developerId: 'dev_xxxxx',             // Developer ID from token
    developerName: 'Company Name',         // Display name
    thumbnailUrl: 's3://bucket/path',      // Game thumbnail
    gameUrl: 's3://bucket/game/index.html', // Main game file
    status: 'active',                      // active/inactive
    version: '1.0.0',                     // DynamoDB sort key
    deviceOrientation: 'landscape',        // Optional
    controlStyle: 'touch',                 // Optional
    gameStage: 'production',              // pre-release/production
    deviceCompatibility: ['mobile', 'tablet', 'desktop']
};
```

## 6. Analytics Events Format

```javascript
// Analytics event structure
const analyticsEvent = {
    eventType: 'game_play',               // game_play, game_like, game_rate, etc.
    eventData: {
        gameId: 'game-123',
        gameName: 'Game Title',
        duration: 120,                    // For game_play events
        rating: 5,                        // For game_rate events
        // Add any relevant data
    },
    timestamp: new Date().toISOString(),
    userId: cognitoUserId || 'guest',
    identityId: cognitoIdentityId,       // Important for guest users
    sessionId: 'unique-session-id',
    deviceInfo: {
        platform: 'android',
        version: '10',
        model: 'Samsung Galaxy S20'
    }
};

// Batch events endpoint accepts array
POST /analytics/events
Body: { events: [event1, event2, ...] }
```

## 7. Game Interactions

```javascript
// Like a game
POST /games/{gameId}/likes
Body: { liked: true }  // true to like, false to unlike

// Rate a game
POST /games/{gameId}/ratings
Body: { rating: 5 }    // 1-5 stars

// Track game play
POST /games/{gameId}/plays
Body: { 
    duration: 120,     // seconds played
    completed: false   // did user finish the game
}
```

## 8. Comments System

```javascript
// Post a comment with rating
POST /games/{gameId}/comments
Body: {
    text: "Great game!",
    rating: 5         // Optional: 1-5 stars
}

// Response includes comment with ID, timestamp, user info
```

## 9. Important IAM Role Names

```
⚠️ NOTE: Despite "staging" in the names, these ARE the production roles:
- Authenticated: trioll-staging-auth-role
- Unauthenticated: trioll-staging-guest-role
```

## 10. WebView Game Loading

```javascript
// Game URLs follow this pattern:
const gameUrl = `https://d2wg7sn99og2se.cloudfront.net/${gameId}/index.html`;

// For S3 direct access (fallback):
const s3GameUrl = `https://trioll-prod-games-us-east-1.s3.amazonaws.com/${gameId}/index.html`;

// Add these WebView settings for games:
webView.getSettings().setJavaScriptEnabled(true);
webView.getSettings().setDomStorageEnabled(true);
webView.getSettings().setAllowFileAccess(true);
```

## 11. Error Handling

```javascript
// API Error Responses
{
    "message": "Error description",
    "error": "Detailed error info"    // Optional
}

// Common HTTP Status Codes:
// 200 - Success
// 401 - Unauthorized (invalid/expired token)
// 403 - Forbidden (no permission)
// 404 - Not found
// 500 - Server error
// 502 - Lambda function error
```

## 12. Testing Your Integration

### Developer Portal Access
- **URL**: https://triolldev.com
- **Login**: freddiecaplin@hotmail.com
- **Developer ID**: dev_c84a7e

### Verify Analytics
- Events should appear in DynamoDB table: `trioll-prod-analytics`
- Check CloudWatch logs for Lambda: `trioll-prod-analytics-api`

### Test Game Interactions
- Likes/ratings should update in real-time
- Check DynamoDB tables: `trioll-prod-likes`, `trioll-prod-ratings`

## 13. Critical Recent Fixes (as of January 8, 2025)

### Developer ID Authentication Fix
1. **Issue**: Frontend was storing company name ("FreddieTrioll") as developer ID instead of the actual developer ID ("dev_c84a7e")
2. **Solution**: 
   - Updated all Lambda functions to extract developer ID from JWT token's `preferred_username` field
   - Fixed Cognito user: changed `preferred_username` from "FreddieTrioll" to "dev_c84a7e"
   - Frontend now uses `getDeveloperIdFromToken()` function to always extract from JWT
3. **Important**: The Cognito User Pool has NO custom attributes, so Lambda functions use `preferred_username` as the developer ID

### Lambda Function Updates
1. **games-api-fixed.js**: Updated to handle JWT tokens and extract developer ID correctly
2. **games-update-api.js**: 
   - Fixed missing DynamoDB Query permission (was causing 500 errors)
   - Removed unnecessary `jsonwebtoken` dependency that was causing 502 errors
   - Now properly validates game ownership before allowing updates
3. **users-api.js**: Updated to handle guest authentication and developer profiles

### Other Critical Fixes
1. **Field Names**: API expects `name` not `title` for game names
2. **DynamoDB**: Games table uses composite key (gameId + version = "1.0.0")
3. **Game Ownership**: Simplified check to just compare `game.developerId === developerId`
4. **IAM Roles**: "staging" named roles are actually production (DO NOT change to "prod" roles)

## 14. Developer Game Upload Workflow

### Overview
Developers upload games through the Trioll Developer Portal (https://triolldev.com). Here's the complete workflow:

### Step 1: Developer Registration/Login
1. **Sign Up**: Create account at triolldev.com with:
   - Email address
   - Password
   - Company/Developer name
2. **Developer ID Assignment**: 
   - System generates unique developer ID (e.g., "dev_c84a7e")
   - Stored in Cognito as `preferred_username`
   - This ID is used for all game ownership

### Step 2: Game Upload Process
1. **Navigate to Upload Tab** in developer portal
2. **Fill in Game Details**:
   ```javascript
   {
     "name": "Game Title",              // Required (NOT "title")
     "description": "Game description", // Required
     "category": "Action",              // Required (dropdown)
     "developerName": "Company Name",   // Auto-filled
     "developerId": "dev_xxxxx",        // Auto-filled from JWT token
     "deviceOrientation": "landscape",  // Optional
     "controlStyle": "touch",           // Optional
     "gameStage": "production",         // pre-release or production
     "deviceCompatibility": ["mobile", "tablet", "desktop"]
   }
   ```

3. **Upload Files**:
   - **HTML File**: Main game file (any .html filename accepted)
   - **Additional Files**: CSS, JS, assets (maintains folder structure)
   - **Thumbnail**: Game preview image (PNG, JPG, GIF, WebP)

4. **File Storage Process**:
   - Files uploaded to S3: `trioll-prod-games-us-east-1/{gameId}/`
   - GameId format: `{game-name-slug}-{timestamp}`
   - Example: `horror-pong-1757087555176`

5. **Metadata Storage**:
   - Game metadata saved to DynamoDB table: `trioll-prod-games`
   - Includes all form data plus:
     - `gameUrl`: S3 path to main HTML file
     - `thumbnailUrl`: S3 path to thumbnail
     - `uploadedAt`: Timestamp
     - `version`: "1.0.0" (DynamoDB sort key)

### Step 3: Game Management
1. **View Games**: "My Games" tab shows all games for logged-in developer
2. **Edit Games**: 
   - Click edit button on game card
   - Can update: name, description, category, status, thumbnail
   - Changes saved via PUT `/games/{gameId}` endpoint
3. **Game Status**:
   - `active`: Game is live and playable
   - `inactive`: Game is hidden from players

### Step 4: Analytics & Monitoring
Developers can track:
- Play count
- Ratings (average and total)
- Likes
- Comments (when implemented in mobile app)

### Mobile App Integration Points

1. **Fetching Games**:
   ```javascript
   GET /games
   // Returns all active games with developer info
   ```

2. **Loading a Game**:
   ```javascript
   // Use CloudFront CDN for best performance
   const gameUrl = `https://d2wg7sn99og2se.cloudfront.net/${gameId}/index.html`;
   ```

3. **Developer Attribution**:
   - Each game includes `developerId` and `developerName`
   - Mobile app should display developer name on game cards
   - Link to developer profile/other games

### Important Notes for Mobile App

1. **Game Availability**: Only games with `status: "active"` should be shown to players
2. **File Paths**: All game assets are relative to the game folder in S3
3. **CORS**: Game files are publicly accessible with proper CORS headers
4. **Updates**: When developer updates game metadata, changes are immediate
5. **New Games**: New games appear immediately after upload (if status is active)

## 15. Mobile App Specific Headers

Always include these headers for proper tracking:
```javascript
headers['X-App-Client'] = 'mobile-app';
headers['X-App-Version'] = '1.0.0';  // Your app version
headers['X-Platform'] = 'android';   // or 'ios'
```

This ensures the backend can differentiate between web and mobile traffic for analytics.

---

## Additional Notes

### Guest User Support
- Guest users are fully supported for all game interactions
- Use Cognito Identity Pool to get guest credentials
- Include `X-Guest-Mode` and `X-Identity-Id` headers for guest requests

### Rate Limiting
- API Gateway has rate limiting configured
- Default: 1000 requests per second, 5000 burst
- Analytics endpoint has higher limits for batch processing

### Data Retention
- Analytics data: Permanent (no TTL configured)
- Game interaction data: Permanent
- User profiles: Permanent

### Support & Monitoring
- CloudWatch Logs: All Lambda functions log to CloudWatch
- API Gateway Logs: Request/response logging enabled
- DynamoDB Streams: Available for real-time data processing

---

## Contact & Support

For technical issues or questions about the integration:
- Developer Portal: https://triolldev.com
- Documentation: Check CLAUDE.md for detailed architecture information
- API Status: Monitor CloudWatch dashboards in AWS Console

**Document Version**: 1.0
**Last Updated**: January 8, 2025
**Author**: Trioll Development Team