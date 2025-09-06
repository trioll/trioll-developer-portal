# AWS Data Separation - Mobile App vs Developer Portal

## Overview
While both systems are in us-east-1, they have proper separation of concerns and data isolation.

## 1. Authentication Separation ✅

### Developer Portal
- **User Pool**: Same (`us-east-1_cLPH2acQd`) 
- **Client ID**: `5joogquqr4jgukp7mncgp3g23h` (Developer Portal Client)
- **User Type**: Developers only
- **Purpose**: Upload and manage games

### Mobile App
- **User Pool**: Same (`us-east-1_cLPH2acQd`)
- **Client ID**: `bft50gui77sdq2n4lcio4onql` (Mobile App Client)
- **User Type**: Players/Gamers
- **Purpose**: Play games, social features

**Result**: Same user pool, but different client applications with different permissions

## 2. Data Storage Separation 🗂️

### User Data
```
DynamoDB: trioll-prod-users
├── Developer Accounts (developerId field)
│   └── Only created via developer portal signup
│   └── Has companyName, gamesCount fields
│
└── Player Accounts (regular users)
    └── Created via mobile app
    └── Has stats, achievements, preferences
```

### Game Interactions
```
Shared Tables (accessible by both):
├── trioll-prod-games (game catalog)
├── trioll-prod-comments (all users can comment)
├── trioll-prod-likes (all users can like)
├── trioll-prod-ratings (all users can rate)
└── trioll-prod-playcounts (tracks all plays)
```

### Developer-Specific Data
```
Only Developer Portal:
├── Game uploads → S3: trioll-prod-games-us-east-1
├── Developer profiles → DynamoDB: trioll-prod-users (with developerId)
└── Future: Analytics dashboard data
```

## 3. API Endpoints Separation 🔌

### Shared Endpoints (Both Apps Use)
- `GET /games` - Browse games
- `GET /games/{gameId}` - Game details
- `POST /games/{gameId}/comments` - Post comments
- `GET /games/{gameId}/comments` - Get comments
- `POST /games/{gameId}/likes` - Like games
- `POST /games/{gameId}/ratings` - Rate games

### Developer Portal Only
- `POST /developers/register` - Developer signup
- `POST /developers/login` - Developer login
- `GET /developers/profile` - Developer profile
- `GET /developers/games` - Developer's uploaded games
- `POST /games` - Upload new game (requires developer auth)

### Mobile App Only
- `POST /users/register` - Player signup
- `POST /users/login` - Player login
- `GET /users/profile` - Player profile
- `GET /users/achievements` - Player achievements
- `POST /games/{gameId}/saves` - Save game progress

## 4. Security & Access Control 🔒

### Developer Portal
```javascript
// Can only upload games if authenticated as developer
if (!user.developerId) {
  return "Unauthorized - Developer account required"
}
```

### Mobile App
```javascript
// Anyone can play and interact with games
// Both authenticated users and guests
if (user || guestId) {
  // Allow gameplay and interactions
}
```

## 5. S3 Bucket Organization 📁

```
trioll-prod-games-us-east-1/
├── Game Files (uploaded by developers)
│   ├── horror-pong-1757075261334/
│   └── cannon-shot-1757105583409/
│
trioll-prod-uploads-us-east-1/
├── profile-images/ (both apps)
│   ├── developers/
│   └── players/
└── game-saves/ (mobile app only)
```

## 6. Future Separation Plans 🚀

### Phase 1 (Current) ✅
- Shared user pool, different clients
- Shared game interaction tables
- Developer-only upload permissions

### Phase 2 (Recommended)
- Separate Identity Pool for developers
- Developer-specific S3 bucket for uploads
- Dedicated analytics database

### Phase 3 (Scale)
- Separate API Gateway for developer portal
- Developer-specific CloudFront distribution
- Isolated VPC for sensitive developer data

## Summary

**Current State**: Proper logical separation with shared infrastructure
**Security**: Developers can't access player data, players can't upload games
**Scalability**: Ready to physically separate when needed

The architecture is well-designed for current needs and can be easily separated further as you scale!