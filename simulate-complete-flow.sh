#!/bin/bash

# Complete flow simulation for Trioll Developer Portal
echo "🔍 Simulating Complete Trioll Games Flow"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games"
S3_BUCKET="trioll-prod-games-us-east-1"
CDN_PRIMARY="dk72g9i0333mv.cloudfront.net"
CDN_SECONDARY="d33yj1oylm0icp.cloudfront.net"
VERCEL_URL="https://trioll-developer-portal-new.vercel.app"

echo "📋 Configuration:"
echo "- API: $API_URL"
echo "- S3 Bucket: $S3_BUCKET"
echo "- CloudFront Primary: $CDN_PRIMARY"
echo "- CloudFront Secondary: $CDN_SECONDARY"
echo "- Vercel URL: $VERCEL_URL"
echo ""

# Step 1: Test API
echo "1️⃣ Testing API Endpoint"
echo "------------------------"
response=$(curl -s -w "\n%{http_code}" "$API_URL")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✅ API returned 200 OK${NC}"
    game_count=$(echo "$body" | jq '.games | length' 2>/dev/null || echo "0")
    echo "   Games found: $game_count"
    
    # Show first game
    first_game=$(echo "$body" | jq '.games[0]' 2>/dev/null)
    if [ -n "$first_game" ] && [ "$first_game" != "null" ]; then
        echo "   First game:"
        echo "$first_game" | jq '{id, title, gameUrl, thumbnailUrl}' 2>/dev/null | sed 's/^/   /'
    fi
else
    echo -e "${RED}❌ API returned $http_code${NC}"
fi
echo ""

# Step 2: Test CORS
echo "2️⃣ Testing CORS Headers"
echo "------------------------"
cors_response=$(curl -s -I -X OPTIONS "$API_URL" -H "Origin: $VERCEL_URL" -H "Access-Control-Request-Method: GET" | grep -i "access-control")
if [ -n "$cors_response" ]; then
    echo -e "${GREEN}✅ CORS headers present:${NC}"
    echo "$cors_response" | sed 's/^/   /'
else
    echo -e "${YELLOW}⚠️  No CORS headers found${NC}"
fi
echo ""

# Step 3: Test CloudFront
echo "3️⃣ Testing CloudFront CDNs"
echo "--------------------------"
test_game="evolution-runner-001"

# Test primary CDN
echo "Testing Primary CDN..."
cf_test1=$(curl -s -o /dev/null -w "%{http_code}" "https://$CDN_PRIMARY/$test_game/index.html")
if [ "$cf_test1" == "200" ]; then
    echo -e "${GREEN}✅ Primary CDN ($CDN_PRIMARY): Working${NC}"
else
    echo -e "${RED}❌ Primary CDN returned: $cf_test1${NC}"
fi

# Test secondary CDN
cf_test2=$(curl -s -o /dev/null -w "%{http_code}" "https://$CDN_SECONDARY/$test_game/index.html")
if [ "$cf_test2" == "200" ]; then
    echo -e "${GREEN}✅ Secondary CDN ($CDN_SECONDARY): Working${NC}"
else
    echo -e "${RED}❌ Secondary CDN returned: $cf_test2${NC}"
fi
echo ""

# Step 4: Test S3 Direct Access
echo "4️⃣ Testing S3 Bucket"
echo "--------------------"
s3_test=$(aws s3 ls "s3://$S3_BUCKET/" --max-items 5 2>&1)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ S3 bucket accessible${NC}"
    folder_count=$(aws s3 ls "s3://$S3_BUCKET/" | grep "PRE" | wc -l)
    echo "   Game folders found: $folder_count"
else
    echo -e "${RED}❌ S3 bucket not accessible${NC}"
    echo "   Error: $s3_test"
fi
echo ""

# Step 5: Test Vercel Website
echo "5️⃣ Testing Vercel Website"
echo "-------------------------"
vercel_test=$(curl -s -o /dev/null -w "%{http_code}" "$VERCEL_URL")
if [ "$vercel_test" == "200" ]; then
    echo -e "${GREEN}✅ Vercel website is up${NC}"
else
    echo -e "${RED}❌ Vercel website returned: $vercel_test${NC}"
fi
echo ""

# Step 6: Simulate Browser Request
echo "6️⃣ Simulating Browser Request from Vercel"
echo "-----------------------------------------"
browser_response=$(curl -s "$API_URL" \
    -H "Accept: application/json" \
    -H "Origin: $VERCEL_URL" \
    -H "Referer: $VERCEL_URL/" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")

if [ -n "$browser_response" ]; then
    echo -e "${GREEN}✅ Browser simulation successful${NC}"
    games_returned=$(echo "$browser_response" | jq '.games | length' 2>/dev/null || echo "0")
    echo "   Games returned: $games_returned"
else
    echo -e "${RED}❌ Browser simulation failed${NC}"
fi
echo ""

# Summary
echo "📊 Summary"
echo "=========="
echo ""

# Check each component
components=()
if [ "$http_code" == "200" ]; then
    components+=("${GREEN}✅ API${NC}")
else
    components+=("${RED}❌ API${NC}")
fi

if [ -n "$cors_response" ]; then
    components+=("${GREEN}✅ CORS${NC}")
else
    components+=("${YELLOW}⚠️  CORS${NC}")
fi

if [ "$cf_test1" == "200" ] || [ "$cf_test2" == "200" ]; then
    components+=("${GREEN}✅ CloudFront${NC}")
else
    components+=("${RED}❌ CloudFront${NC}")
fi

if [ $? -eq 0 ]; then
    components+=("${GREEN}✅ S3${NC}")
else
    components+=("${RED}❌ S3${NC}")
fi

echo "Components Status:"
for component in "${components[@]}"; do
    echo -e "- $component"
done

echo ""
echo "🔧 Troubleshooting Tips:"
echo "------------------------"

if [ "$http_code" != "200" ]; then
    echo "- API is not returning 200. Check Lambda function logs in CloudWatch"
fi

if [ -z "$cors_response" ]; then
    echo "- CORS headers missing. Update API Gateway to include CORS configuration"
fi

if [ "$cf_test1" != "200" ] && [ "$cf_test2" != "200" ]; then
    echo "- CloudFront not serving content. Run: ./update-cloudfront-origin.sh"
fi

echo ""
echo "To view the website locally with console logs:"
echo "1. Open test-games-flow.html in a browser"
echo "2. Open Developer Console (F12)"
echo "3. Click 'Test API Endpoint' button"
echo ""