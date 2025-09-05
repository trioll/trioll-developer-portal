# Trioll Developer Portal - Complete Documentation

Last Updated: September 4, 2025

## Table of Contents
1. [Overview](#overview)
2. [Infrastructure](#infrastructure)
3. [Features](#features)
4. [Testing Process](#testing-process)
5. [API Endpoints](#api-endpoints)
6. [Deployment Status](#deployment-status)

## Overview

The Trioll Developer Portal is a web-based platform for game developers to upload, manage, and monitor their games on the Trioll Mobile platform.

### Key Features
- 🎮 Game upload and management
- 👤 Developer authentication with unique IDs
- 📊 Analytics dashboard (coming soon)
- 💬 Comments system for player feedback
- 🚀 CloudFront CDN for global game delivery
- 📱 Integration with Trioll Mobile app

## Infrastructure

### Region: US-EAST-1 (N. Virginia)
All infrastructure is deployed in US-EAST-1. EU-WEST-2 infrastructure has been completely removed.

### AWS Services

#### S3 Buckets
- **trioll-prod-games-us-east-1**: Game files storage
  - Public read access
  - CloudFront distribution attached
  - Structure: `/{gameId}/index.html`, `/{gameId}/thumbnail.png`

- **trioll-prod-uploads-us-east-1**: User uploads (profile images)
  - Controlled access via IAM
  - Structure: `/profile-images/{prefix}/{userId}/{type}/`

#### CloudFront Distribution
- **ID**: E19KSV2LWED5HJ
- **Domain**: dgq2nqysbn2z3.cloudfront.net
- **Origin**: trioll-prod-games-us-east-1 S3 bucket
- **Features**: HTTPS only, global caching, compression enabled

#### DynamoDB Tables
- **trioll-prod-games**: Game metadata
- **trioll-prod-users**: User profiles
- **trioll-prod-developers**: Developer accounts
- **trioll-prod-comments**: Game comments
- **trioll-prod-likes**: Like tracking
- **trioll-prod-ratings**: Game ratings
- **trioll-prod-playcounts**: Play statistics

#### API Gateway
- **ID**: 4ib0hvu1xj
- **URL**: https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod
- **Endpoints**: Games, Users, Developers, Comments, Analytics

#### Lambda Functions
1. **games-api.js**: Game CRUD operations
2. **users-api.js**: User profile management
3. **developers-api-enhanced.js**: Developer authentication and ID generation
4. **comments-api.js**: Comments system
5. **interactions-dynamodb-final.js**: Likes, ratings, plays
6. **analytics-api.js**: Analytics event tracking

#### Cognito
- **User Pool ID**: us-east-1_cLPH2acQd
- **Client ID**: bft50gui77sdq2n4lcio4onql
- **Features**: Auto-confirmation enabled, developer ID generation

## Features

### 1. Developer Authentication
- Email/password login
- Auto-confirmation (no email verification required)
- Unique developer IDs (format: dev_xxxxx)
- Remember me functionality
- Session persistence

### 2. Game Upload
- Support for folder or ZIP upload
- Automatic thumbnail detection
- CloudFront URL generation
- Developer ID association
- Metadata storage in DynamoDB

### 3. My Games Tab
- Filter games by developer ID
- View game statistics
- Direct game management
- Delete functionality

### 4. Comments System
- Full CRUD operations
- Guest and authenticated user support
- 5-star rating system
- Like functionality
- Pagination support
- Developer moderation (can delete any comment on their games)

### 5. CloudFront CDN
- Global content delivery
- HTTPS enforcement
- Automatic caching
- 400+ edge locations
- DDoS protection

## Testing Process

### Step 1: Developer Portal Testing

1. **Access the Portal**
   ```
   Open: /Users/frederickcaplin/Desktop/trioll-developer-portal/index.html
   ```

2. **Test Authentication**
   - Login with: freddiecaplin@hotmail.com / @Freddie1
   - Verify developer ID appears (dev_freddi)
   - Test "Remember Me" checkbox
   - Logout and login again

3. **Upload a Game**
   - Click "Upload Game" tab
   - Verify developer ID is auto-populated
   - Upload a folder with:
     - index.html
     - thumbnail.png (or .jpg)
     - game assets
   - Or upload a ZIP file

4. **Verify Game Upload**
   - Check "All Games" tab - game should appear
   - Check "My Games" tab - only your games shown
   - Click game URL to test (may show 404 until CloudFront deploys)
   - Note the game ID for testing

5. **Test Comments System**
   ```
   Open: /Users/frederickcaplin/Desktop/trioll-developer-portal/backend-updates/test-comments-comprehensive.html
   ```
   - Use your uploaded game's ID
   - Test posting comments
   - Test rating system
   - Test permissions

### Step 2: CloudFront Verification

1. **Check Deployment Status**
   ```bash
   aws cloudfront get-distribution --id E19KSV2LWED5HJ --query 'Distribution.Status' --output text
   ```
   Should show "Deployed" when ready (15-20 minutes)

2. **Test Game Access**
   - Direct S3: `https://trioll-prod-games-us-east-1.s3.us-east-1.amazonaws.com/{gameId}/index.html`
   - CloudFront: `https://dgq2nqysbn2z3.cloudfront.net/{gameId}/index.html`

3. **Verify CDN Performance**
   - Access game from different browsers
   - Check response headers for CloudFront cache hits
   - Verify HTTPS redirect works

### Step 3: API Testing

1. **Games API**
   ```bash
   # Get all games
   curl https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games
   
   # Get specific game
   curl https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games/{gameId}
   ```

2. **Comments API**
   ```bash
   # Get comments for a game
   curl https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games/{gameId}/comments
   ```

3. **Developer Games** (if endpoint exists)
   ```bash
   # Get developer's games
   curl https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/{developerId}/games
   ```

### Step 4: Mobile App Integration Testing

1. **Verify Game Shows in App**
   - Open Trioll Mobile app
   - Check if uploaded game appears
   - Test playing the game
   - Verify CloudFront URLs work

2. **Test Comments in App**
   - Navigate to your game
   - Post a comment
   - Verify it appears in developer portal

## API Endpoints

### Games
- `GET /games` - List all games
- `GET /games/{gameId}` - Get specific game
- `POST /games` - Create new game (requires auth)
- `DELETE /games/{gameId}` - Delete game (requires auth)

### Comments
- `GET /games/{gameId}/comments` - Get game comments
- `POST /games/{gameId}/comments` - Post comment (requires auth)
- `PUT /comments/{commentId}` - Update comment
- `DELETE /comments/{commentId}` - Delete comment
- `PUT /comments/{commentId}/like` - Like comment

### Developers
- `POST /developers/login` - Developer login
- `POST /developers/signup` - Developer registration
- `GET /developers/profile` - Get developer profile

### Analytics
- `POST /analytics/events` - Batch event tracking

## Deployment Status

### ✅ Deployed and Active
- S3 Buckets (all configured)
- DynamoDB Tables (all created)
- Lambda Functions (all deployed)
- API Gateway Routes (all configured)
- Cognito User Pool (configured)
- CloudFront Distribution (deploying - 15-20 min)

### 🧹 Cleaned Up
- Old EU-WEST-2 infrastructure (removed)
- Duplicate CloudFront distributions (disabled)
- Unused API endpoints (removed)

### 📝 Configuration Files
- `/CLAUDE.md` - Project memory and context
- `/backend-updates/CLOUDFRONT_SETUP.md` - CDN configuration
- `/backend-updates/*.sh` - Deployment scripts
- `/backend-updates/*-api.js` - Lambda functions

## Common Issues & Solutions

### Game Not Loading
1. Check CloudFront deployment status
2. Try direct S3 URL first
3. Verify game files were uploaded correctly
4. Check browser console for errors

### Developer ID Not Showing
1. Clear browser cache
2. Check localStorage/sessionStorage
3. Re-login to refresh token

### Comments Not Posting
1. Verify authentication token
2. Check game ID is correct
3. Test with comprehensive test page

### My Games Tab Empty
1. Ensure developer ID is stored
2. Check if games have developerId field
3. Verify API is returning filtered results

## Next Phases

1. **Phase 1**: Mobile App Integration ✓ (Ready to test)
2. **Phase 2**: Analytics Dashboard (Pending)
3. **Phase 3**: Game Management UI (Pending)
4. **Phase 4**: Revenue & Monetization (Pending)
5. **Phase 5**: Social Features (Pending)

## Support

For issues or questions:
- Check browser console for errors
- Review CloudWatch logs for Lambda functions
- Verify all services are in US-EAST-1 region
- Ensure no references to old EU-WEST-2 remain