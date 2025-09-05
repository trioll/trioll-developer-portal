# IAM Role Change Documentation - September 5, 2025

## Critical Configuration Change Made

### What Was Changed
**Date/Time**: September 5, 2025 at 21:02 GMT
**AWS Service**: Cognito Identity Pool
**Identity Pool**: TriollMobileIdentityPool (us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268)
**Change Made**: Updated Authenticated Role from `trioll-staging-auth-role` to `trioll-prod-auth-role`

### Why This Change Was Made
The developer portal was failing to upload games with the error:
```
User: arn:aws:sts::561645284740:assumed-role/trioll-staging-auth-role/CognitoIdentityCredentials 
is not authorized to perform: s3:PutObject on resource: 
"arn:aws:s3:::trioll-prod-games-us-east-1/cannon-shot-1757100838419/thumbnail.png"
```

**Root Cause**: The Identity Pool was configured with a staging role (`trioll-staging-auth-role`) but the developer portal was trying to upload to the production S3 bucket (`trioll-prod-games-us-east-1`). The staging role didn't have permissions to write to the production bucket.

## Potential Impact on Mobile App

### ⚠️ CRITICAL: This Identity Pool is shared with the Trioll Mobile App

The Identity Pool `TriollMobileIdentityPool` is used by BOTH:
1. **Trioll Developer Portal** (web)
2. **Trioll Mobile App** (React Native)

### Possible Impacts:

#### 1. **Positive Impacts** ✅
- Mobile app users will now use production resources consistently
- Better security alignment (production role for production resources)
- Unified permissions across web and mobile

#### 2. **Potential Issues** ⚠️
- If the mobile app was relying on staging resources, it may lose access
- Any staging-specific permissions in `trioll-staging-auth-role` are no longer available
- Mobile app S3 uploads/downloads might be affected if they were using staging buckets

### What to Check in Mobile App

1. **Authentication Flow**
   - Verify users can still sign up and log in
   - Check if guest mode still works
   - Ensure token refresh works properly

2. **S3 Operations**
   - Test game asset downloads
   - Test user profile image uploads (if applicable)
   - Verify saved game data uploads/downloads

3. **API Calls**
   - Ensure all API endpoints still work
   - Check if any APIs were staging-specific

## Mobile App Code References

Based on the CLAUDE.md file, the mobile app uses:

```javascript
// AWS Infrastructure (us-east-1 N. Virginia)
// Authentication (Cognito)
- User Pool ID: us-east-1_cLPH2acQd
- Client ID: bft50gui77sdq2n4lcio4onql  
- Identity Pool ID: us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268
- Guest Role: trioll-guest-role
- Auth Role: trioll-auth-role (NOW: trioll-prod-auth-role)
```

## Rollback Plan

If the mobile app experiences issues:

1. **Quick Rollback**:
   - Go to AWS Cognito Console > Identity Pools
   - Select `TriollMobileIdentityPool`
   - Edit authenticated role back to `trioll-staging-auth-role`
   - Save changes

2. **Alternative Fix**:
   - Keep the production role
   - Add necessary permissions to `trioll-prod-auth-role` that were in staging role
   - Or create separate Identity Pools for web and mobile

## Testing Checklist

### Developer Portal (Web) ✅
- [x] Login works
- [x] Game upload works
- [x] S3 uploads successful
- [ ] Game deletion works
- [ ] All API endpoints functional

### Mobile App (Needs Testing) ⚠️
- [ ] User registration
- [ ] User login
- [ ] Guest mode access
- [ ] Game browsing
- [ ] Game playing
- [ ] Profile updates
- [ ] S3 asset loading
- [ ] Analytics events
- [ ] Social features

## Recommended Actions

1. **Immediate**:
   - Test the mobile app thoroughly
   - Monitor CloudWatch logs for any new errors
   - Check if mobile app users report issues

2. **Short-term**:
   - Review permissions in both roles:
     - `trioll-staging-auth-role` (old)
     - `trioll-prod-auth-role` (new)
   - Document any missing permissions

3. **Long-term**:
   - Consider separate Identity Pools for web and mobile
   - Implement proper staging/production separation
   - Update mobile app to handle multiple environments

## Configuration Backup

### Previous Configuration
```json
{
  "IdentityPoolId": "us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268",
  "IdentityPoolName": "TriollMobileIdentityPool",
  "AuthenticatedRole": "trioll-staging-auth-role",
  "UnauthenticatedRole": "trioll-guest-role"
}
```

### Current Configuration
```json
{
  "IdentityPoolId": "us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268",
  "IdentityPoolName": "TriollMobileIdentityPool",
  "AuthenticatedRole": "trioll-prod-auth-role",
  "UnauthenticatedRole": "trioll-guest-role"
}
```

## Contact for Issues

If mobile app users report issues:
1. Check CloudWatch logs for the Identity Pool
2. Review IAM role permissions
3. Rollback if necessary
4. Consider implementing the alternative fixes mentioned above

---

**Document Created**: September 5, 2025
**Created By**: Claude (AI Assistant)
**Reason**: Document IAM role change that fixed developer portal uploads but may impact mobile app