const jwt = require('jsonwebtoken');

// Sample token from the user's test (expired but structure is what matters)
const token = 'eyJraWQiOiJOYXNKUk1mRm5kMENOaWIrRHM3QzJiOGprSThmVkkxaHdnU3VqM1wvNnJBQT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJjODRhN2U5Ni01NTgzLTRkMGItYmUwYS00NTE5NTE4YzI4OGQiLCJjb2duaXRvOmdyb3VwcyI6WyJkZXZlbG9wZXJzIl0sImN1c3RvbTpjb21wYW55X25hbWUiOiJGcmVkZGllVHJpb2xsIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImN1c3RvbTp1c2VyX3R5cGUiOiJkZXZlbG9wZXIiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV9jTFBIMmFjUWQiLCJjb2duaXRvOnVzZXJuYW1lIjoiYzg0YTdlOTYtNTU4My00ZDBiLWJlMGEtNDUxOTUxOGMyODhkIiwiY3VzdG9tOmRldmVsb3Blcl9pZCI6ImRldl9jODRhN2UiLCJvcmlnaW5fanRpIjoiODg2NGJjOGYtNzM3OS00ZmJkLWIwZDgtM2U1ODE0YzAyNGY5IiwiYXVkIjoiNWpvb2dxdXFyNGpndWtwN21uY2dwM2cyM2giLCJldmVudF9pZCI6IjQ5N2FlMDVhLTY3MDEtNGQwZC1hMzVmLTgzYzJjZTkzZjMzZCIsInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNzM2MDc1NTA3LCJleHAiOjE3MzYxNjE5MDcsImlhdCI6MTczNjA3NTUwNywianRpIjoiMGQwMGE4NTMtN2Y1OC00NDA5LTkxOWEtZWM4Mjc4YzRjOWI4IiwiZW1haWwiOiJmcmVkZGllY2FwbGluQGhvdG1haWwuY29tIn0.bk6Hw6e_6KxzH5Iw2xdRJUnGdTcvBJppA8-tYA5pnBdLNOdT2mJfHy6sHXezrQJQfBZ72vqOjYPOEgwu0bVgr4FJBaWNJtRNyHG6BFvP7RgBnKaWD2QJPYcrL1wJGHQa4CuwDNdyxC1cJON8CvXSkiSKzKKsXaJmfGfPCOcKFzJGxPYXrJdLZBaOx_XMEWJwXhRb0wB0y6mF8CULhq5YLqJBv3ZE8yOy-VR79w5UBFt3K0wMW77vFzl1n9kKY8idHf8TIJnfuNtAk8Nt1WJTKqF0afBrXXlBKbIZ3sOBBCUvKPbYQ1QKWDSgJOJQJ3B10y7x_0KCHn8k8Y93DHW4vw';

// Decode without verifying signature (since we don't have the public key)
const decoded = jwt.decode(token, { complete: true });

console.log('JWT Token Analysis:');
console.log('==================');
console.log('\nHeader:');
console.log(JSON.stringify(decoded.header, null, 2));

console.log('\nPayload:');
console.log(JSON.stringify(decoded.payload, null, 2));

console.log('\nKey Fields:');
console.log('- User ID (sub):', decoded.payload.sub);
console.log('- Email:', decoded.payload.email);
console.log('- Developer ID:', decoded.payload['custom:developer_id']);
console.log('- Company Name:', decoded.payload['custom:company_name']);
console.log('- User Type:', decoded.payload['custom:user_type']);
console.log('- Groups:', decoded.payload['cognito:groups']);

// Check if token has standard attributes
console.log('\nStandard Attributes:');
console.log('- preferred_username:', decoded.payload.preferred_username || 'NOT FOUND');
console.log('- website:', decoded.payload.website || 'NOT FOUND');
console.log('- profile:', decoded.payload.profile || 'NOT FOUND');