# Developer Authentication Implementation Task List

## Overview
Implementation plan that **keeps PIN protection** as the first gate, then adds developer authentication after PIN entry.

## ⚠️ IMPORTANT: Developer Portal Separation

This implementation creates **separate infrastructure** for the developer portal (triolldev.com) that is **independent from the mobile app**:

- **Separate Cognito App Client** - Not shared with mobile app
- **Separate IAM Role** - `trioll-developer-portal-role` with specific permissions
- **Separate CORS Settings** - Only allowing triolldev.com origin
- **Separate User Type** - Developers vs Players distinction
- **Separate Token Management** - Developer tokens ≠ Player tokens

While we're using the same Cognito User Pool and DynamoDB tables, the **access patterns and permissions are completely separate** to ensure security isolation between the developer portal and consumer mobile app.

## Flow: PIN → Login/Signup → Developer Portal

```
1. User visits triolldev.com
2. Enter PIN: 477235
3. See login screen (or signup)
4. Authenticate as developer
5. Access portal with auto-populated developer ID
```

---

## 🔍 Phase 0: Infrastructure Audit & Preparation (Day 1 Morning)

### AWS IAM Policies - DEVELOPER PORTAL SPECIFIC
- [ ] **Create NEW Cognito App Client** specifically for triolldev.com
  - [ ] Name: `trioll-developer-portal-client`
  - [ ] Different from mobile app client
  - [ ] Enable USER_PASSWORD_AUTH flow
- [ ] **Create Developer-Specific IAM Role**
  - [ ] Name: `trioll-developer-portal-role`
  - [ ] Trust relationship with Cognito Identity Pool
  - [ ] Permissions needed:
    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "s3:PutObject",
            "s3:GetObject"
          ],
          "Resource": "arn:aws:s3:::trioll-prod-games-us-east-1/*"
        },
        {
          "Effect": "Allow",
          "Action": [
            "execute-api:Invoke"
          ],
          "Resource": "arn:aws:execute-api:us-east-1:*:*/prod/POST/games"
        },
        {
          "Effect": "Allow",
          "Action": [
            "execute-api:Invoke"
          ],
          "Resource": "arn:aws:execute-api:us-east-1:*:*/prod/*/developers/*"
        }
      ]
    }
    ```
- [ ] **Update Cognito Identity Pool**
  - [ ] Add authenticated role mapping for developer portal users
  - [ ] Map `trioll-developer-portal-role` to authenticated developers
  - [ ] Keep mobile app roles separate
- [ ] **Configure CORS for triolldev.com**
  - [ ] Update S3 bucket CORS to include `https://triolldev.com`
  - [ ] Update API Gateway CORS headers
  - [ ] Add triolldev.com to allowed origins

### Cognito User Pool Configuration - DEVELOPER SPECIFIC
- [ ] **Create App Client for Developer Portal**
  ```bash
  aws cognito-idp create-user-pool-client \
    --user-pool-id us-east-1_cLPH2acQd \
    --client-name "Trioll Developer Portal" \
    --explicit-auth-flows USER_PASSWORD_AUTH \
    --generate-secret false \
    --allowed-o-auth-flows-user-pool-client \
    --callback-urls "https://triolldev.com/auth/callback" \
    --logout-urls "https://triolldev.com"
  ```
- [ ] **Add Custom Attributes** (if not exists)
  - [ ] `custom:developer_id` (String)
  - [ ] `custom:company_name` (String) 
  - [ ] `custom:user_type` (String) - to distinguish developers from players
- [ ] **Configure Developer Group**
  - [ ] Create Cognito User Pool Group: `developers`
  - [ ] Attach IAM role to group (optional)
  - [ ] Set precedence value

### DynamoDB Tables Audit
- [ ] Verify `trioll-prod-users` table exists and is active
- [ ] Check if email-index GSI exists on users table
- [ ] Verify read/write capacity or on-demand pricing
- [ ] Check `trioll-prod-games` table structure
- [ ] Plan GSI for developerId on games table
- [ ] Estimate capacity needs for developer queries

### API Gateway Configuration - DEVELOPER PORTAL SPECIFIC
- [ ] **Update CORS settings** to specifically allow triolldev.com:
  ```json
  {
    "Access-Control-Allow-Origin": "https://triolldev.com",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
  }
  ```
- [ ] **Configure Cognito Authorizer** for developer endpoints
  - [ ] Use the new developer portal app client ID
  - [ ] Apply to `/developers/*` routes
  - [ ] Keep mobile app authorizer separate
- [ ] **Set Rate Limiting** for developer portal
  - [ ] 100 requests per minute per developer
  - [ ] 10 game uploads per hour per developer
- [ ] **Create API Keys** (optional)
  - [ ] For future programmatic access
  - [ ] Usage plans for different developer tiers

### S3 Bucket Policies - DEVELOPER PORTAL SPECIFIC
- [ ] **Update bucket CORS** for `trioll-prod-games-us-east-1`:
  ```xml
  <CORSConfiguration>
    <CORSRule>
      <AllowedOrigin>https://triolldev.com</AllowedOrigin>
      <AllowedMethod>PUT</AllowedMethod>
      <AllowedMethod>POST</AllowedMethod>
      <AllowedMethod>GET</AllowedMethod>
      <AllowedHeader>*</AllowedHeader>
      <ExposeHeader>ETag</ExposeHeader>
    </CORSRule>
  </CORSConfiguration>
  ```
- [ ] **Add bucket policy** to allow developer uploads:
  ```json
  {
    "Effect": "Allow",
    "Principal": {
      "AWS": "arn:aws:iam::ACCOUNT:role/trioll-developer-portal-role"
    },
    "Action": ["s3:PutObject", "s3:PutObjectAcl"],
    "Resource": "arn:aws:s3:::trioll-prod-games-us-east-1/*",
    "Condition": {
      "StringEquals": {
        "s3:x-amz-acl": "public-read"
      }
    }
  }
  ```

### Lambda Functions Audit
- [ ] Test current users-api.js endpoints
- [ ] Check games-api.js POST endpoint works
- [ ] Verify Lambda timeout settings (30s recommended)
- [ ] Check CloudWatch logs access
- [ ] Review environment variables configuration
- [ ] **Add Environment Variables** for developer portal:
  - [ ] `DEVELOPER_APP_CLIENT_ID` = new client ID
  - [ ] `ALLOWED_ORIGINS` = "https://triolldev.com"

---

## 🔧 Phase 1: Backend API Updates (Day 1)

### Update users-api.js Lambda
- [ ] Add `/developers/register` endpoint
  - [ ] Generate unique developer ID (dev_xxxxxx)
  - [ ] Set userType = 'developer' 
  - [ ] Store company name and website
  - [ ] Create Cognito user with custom attributes
  - [ ] Save developer profile to DynamoDB
- [ ] Add `/developers/profile` GET endpoint
  - [ ] Return developer info including developerId
  - [ ] Include games count (future)
- [ ] Add `/developers/verify-email` POST endpoint
  - [ ] Handle email verification for developers
- [ ] Test all endpoints with Postman/curl
- [ ] Add comprehensive error handling
- [ ] Add CloudWatch logging for debugging

### Update games-api.js Lambda  
- [ ] Modify POST /games to extract developerId from JWT token
- [ ] Add developerId and developerEmail to game records
- [ ] Add validation to ensure developer owns the game
- [ ] Add GET `/developers/games` endpoint
  - [ ] Query games by developerId (needs GSI)
- [ ] Update field mapping to include developer fields
- [ ] Test with authenticated requests

### Create/Update DynamoDB Indexes
- [ ] Create GSI on games table:
  ```bash
  aws dynamodb update-table \
    --table-name trioll-prod-games \
    --attribute-definitions AttributeName=developerId,AttributeType=S \
    --global-secondary-indexes ... 
  ```
- [ ] Wait for index to become ACTIVE
- [ ] Test queries on new index

### Deploy Lambda Functions
- [ ] Package users-api.js with dependencies
- [ ] Deploy users-api to Lambda
- [ ] Package games-api.js with dependencies  
- [ ] Deploy games-api to Lambda
- [ ] Test endpoints via API Gateway

---

## 🎨 Phase 2: Frontend UI Updates (Day 2)

### Modify PIN Flow
- [ ] Keep existing PIN lock screen
- [ ] After correct PIN, show login/signup choice screen
- [ ] Create smooth transition from PIN to auth

### Create Authentication UI
- [ ] Design login form matching Trioll aesthetic
  - [ ] Email input
  - [ ] Password input  
  - [ ] "Remember me" checkbox
  - [ ] "Forgot password" link
  - [ ] "New developer? Sign up" link
- [ ] Design signup form
  - [ ] Email (required)
  - [ ] Password (required, show requirements)
  - [ ] Company/Developer Name (required)
  - [ ] Website (optional)
  - [ ] Terms of Service checkbox
  - [ ] "Already registered? Login" link
- [ ] Create email verification screen
  - [ ] 6-digit code input
  - [ ] Resend code button
  - [ ] Cancel/back button

### Update AWS Configuration for Developer Portal
- [ ] **Update AWS config** in index.html:
  ```javascript
  const AWS_CONFIG = {
    region: 'us-east-1',
    identityPoolId: 'us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268',
    userPoolId: 'us-east-1_cLPH2acQd',
    clientId: 'NEW_DEVELOPER_PORTAL_CLIENT_ID', // ← New client ID
    gamesBucket: 'trioll-prod-games-us-east-1',
    apiEndpoint: 'https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod'
  };
  ```
- [ ] **Configure AWS Amplify** for developer auth:
  ```javascript
  Amplify.configure({
    Auth: {
      region: 'us-east-1',
      userPoolId: 'us-east-1_cLPH2acQd',
      userPoolWebClientId: 'NEW_DEVELOPER_PORTAL_CLIENT_ID',
      identityPoolId: 'us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268',
      authenticationFlowType: 'USER_PASSWORD_AUTH'
    }
  });
  ```

### Implement Authentication Logic
- [ ] Create `AuthService` class
  - [ ] signup() method
  - [ ] login() method
  - [ ] logout() method
  - [ ] refreshToken() method
  - [ ] getCurrentDeveloper() method
- [ ] Handle JWT token storage (localStorage)
- [ ] Implement token refresh before expiry
- [ ] Add auth headers to all API calls
- [ ] Handle 401 errors (redirect to login)
- [ ] **Use developer-specific credentials**:
  - [ ] Different from mobile app tokens
  - [ ] Include developer claims in JWT

### Update Upload Form
- [ ] Auto-populate developer name field
- [ ] Disable developer name field editing
- [ ] Add developer badge showing:
  - [ ] Company name
  - [ ] Developer ID
- [ ] Add hidden developerId field
- [ ] Include auth token in upload API call

### Add Developer Info Header
- [ ] Show logged-in developer info
- [ ] Display developer ID
- [ ] Add logout button
- [ ] Show "Switch Account" option

---

## 📊 Phase 3: Developer Dashboard (Day 3)

### Create Dashboard UI
- [ ] Design dashboard layout
  - [ ] Developer profile section
  - [ ] Quick stats cards (games, plays, ratings)
  - [ ] Games grid/list view
  - [ ] Future: Analytics placeholder
- [ ] Implement responsive design
- [ ] Match Trioll design system

### Dashboard Functionality
- [ ] Load developer profile on login
- [ ] Fetch developer's games via API
- [ ] Calculate and display stats
- [ ] Add game management options:
  - [ ] View game
  - [ ] Edit game metadata (future)
  - [ ] Toggle game visibility (future)
- [ ] Add refresh functionality
- [ ] Handle empty state (no games yet)

### Navigation Updates
- [ ] Add "Dashboard" to main navigation
- [ ] Update navigation to show when authenticated
- [ ] Highlight active section
- [ ] Mobile-responsive navigation

---

## 🔒 Phase 4: Security & Error Handling (Day 4)

### Frontend Security
- [ ] Implement secure token storage
- [ ] Add token expiration checks
- [ ] Clear tokens on logout
- [ ] Prevent authenticated route access without login
- [ ] Add CSRF protection if needed

### Backend Security
- [ ] Validate JWT tokens on every request
- [ ] Verify developer owns resources they're accessing
- [ ] Add rate limiting per developer
- [ ] Implement request validation
- [ ] Sanitize all inputs

### Error Handling
- [ ] User-friendly error messages
- [ ] Network error recovery
- [ ] Token refresh error handling
- [ ] Form validation with clear messages
- [ ] Loading states for all async operations

### Audit Trail
- [ ] Log all developer actions
- [ ] Track game uploads by developer
- [ ] Monitor failed login attempts
- [ ] Set up CloudWatch alarms

---

## 🧪 Phase 5: Testing & QA (Day 4-5)

### Unit Testing
- [ ] Test developer ID generation uniqueness
- [ ] Test JWT token validation
- [ ] Test database operations
- [ ] Test API endpoint responses

### Integration Testing
- [ ] Test full signup flow
- [ ] Test email verification
- [ ] Test login flow
- [ ] Test game upload with auth
- [ ] Test dashboard data accuracy
- [ ] Test token refresh

### User Acceptance Testing
- [ ] PIN → Login flow smooth
- [ ] Signup process intuitive
- [ ] Upload process unchanged (except auth)
- [ ] Dashboard loads correctly
- [ ] Logout works properly

### Performance Testing
- [ ] API response times < 1s
- [ ] Dashboard loads < 2s
- [ ] No memory leaks
- [ ] Works on slow connections

### Security Testing
- [ ] Try accessing without PIN
- [ ] Try accessing without auth
- [ ] Test SQL injection attempts
- [ ] Test XSS attempts
- [ ] Verify HTTPS only

---

## 🚀 Phase 6: Deployment (Day 5)

### Pre-deployment Checklist
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Backup current version
- [ ] Deployment scripts ready

### Deploy Backend
- [ ] Deploy users-api.js updates
- [ ] Deploy games-api.js updates
- [ ] Verify Lambda functions active
- [ ] Test API endpoints live
- [ ] Check CloudWatch logs

### Deploy Frontend
- [ ] Build production version
- [ ] Deploy to hosting (Vercel/GitHub Pages)
- [ ] Verify all assets loading
- [ ] Test authentication flow
- [ ] Check console for errors

### Post-deployment
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify email delivery
- [ ] Test with real developer
- [ ] Announce to developers

---

## 📈 Phase 7: Monitoring & Support (Ongoing)

### Monitoring Setup
- [ ] CloudWatch dashboards for:
  - [ ] API errors
  - [ ] Lambda performance  
  - [ ] DynamoDB throttling
  - [ ] Failed logins
- [ ] Set up alerts for critical errors
- [ ] Daily developer signup report

### Documentation
- [ ] Update API documentation
- [ ] Create developer onboarding guide
- [ ] Document common issues
- [ ] Create video walkthrough

### Future Enhancements List
- [ ] Password reset functionality
- [ ] Social login (Google/GitHub)
- [ ] Team accounts
- [ ] API keys for CLI uploads
- [ ] Detailed analytics dashboard
- [ ] Developer forums/support

---

## ⚠️ Critical Checkpoints

Before proceeding to next phase, verify:

### After Phase 0:
- ✓ All AWS permissions confirmed
- ✓ No blocking infrastructure issues
- ✓ Capacity planning done

### After Phase 1:
- ✓ All API endpoints tested
- ✓ Database indexes active
- ✓ No Lambda errors

### After Phase 2:
- ✓ Auth flow works end-to-end
- ✓ Tokens properly stored/used
- ✓ UI responsive on mobile

### After Phase 3:
- ✓ Dashboard shows correct data
- ✓ Developer's games loading
- ✓ Stats calculating properly

### After Phase 4:
- ✓ Security audit complete
- ✓ Error handling comprehensive
- ✓ Logging working

### After Phase 5:
- ✓ All tests passing
- ✓ Performance acceptable
- ✓ Security verified

---

## 📞 Rollback Plan

If issues arise:
1. Frontend: Revert to previous version
2. Lambda: Use function versioning to rollback
3. Keep PIN-only access as emergency fallback
4. Have hotfix process ready

---

## Success Metrics

- [ ] 0 critical errors in first 48 hours
- [ ] < 2s page load times
- [ ] 95%+ successful login rate
- [ ] Positive developer feedback
- [ ] No security incidents

---

## 📋 Quick Reference: New AWS Resources for Developer Portal

### Resources to Create:
1. **Cognito App Client**: `trioll-developer-portal-client`
2. **IAM Role**: `trioll-developer-portal-role`
3. **Cognito User Pool Group**: `developers`
4. **DynamoDB GSI**: `developerId-index` on games table
5. **Lambda Environment Variables**:
   - `DEVELOPER_APP_CLIENT_ID`
   - `ALLOWED_ORIGINS`

### Resources to Update:
1. **S3 Bucket CORS**: Add `https://triolldev.com`
2. **API Gateway CORS**: Add developer portal origin
3. **Cognito Identity Pool**: Map developer role
4. **Lambda Functions**: Add developer endpoints
5. **API Gateway Routes**: Add `/developers/*` paths

### Resources to Keep Separate:
1. **App Clients**: Mobile ≠ Developer Portal
2. **IAM Roles**: Player ≠ Developer
3. **API Keys**: Consumer ≠ Developer
4. **Token Storage**: Different prefixes
5. **User Types**: `player` vs `developer`

This comprehensive task list ensures nothing is missed during implementation while maintaining the PIN protection as the first security layer and keeping the developer portal infrastructure separate from the mobile app.