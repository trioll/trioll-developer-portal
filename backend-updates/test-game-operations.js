// Test script to verify game operations work with the fixed Lambda functions

const API_BASE = 'https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod';

// The token from the user's test (expired but structure is what matters for local testing)
const TOKEN = 'eyJraWQiOiJOYXNKUk1mRm5kMENOaWIrRHM3QzJiOGprSThmVkkxaHdnU3VqM1wvNnJBQT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJjODRhN2U5Ni01NTgzLTRkMGItYmUwYS00NTE5NTE4YzI4OGQiLCJjb2duaXRvOmdyb3VwcyI6WyJkZXZlbG9wZXJzIl0sImN1c3RvbTpjb21wYW55X25hbWUiOiJGcmVkZGllVHJpb2xsIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImN1c3RvbTp1c2VyX3R5cGUiOiJkZXZlbG9wZXIiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV9jTFBIMmFjUWQiLCJjb2duaXRvOnVzZXJuYW1lIjoiYzg0YTdlOTYtNTU4My00ZDBiLWJlMGEtNDUxOTUxOGMyODhkIiwiY3VzdG9tOmRldmVsb3Blcl9pZCI6ImRldl9jODRhN2UiLCJvcmlnaW5fanRpIjoiODg2NGJjOGYtNzM3OS00ZmJkLWIwZDgtM2U1ODE0YzAyNGY5IiwiYXVkIjoiNWpvb2dxdXFyNGpndWtwN21uY2dwM2cyM2giLCJldmVudF9pZCI6IjQ5N2FlMDVhLTY3MDEtNGQwZC1hMzVmLTgzYzJjZTkzZjMzZCIsInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNzM2MDc1NTA3LCJleHAiOjE3MzYxNjE5MDcsImlhdCI6MTczNjA3NTUwNywianRpIjoiMGQwMGE4NTMtN2Y1OC00NDA5LTkxOWEtZWM4Mjc4YzRjOWI4IiwiZW1haWwiOiJmcmVkZGllY2FwbGluQGhvdG1haWwuY29tIn0.bk6Hw6e_6KxzH5Iw2xdRJUnGdTcvBJppA8-tYA5pnBdLNOdT2mJfHy6sHXezrQJQfBZ72vqOjYPOEgwu0bVgr4FJBaWNJtRNyHG6BFvP7RgBnKaWD2QJPYcrL1wJGHQa4CuwDNdyxC1cJON8CvXSkiSKzKKsXaJmfGfPCOcKFzJGxPYXrJdLZBaOx_XMEWJwXhRb0wB0y6mF8CULhq5YLqJBv3ZE8yOy-VR79w5UBFt3K0wMW77vFzl1n9kKY8idHf8TIJnfuNtAk8Nt1WJTKqF0afBrXXlBKbIZ3sOBBCUvKPbYQ1QKWDSgJOJQJ3B10y7x_0KCHn8k8Y93DHW4vw';

async function testGameOperations() {
    console.log('Testing Game Operations with Fixed Lambda Functions');
    console.log('=================================================\n');

    // Step 1: Test GET /developers/games
    console.log('1. Testing GET /developers/games');
    try {
        const response = await fetch(`${API_BASE}/developers/games`, {
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'X-App-Client': 'developer-portal'
            }
        });
        
        const data = await response.json();
        console.log(`   Status: ${response.status}`);
        console.log(`   Success: ${data.success}`);
        console.log(`   Games found: ${data.games?.length || 0}`);
        
        if (data.games && data.games.length > 0) {
            console.log(`   First game: ${data.games[0].name} (${data.games[0].gameId})`);
        }
    } catch (error) {
        console.log(`   Error: ${error.message}`);
    }

    console.log('\n2. Testing POST /games (Create new game)');
    const testGameId = `test-${Date.now()}`;
    const newGame = {
        gameId: testGameId,
        name: 'Lambda Test Game',
        description: 'Testing the fixed Lambda function',
        category: 'Action',
        developer: 'FreddieTrioll',
        developerId: 'dev_c84a7e',
        deviceOrientation: 'Both',
        controlStyle: 'Tap & Swipe Only',
        gameStage: 'Released',
        deviceCompatibility: ['Mobile iOS', 'Mobile Android', 'Computer/Laptop'],
        gameUrl: `https://trioll-prod-games-us-east-1.s3.amazonaws.com/${testGameId}/index.html`,
        thumbnailUrl: `https://trioll-prod-games-us-east-1.s3.amazonaws.com/${testGameId}/thumbnail.png`,
        status: 'active'
    };

    try {
        const response = await fetch(`${API_BASE}/games`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`,
                'X-App-Client': 'developer-portal'
            },
            body: JSON.stringify(newGame)
        });
        
        const data = await response.json();
        console.log(`   Status: ${response.status}`);
        console.log(`   Success: ${data.success}`);
        console.log(`   Game ID: ${data.gameId}`);
        
        if (!data.success) {
            console.log(`   Error: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        console.log(`   Error: ${error.message}`);
    }

    console.log('\n3. Testing PUT /games/{gameId} (Update game)');
    const updates = {
        name: 'Lambda Test Game - Updated',
        description: 'Updated description from test script',
        category: 'Adventure',
        status: 'active'
    };

    try {
        const response = await fetch(`${API_BASE}/games/${testGameId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`,
                'X-App-Client': 'developer-portal'
            },
            body: JSON.stringify(updates)
        });
        
        const data = await response.json();
        console.log(`   Status: ${response.status}`);
        console.log(`   Success: ${data.success}`);
        
        if (data.game) {
            console.log(`   Updated game: ${data.game.name}`);
        } else {
            console.log(`   Response: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        console.log(`   Error: ${error.message}`);
    }

    console.log('\n4. Verify game was created/updated');
    try {
        const response = await fetch(`${API_BASE}/games/${testGameId}`, {
            headers: {
                'X-App-Client': 'developer-portal'
            }
        });
        
        const game = await response.json();
        console.log(`   Status: ${response.status}`);
        if (response.ok) {
            console.log(`   Game found: ${game.title}`);
            console.log(`   Developer: ${game.developerName} (${game.developerId})`);
            console.log(`   Version: ${game.version || 'N/A'}`);
        } else {
            console.log(`   Error: ${JSON.stringify(game)}`);
        }
    } catch (error) {
        console.log(`   Error: ${error.message}`);
    }

    console.log('\n✅ Test completed!');
    console.log('\nNOTE: The token in this test is expired. To run live tests:');
    console.log('1. Log in at https://triolldev.com');
    console.log('2. Open browser console and run: localStorage.getItem("developerToken")');
    console.log('3. Replace the TOKEN variable with the fresh token');
}

// For local testing only - won't work due to CORS
if (require.main === module) {
    console.log('⚠️  This script is meant to be run from a browser console');
    console.log('   Copy the testGameOperations function and run it there');
    console.log('   OR use the test pages at triolldev.com');
}

// Export for use in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testGameOperations };
}