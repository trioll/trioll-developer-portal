#!/bin/bash

# Deploy script to assign historical games to Freddie's account
# This will update all games without a developerId to belong to dev_c84a7e

echo "🎮 Assigning Historical Games to FreddieTrioll (dev_c84a7e)"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
DEVELOPER_ID="dev_c84a7e"
DEVELOPER_EMAIL="freddiecaplin@hotmail.com"
REGION="us-east-1"

echo -e "\n${YELLOW}Developer Info:${NC}"
echo "  Email: $DEVELOPER_EMAIL"
echo "  Developer ID: $DEVELOPER_ID"
echo "  Company: FreddieTrioll"

# Check if running locally or need to deploy
echo -e "\n${YELLOW}How would you like to run this?${NC}"
echo "1) Run locally (requires AWS credentials)"
echo "2) Deploy as Lambda and execute"
echo "3) Just show me what would be updated"

read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo -e "\n${GREEN}Running locally...${NC}"
        cd "$(dirname "$0")"
        
        # Check if AWS credentials are configured
        if ! aws sts get-caller-identity &>/dev/null; then
            echo -e "${RED}Error: AWS credentials not configured${NC}"
            echo "Please run: aws configure"
            exit 1
        fi
        
        # Install dependencies if needed
        if [ ! -d "node_modules" ]; then
            echo "Installing AWS SDK..."
            npm init -y &>/dev/null
            npm install aws-sdk &>/dev/null
        fi
        
        # Run the script
        node assign-historical-games.js
        ;;
        
    2)
        echo -e "\n${GREEN}Creating Lambda deployment package...${NC}"
        
        # Create deployment directory
        mkdir -p lambda-deploy
        cp assign-historical-games.js lambda-deploy/index.js
        
        # Create Lambda handler wrapper
        cat > lambda-deploy/index.js << 'EOF'
const { assignHistoricalGames } = require('./assign-historical-games');

exports.handler = async (event) => {
    try {
        await assignHistoricalGames();
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Historical games assigned successfully' })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Include the original code
EOF
        
        cat assign-historical-games.js >> lambda-deploy/index.js
        
        # Create deployment package
        cd lambda-deploy
        zip -q deployment.zip index.js
        
        echo -e "${GREEN}Deploying to Lambda...${NC}"
        
        # Create Lambda function
        aws lambda create-function \
            --function-name trioll-assign-historical-games \
            --runtime nodejs18.x \
            --role arn:aws:iam::471112976510:role/lambda-basic-execution \
            --handler index.handler \
            --timeout 300 \
            --memory-size 512 \
            --zip-file fileb://deployment.zip \
            --region $REGION 2>/dev/null
        
        if [ $? -ne 0 ]; then
            echo "Lambda already exists, updating..."
            aws lambda update-function-code \
                --function-name trioll-assign-historical-games \
                --zip-file fileb://deployment.zip \
                --region $REGION
        fi
        
        echo -e "\n${GREEN}Invoking Lambda function...${NC}"
        aws lambda invoke \
            --function-name trioll-assign-historical-games \
            --region $REGION \
            response.json
        
        echo -e "\n${GREEN}Response:${NC}"
        cat response.json
        
        # Cleanup
        cd ..
        rm -rf lambda-deploy
        ;;
        
    3)
        echo -e "\n${YELLOW}Dry run - checking what would be updated...${NC}"
        
        # Use AWS CLI to scan the table
        echo "Scanning for games without developerId..."
        
        aws dynamodb scan \
            --table-name trioll-prod-games \
            --filter-expression "attribute_not_exists(developerId)" \
            --projection-expression "id, #n, title" \
            --expression-attribute-names '{"#n": "name"}' \
            --region $REGION \
            --output json | \
        jq -r '.Items[] | "\(.id.S // .gameId.S) - \(.name.S // .title.S // "Untitled")"' 2>/dev/null
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}Error: Could not scan DynamoDB. Check AWS credentials.${NC}"
            exit 1
        fi
        ;;
        
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}Done!${NC}"