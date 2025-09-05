#!/bin/bash

# Cleanup old CloudFront distributions that reference EU-WEST-2
# This removes confusion and ensures only US-EAST-1 infrastructure remains

echo "🧹 Cleaning up old CloudFront distributions"
echo "=========================================="
echo ""

# Distribution E1GU3JOU2TXD30 - points to wrong bucket with EU-WEST-2 reference
OLD_DISTRIBUTION_ID="E1GU3JOU2TXD30"

echo "📋 Checking distribution $OLD_DISTRIBUTION_ID"
echo "   This distribution has origin ID referencing old EU-WEST-2 bucket"
echo ""

# Get the current config and ETag
echo "⬇️ Getting current configuration..."
aws cloudfront get-distribution-config --id $OLD_DISTRIBUTION_ID --region us-east-1 > old-dist-config.json

if [ $? -ne 0 ]; then
    echo "❌ Failed to get distribution config"
    exit 1
fi

ETAG=$(jq -r '.ETag' old-dist-config.json)
CONFIG=$(jq '.DistributionConfig' old-dist-config.json)

# Check if already disabled
ENABLED=$(echo $CONFIG | jq -r '.Enabled')

if [ "$ENABLED" = "true" ]; then
    echo "🔄 Disabling distribution..."
    
    # Disable the distribution
    echo $CONFIG | jq '.Enabled = false' > disable-config.json
    
    aws cloudfront update-distribution \
        --id $OLD_DISTRIBUTION_ID \
        --distribution-config file://disable-config.json \
        --if-match $ETAG \
        --region us-east-1 > /dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Distribution disabled successfully"
        echo "⏳ Note: Distribution must be fully disabled before deletion (15-20 minutes)"
        echo ""
        echo "To delete later, run:"
        echo "aws cloudfront delete-distribution --id $OLD_DISTRIBUTION_ID --if-match <NEW_ETAG>"
    else
        echo "❌ Failed to disable distribution"
    fi
else
    echo "✅ Distribution is already disabled"
    echo ""
    
    # Try to delete if already disabled
    echo "🗑️ Attempting to delete distribution..."
    
    # Get fresh ETag for deletion
    FRESH_ETAG=$(aws cloudfront get-distribution-config --id $OLD_DISTRIBUTION_ID --region us-east-1 2>/dev/null | jq -r '.ETag')
    
    aws cloudfront delete-distribution \
        --id $OLD_DISTRIBUTION_ID \
        --if-match $FRESH_ETAG \
        --region us-east-1 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Distribution deleted successfully"
    else
        echo "⏳ Distribution not ready for deletion yet. Try again later."
    fi
fi

# Cleanup temp files
rm -f old-dist-config.json disable-config.json

echo ""
echo "📝 Summary of active CloudFront distributions:"
aws cloudfront list-distributions --region us-east-1 | \
    jq -r '.DistributionList.Items[] | select(.Enabled==true) | {Id: .Id, DomainName: .DomainName, Comment: .Comment}'