# Trioll Developer Portal - Deployment & Testing Checklist

## Current Status
- ✅ Code updated to allow flexible filenames
- ✅ Changes pushed to GitHub
- ❌ Not yet deployed to triolldev.com
- ❌ Upload still failing with "Failed to fetch" error

## Pre-Deployment Tasks

### 1. Verify GitHub Repository Status
- [ ] Confirm latest commit is pushed (hash: 14427ea)
- [ ] Check GitHub Actions (if any) are passing
- [ ] Verify main branch is selected

### 2. Vercel Deployment Setup
- [ ] Check if GitHub repo is connected to Vercel
- [ ] Verify auto-deploy is enabled
- [ ] Check deployment settings (build commands, environment variables)

## Deployment Steps

### 1. Deploy to Vercel
- [ ] Option A: Wait for auto-deploy (if configured)
- [ ] Option B: Manual deploy from Vercel dashboard
- [ ] Option C: Use Vercel CLI: `vercel --prod`

### 2. Verify Deployment
- [ ] Check Vercel dashboard for deployment status
- [ ] Wait for "Ready" status
- [ ] Verify deployment URL works

## Post-Deployment Testing

### 1. Basic Site Access
- [ ] Navigate to https://www.triolldev.com
- [ ] Verify site loads without 404
- [ ] Check browser console for errors

### 2. Authentication Testing
- [ ] Login with freddiecaplin@hotmail.com / @Freddie1
- [ ] Verify developer ID shows: dev_freddi
- [ ] Check auth token in localStorage

### 3. File Upload Testing
- [ ] Navigate to Upload Game tab
- [ ] Upload test files:
  - horror_pong_game.html
  - Horror Pong Thumbnail.png
- [ ] Monitor browser console during upload
- [ ] Note any error messages

### 4. Debug Failed Upload
- [ ] Open https://www.triolldev.com/debug-upload.html
- [ ] Run each test:
  - [ ] Check location info
  - [ ] Check auth token
  - [ ] Test API directly
- [ ] Document error messages

### 5. S3 Upload Verification
- [ ] Check S3 bucket for uploaded files
- [ ] Verify file structure is correct
- [ ] Check if thumbnails uploaded

### 6. API Integration Check
- [ ] Verify game saved to DynamoDB
- [ ] Check if developer ID attached
- [ ] Confirm game metadata stored

### 7. Game Display Testing
- [ ] Check "All Games" tab
- [ ] Check "My Games" tab
- [ ] Verify game appears with:
  - Correct title
  - Thumbnail image
  - Play button
  - Developer info

### 8. CloudFront Testing
- [ ] Click "Play Game" link
- [ ] Verify game loads from CloudFront URL
- [ ] Check if game is playable

### 9. Comments System Testing
- [ ] Navigate to uploaded game
- [ ] Post a test comment
- [ ] Verify comment appears
- [ ] Test rating system

## Troubleshooting Guide

### If "Failed to fetch" persists:
1. **Check CORS**:
   - Browser console for CORS errors
   - Verify API Gateway CORS settings
   - Check S3 bucket CORS

2. **Check Network**:
   - HTTP vs HTTPS mismatch
   - Firewall/proxy blocking
   - Browser security settings

3. **Check Authentication**:
   - Token present in headers
   - Token not expired
   - Correct Authorization format

4. **Check API**:
   - API Gateway responding
   - Lambda function logs
   - Request/response format

### Common Issues & Solutions:
- **404 on triolldev.com**: Deployment not complete
- **CORS errors**: Check allowed origins in API/S3
- **401 Unauthorized**: Auth token missing/invalid
- **Network error**: HTTPS/HTTP mismatch

## Success Criteria
- [ ] Game uploads successfully
- [ ] No "Failed to fetch" errors
- [ ] Game appears in portal
- [ ] Game playable via CloudFront
- [ ] Comments system works

## Next Steps After Testing
1. If all tests pass:
   - Test on mobile app
   - Upload more games
   - Begin Phase 1 (Mobile Integration)

2. If tests fail:
   - Document specific errors
   - Check CloudWatch logs
   - Debug based on error type

## Important URLs
- Portal: https://www.triolldev.com
- Debug Page: https://www.triolldev.com/debug-upload.html
- Test API: https://www.triolldev.com/test-api-cors.html
- GitHub Repo: https://github.com/trioll/trioll-developer-portal
- S3 Bucket: trioll-prod-games-us-east-1
- CloudFront: https://dgq2nqysbn2z3.cloudfront.net

## Contact for Issues
- AWS Console access needed for:
  - CloudWatch logs
  - API Gateway configuration
  - Lambda function debugging
  - S3 bucket permissions