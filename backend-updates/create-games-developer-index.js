const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
    region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB();

const GAMES_TABLE = 'trioll-prod-games';

// Create Global Secondary Index for developerId on games table
async function createGamesDeveloperIdIndex() {
    const params = {
        TableName: GAMES_TABLE,
        AttributeDefinitions: [
            {
                AttributeName: 'developerId',
                AttributeType: 'S'
            }
        ],
        GlobalSecondaryIndexUpdates: [
            {
                Create: {
                    IndexName: 'developerIdIndex',
                    KeySchema: [
                        {
                            AttributeName: 'developerId',
                            KeyType: 'HASH'
                        }
                    ],
                    Projection: {
                        ProjectionType: 'ALL'
                    }
                }
            }
        ]
    };
    
    try {
        console.log('Creating GSI for developerId on table:', GAMES_TABLE);
        const result = await dynamodb.updateTable(params).promise();
        console.log('GSI creation initiated successfully');
        console.log('Index status:', result.TableDescription.GlobalSecondaryIndexes);
        
        // Wait for index to be active
        console.log('\nWaiting for index to become active...');
        await waitForIndexActive();
        
    } catch (error) {
        if (error.code === 'ValidationException' && error.message.includes('already exists')) {
            console.log('Index already exists');
        } else {
            console.error('Error creating GSI:', error);
            throw error;
        }
    }
}

// Wait for index to become active
async function waitForIndexActive() {
    const params = {
        TableName: GAMES_TABLE
    };
    
    let indexActive = false;
    let attempts = 0;
    
    while (!indexActive && attempts < 30) {
        attempts++;
        
        try {
            const result = await dynamodb.describeTable(params).promise();
            const index = result.Table.GlobalSecondaryIndexes?.find(idx => idx.IndexName === 'developerIdIndex');
            
            if (index && index.IndexStatus === 'ACTIVE') {
                indexActive = true;
                console.log('✅ Index is now ACTIVE');
            } else {
                console.log(`Attempt ${attempts}: Index status is ${index?.IndexStatus || 'CREATING'}...`);
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            }
        } catch (error) {
            console.error('Error checking index status:', error);
            break;
        }
    }
    
    if (!indexActive) {
        console.log('⚠️  Index did not become active within expected time');
    }
}

// Run the script
createGamesDeveloperIdIndex()
    .then(() => {
        console.log('\n✅ Script completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });