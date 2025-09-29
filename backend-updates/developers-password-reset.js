const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();

// Use environment variables with production defaults
const CLIENT_ID = process.env.CLIENT_ID || '5joogquqr4jgukp7mncgp3g23h'; // Developer portal client ID

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-App-Client',
    'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // Handle OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ message: 'OK' })
        };
    }
    
    const path = event.path;
    const method = event.httpMethod;
    
    try {
        // Parse request body
        const body = JSON.parse(event.body || '{}');
        
        // Route based on path
        if (path === '/developers/forgot-password' && method === 'POST') {
            return await handleForgotPassword(body);
        } else if (path === '/developers/reset-password' && method === 'POST') {
            return await handleResetPassword(body);
        } else {
            return {
                statusCode: 404,
                headers: CORS_HEADERS,
                body: JSON.stringify({ message: 'Not found' })
            };
        }
    } catch (error) {
        console.error('Handler error:', error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Internal server error',
                error: error.message
            })
        };
    }
};

// Handle forgot password request
async function handleForgotPassword(body) {
    const { email } = body;
    
    if (!email) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ message: 'Email is required' })
        };
    }
    
    try {
        // Initiate password reset
        await cognito.forgotPassword({
            ClientId: CLIENT_ID,
            Username: email
        }).promise();
        
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Password reset code sent to your email'
            })
        };
    } catch (error) {
        console.error('Forgot password error:', error);
        
        // Handle specific Cognito errors
        if (error.code === 'UserNotFoundException') {
            // For security, don't reveal if user exists
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    message: 'If an account exists with this email, a reset code has been sent'
                })
            };
        } else if (error.code === 'LimitExceededException') {
            return {
                statusCode: 429,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    message: 'Too many attempts. Please try again later'
                })
            };
        }
        
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Failed to send reset code',
                error: error.message
            })
        };
    }
}

// Handle password reset confirmation
async function handleResetPassword(body) {
    const { email, code, newPassword } = body;
    
    if (!email || !code || !newPassword) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ 
                message: 'Email, code, and new password are required' 
            })
        };
    }
    
    // Validate password strength
    if (newPassword.length < 8) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ 
                message: 'Password must be at least 8 characters long' 
            })
        };
    }
    
    try {
        // Confirm password reset
        await cognito.confirmForgotPassword({
            ClientId: CLIENT_ID,
            Username: email,
            ConfirmationCode: code,
            Password: newPassword
        }).promise();
        
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Password reset successfully'
            })
        };
    } catch (error) {
        console.error('Reset password error:', error);
        
        // Handle specific Cognito errors
        if (error.code === 'CodeMismatchException') {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    message: 'Invalid or expired reset code'
                })
            };
        } else if (error.code === 'ExpiredCodeException') {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    message: 'Reset code has expired. Please request a new one'
                })
            };
        } else if (error.code === 'InvalidPasswordException') {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    message: 'Password does not meet requirements. Must include uppercase, lowercase, numbers, and symbols'
                })
            };
        }
        
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Failed to reset password',
                error: error.message
            })
        };
    }
}