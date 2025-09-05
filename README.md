# TRIOLL Developer Portal

A web-based developer portal for the TRIOLL gaming platform, allowing developers to upload and manage their games.

## Recent Updates (September 2025)

### 🔐 Authentication & Developer ID Management
- **Fixed**: Login now automatically fetches and saves developer ID from API
- **Fixed**: Developer ID persists across sessions (respects "Remember me" checkbox)
- **Added**: Debug tab with comprehensive troubleshooting tools
- **Added**: "Fix Developer ID" button for manual recovery if ID is missing

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

### Developer ID Missing After Login
If your developer ID is not showing after login:

1. Go to the **Debug** tab
2. Click **"Fix Developer ID"** button
3. This will fetch your developer info from the API and save it locally

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
- Ensure your developer ID is set (check Debug tab)
- The game must have your developer ID attached
- Try refreshing the page

### CORS Errors
If you see CORS errors in the browser console:
- This usually means the API Gateway CORS settings need updating
- Contact backend team to verify CORS configuration

## API Endpoints

The portal uses these API endpoints:
- `POST /games` - Upload new game (requires: name, description, category, developerId)
- `GET /games` - List all games
- `GET /developers/me` - Get current developer info
- `GET /developers/{developerId}/games` - Get games by developer

## Security Note

- Authentication is handled by AWS Cognito
- Tokens are stored in localStorage (if "Remember me" checked) or sessionStorage
- Developer IDs follow the pattern: `dev_xxxxx`

## License

See license-file.txt for details.