#!/bin/bash

# Fix AWS Cognito Identity Pool to trust the developer portal
# This script updates the Identity Pool to accept tokens from the developer portal's User Pool client

set -e

echo "🔧 Fixing AWS Cognito Identity Pool authentication for developer portal..."

# Configuration
IDENTITY_POOL_ID="us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268"
USER_POOL_ID="us-east-1_cLPH2acQd"
REGION="us-east-1"

# User Pool Clients
MOBILE_CLIENT_ID="bft50gui77sdq2n4lcio4onql"      # Mobile app client
DEVELOPER_CLIENT_ID="5joogquqr4jgukp7mncgp3g23h"  # Developer portal client

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "📍 Identity Pool: $IDENTITY_POOL_ID"
echo "📍 User Pool: $USER_POOL_ID"
echo "📍 Region: $REGION"
echo ""

# Step 1: Get current Identity Pool configuration
echo "🔍 Fetching current Identity Pool configuration..."
CURRENT_CONFIG=$(aws cognito-identity describe-identity-pool \
    --identity-pool-id $IDENTITY_POOL_ID \
    --region $REGION)

echo "${GREEN}✅ Current configuration retrieved${NC}"

# Step 2: Extract current settings
POOL_NAME=$(echo $CURRENT_CONFIG | jq -r '.IdentityPoolName')
ALLOW_UNAUTHENTICATED=$(echo $CURRENT_CONFIG | jq -r '.AllowUnauthenticatedIdentities')

echo "Pool Name: $POOL_NAME"
echo "Allow Unauthenticated: $ALLOW_UNAUTHENTICATED"

# Step 3: Update Identity Pool to trust both clients
echo ""
echo "🔧 Updating Identity Pool to trust both mobile app and developer portal clients..."

aws cognito-identity update-identity-pool \
    --identity-pool-id $IDENTITY_POOL_ID \
    --identity-pool-name "$POOL_NAME" \
    --allow-unauthenticated-identities \
    --cognito-identity-providers \
        "ProviderName=cognito-idp.$REGION.amazonaws.com/$USER_POOL_ID,ClientId=$MOBILE_CLIENT_ID,ServerSideTokenCheck=false" \
        "ProviderName=cognito-idp.$REGION.amazonaws.com/$USER_POOL_ID,ClientId=$DEVELOPER_CLIENT_ID,ServerSideTokenCheck=false" \
    --region $REGION \
    > /tmp/identity-pool-update.json

if [ $? -eq 0 ]; then
    echo "${GREEN}✅ Identity Pool updated successfully!${NC}"
else
    echo "${RED}❌ Failed to update Identity Pool${NC}"
    exit 1
fi

# Step 4: Verify the update
echo ""
echo "🔍 Verifying the update..."
UPDATED_CONFIG=$(aws cognito-identity describe-identity-pool \
    --identity-pool-id $IDENTITY_POOL_ID \
    --region $REGION)

echo ""
echo "📋 Updated Identity Pool Configuration:"
echo "-----------------------------------"
echo "$UPDATED_CONFIG" | jq '.CognitoIdentityProviders'

# Step 5: Get role information
echo ""
echo "🔐 Identity Pool Roles:"
echo "-----------------------------------"
ROLES=$(aws cognito-identity get-identity-pool-roles \
    --identity-pool-id $IDENTITY_POOL_ID \
    --region $REGION)

echo "Authenticated Role: $(echo $ROLES | jq -r '.Roles.authenticated')"
echo "Unauthenticated Role: $(echo $ROLES | jq -r '.Roles.unauthenticated')"

# Step 6: Create test HTML file
echo ""
echo "📝 Creating test file to verify authentication..."
cat > test-identity-pool-auth.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Test Identity Pool Authentication</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #1a1a1a; color: #fff; }
        button { padding: 10px 20px; margin: 10px 0; cursor: pointer; }
        .log { background: #000; padding: 10px; border-radius: 5px; margin: 10px 0; font-family: monospace; }
        .success { color: #4ade80; }
        .error { color: #ef4444; }
    </style>
</head>
<body>
    <h1>Test Identity Pool Authentication</h1>
    <button onclick="testAuth()">Test Developer Portal Authentication</button>
    <div id="log"></div>
    
    <script src="https://sdk.amazonaws.com/js/aws-sdk-2.1099.0.min.js"></script>
    <script>
        function log(msg, type = '') {
            const logEl = document.getElementById('log');
            const div = document.createElement('div');
            div.className = 'log ' + type;
            div.textContent = new Date().toISOString() + ' - ' + msg;
            logEl.appendChild(div);
        }
        
        async function testAuth() {
            log('Starting authentication test...');
            
            // Get token from storage
            const token = localStorage.getItem('developerToken') || sessionStorage.getItem('developerToken');
            
            if (!token) {
                log('No developer token found. Please login to the developer portal first.', 'error');
                return;
            }
            
            log('Token found, configuring AWS...');
            
            AWS.config.region = 'us-east-1';
            AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                IdentityPoolId: 'us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268',
                Logins: {
                    'cognito-idp.us-east-1.amazonaws.com/us-east-1_cLPH2acQd': token
                }
            });
            
            log('Refreshing credentials...');
            
            AWS.config.credentials.refresh((error) => {
                if (error) {
                    log('Error: ' + error.message, 'error');
                    log('Error code: ' + error.code, 'error');
                } else {
                    log('Success! Identity ID: ' + AWS.config.credentials.identityId, 'success');
                    log('Access Key: ' + AWS.config.credentials.accessKeyId.substring(0, 10) + '...', 'success');
                    
                    // Try to list S3 buckets as a test
                    const s3 = new AWS.S3();
                    s3.listBuckets((err, data) => {
                        if (err) {
                            log('S3 test failed: ' + err.message, 'error');
                        } else {
                            log('S3 test successful! Found ' + data.Buckets.length + ' buckets', 'success');
                        }
                    });
                }
            });
        }
    </script>
</body>
</html>
EOF

echo "${GREEN}✅ Test file created: test-identity-pool-auth.html${NC}"

echo ""
echo "${GREEN}✅ Identity Pool configuration complete!${NC}"
echo ""
echo "📋 Summary:"
echo "  - Identity Pool: $IDENTITY_POOL_ID"
echo "  - Now trusts both clients:"
echo "    • Mobile App: $MOBILE_CLIENT_ID"
echo "    • Developer Portal: $DEVELOPER_CLIENT_ID"
echo ""
echo "🧪 To test the authentication:"
echo "1. Make sure you're logged into the developer portal"
echo "2. Open test-identity-pool-auth.html in the same browser"
echo "3. Click the 'Test Developer Portal Authentication' button"
echo ""
echo "The developer portal should now authenticate without errors!"