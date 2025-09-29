// Lambda function to generate presigned URLs for S3 uploads
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const GAMES_BUCKET = process.env.GAMES_BUCKET || 'trioll-prod-games-us-east-1';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Guest-Mode,X-Identity-Id,X-Platform,X-App-Source,X-App-Client',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json'
};

exports.handler = async (event) => {
    console.log('Upload URL request:', JSON.stringify(event, null, 2));
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: ''
        };
    }
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: CORS_HEADERS,
            body: JSON.stringify({ message: 'Method not allowed' })
        };
    }
    
    try {
        const body = JSON.parse(event.body || '{}');
        const { gameId, fileName, contentType } = body;
        
        if (!gameId || !fileName) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ message: 'gameId and fileName are required' })
            };
        }
        
        // Generate S3 key
        const key = `${gameId}/${fileName}`;
        
        // Generate presigned URL for upload
        const uploadParams = {
            Bucket: GAMES_BUCKET,
            Key: key,
            ContentType: contentType || 'application/octet-stream',
            Expires: 3600 // 1 hour
        };
        
        const uploadUrl = await s3.getSignedUrlPromise('putObject', uploadParams);
        
        // Also generate URL for download
        const downloadUrl = `https://${GAMES_BUCKET}.s3.amazonaws.com/${key}`;
        const cdnUrl = `https://dgq2nqysbn2z3.cloudfront.net/${key}`;
        
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                uploadUrl,
                downloadUrl,
                cdnUrl,
                key,
                expiresIn: 3600
            })
        };
        
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Failed to generate upload URL',
                error: error.message
            })
        };
    }
};