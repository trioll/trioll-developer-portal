#!/bin/bash

echo "🎮 Trioll Developer Portal - Upload Test Script"
echo "============================================"
echo ""
echo "This script will help test the upload functionality once deployment is complete."
echo ""

# Get user confirmation
echo "Prerequisites:"
echo "1. Deployment must be complete (run check-deployment.sh first)"
echo "2. You must have horror_pong_game.html and Horror Pong Thumbnail.png ready"
echo "3. You should be at your computer to interact with the browser"
echo ""
read -p "Are you ready to start testing? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Test cancelled."
    exit 1
fi

echo ""
echo "📋 Test Steps:"
echo ""

echo "1. Opening triolldev.com in your default browser..."
open https://www.triolldev.com

echo "   ✓ Browser opened"
echo ""

echo "2. Login with these credentials:"
echo "   Email: freddiecaplin@hotmail.com"
echo "   Password: @Freddie1"
echo ""
read -p "   Press Enter when logged in..."

echo ""
echo "3. Check that your developer ID shows: dev_freddi"
echo ""
read -p "   Press Enter when confirmed..."

echo ""
echo "4. Navigate to the 'Upload Game' tab"
echo ""
read -p "   Press Enter when on Upload Game tab..."

echo ""
echo "5. Fill in the upload form:"
echo "   - Title: Horror Pong"
echo "   - Category: (choose any)"
echo "   - HTML File: horror_pong_game.html"
echo "   - Thumbnail: Horror Pong Thumbnail.png"
echo "   - Device Orientation: (optional - leave blank)"
echo "   - Control Style: (optional - leave blank)"
echo ""
echo "6. Click 'Upload Game' button"
echo ""
read -p "   Press Enter after clicking upload..."

echo ""
echo "7. Check the result:"
echo "   a) Did you see 'Game uploaded successfully!'?"
echo "   b) Or did you see 'Upload failed: Failed to fetch'?"
echo ""
read -p "   Which result? (success/fail): " RESULT

if [[ $RESULT == "success" ]]; then
    echo ""
    echo "🎉 Great! The upload worked!"
    echo ""
    echo "Next steps to verify:"
    echo "1. Check 'All Games' tab - your game should appear"
    echo "2. Check 'My Games' tab - only your games should show"
    echo "3. Click 'Play Game' - it should open in CloudFront"
    echo "4. Test the comments system on your game"
    
    # Mark todo as complete
    echo ""
    echo "✅ Marking upload test as successful..."
    
else
    echo ""
    echo "❌ Upload failed. Let's debug..."
    echo ""
    echo "8. Opening debug page..."
    open https://www.triolldev.com/debug-upload.html
    
    echo ""
    echo "In the debug page:"
    echo "1. Click 'Check Auth Token' - note the results"
    echo "2. Click 'Test API Directly' - note any errors"
    echo "3. Open browser console (F12) and check for errors"
    echo ""
    read -p "   Press Enter when you've gathered debug info..."
    
    echo ""
    echo "Common issues to check:"
    echo "- CORS errors in console"
    echo "- 404 on API endpoint"
    echo "- Authentication token missing"
    echo "- Network timeout"
    echo ""
    echo "Debug info will help identify the issue."
fi

echo ""
echo "============================================"
echo "Test complete. Document any issues found."