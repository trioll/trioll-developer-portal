# Game Data Lifecycle Explanation

## When Game is UPLOADED (Initial Creation)

These fields should be set by the **developer portal** during upload:
```javascript
{
    // Core game data from upload form
    gameId: "game_123456",
    name: "My Awesome Game",
    category: "action",
    description: "An exciting action game",
    developer: "FreddieTrioll",
    developerId: "dev_freddi",
    
    // Technical settings from form
    deviceOrientation: "both",
    controlStyle: "touchscreen", 
    gameStage: "beta",
    deviceCompatibility: ["ios", "android"],
    buildId: "BUILD-12345",
    
    // File locations from S3 upload
    gameUrl: "https://s3.../game/index.html",
    thumbnailUrl: "https://s3.../game/thumb.png",
    s3Folder: "game_123456",
    uploadedFiles: 10,
    
    // Timestamps
    uploadedAt: "2025-09-04T...",
    createdAt: "2025-09-04T...",
    
    // Initial status
    status: "active", // or "inactive" if developer wants to upload but not publish yet
    isActive: true
}
```

## Fields Set by BACKEND on Creation

These should be automatically initialized by the backend:
```javascript
{
    // Statistics (start at 0)
    plays: 0,
    playCount: 0,
    likes: 0,
    likeCount: 0,
    rating: 0,
    ratingCount: 0,
    ratingSum: 0,
    commentCount: 0,
    
    // System fields
    version: "v1",
    publishedAt: "2025-09-04T..." // when first made active
}
```

## Fields Updated During GAMEPLAY (Mobile App)

These get updated when users interact with the game:
```javascript
{
    // Updated by interactions
    plays: 1523,        // increments each play
    likes: 89,          // increments when liked
    rating: 4.5,        // average of all ratings
    ratingCount: 45,    // number of ratings
    commentCount: 12,   // number of comments
    
    // Timestamps updated
    lastPlayedAt: "2025-09-04T...",
    updatedAt: "2025-09-04T..."
}
```

## Comments System

Comments are typically stored in a **separate table** for better scalability:

### Comments Table Structure:
```javascript
{
    commentId: "comment_123",
    gameId: "game_123456",
    userId: "user_789",
    userName: "Player123",
    userAvatar: "https://...",
    comment: "This game is really fun!",
    rating: 5, // if comment includes rating
    createdAt: "2025-09-04T...",
    updatedAt: "2025-09-04T...",
    likes: 3,
    isEdited: false,
    parentCommentId: null // for replies
}
```

### Why Separate?
1. **Performance**: Games table stays small and fast
2. **Scalability**: Comments can grow infinitely
3. **Features**: Easy to add replies, likes, moderation
4. **Queries**: Can paginate comments efficiently

## Current Implementation Status

### ✅ What We Have:
- Developer portal sends game metadata
- Backend creates game record
- S3 stores game files
- DynamoDB stores game data

### ⚠️ What's Missing:
1. **Comments API**: Need endpoints for:
   - POST /games/{gameId}/comments
   - GET /games/{gameId}/comments
   - PUT /comments/{commentId}
   - DELETE /comments/{commentId}

2. **Interactions Update**: The existing interactions API needs to properly update:
   - Play counts
   - Like counts
   - Ratings

3. **Comments Table**: Need to create DynamoDB table for comments

## Recommended Next Steps:

1. **For Upload Process**: Remove these fields from upload:
   ```javascript
   // Don't send these from frontend:
   plays: 0,
   likes: 0,
   rating: 0,
   commentCount: 0
   ```

2. **Let Backend Initialize**: The games-api should set initial values:
   ```javascript
   // Backend adds these automatically:
   plays: 0,
   likes: 0,
   rating: 0,
   ratingCount: 0,
   commentCount: 0
   ```

3. **Create Comments System**: 
   - New DynamoDB table: trioll-prod-comments
   - New Lambda endpoints for comment management
   - Update mobile app to show/post comments

Would you like me to:
1. Update the upload process to remove the stats fields?
2. Create the comments system infrastructure?
3. Show how the mobile app would display comments?