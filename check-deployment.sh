#!/bin/bash

echo "🔍 Checking Vercel deployment status for triolldev.com..."
echo "============================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Check if site is up
echo -n "1. Checking if site is accessible... "
HTTP_CODE=$(curl -I -s -o /dev/null -w "%{http_code}" https://www.triolldev.com)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Site is up (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ Site returned HTTP $HTTP_CODE${NC}"
    exit 1
fi

# Check for our specific changes
echo -n "2. Checking for flexible filename text... "
if curl -s https://www.triolldev.com/index.html | grep -q "can be any"; then
    echo -e "${GREEN}✓ New upload instructions found${NC}"
    DEPLOYED=true
else
    echo -e "${YELLOW}⏳ Old version still deployed${NC}"
    DEPLOYED=false
fi

echo -n "3. Checking for debug page... "
DEBUG_CODE=$(curl -I -s -o /dev/null -w "%{http_code}" https://www.triolldev.com/debug-upload.html)
if [ "$DEBUG_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Debug page deployed${NC}"
else
    echo -e "${YELLOW}⏳ Debug page not found (HTTP $DEBUG_CODE)${NC}"
    DEPLOYED=false
fi

# Show deployment time
echo -n "4. Checking deployment headers... "
DEPLOY_TIME=$(curl -s -I https://www.triolldev.com | grep -i "x-vercel-id" | awk '{print $2}')
if [ ! -z "$DEPLOY_TIME" ]; then
    echo -e "${GREEN}✓ Vercel ID: $DEPLOY_TIME${NC}"
else
    echo -e "${YELLOW}No Vercel headers found${NC}"
fi

echo "============================================"

if [ "$DEPLOYED" = true ]; then
    echo -e "${GREEN}🎉 Deployment complete! You can now test the upload.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Go to https://www.triolldev.com"
    echo "2. Login with freddiecaplin@hotmail.com / @Freddie1"
    echo "3. Try uploading horror_pong_game.html"
    echo "4. If upload fails, use https://www.triolldev.com/debug-upload.html"
else
    echo -e "${YELLOW}⏳ Deployment still in progress...${NC}"
    echo "Run this script again in 30-60 seconds."
    echo ""
    echo "You can also check:"
    echo "- Vercel dashboard at https://vercel.com"
    echo "- GitHub Actions (if configured)"
fi