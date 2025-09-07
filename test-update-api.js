// Test script for game update API
const https = require('https');

// Test configuration
const API_ENDPOINT = 'https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod';
const GAME_ID = 'Evolution-Runner'; // Game owned by dev_c84a7e
const TEST_TOKEN = process.argv[2]; // Pass token as command line argument

if (!TEST_TOKEN) {
    console.error('Please provide a token as argument: node test-update-api.js YOUR_TOKEN');
    process.exit(1);
}

// Test data
const updateData = {
    name: "Evolution Runner - Updated",
    description: "Updated description for testing the game update API",
    category: "Adventure",
    status: "active"
};

// Make PUT request
const options = {
    hostname: '4ib0hvu1xj.execute-api.us-east-1.amazonaws.com',
    path: `/prod/games/${GAME_ID}`,
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'X-App-Client': 'developer-portal'
    }
};

console.log('🔍 Testing game update API...');
console.log(`📍 Endpoint: PUT ${API_ENDPOINT}/games/${GAME_ID}`);
console.log('📝 Update data:', updateData);

const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log(`\n📊 Response Status: ${res.statusCode}`);
        console.log('📋 Response Headers:', res.headers);
        console.log('\n📄 Response Body:');
        
        try {
            const parsed = JSON.parse(data);
            console.log(JSON.stringify(parsed, null, 2));
            
            if (res.statusCode === 200 && parsed.success) {
                console.log('\n✅ SUCCESS: Game updated successfully!');
                console.log('Updated game:', parsed.game);
            } else if (res.statusCode === 401) {
                console.log('\n❌ ERROR: Authentication failed');
                console.log('Make sure your token is valid and not expired');
            } else if (res.statusCode === 403) {
                console.log('\n❌ ERROR: Permission denied');
                console.log('You can only update games you own');
            } else {
                console.log('\n❌ ERROR: Update failed');
            }
        } catch (e) {
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (e) => {
    console.error('❌ Request failed:', e.message);
});

req.write(JSON.stringify(updateData));
req.end();