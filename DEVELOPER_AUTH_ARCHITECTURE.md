# Trioll Developer Authentication Architecture

## Overview

This document outlines the implementation strategy for adding user authentication to the Trioll Developer Portal (triolldev.com), allowing developers to sign up with email/password and have their own upload portal with unique developer IDs.

## Key Requirements

1. Email/password signup and login
2. Unique developer ID (format: `dev_xxxxx`) for each developer
3. Automatic developer ID attachment to all game uploads
4. Future capability for analytics dashboard per developer
5. Leverage existing AWS infrastructure

## Current Infrastructure Analysis

After analyzing the codebase, we have:
- **Cognito User Pool**: `us-east-1_cLPH2acQd` (already exists)
- **Cognito Client ID**: `bft50gui77sdq2n4lcio4onql`
- **Identity Pool**: `us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268`
- **Users Table**: `trioll-prod-users` (with email index)
- **Users API**: Complete auth system in `users-api.js`
- **Current Portal**: Uses guest credentials for uploads

## Architecture Design

### 1. Authentication Strategy

**Leverage Existing Infrastructure** with Developer Attributes:
- **User Pool**: `us-east-1_cLPH2acQd` (existing)
- **Client ID**: `bft50gui77sdq2n4lcio4onql` (existing)
- **User Type**: Add `userType: 'developer'` to distinguish from players
- **Developer ID**: Auto-generated `dev_xxxxx` stored in user profile

### 2. Database Schema Updates

#### Extend `trioll-prod-users` Table
```javascript
{
  "userId": "cognito-sub-id", // Existing PK
  "email": "developer@example.com",
  "userType": "developer", // New: 'player' | 'developer' | 'admin'
  "developerId": "dev_a3f2k9", // New: Unique developer ID
  "developerProfile": { // New: Developer-specific data
    "companyName": "Awesome Games Studio",
    "website": "https://example.com",
    "description": "Indie game developer",
    "joinedAt": "2025-01-15T10:00:00Z",
    "verifiedAt": null,
    "gamesCount": 5
  },
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

#### Update `trioll-prod-games` Table
```javascript
{
  "id": "game-123456", // Existing PK
  "developerId": "dev_a3f2k9", // New: Links to developer
  "developerEmail": "developer@example.com", // New: For quick lookup
  // ... existing fields
}
```

#### Add GSI to `trioll-prod-games`
- **GSI Name**: `developerId-index`
- **Partition Key**: `developerId`
- **Purpose**: Query all games by developer

### 3. Frontend Implementation

#### Authentication Flow
1. **Replace PIN Lock Screen** with Login/Signup
2. **Login Screen**:
   - Email input
   - Password input
   - "Remember me" checkbox
   - Link to signup
   
3. **Signup Screen**:
   - Email (required)
   - Password (required, min 8 chars)
   - Company Name (required)
   - Website (optional)
   - Terms acceptance checkbox

4. **Session Management**:
   - Store JWT tokens in localStorage
   - Refresh tokens automatically
   - Show developer info in header
   - Auto-populate developerId in uploads

#### New UI Components
```html
<!-- Login Modal -->
<div id="loginModal" class="auth-modal">
  <h2>Developer Login</h2>
  <form id="loginForm">
    <input type="email" placeholder="Email" required>
    <input type="password" placeholder="Password" required>
    <button type="submit">Login</button>
    <p>Don't have an account? <a href="#" id="showSignup">Sign up</a></p>
  </form>
</div>

<!-- Developer Info in Header -->
<div class="developer-info">
  <span>Welcome, [Company Name]</span>
  <span>Developer ID: dev_a3f2k9</span>
  <button id="logoutBtn">Logout</button>
</div>
```

### 4. Backend Implementation

#### New Lambda Function: `trioll-prod-developer-auth`
```javascript
// Endpoints:
POST /developers/signup    // Create developer account
POST /developers/login     // Authenticate developer
POST /developers/verify    // Verify email
GET  /developers/profile   // Get developer profile
PUT  /developers/profile   // Update developer profile
GET  /developers/games     // Get developer's games
```

#### Update `trioll-prod-games-api` (existing Lambda)
```javascript
// Modified POST /games endpoint
async function handleCreateGame(body, developerId, developerEmail) {
  const gameData = JSON.parse(body);
  
  const item = {
    ...existingFields,
    developerId: developerId, // Auto-populated from auth
    developerEmail: developerEmail, // For quick lookup
    developerName: gameData.developer || 'Unknown' // Keep for display
  };
  
  // Save to DynamoDB
}
```

### 5. Security Implementation

#### JWT Token Structure
```javascript
{
  "sub": "cognito-user-id",
  "email": "developer@example.com",
  "custom:developer_id": "dev_a3f2k9",
  "custom:company_name": "Awesome Games Studio",
  "custom:verified_developer": true,
  "cognito:groups": ["developers"],
  "exp": 1234567890
}
```

#### API Gateway Authorizer
- Use Cognito User Pool authorizer
- Validate JWT tokens
- Check "developers" group membership
- Pass developerId to Lambda context

### 6. Implementation Steps

#### Phase 1: Authentication Setup (Week 1)
1. Create Cognito app client for developer portal
2. Add custom attributes to Cognito
3. Create developer group in Cognito
4. Implement signup/login Lambda functions
5. Update frontend with auth screens

#### Phase 2: Developer Integration (Week 2)
1. Update games table schema
2. Add GSI for developerId queries
3. Modify game upload to include developerId
4. Create developer profile endpoints
5. Add developer dashboard UI

#### Phase 3: Migration & Testing (Week 3)
1. Migrate existing games (optional developerId)
2. Test authentication flow
3. Add email verification
4. Implement password reset
5. Add rate limiting

### 7. Developer ID Generation

```javascript
function generateDeveloperId() {
  const prefix = 'dev_';
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = prefix;
  
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  
  return id; // Example: dev_a3f2k9
}
```

### 8. Auto-Population in Upload Form

```javascript
// When developer is authenticated
const developerInfo = JSON.parse(localStorage.getItem('developerInfo'));

// Auto-fill hidden fields
document.getElementById('developerId').value = developerInfo.developerId;
document.getElementById('developerEmail').value = developerInfo.email;

// Show in UI
document.getElementById('developerBadge').textContent = 
  `Uploading as: ${developerInfo.companyName} (${developerInfo.developerId})`;
```

### 9. Future Analytics Integration

The developerId structure enables future analytics:
- Query games by developer using GSI
- Aggregate play counts, likes, ratings by developer
- Create developer-specific dashboards
- Track revenue and performance metrics

### 10. Benefits of This Approach

1. **Leverages Existing Infrastructure**: Uses current Cognito setup
2. **Minimal Changes**: Extends rather than replaces
3. **Scalable**: Can add more developer features later
4. **Secure**: Uses AWS best practices
5. **Backward Compatible**: Won't break existing games

## Implementation Approach

### Minimal Changes Strategy
1. **Reuse Existing Auth System**: The `users-api.js` already handles registration, login, and profiles
2. **Extend User Model**: Add `userType: 'developer'` and `developerId` fields
3. **Use Same Tables**: No new tables needed, just extend existing ones
4. **Leverage Guest → Auth Flow**: Similar to mobile app's guest-to-registered conversion

### Key Benefits
- **No New Infrastructure**: Uses existing Cognito, DynamoDB, and Lambda
- **Proven Auth System**: Battle-tested authentication from mobile app
- **Quick Implementation**: 3-5 days to full deployment
- **Backward Compatible**: Won't affect existing mobile app users

## Security Considerations

1. **JWT Validation**: Tokens validated on every API call
2. **Developer Isolation**: Developers can only modify their own games
3. **Rate Limiting**: Existing API Gateway throttling
4. **Email Verification**: Required before first login
5. **Secure Storage**: Tokens in localStorage with expiration

## Migration Path

### Existing Games
- Games without `developerId` remain accessible to admins
- Future: Add "claim game" feature for developers
- Legacy games marked with `uploadedBy: 'legacy'`

### Future Enhancements
1. **Analytics Dashboard**: Query games by developerId using GSI
2. **Revenue Tracking**: Add monetization metrics
3. **Team Accounts**: Multiple users per developer account
4. **API Keys**: For programmatic uploads
5. **Webhook Notifications**: Game performance alerts

## Files to Modify

### Backend
1. `/backend-api-deployment/lambda-functions/users-api.js` - Add developer endpoints
2. `/backend-api-deployment/lambda-functions/games-api.js` - Add developer auth

### Frontend  
1. `/trioll-developer-portal/index.html` - Replace PIN with login/signup
2. Add `auth.js` - Authentication service
3. Add `dashboard.js` - Developer dashboard

## Deployment Timeline

- **Day 1**: Backend API updates
- **Day 2**: Frontend authentication UI
- **Day 3**: Database schema updates
- **Day 4**: Developer dashboard
- **Day 5**: Testing and deployment

Total: **5 days** from approval to production

## Next Steps

1. Review `IMPLEMENTATION_PLAN.md` for detailed code
2. Approve approach
3. Begin Phase 1 implementation
4. Test on staging environment
5. Deploy to production