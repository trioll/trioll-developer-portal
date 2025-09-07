# Trioll Developer Portal API Documentation

Last Updated: September 4, 2025

## Overview

The Trioll Developer Portal uses the AWS API Gateway REST API to manage game uploads and developer data. This document describes all available endpoints and their usage.

## Base URL

```
https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod
```

## Authentication

Currently, the API uses AWS Cognito Identity Pool for authentication:
- **Identity Pool ID**: `us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268`
- Guest access is enabled for basic operations

## Endpoints

### 1. Create Game (NEW)

**Endpoint**: `POST /games`

Creates a new game entry in the system after files have been uploaded to S3.

#### Request Body

```json
{
  "gameId": "string",          // Required: Unique game identifier
  "name": "string",            // Required: Game title
  "description": "string",     // Required: Game description
  "category": "string",        // Required: Game category
  "developer": "string",       // Required: Developer name
  "deviceOrientation": "string", // Required: "Portrait", "Landscape", or "Both"
  "controlStyle": "string",    // Required: Control mechanism
  "gameStage": "string",       // Required: "Pre-release (Feature Testing)" or "Released (In App Store)"
  "deviceCompatibility": ["string"], // Required: Array of supported devices
  "buildId": "string",         // Optional: Build identifier
  "gameUrl": "string",         // Required: URL to game's index.html
  "thumbnailUrl": "string",    // Required: URL to game thumbnail
  "s3Folder": "string",        // Optional: S3 folder name
  "uploadedFiles": number,     // Optional: Number of files uploaded
  "status": "string",          // Optional: Default "active"
  "publishedAt": "string"      // Optional: ISO 8601 timestamp
}
```

#### Device Compatibility Options
- `"Mobile iOS"`
- `"Mobile Android"`
- `"Computer/Laptop"`
- `"All of the Above"`

#### Game Stage Options
- `"Pre-release (Feature Testing)"` - Game is in testing phase
- `"Released (In App Store)"` - Game is publicly available

#### Control Style Options
- `"Tap & Swipe Only"`
- `"Virtual Joystick + Buttons"`
- `"Twin Stick"`
- `"Single Large Button"`
- `"Rhythm Lane"`
- `"Gyro / Tilt"`

#### Response

**Success (201)**:
```json
{
  "success": true,
  "gameId": "game-123456",
  "message": "Game created successfully"
}
```

**Error (400)**:
```json
{
  "error": "Missing required field: name",
  "receivedFields": ["gameId", "description", ...]
}
```

**Error (500)**:
```json
{
  "error": "Failed to create game",
  "details": "Error message"
}
```

### 2. Get All Games

**Endpoint**: `GET /games`

Retrieves a paginated list of all games.

#### Query Parameters

- `limit` (optional): Number of games to return (default: 20)
- `cursor` (optional): Pagination cursor for next page

#### Response

```json
{
  "games": [
    {
      "id": "game-123456",
      "title": "Game Title",
      "developerName": "Developer Name",
      "category": "Action",
      "thumbnailUrl": "https://...",
      "gameUrl": "https://...",
      "gameStage": "Released (In App Store)",
      "deviceCompatibility": ["Mobile iOS", "Mobile Android"],
      "controlStyle": "Tap & Swipe Only",
      "deviceOrientation": "Both",
      "status": "active",
      "playCount": 0,
      "likeCount": 0,
      "rating": 0
    }
  ],
  "hasMore": false,
  "nextCursor": null
}
```

### 3. Get Game by ID

**Endpoint**: `GET /games/{id}`

Retrieves details for a specific game.

#### Response

Returns a single game object with all fields as shown in Get All Games response.

### 4. Search Games

**Endpoint**: `GET /games/search?q={query}`

Search for games by title, description, or category.

#### Query Parameters

- `q` (required): Search query (minimum 2 characters)

#### Response

```json
{
  "games": [/* Array of matching game objects */]
}
```

## S3 Upload Process

Before creating a game via the API, files must be uploaded to S3:

1. **S3 Bucket**: `trioll-prod-games-us-east-1`
2. **Folder Structure**: `{gameId}/` containing:
   - `index.html` - Main game file
   - `thumbnail.png` (or .jpg) - Game thumbnail
   - Other game assets

3. **CloudFront CDN**: Files are served via `https://dk72g9i0333mv.cloudfront.net/{gameId}/`

## Field Mapping

The API performs the following field transformations:
- Frontend `name` → Backend `title`
- Frontend `developer` → Backend `developerName`
- `thumbnailUrl` is mirrored as `imageUrl`
- `gameUrl` is used as both `gameUrl` and `trialUrl`

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success (GET requests)
- `201` - Created (POST requests)
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

## Testing

### Test with cURL

```bash
# Create a new game
curl -X POST https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "test-game-123",
    "name": "Test Game",
    "description": "A test game",
    "category": "Action",
    "developer": "Test Developer",
    "deviceOrientation": "Both",
    "controlStyle": "Tap & Swipe Only",
    "gameStage": "Pre-release (Feature Testing)",
    "deviceCompatibility": ["Mobile iOS", "Mobile Android"],
    "gameUrl": "https://dk72g9i0333mv.cloudfront.net/test-game/index.html",
    "thumbnailUrl": "https://dk72g9i0333mv.cloudfront.net/test-game/thumbnail.png"
  }'

# Get all games
curl https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games?limit=10

# Search games
curl "https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games/search?q=runner"
```

## Lambda Functions

The API is powered by the following AWS Lambda function:
- **Function Name**: `trioll-prod-get-games`
- **Runtime**: Node.js 20.x
- **Region**: us-east-1

## Database

Game data is stored in DynamoDB:
- **Table**: `trioll-prod-games`
- **Primary Key**: `id` (game ID)
- **Region**: us-east-1

### 5. Update Game (NEW - September 6, 2025)

**Endpoint**: `PUT /games/{gameId}`

Updates game metadata for games owned by the authenticated developer.

#### Authentication Required
- **Bearer Token**: Required in Authorization header
- **Client Header**: `X-App-Client: developer-portal`

#### Request Headers
```
Content-Type: application/json
Authorization: Bearer {developerToken}
X-App-Client: developer-portal
```

#### Request Body
```json
{
  "name": "string",          // Game title
  "description": "string",   // Game description
  "category": "string",      // Game category
  "status": "string",        // "active" or "inactive"
  "thumbnailUrl": "string"   // Optional: New thumbnail URL
}
```

#### Response

**Success (200)**:
```json
{
  "success": true,
  "game": {
    "gameId": "horror-pong-1757075261334",
    "name": "Updated Game Name",
    "description": "Updated description",
    "category": "Action",
    "status": "active",
    "developerId": "dev_c84a7e",
    "thumbnailUrl": "https://...",
    "gameUrl": "https://...",
    "updatedAt": "2025-09-06T16:30:00.000Z"
  }
}
```

**Error (403)**:
```json
{
  "success": false,
  "message": "You can only update games you uploaded"
}
```

## Recent Updates

### September 6, 2025
1. Added `PUT /games/{gameId}` endpoint for game updates
2. Added developer ownership verification
3. Added game visibility toggle (active/inactive status)
4. Frontend game management UI implemented

### September 4, 2025
1. Added `POST /games` endpoint for game creation
2. Added support for new fields:
   - `gameStage` - Track pre-release vs released games
   - `deviceCompatibility` - Multi-select device support
3. Enhanced validation with detailed error messages
4. Updated Lambda function to handle both GET and POST requests