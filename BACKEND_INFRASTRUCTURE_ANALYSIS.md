# Backend Infrastructure Analysis - Trioll Platform
**Date**: September 10, 2025  
**Scope**: Shared backend serving both Trioll Mobile App & triolldev.com

## Executive Summary

The backend infrastructure is shared between the Trioll Mobile app and triolldev.com developer portal. Recent analysis shows API Gateway misconfigurations causing "Failed to fetch" errors on triolldev.com.

## Critical Issues Identified

### 1. API Gateway Lambda Mapping Issues

**Problem**: Multiple Lambda functions serve the same endpoints, causing inconsistent behavior.

| Endpoint | Current Lambda | Should Use | Impact |
|----------|---------------|------------|--------|
| GET /games | trioll-prod-get-games | trioll-prod-games-api | Old code, missing fixes |
| GET /games/{id} | trioll-staging-games-api | trioll-prod-games-api | Staging in prod! |
| GET /games/{id}/likes | trioll-prod-like-counter | trioll-prod-interactions-api | Random data |
| GET /games/{id}/plays | trioll-prod-play-counter | trioll-prod-interactions-api | Random data |
| GET /games/{id}/ratings | trioll-prod-star-rating | trioll-prod-interactions-api | Random data |

**Impact on triolldev.com**: 
- Network errors when fetching games
- Inconsistent data between list and detail views
- Analytics showing fake data

**Impact on Mobile App**:
- Different Lambda functions for same resource
- Inconsistent behavior across endpoints
- Performance issues from multiple functions

### 2. CORS Configuration

**Current State**: API Gateway uses wildcard (*) CORS which should include triolldev.com, but implementation may be incomplete.

**S3 Buckets**:
- `trioll-prod-games-us-east-1`: CORS configuration needed verification
- `trioll-prod-uploads-us-east-1`: Missing CORS for browser uploads

### 3. CloudFront CDN Architecture

**Two CDN Distributions**:
1. **Mobile App CDN**: d2wg7sn99og2se.cloudfront.net (primary for app)
2. **Developer Portal CDN**: dgq2nqysbn2z3.cloudfront.net (for uploaded games)

Both are active and serving content correctly.

### 4. IAM Role Naming Issue

**Current**: Using `trioll-staging-auth-role` and `trioll-staging-guest-role`
**Important**: These ARE the production roles - DO NOT change to "prod" named roles

## Infrastructure Components

### API Gateway
- **ID**: 4ib0hvu1xj
- **Region**: us-east-1
- **Base URL**: https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod
- **Stages**: prod (active)

### Lambda Functions (Active)
1. **trioll-prod-games-api** - Should handle all game operations
2. **trioll-prod-interactions-api** - Handles likes, plays, ratings, comments
3. **trioll-prod-users-api** - User management and developer auth
4. **trioll-prod-analytics-api** - Analytics tracking
5. **trioll-prod-search-games** - Search functionality

### Lambda Functions (To Deprecate)
- trioll-prod-get-games
- trioll-staging-games-api  
- trioll-prod-like-counter
- trioll-prod-play-counter
- trioll-prod-star-rating
- trioll-prod-games-update-api

### DynamoDB Tables
- **trioll-prod-games**: Game metadata and stats
- **trioll-prod-users**: User profiles
- **trioll-prod-likes**: Like tracking
- **trioll-prod-ratings**: Rating data
- **trioll-prod-playcounts**: Play statistics
- **trioll-prod-comments**: Game comments
- **trioll-prod-purchase-intent**: Purchase tracking

### S3 Buckets
1. **trioll-prod-games-us-east-1**
   - Purpose: Game files storage
   - Access: Public read via CloudFront
   - CORS: Needs configuration for triolldev.com

2. **trioll-prod-uploads-us-east-1**
   - Purpose: User uploads (profiles, etc)
   - Access: Authenticated users
   - CORS: Missing, needed for browser uploads

### Cognito
- **User Pool ID**: us-east-1_cLPH2acQd
- **Client IDs**: 
  - Mobile: bft50gui77sdq2n4lcio4onql
  - Developer Portal: 5joogquqr4jgukp7mncgp3g23h
- **Identity Pool**: us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268

## Recommended Actions

### Immediate Fixes (Priority 1)
1. **Fix API Gateway Routes**:
   ```bash
   # Update GET /games to use trioll-prod-games-api
   # Update GET /games/{id} to use trioll-prod-games-api
   # Update GET interactions to use trioll-prod-interactions-api
   ```

2. **Configure S3 CORS**:
   ```json
   {
     "CORSRules": [{
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
       "AllowedOrigins": ["https://triolldev.com", "https://www.triolldev.com"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }]
   }
   ```

3. **Add Error Handling** in triolldev.com for network failures

### Medium Priority
1. Consolidate Lambda functions
2. Remove deprecated functions
3. Set up monitoring dashboards
4. Enable DynamoDB backups

### Low Priority  
1. Rename IAM roles (risky, low value)
2. Optimize Lambda memory allocation
3. Set up cost alerts

## Testing Plan

1. **Before Changes**:
   - Document current behavior
   - Take API response snapshots
   - Note error patterns

2. **After Each Change**:
   - Test triolldev.com functionality
   - Test mobile app endpoints
   - Verify data consistency

3. **Validation**:
   - All developer portal features work
   - Mobile app maintains functionality
   - No data loss or corruption

## Risk Assessment

- **High Risk**: Changing IAM role names (DON'T DO)
- **Medium Risk**: Consolidating Lambda functions
- **Low Risk**: Adding CORS headers, fixing routes

## Conclusion

The infrastructure is well-architected but has configuration drift. The main issue is API Gateway using old Lambda functions. Fixing the route mappings should resolve most "Failed to fetch" errors on triolldev.com.