# Configuration Migration Guide

## How to Use the New Config System

### 1. Add Config Script to HTML
```html
<!-- Add this before other scripts in index.html -->
<script src="js/config.js"></script>
```

### 2. Replace Hardcoded Values

#### Before:
```javascript
const AWS_CONFIG = {
    region: 'us-east-1',
    identityPoolId: 'us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268',
    gamesBucket: 'trioll-prod-games-us-east-1',
    apiEndpoint: 'https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod'
};
```

#### After:
```javascript
const AWS_CONFIG = {
    region: TriollConfig.aws.region,
    identityPoolId: TriollConfig.aws.identityPoolId,
    gamesBucket: TriollConfig.storage.gamesBucket,
    apiEndpoint: TriollConfig.aws.apiEndpoint
};
```

### 3. Replace Client ID References

#### Before:
```javascript
const portalClientId = '5joogquqr4jgukp7mncgp3g23h';
```

#### After:
```javascript
const portalClientId = TriollConfig.cognito.clientIds.developerPortal;
```

### 4. Use Helper Methods

#### API Calls:
```javascript
// Before
const url = `${AWS_CONFIG.apiEndpoint}/developers/games`;

// After
const url = TriollConfig.getApiUrl('/developers/games');
```

#### S3 URLs:
```javascript
// Before
const gameUrl = `https://trioll-prod-games-us-east-1.s3.amazonaws.com/${gameId}/index.html`;

// After
const gameUrl = TriollConfig.getS3Url(TriollConfig.storage.gamesBucket, `${gameId}/index.html`);
```

### 5. Environment-Specific Behavior

```javascript
// Use debug logging
TriollConfig.log('Loading games...', games);

// Check environment
if (TriollConfig.isDevelopment()) {
    console.log('Running in development mode');
}

// Check features
if (TriollConfig.features.enableAnalytics) {
    initAnalytics();
}
```

## Benefits

1. **Single Source of Truth**: All config in one place
2. **Type Safety**: Config is frozen to prevent accidental changes
3. **Environment Support**: Easy to switch between dev/prod
4. **Feature Flags**: Enable/disable features easily
5. **Helper Methods**: Simplified URL building
6. **Debug Control**: Conditional logging

## Next Steps

1. Update `index.html` to include config.js
2. Replace hardcoded values with config references
3. Test thoroughly
4. Consider adding environment variable support for production
5. Document any new config values added

## For Backend (Lambda Functions)

Create a similar config module:

```javascript
// config/index.js for Lambda
module.exports = {
    tables: {
        games: process.env.GAMES_TABLE || 'trioll-prod-games',
        users: process.env.USERS_TABLE || 'trioll-prod-users',
        // etc...
    },
    cognito: {
        userPoolId: process.env.USER_POOL_ID || 'us-east-1_cLPH2acQd',
        clientIds: {
            developerPortal: process.env.DEV_PORTAL_CLIENT_ID || '5joogquqr4jgukp7mncgp3g23h',
            // etc...
        }
    }
    // etc...
};
```

Then in Lambda functions:
```javascript
const config = require('./config');
const GAMES_TABLE = config.tables.games;
const developerClientId = config.cognito.clientIds.developerPortal;
```

This approach makes the system more maintainable and ready for multiple environments.