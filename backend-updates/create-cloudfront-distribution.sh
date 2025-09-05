#!/bin/bash

# Create CloudFront Distribution for Trioll Games
# Region: US-EAST-1 (N. Virginia)
# Bucket: trioll-prod-games-us-east-1

echo "🚀 Creating CloudFront Distribution for Trioll Games"
echo "================================================="
echo "Region: US-EAST-1 (N. Virginia)"
echo "S3 Bucket: trioll-prod-games-us-east-1"
echo ""

# Variables
BUCKET_NAME="trioll-prod-games-us-east-1"
REGION="us-east-1"
CALLER_REFERENCE="trioll-games-cf-$(date +%s)"
COMMENT="CloudFront distribution for Trioll games - US-EAST-1"

# Create Origin Access Control (OAC) for secure S3 access
echo "📦 Creating Origin Access Control..."
OAC_RESPONSE=$(aws cloudfront create-origin-access-control \
    --region $REGION \
    --origin-access-control-config \
    Name="trioll-games-oac",\
Description="OAC for trioll-prod-games-us-east-1 bucket",\
SigningProtocol="sigv4",\
SigningBehavior="always",\
OriginAccessControlOriginType="s3" 2>/dev/null)

if [ $? -eq 0 ]; then
    OAC_ID=$(echo $OAC_RESPONSE | jq -r '.OriginAccessControl.Id')
    echo "✅ Created OAC: $OAC_ID"
else
    # If OAC already exists, list and find it
    echo "⚠️  OAC might already exist, checking..."
    OAC_ID=$(aws cloudfront list-origin-access-controls --region $REGION | \
        jq -r '.OriginAccessControlList.Items[] | select(.Name=="trioll-games-oac") | .Id')
    echo "✅ Found existing OAC: $OAC_ID"
fi

# Create CloudFront distribution configuration
echo ""
echo "📝 Creating distribution configuration..."

cat > cf-config.json <<EOF
{
    "CallerReference": "$CALLER_REFERENCE",
    "Comment": "$COMMENT",
    "DefaultRootObject": "index.html",
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "S3-$BUCKET_NAME",
                "DomainName": "$BUCKET_NAME.s3.$REGION.amazonaws.com",
                "S3OriginConfig": {
                    "OriginAccessIdentity": ""
                },
                "OriginAccessControlId": "$OAC_ID"
            }
        ]
    },
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-$BUCKET_NAME",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
            "Quantity": 2,
            "Items": ["GET", "HEAD"],
            "CachedMethods": {
                "Quantity": 2,
                "Items": ["GET", "HEAD"]
            }
        },
        "Compress": true,
        "MinTTL": 0,
        "DefaultTTL": 86400,
        "MaxTTL": 31536000,
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {
                "Forward": "none"
            }
        },
        "TrustedSigners": {
            "Enabled": false,
            "Quantity": 0
        },
        "SmoothStreaming": false
    },
    "Enabled": true,
    "PriceClass": "PriceClass_All",
    "HttpVersion": "http2",
    "IsIPV6Enabled": true,
    "CustomErrorResponses": {
        "Quantity": 2,
        "Items": [
            {
                "ErrorCode": 403,
                "ResponsePagePath": "/index.html",
                "ResponseCode": "200",
                "ErrorCachingMinTTL": 300
            },
            {
                "ErrorCode": 404,
                "ResponsePagePath": "/index.html",
                "ResponseCode": "200",
                "ErrorCachingMinTTL": 300
            }
        ]
    }
}
EOF

# Create the CloudFront distribution
echo ""
echo "🌐 Creating CloudFront distribution..."
DISTRIBUTION_RESPONSE=$(aws cloudfront create-distribution \
    --region $REGION \
    --distribution-config file://cf-config.json)

if [ $? -eq 0 ]; then
    DISTRIBUTION_ID=$(echo $DISTRIBUTION_RESPONSE | jq -r '.Distribution.Id')
    DISTRIBUTION_DOMAIN=$(echo $DISTRIBUTION_RESPONSE | jq -r '.Distribution.DomainName')
    
    echo "✅ CloudFront distribution created successfully!"
    echo ""
    echo "📋 Distribution Details:"
    echo "   ID: $DISTRIBUTION_ID"
    echo "   Domain: $DISTRIBUTION_DOMAIN"
    echo "   Status: Deploying (takes 15-20 minutes)"
    echo ""
    
    # Update S3 bucket policy to allow CloudFront access
    echo "🔐 Updating S3 bucket policy for CloudFront access..."
    
    cat > bucket-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontServicePrincipalReadOnly",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::561645284740:distribution/$DISTRIBUTION_ID"
                }
            }
        },
        {
            "Sid": "AllowDirectS3Access",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
        }
    ]
}
EOF

    aws s3api put-bucket-policy \
        --bucket $BUCKET_NAME \
        --region $REGION \
        --policy file://bucket-policy.json
    
    if [ $? -eq 0 ]; then
        echo "✅ S3 bucket policy updated"
    else
        echo "⚠️  Failed to update bucket policy"
    fi
    
    # Create documentation
    echo ""
    echo "📄 Creating documentation..."
    
    cat > CLOUDFRONT_SETUP.md <<EOF
# CloudFront Distribution for Trioll Games

## Overview
This CloudFront distribution serves game content from the trioll-prod-games-us-east-1 S3 bucket with global CDN caching for optimal performance.

## Configuration Details

### Distribution Information
- **Distribution ID**: $DISTRIBUTION_ID
- **Domain Name**: $DISTRIBUTION_DOMAIN
- **Region**: US-EAST-1 (N. Virginia)
- **Created**: $(date)

### Origin Configuration
- **S3 Bucket**: trioll-prod-games-us-east-1
- **Origin Access**: Origin Access Control (OAC)
- **OAC ID**: $OAC_ID
- **Protocol**: HTTPS only

### Cache Behavior
- **Viewer Protocol**: Redirect HTTP to HTTPS
- **Allowed Methods**: GET, HEAD
- **Compression**: Enabled
- **TTL Settings**:
  - Minimum: 0 seconds
  - Default: 24 hours (86400 seconds)
  - Maximum: 1 year (31536000 seconds)

### Error Pages
- 403 and 404 errors redirect to /index.html with 200 status (for SPA support)

### Performance Settings
- **Price Class**: All edge locations (best performance)
- **HTTP Version**: HTTP/2
- **IPv6**: Enabled

## Usage

### Game URLs
Games are now accessible via CloudFront:
\`\`\`
https://$DISTRIBUTION_DOMAIN/{gameId}/index.html
https://$DISTRIBUTION_DOMAIN/{gameId}/thumbnail.png
\`\`\`

### Direct S3 Access (Fallback)
Games are still accessible directly via S3:
\`\`\`
https://trioll-prod-games-us-east-1.s3.us-east-1.amazonaws.com/{gameId}/index.html
\`\`\`

## Portal Update Required

Update the following URLs in index.html:

Replace:
\`\`\`javascript
https://trioll-prod-games-us-east-1.s3.us-east-1.amazonaws.com/
\`\`\`

With:
\`\`\`javascript
https://$DISTRIBUTION_DOMAIN/
\`\`\`

## Deployment Status

CloudFront distributions take 15-20 minutes to fully deploy. Check status:
\`\`\`bash
aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status' --output text
\`\`\`

When status shows "Deployed", the CDN is ready for use.

## Benefits

1. **Global Performance**: Content cached at 400+ edge locations worldwide
2. **Reduced Latency**: Users get content from nearest edge location
3. **HTTPS by Default**: All content served securely
4. **Cost Optimization**: Reduced S3 bandwidth costs
5. **DDoS Protection**: Built-in AWS Shield Standard

## Important Notes

- ⚠️ **NO EU-WEST-2 References**: This setup is exclusively for US-EAST-1
- The old EU-WEST-2 infrastructure has been completely removed
- All game content is stored in trioll-prod-games-us-east-1 bucket

## Monitoring

View CloudFront metrics in AWS Console:
https://console.aws.amazon.com/cloudfront/v3/home?region=us-east-1#/distributions/$DISTRIBUTION_ID
EOF

    echo "✅ Documentation created: CLOUDFRONT_SETUP.md"
    echo ""
    echo "🎉 CloudFront setup complete!"
    echo ""
    echo "⏳ Note: Distribution will be ready in 15-20 minutes"
    echo "📝 Next step: Update portal URLs to use: https://$DISTRIBUTION_DOMAIN/"
    
else
    echo "❌ Failed to create CloudFront distribution"
    cat cf-config.json
fi

# Cleanup
rm -f cf-config.json bucket-policy.json