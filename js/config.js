// Trioll Developer Portal Configuration
// This centralizes all configuration values in one place
// In production, these should come from environment variables

const TriollConfig = {
    // AWS Configuration
    aws: {
        region: 'us-east-1',
        identityPoolId: 'us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268',
        apiGatewayId: '4ib0hvu1xj',
        apiEndpoint: 'https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod'
    },
    
    // Cognito Configuration
    cognito: {
        userPoolId: 'us-east-1_cLPH2acQd',
        clientIds: {
            developerPortal: '5joogquqr4jgukp7mncgp3g23h',
            mobileApp: 'bft50gui77sdq2n4lcio4onql',
            webPlatform: '2pp1r86dvfqbbu5fe0b1od3m07'
        }
    },
    
    // S3 Buckets
    storage: {
        gamesBucket: 'trioll-prod-games-us-east-1',
        uploadsBucket: 'trioll-prod-uploads-us-east-1',
        analyticsBucket: 'trioll-prod-analytics-us-east-1',
        backupsBucket: 'trioll-prod-backups-us-east-1'
    },
    
    // DynamoDB Tables
    tables: {
        games: 'trioll-prod-games',
        users: 'trioll-prod-users',
        comments: 'trioll-prod-comments',
        likes: 'trioll-prod-likes',
        ratings: 'trioll-prod-ratings',
        playCounts: 'trioll-prod-playcounts',
        purchaseIntent: 'trioll-prod-purchase-intent'
    },
    
    // CloudFront CDNs
    cdn: {
        primary: 'dgq2nqysbn2z3.cloudfront.net',
        legacy: 'dk72g9i0333mv.cloudfront.net'
    },
    
    // Application Settings
    app: {
        name: 'Trioll Developer Portal',
        version: '1.0.0',
        environment: 'production',
        debugMode: false
    },
    
    // Feature Flags
    features: {
        enableAnalytics: true,
        enableComments: true,
        enablePurchaseIntent: true,
        enableWebSocketSupport: false,
        enableDebugConsole: true
    },
    
    // API Rate Limits
    rateLimits: {
        uploadSizeMB: 100,
        maxFilesPerUpload: 500,
        apiCallsPerMinute: 60
    },
    
    // Helper method to get full API URL
    getApiUrl: function(endpoint) {
        return `${this.aws.apiEndpoint}${endpoint}`;
    },
    
    // Helper method to get S3 URL
    getS3Url: function(bucket, key) {
        return `https://${bucket}.s3.amazonaws.com/${key}`;
    },
    
    // Helper method to get CDN URL
    getCdnUrl: function(gameId, file = 'index.html') {
        return `https://${this.cdn.primary}/${gameId}/${file}`;
    },
    
    // Environment detection
    isDevelopment: function() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1';
    },
    
    // Debug logging
    log: function(...args) {
        if (this.app.debugMode || this.isDevelopment()) {
            console.log('[Trioll]', ...args);
        }
    }
};

// Freeze the configuration to prevent accidental changes
Object.freeze(TriollConfig);
Object.freeze(TriollConfig.aws);
Object.freeze(TriollConfig.cognito);
Object.freeze(TriollConfig.cognito.clientIds);
Object.freeze(TriollConfig.storage);
Object.freeze(TriollConfig.tables);
Object.freeze(TriollConfig.cdn);
Object.freeze(TriollConfig.app);
Object.freeze(TriollConfig.features);
Object.freeze(TriollConfig.rateLimits);

// Export for use
window.TriollConfig = TriollConfig;