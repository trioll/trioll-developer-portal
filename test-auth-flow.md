# Developer Portal Authentication Test Flow

## Test Steps

### 1. PIN Entry Test
- Open http://localhost:8000 (or wherever the portal is hosted)
- Enter PIN: 477235
- Verify: Auth screen should appear instead of main content

### 2. Signup Test
1. Click "Need an account? Sign up"
2. Fill in:
   - Email: test@example.com
   - Password: TestPass123!
   - Company Name: Test Game Studio
   - Website: https://testgamestudio.com
3. Click "Create Account"
4. Expected: Email verification modal appears

### 3. Email Verification Test
1. Enter verification code (check AWS Cognito console or email)
2. Click "Verify Email"
3. Expected: Main portal appears with developer badge showing

### 4. Login Test
1. Refresh page or logout
2. Enter PIN again
3. Click "Sign In" on auth screen
4. Enter credentials
5. Expected: Main portal with auto-populated developer info

### 5. Developer Info Display Test
1. Check developer badge (top-right):
   - Shows company name
   - Shows developer ID (dev_xxxxx)
2. Navigate to Upload Game
3. Verify developer info appears at top of form
4. Verify developer name field is auto-populated and disabled

### 6. Game Upload Test
1. Fill in game details
2. Submit form
3. Check network tab for Authorization header
4. Verify developerId is included in request

### 7. Logout Test
1. Click "Logout" in developer badge
2. Expected: Return to auth screen
3. Verify developer info cleared from forms

## Common Issues

1. **Auth screen doesn't appear after PIN**
   - Check browser console for errors
   - Verify auth-service.js and auth-integration.js loaded
   - Check if unlock() function is overridden

2. **Signup fails**
   - Check API Gateway endpoints are deployed
   - Verify Cognito app client ID is correct
   - Check CORS configuration

3. **Developer info not showing**
   - Verify token storage in localStorage
   - Check /developers/profile endpoint
   - Verify JWT token contains developerId

4. **Upload fails with auth**
   - Check Authorization header format
   - Verify Lambda accepts developer tokens
   - Check IAM policies for developer role