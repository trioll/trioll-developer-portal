# TRIOLL Developer Portal

A web-based developer portal for the TRIOLL gaming platform, allowing developers to upload and manage their games.

## Recent Updates (September 2025 - January 2025)

### 🔐 Authentication & Developer ID Management (January 5, 2025)
- **CRITICAL FIX**: Resolved developer ID mismatch between JWT tokens and localStorage
- **Fixed**: Frontend now extracts developer ID from JWT token (e.g., "dev_c84a7e") instead of storing company name
- **Fixed**: Lambda functions updated to support both custom and standard Cognito attributes
- **Fixed**: "My Games" tab now properly displays developer's uploaded games
- **Updated**: 9 historical games in DynamoDB corrected to use proper developer IDs
- **Added**: Multiple debugging tools for token inspection and quick fixes

### 🚀 API Improvements
- **Fixed**: API now expects `name` field instead of `title` for games
- **Fixed**: Added required `description` field to game uploads
- **Updated**: Flexible filename support - any .html file accepted (not just index.html)
- **Updated**: Device orientation and control style are now optional fields

### 💻 UI Enhancements
- **New Tab**: Debug tools integrated into main navigation for easy troubleshooting
- **New Tab**: "My Games" tab shows only games uploaded by logged-in developer
- **Improved**: Better error messages and debugging information

## Features

- 🔒 Secure developer authentication with AWS Cognito
- 🎮 Game upload functionality with AWS S3 integration
- 📊 Developer dashboard with game management
- 🎨 Shooting stars background effect (matching trioll.com)
- 📱 Responsive design
- 🆕 Game stage tracking (Pre-release/Released)
- 📱 Multi-platform device compatibility selection
- 🎯 Advanced control style options
- 💾 Automatic game metadata storage in DynamoDB
- 🐛 Built-in debugging tools
- 📝 Comments system for games (backend ready)
- 🎮 "My Games" filtering for developers

## Technology Stack

- HTML5/CSS3/JavaScript (Vanilla)
- AWS SDK for browser
- AWS S3 for game storage
- AWS DynamoDB for game metadata
- AWS Lambda for backend API
- AWS API Gateway REST API
- AWS Cognito for authentication
- Canvas API for shooting stars effect

## Deployment

This site is designed to be deployed on Vercel or GitHub Pages.

### Vercel Deployment

1. Fork or clone this repository
2. Connect your GitHub account to Vercel
3. Import this repository
4. Deploy with default settings

### GitHub Pages Deployment

1. Go to Settings → Pages in your GitHub repository
2. Select "Deploy from a branch"
3. Choose "main" branch and "/ (root)" folder
4. Save and wait for deployment

## Local Development

Simply open `index.html` in a web browser. No build process required.

## Troubleshooting

### Developer ID Missing or Incorrect After Login
If your games aren't showing in "My Games" or developer ID is incorrect:

1. **Quick Fix**: Open `fix-frontend-developer-id.html` in your browser
2. Click **"Fix Developer ID"** button
3. This will sync your developer ID from your JWT token

**Alternative Manual Fix:**
1. Go to the **Debug** tab
2. Check if developer ID matches your JWT token (should be like "dev_xxxxx", not your company name)
3. If mismatched, clear storage and re-login

### Upload Failed: Failed to fetch
Common causes and solutions:

1. **Not logged in**: Make sure you're logged in (check Debug tab)
2. **Missing fields**: Ensure you've filled in all required fields:
   - Game Title (saved as `name` in API)
   - Description
   - Category
3. **File issues**: 
   - HTML file must have .html extension
   - Thumbnail must be an image file
4. **API issues**: Use Debug tab to test API connectivity

### Game Not Appearing in "My Games"
- **Most Common Issue**: Developer ID mismatch (stored company name instead of dev_xxxxx)
- **Fix**: Use `fix-frontend-developer-id.html` to sync correct developer ID
- Ensure your developer ID matches JWT token (check with `check-my-token.html`)
- The game must have your correct developer ID (dev_xxxxx) attached
- Games uploaded before January 2025 may need database correction

### CORS Errors
If you see CORS errors in the browser console:
- This usually means the API Gateway CORS settings need updating
- Contact backend team to verify CORS configuration

## API Endpoints

The portal uses these API endpoints:
- `POST /games` - Upload new game (requires: name, description, category, developerId)
- `GET /games` - List all games
- `GET /developers/profile` - Get current developer profile (requires auth)
- `GET /developers/{developerId}/games` - Get games by developer

## Security Note

- Authentication is handled by AWS Cognito
- Tokens are stored in localStorage (if "Remember me" checked) or sessionStorage
- Developer IDs follow the pattern: `dev_xxxxx` (extracted from JWT token)
- **Important**: Developer ID must come from JWT token, not from user input

## Known Issues & Fixes

### Developer ID Architecture
The system uses JWT tokens as the source of truth for developer IDs:
- **Correct**: Extract developer ID from `payload['custom:developer_id']` in JWT token
- **Incorrect**: Storing company name or user-provided values as developer ID

For implementation details, see:
- `DEVELOPER_ID_FIX_SUMMARY.md` - Complete fix documentation
- `apply-developer-id-fixes.html` - Step-by-step implementation guide

## License

See license-file.txt for details.