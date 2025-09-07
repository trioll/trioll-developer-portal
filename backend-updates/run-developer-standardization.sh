#!/bin/bash

# Run the developer ID standardization script

echo "🚀 Running developer ID standardization..."
echo ""
echo "This will update your existing games to have consistent developer identification."
echo "This is a one-time migration to ensure the edit functionality works properly."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the script
node standardize-developer-ids.js

echo ""
echo "✅ Done! Your games should now have standardized developer IDs."
echo ""
echo "You can now:"
echo "1. Refresh the developer portal"
echo "2. Try editing your games"
echo ""
echo "The ownership check will now work properly for all developers!"