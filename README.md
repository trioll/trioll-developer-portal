# TRIOLL Developer Portal

A web-based developer portal for the TRIOLL gaming platform, allowing developers to upload and manage their games.

## Features

- 🔒 Secure PIN-protected access (PIN: 477235)
- 🎮 Game upload functionality with AWS S3 integration
- 📊 Developer dashboard with analytics
- 🎨 Interactive particle effects and animations
- 📱 Responsive design with iPhone-style lock screen

## Technology Stack

- HTML5/CSS3/JavaScript (Vanilla)
- AWS SDK for browser
- AWS S3 for game storage
- AWS Cognito for authentication
- Canvas API for particle effects

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

## Security Note

The PIN code (477235) is currently hardcoded for demo purposes. In production, implement proper authentication.

## License

See license-file.txt for details.