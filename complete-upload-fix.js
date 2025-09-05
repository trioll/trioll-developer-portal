// Complete fix for upload issues - apply these changes to index.html

// 1. Fix the initializeAWS function to support authenticated Identity Pool access
const NEW_INITIALIZE_AWS = `
function initializeAWS() {
    const statusEl = document.getElementById('awsStatus');
    const statusTextEl = document.getElementById('awsStatusText');
    
    try {
        // Check if we have a Cognito token to use authenticated access
        const idToken = localStorage.getItem('developerToken') || sessionStorage.getItem('developerToken');
        
        let credentials;
        if (idToken) {
            console.log('Using authenticated Identity Pool access with Cognito token');
            credentials = new AWS.CognitoIdentityCredentials({
                IdentityPoolId: AWS_CONFIG.identityPoolId,
                Logins: {
                    'cognito-idp.us-east-1.amazonaws.com/us-east-1_cLPH2acQd': idToken
                }
            });
        } else {
            console.log('Using guest Identity Pool access');
            credentials = new AWS.CognitoIdentityCredentials({
                IdentityPoolId: AWS_CONFIG.identityPoolId
            });
        }
        
        AWS.config.update({
            region: AWS_CONFIG.region,
            credentials: credentials
        });
        
        AWS.config.credentials.refresh((error) => {
            if (error) {
                console.error('Error refreshing AWS credentials:', error);
                statusEl.className = 'aws-status error';
                statusTextEl.textContent = 'AWS Offline';
                awsInitialized = false;
            } else {
                console.log('AWS credentials loaded successfully');
                console.log('Identity ID:', AWS.config.credentials.identityId);
                statusEl.className = 'aws-status connected';
                statusTextEl.textContent = idToken ? 'AWS Connected (Auth)' : 'AWS Connected (Guest)';
                s3 = new AWS.S3({
                    apiVersion: '2006-03-01',
                    params: { Bucket: AWS_CONFIG.gamesBucket }
                });
                awsInitialized = true;
            }
            statusEl.style.display = 'flex';
        });
    } catch (error) {
        console.error('Error initializing AWS:', error);
        statusEl.className = 'aws-status error';
        statusTextEl.textContent = 'AWS Error';
        statusEl.style.display = 'flex';
        awsInitialized = false;
    }
}
`;

// 2. Find these lines in S3GameUploader class uploadFile method (around line 2072):
const OLD_UPLOAD_FILE = `
                return new Promise((resolve, reject) => {
                    this.s3.upload(params, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({
                                url: data.Location,
                                key: data.Key,
                                etag: data.ETag
                            });
                        }
                    });
                });
`;

// Replace with:
const NEW_UPLOAD_FILE = `
                // Ensure S3 client exists
                if (!this.s3) {
                    throw new Error('S3 client not initialized');
                }
                
                // Use managed upload with promise
                const managedUpload = this.s3.upload(params);
                
                // Track progress if needed
                managedUpload.on('httpUploadProgress', (progress) => {
                    console.log(\`Upload progress: \${progress.loaded} / \${progress.total}\`);
                });
                
                const data = await managedUpload.promise();
                return {
                    url: data.Location,
                    key: data.Key,
                    etag: data.ETag
                };
`;

// 3. Find these lines in S3GameUploader class uploadThumbnail method (around line 2099):
const OLD_UPLOAD_THUMBNAIL = `
                return new Promise((resolve, reject) => {
                    this.s3.upload(params, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(data.Location);
                        }
                    });
                });
`;

// Replace with:
const NEW_UPLOAD_THUMBNAIL = `
                // Ensure S3 client exists
                if (!this.s3) {
                    throw new Error('S3 client not initialized');
                }
                
                // Use managed upload with promise
                const data = await this.s3.upload(params).promise();
                return data.Location;
`;

// 4. Find the performS3UploadTest function (around line 3694):
const OLD_TEST_UPLOAD = `
                logToDebugConsole('Uploading test file...', 'info');
                const uploadResult = await s3.upload(params).promise();
`;

// Replace with:
const NEW_TEST_UPLOAD = `
                logToDebugConsole('Uploading test file...', 'info');
                
                // Ensure S3 is initialized
                if (!s3) {
                    throw new Error('S3 client not initialized - try logging in first');
                }
                
                const uploadResult = await s3.upload(params).promise();
`;

console.log('\n🔧 COMPLETE FIX INSTRUCTIONS:');
console.log('1. Replace initializeAWS function (lines 2002-2038)');
console.log('2. Fix S3GameUploader uploadFile method (around line 2072)');
console.log('3. Fix S3GameUploader uploadThumbnail method (around line 2099)');
console.log('4. Fix performS3UploadTest function (around line 3694)');
console.log('5. The AWS reinitialization after login is already done (line 4217)');
console.log('\n✅ These fixes will:');
console.log('   - Exchange Cognito tokens for AWS credentials via Identity Pool');
console.log('   - Fix S3 upload promise syntax errors');
console.log('   - Ensure S3 client is properly initialized before uploads');
console.log('   - Support both authenticated and guest access');