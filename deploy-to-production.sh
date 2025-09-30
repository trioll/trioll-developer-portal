#!/bin/bash

# Deploy Developer Portal to Production
# This script commits and pushes changes to GitHub, which triggers Vercel deployment

set -e

echo "🚀 Deploying Trioll Developer Portal to Production..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if we're in the right directory
if [ ! -f "index.html" ] || [ ! -f "vercel.json" ]; then
    echo "${RED}❌ Error: Not in the developer portal directory${NC}"
    echo "Please run this script from /Users/frederickcaplin/Desktop/trioll-developer-portal"
    exit 1
fi

# Check git status
echo "📋 Checking git status..."
git status --short

# Stage all changes
echo ""
echo "📦 Staging changes..."
git add -A

# Show what will be committed
echo ""
echo "📝 Changes to be committed:"
git diff --cached --stat

# Create commit message
COMMIT_MSG="feat: Add platform field for mobile/web game filtering

- Added platform conversion from device compatibility checkboxes
- Platform field now saved to DynamoDB for filtering
- Mobile app can filter games by platform=mobile
- Web platform can filter games by platform=web
- Games marked for both platforms show on all platforms"

# Commit changes
echo ""
echo "💾 Committing changes..."
git commit -m "$COMMIT_MSG" || {
    echo "${YELLOW}⚠️  No changes to commit${NC}"
    echo "Your code might already be up to date."
}

# Push to GitHub
echo ""
echo "🔄 Pushing to GitHub..."
git push origin main || git push origin master || {
    echo "${RED}❌ Failed to push. You might need to pull first:${NC}"
    echo "Run: git pull origin main"
    exit 1
}

echo ""
echo "${GREEN}✅ Successfully pushed to GitHub!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Vercel will automatically detect the push and start deployment"
echo "2. Check your Vercel dashboard at https://vercel.com/dashboard"
echo "3. The deployment usually takes 1-2 minutes"
echo "4. Your live site will be updated at https://triolldev.com"
echo ""
echo "🎮 The platform field feature is now deployed!"
echo "Developers can now upload games with proper platform targeting."