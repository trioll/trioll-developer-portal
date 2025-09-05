const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
    region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB();

const TABLE_NAME = 'trioll-prod-comments';

async function createCommentsTable() {
    const params = {
        TableName: TABLE_NAME,
        KeySchema: [
            { AttributeName: 'gameId', KeyType: 'HASH' },  // Partition key
            { AttributeName: 'commentId', KeyType: 'RANGE' } // Sort key
        ],
        AttributeDefinitions: [
            { AttributeName: 'gameId', AttributeType: 'S' },
            { AttributeName: 'commentId', AttributeType: 'S' },
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'createdAt', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'userId-createdAt-index',
                KeySchema: [
                    { AttributeName: 'userId', KeyType: 'HASH' },
                    { AttributeName: 'createdAt', KeyType: 'RANGE' }
                ],
                Projection: {
                    ProjectionType: 'ALL'
                }
            }
        ],
        BillingMode: 'PAY_PER_REQUEST'
    };
    
    try {
        console.log('Creating comments table...');
        const result = await dynamodb.createTable(params).promise();
        console.log('✅ Comments table created successfully');
        console.log('Table ARN:', result.TableDescription.TableArn);
        
        // Wait for table to be active
        console.log('\nWaiting for table to become active...');
        await waitForTableActive();
        
    } catch (error) {
        if (error.code === 'ResourceInUseException') {
            console.log('⚠️  Table already exists');
        } else {
            console.error('❌ Error creating table:', error);
            throw error;
        }
    }
}

async function waitForTableActive() {
    const params = {
        TableName: TABLE_NAME
    };
    
    let tableActive = false;
    let attempts = 0;
    
    while (!tableActive && attempts < 30) {
        attempts++;
        
        try {
            const result = await dynamodb.describeTable(params).promise();
            
            if (result.Table.TableStatus === 'ACTIVE') {
                tableActive = true;
                console.log('✅ Table is now ACTIVE');
                
                // Show sample comment structure
                console.log('\n📝 Sample comment structure:');
                console.log(JSON.stringify({
                    gameId: "game_123456",
                    commentId: "comment_" + Date.now(),
                    userId: "user_789",
                    userName: "Player123",
                    userAvatar: "https://trioll-prod-uploads.s3.amazonaws.com/avatars/user_789.jpg",
                    comment: "This game is really fun! The controls are smooth.",
                    rating: 5,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    likes: 0,
                    isEdited: false,
                    parentCommentId: null
                }, null, 2));
            } else {
                console.log(`Attempt ${attempts}: Table status is ${result.Table.TableStatus}...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (error) {
            console.error('Error checking table status:', error);
            break;
        }
    }
    
    if (!tableActive) {
        console.log('⚠️  Table did not become active within expected time');
    }
}

// Run the script
createCommentsTable()
    .then(() => {
        console.log('\n✅ Script completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });