# Trioll Developer Portal - Testing Checklist

## Pre-Test Setup
- [ ] CloudFront distribution status: `Deployed` (check with AWS CLI command)
- [ ] Browser: Clear cache and cookies for fresh test
- [ ] Have test game files ready (HTML game + thumbnail)

## 1. Authentication Testing

### Login Flow
- [ ] Navigate to developer portal
- [ ] Click "Login" 
- [ ] Enter credentials: freddiecaplin@hotmail.com / @Freddie1
- [ ] Verify Trioll logo appears on login screen
- [ ] Verify starfield background animation
- [ ] Check "Remember Me" checkbox
- [ ] Click Login
- [ ] **Expected**: Redirected to dashboard with developer ID visible

### Dashboard Verification
- [ ] Developer ID shows at top: `dev_freddi`
- [ ] Total games count displays
- [ ] Navigation menu shows all tabs
- [ ] Logout button works

### Session Persistence
- [ ] With "Remember Me" checked, close browser
- [ ] Reopen portal - should stay logged in
- [ ] Without "Remember Me", close browser
- [ ] Reopen portal - should require login

## 2. Game Upload Testing

### Upload Form
- [ ] Click "Upload Game" tab
- [ ] Developer ID field is auto-populated
- [ ] Developer ID field is read-only (cannot edit)
- [ ] All required fields marked with *

### File Upload - Folder Method
- [ ] Create test folder with:
  - [ ] index.html
  - [ ] thumbnail.png or thumbnail.jpg
  - [ ] style.css (optional)
  - [ ] script.js (optional)
- [ ] Use file picker to select folder
- [ ] Verify file count shows correctly
- [ ] Fill in game details:
  - [ ] Game Title
  - [ ] Category (dropdown)
  - [ ] Description
  - [ ] Tags
- [ ] Click "Upload Game"
- [ ] **Expected**: Progress bar, then success message
- [ ] Note the game ID from success message

### File Upload - ZIP Method
- [ ] Create ZIP with game files
- [ ] Upload via file picker
- [ ] Verify upload process same as folder

## 3. Game Display Testing

### All Games Tab
- [ ] Click "All Games" tab
- [ ] Your game appears in grid
- [ ] Thumbnail displays (or placeholder if missing)
- [ ] Game title correct
- [ ] Category shows
- [ ] Play count: 0
- [ ] Status: Active
- [ ] "Play Game →" link present

### My Games Tab
- [ ] Click "My Games" tab
- [ ] ONLY your uploaded games show
- [ ] Same display format as All Games
- [ ] If no games: "Upload Your First Game" button
- [ ] Delete button visible on each game

### Game URLs (After CloudFront Deploys)
- [ ] Click "Play Game →" link
- [ ] CloudFront URL format: `https://dgq2nqysbn2z3.cloudfront.net/{gameId}/index.html`
- [ ] Game loads correctly
- [ ] HTTPS certificate valid (padlock icon)

## 4. Comments System Testing

### Open Test Page
- [ ] Navigate to: `test-comments-comprehensive.html`
- [ ] Auth status shows "Authenticated"
- [ ] Set game ID to your uploaded game

### Basic Comment Operations
- [ ] Post a comment with 5-star rating
- [ ] Comment appears in list
- [ ] Shows your developer name
- [ ] Rating displays correctly
- [ ] Timestamp is accurate

### Comment Management
- [ ] Copy a comment ID (click Copy ID)
- [ ] Update the comment text
- [ ] Verify "Edited" tag appears
- [ ] Like a comment - count increases
- [ ] Delete your comment - confirms first

### Permission Testing
- [ ] Try posting as guest (should work)
- [ ] Try posting with no auth (should fail)
- [ ] Verify you can delete comments on YOUR games
- [ ] Cannot delete comments on others' games

### Advanced Testing
- [ ] Test pagination (if many comments)
- [ ] Test special characters/emoji
- [ ] Test very long comment
- [ ] Test security (XSS attempts blocked)

## 5. CloudFront CDN Testing

### Deployment Verification
```bash
aws cloudfront get-distribution --id E19KSV2LWED5HJ --query 'Distribution.Status' --output text
```
- [ ] Status shows: `Deployed`

### URL Testing
- [ ] S3 Direct: `https://trioll-prod-games-us-east-1.s3.us-east-1.amazonaws.com/{gameId}/index.html`
- [ ] CloudFront: `https://dgq2nqysbn2z3.cloudfront.net/{gameId}/index.html`
- [ ] Both URLs load the game
- [ ] CloudFront loads faster (after first visit)

### Cache Testing
- [ ] Load game once (cache miss)
- [ ] Reload page (should be cache hit)
- [ ] Check Network tab for `x-cache: Hit from cloudfront`

## 6. API Integration Testing

### Direct API Calls
```bash
# List all games
curl https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games

# Get your game
curl https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games/{your-game-id}

# Get game comments  
curl https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games/{your-game-id}/comments
```

- [ ] Games endpoint returns your game
- [ ] Game has correct developerId
- [ ] Comments endpoint works

## 7. Mobile App Integration

### Game Visibility
- [ ] Open Trioll Mobile app
- [ ] Navigate to games list
- [ ] Your game appears
- [ ] Thumbnail loads correctly
- [ ] Game launches in WebView

### Comments in App
- [ ] Open your game in app
- [ ] Comments section available
- [ ] Post comment from app
- [ ] Comment appears in developer portal
- [ ] Ratings sync correctly

## 8. Error Handling

### Upload Errors
- [ ] Try uploading without required fields
- [ ] Try uploading non-game files
- [ ] Verify error messages are clear

### Network Errors
- [ ] Disable internet mid-upload
- [ ] Verify graceful error handling
- [ ] Re-enable and retry works

## 9. Performance Testing

### Page Load Times
- [ ] Portal loads under 3 seconds
- [ ] Games load under 2 seconds
- [ ] No console errors
- [ ] No 404s for resources

### Responsive Design
- [ ] Test on mobile browser
- [ ] Test on tablet
- [ ] All features accessible
- [ ] UI remains usable

## 10. Final Verification

### Data Persistence
- [ ] Uploaded games persist after logout/login
- [ ] Comments remain after page refresh
- [ ] Developer ID consistent
- [ ] Game stats update correctly

### Clean Up Old EU-WEST-2 References
- [ ] No URLs contain "eu-west-2"
- [ ] No errors about missing EU resources
- [ ] All content serves from US-EAST-1

## Test Summary

### Pass Criteria
- All core features work
- No critical errors
- CloudFront serving games
- Comments system functional
- Mobile app integration confirmed

### Known Issues
- CloudFront takes 15-20 min to deploy
- First-time cache miss expected
- Guest comments show generic name

### Sign-Off
- [ ] Date tested: ___________
- [ ] Tested by: ___________
- [ ] Portal Version: Latest
- [ ] All tests passed: Yes/No

## Quick Test Commands

```bash
# Check CloudFront status
aws cloudfront get-distribution --id E19KSV2LWED5HJ --query 'Distribution.Status' --output text

# List your S3 games
aws s3 ls s3://trioll-prod-games-us-east-1/ --region us-east-1

# Check API health
curl https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games

# View CloudFront metrics
open "https://console.aws.amazon.com/cloudfront/v3/home?region=us-east-1#/distributions/E19KSV2LWED5HJ"
```