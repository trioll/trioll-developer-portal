#!/bin/bash

# TRIOLL Website Deployment Script
# This script helps deploy the website to GitHub Pages

echo "🚀 TRIOLL Website Deployment Script"
echo "=================================="

# Check if git is initialized
if [ ! -d .git ]; then
    echo "❌ Git not initialized. Initializing..."
    git init
    git branch -M main
fi

# Check if remote exists
if ! git remote | grep -q origin; then
    echo "❌ No remote repository set."
    echo "Please add your GitHub repository:"
    echo "git remote add origin https://github.com/yourusername/trioll-website.git"
    exit 1
fi

# Add all files
echo "📦 Adding files..."
git add .

# Commit
echo "💾 Creating commit..."
git commit -m "Deploy TRIOLL website - $(date)"

# Push to GitHub
echo "🔄 Pushing to GitHub..."
git push origin main

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Go to your GitHub repository"
echo "2. Navigate to Settings → Pages"
echo "3. Enable GitHub Pages from main branch"
echo "4. Your site will be live at: https://[username].github.io/trioll-website/"