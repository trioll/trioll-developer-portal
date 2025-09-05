# CloudFront Distribution for Trioll Games

## Overview
This CloudFront distribution serves game content from the trioll-prod-games-us-east-1 S3 bucket with global CDN caching for optimal performance.

## Configuration Details

### Distribution Information
- **Distribution ID**: E19KSV2LWED5HJ
- **Domain Name**: dgq2nqysbn2z3.cloudfront.net
- **Region**: US-EAST-1 (N. Virginia)
- **Created**: Thu  4 Sep 2025 18:54:13 BST

### Origin Configuration
- **S3 Bucket**: trioll-prod-games-us-east-1
- **Origin Access**: Origin Access Control (OAC)
- **OAC ID**: E1R0AUS0URA7T0
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
```
https://dgq2nqysbn2z3.cloudfront.net/{gameId}/index.html
https://dgq2nqysbn2z3.cloudfront.net/{gameId}/thumbnail.png
```

### Direct S3 Access (Fallback)
Games are still accessible directly via S3:
```
https://trioll-prod-games-us-east-1.s3.us-east-1.amazonaws.com/{gameId}/index.html
```

## Portal Update Required

Update the following URLs in index.html:

Replace:
```javascript
https://trioll-prod-games-us-east-1.s3.us-east-1.amazonaws.com/
```

With:
```javascript
https://dgq2nqysbn2z3.cloudfront.net/
```

## Deployment Status

CloudFront distributions take 15-20 minutes to fully deploy. Check status:
```bash
aws cloudfront get-distribution --id E19KSV2LWED5HJ --query 'Distribution.Status' --output text
```

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
https://console.aws.amazon.com/cloudfront/v3/home?region=us-east-1#/distributions/E19KSV2LWED5HJ
