# Hardcoded Values Audit & Cleanup Plan
*Generated: September 17, 2025*

## 🚨 Critical Security Issues to Fix

### 1. **Personal Email Address** (HIGH PRIORITY)
- **Found**: `freddiecaplin@hotmail.com` in multiple files
- **Risk**: Privacy concern, not scalable
- **Fix**: Replace with environment variable or remove entirely

### 2. **JWT Secret Placeholder**
- **Found**: `'your-jwt-secret'` in games-update-api-fixed.js
- **Risk**: Security vulnerability if deployed
- **Fix**: Use AWS Secrets Manager or environment variable

## ⚠️ Configuration Issues to Address

### 3. **Client IDs**
Currently hardcoded: `5joogquqr4jgukp7mncgp3g23h`

**Recommended approach**:
```javascript
// config/clients.js
const COGNITO_CLIENTS = {
  DEVELOPER_PORTAL: process.env.DEVELOPER_PORTAL_CLIENT_ID || '5joogquqr4jgukp7mncgp3g23h',
  MOBILE_APP: process.env.MOBILE_APP_CLIENT_ID || 'bft50gui77sdq2n4lcio4onql',
  WEB_PLATFORM: process.env.WEB_PLATFORM_CLIENT_ID || '2pp1r86dvfqbbu5fe0b1od3m07'
};
```

### 4. **AWS Resources**
Create a central configuration:

```javascript
// config/aws-resources.js
module.exports = {
  tables: {
    GAMES: process.env.GAMES_TABLE || 'trioll-prod-games',
    USERS: process.env.USERS_TABLE || 'trioll-prod-users',
    COMMENTS: process.env.COMMENTS_TABLE || 'trioll-prod-comments'
  },
  buckets: {
    GAMES: process.env.GAMES_BUCKET || 'trioll-prod-games-us-east-1',
    UPLOADS: process.env.UPLOADS_BUCKET || 'trioll-prod-uploads-us-east-1'
  },
  api: {
    GATEWAY_ID: process.env.API_GATEWAY_ID || '4ib0hvu1xj',
    REGION: process.env.AWS_REGION || 'us-east-1'
  },
  cognito: {
    USER_POOL_ID: process.env.USER_POOL_ID || 'us-east-1_cLPH2acQd',
    IDENTITY_POOL_ID: process.env.IDENTITY_POOL_ID || 'us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268'
  }
};
```

## 📋 Files Needing Updates

### Backend Files with Hardcoded Values:
1. **assign-historical-games.js** - Remove specific email/developer ID
2. **fix-developer-ids.js** - Make generic or archive
3. **standardize-developer-ids.js** - Make generic or archive
4. **games-api-hotfix.js** - Remove specific references
5. **users-api-with-cognito-attributes.js** - Use config
6. **lambda-code-node22.js** - Remove test data

### Frontend Files:
1. **index.html** - Move AWS config to separate config file
2. **auth-service.js** - Use environment-based configuration

### Test Files:
- Remove or move to a separate test directory
- Add .gitignore entries for test files

## 🔧 Recommended Actions

### 1. Create Configuration Module
```javascript
// config/index.js
const getConfig = () => {
  const env = process.env.NODE_ENV || 'production';
  
  return {
    aws: require('./aws-resources'),
    auth: require('./auth-config'),
    api: {
      baseUrl: process.env.API_BASE_URL || 
        `https://${process.env.API_GATEWAY_ID || '4ib0hvu1xj'}.execute-api.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/prod`
    },
    isDevelopment: env === 'development',
    isProduction: env === 'production'
  };
};

module.exports = getConfig();
```

### 2. Environment Variables Template
Create `.env.template`:
```bash
# AWS Configuration
AWS_REGION=us-east-1
API_GATEWAY_ID=4ib0hvu1xj

# Cognito
USER_POOL_ID=us-east-1_cLPH2acQd
IDENTITY_POOL_ID=us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268
DEVELOPER_PORTAL_CLIENT_ID=5joogquqr4jgukp7mncgp3g23h

# DynamoDB Tables
GAMES_TABLE=trioll-prod-games
USERS_TABLE=trioll-prod-users
COMMENTS_TABLE=trioll-prod-comments

# S3 Buckets
GAMES_BUCKET=trioll-prod-games-us-east-1
UPLOADS_BUCKET=trioll-prod-uploads-us-east-1

# Remove in production
DEBUG_MODE=false
```

### 3. Clean Console Logs
Add a build step to remove console.logs in production:
```javascript
// build-utils/remove-logs.js
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
}
```

## 🚀 Implementation Priority

1. **URGENT**: Remove personal email addresses
2. **HIGH**: Fix JWT secret placeholder
3. **MEDIUM**: Centralize AWS resource configuration
4. **MEDIUM**: Move client IDs to config
5. **LOW**: Clean up test files and console logs

## 📝 Next Steps

1. Create a `config/` directory for all configuration
2. Update Lambda environment variables in AWS
3. Update deployment scripts to use config
4. Archive or remove developer-specific scripts
5. Add proper .gitignore entries
6. Document configuration in README

## 🔒 Security Checklist

- [ ] No personal emails in code
- [ ] No hardcoded secrets
- [ ] No test data in production files
- [ ] Configuration separated from code
- [ ] Environment-specific configs
- [ ] Sensitive data in AWS Secrets Manager
- [ ] Console logs removed/controlled

This cleanup will make the codebase more secure, maintainable, and ready for multiple developers and environments.