# Trioll Developer Portal Deployment Guide

## Overview

This guide covers deployment and maintenance of the Trioll Developer Portal and its associated backend infrastructure.

## Infrastructure Components

### Frontend (Developer Portal)
- **Repository**: https://github.com/trioll/trioll-developer-portal
- **Technology**: Static HTML/CSS/JavaScript
- **Hosting**: GitHub Pages / Vercel
- **Features**: Shooting stars effect, game upload form with S3 integration

### Backend API
- **AWS Region**: us-east-1 (N. Virginia)
- **Lambda Function**: `trioll-prod-get-games`
- **Runtime**: Node.js 20.x
- **API Gateway**: REST API at `https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod`

### Storage
- **S3 Bucket**: `trioll-prod-games-us-east-1`
- **CDN**: CloudFront distribution at `https://dk72g9i0333mv.cloudfront.net`
- **Database**: DynamoDB table `trioll-prod-games`

## Deployment Process

### 1. Frontend Deployment

#### Via GitHub Pages
```bash
# Push changes to main branch
git add .
git commit -m "Update developer portal"
git push origin main

# GitHub Pages will auto-deploy from main branch
```

#### Via Vercel
```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Deploy
vercel --prod
```

### 2. Backend Deployment

#### Lambda Function Updates

Use the provided deployment script:
```bash
# Make the script executable
chmod +x /Users/frederickcaplin/Desktop/deploy-correct-lambda.sh

# Run deployment
./deploy-correct-lambda.sh
```

#### Manual Lambda Deployment
```bash
# 1. Package the Lambda function
cd /path/to/lambda
zip -r function.zip index.js node_modules/

# 2. Update function code
aws lambda update-function-code \
  --function-name trioll-prod-get-games \
  --zip-file fileb://function.zip \
  --region us-east-1

# 3. Wait for update to complete
aws lambda wait function-updated \
  --function-name trioll-prod-get-games \
  --region us-east-1
```

## API Endpoints

### Game Management

#### Create Game (NEW as of Sept 4, 2025)
```bash
POST /games
Content-Type: application/json

{
  "gameId": "unique-game-id",
  "name": "Game Title",
  "description": "Game description",
  "category": "Action",
  "developer": "Developer Name",
  "deviceOrientation": "Both",
  "controlStyle": "Tap & Swipe Only",
  "gameStage": "Pre-release (Feature Testing)",
  "deviceCompatibility": ["Mobile iOS", "Mobile Android"],
  "gameUrl": "https://...",
  "thumbnailUrl": "https://..."
}
```

#### Get Games
```bash
GET /games?limit=20&cursor=xxx
```

#### Get Game by ID
```bash
GET /games/{gameId}
```

#### Search Games
```bash
GET /games/search?q=searchterm
```

## Testing

### Test New Game Upload
```bash
# Use the test script
./test-game-upload.sh

# Or test manually with curl
curl -X POST https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "test-'$(date +%s)'",
    "name": "Test Game",
    "description": "Test description",
    "category": "Action",
    "developer": "Test Dev",
    "deviceOrientation": "Both",
    "controlStyle": "Tap & Swipe Only",
    "gameStage": "Pre-release (Feature Testing)",
    "deviceCompatibility": ["Mobile iOS"],
    "gameUrl": "https://example.com/game",
    "thumbnailUrl": "https://example.com/thumb.png"
  }'
```

## Monitoring

### CloudWatch Logs
```bash
# View Lambda logs
aws logs tail /aws/lambda/trioll-prod-get-games --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/trioll-prod-get-games \
  --filter-pattern "ERROR"
```

### API Gateway Metrics
1. Navigate to API Gateway console
2. Select the Trioll API
3. View CloudWatch metrics for:
   - Request count
   - Latency
   - 4XX/5XX errors

## Database Management

### DynamoDB Operations
```bash
# Scan games table
aws dynamodb scan \
  --table-name trioll-prod-games \
  --region us-east-1

# Query specific game
aws dynamodb get-item \
  --table-name trioll-prod-games \
  --key '{"id": {"S": "game-id"}}' \
  --region us-east-1
```

## Recent Updates

### September 4, 2025
1. **Added POST /games endpoint** for game creation
2. **New fields supported**:
   - `gameStage`: Pre-release or Released status
   - `deviceCompatibility`: Multi-device support array
3. **Lambda function updated** with validation and error handling
4. **Documentation created** for API endpoints

### Visual Updates
- Implemented shooting stars effect matching trioll.com
- Added Trioll logo to navigation
- Applied glassmorphic design system
- Enhanced form with new game metadata fields

## Security Considerations

1. **CORS Configuration**: Currently allows all origins (`*`)
2. **Authentication**: Uses AWS Cognito Identity Pool for basic auth
3. **S3 Bucket**: Ensure proper bucket policies for game assets
4. **API Rate Limiting**: Consider implementing throttling for production

## Troubleshooting

### Common Issues

#### 1. Lambda Deployment Fails
```bash
# Check Lambda function exists
aws lambda get-function --function-name trioll-prod-get-games

# Verify IAM permissions
aws sts get-caller-identity
```

#### 2. API Returns 500 Error
- Check CloudWatch logs for detailed error messages
- Verify DynamoDB table exists and has proper permissions
- Ensure all required fields are provided in request

#### 3. Game Not Appearing After Upload
- Verify S3 upload completed successfully
- Check if game entry exists in DynamoDB
- Ensure CDN URLs are correctly formatted

## Maintenance Tasks

### Regular Tasks
1. Monitor CloudWatch logs for errors
2. Review API Gateway metrics weekly
3. Check S3 bucket usage and costs
4. Update Lambda dependencies quarterly

### Backup Procedures
```bash
# Backup DynamoDB table
aws dynamodb create-backup \
  --table-name trioll-prod-games \
  --backup-name trioll-games-backup-$(date +%Y%m%d) \
  --region us-east-1
```

## Contact & Support

For issues or questions:
- Create issue at: https://github.com/trioll/trioll-developer-portal/issues
- Check CloudWatch logs for detailed error information
- Review API documentation at: `/API_DOCUMENTATION.md`