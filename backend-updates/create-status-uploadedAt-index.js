const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB({ region: 'us-east-1' });

const params = {
    TableName: 'trioll-prod-games',
    AttributeDefinitions: [
        {
            AttributeName: 'status',
            AttributeType: 'S'
        },
        {
            AttributeName: 'uploadedAt',
            AttributeType: 'S'
        }
    ],
    GlobalSecondaryIndexUpdates: [
        {
            Create: {
                IndexName: 'status-uploadedAt-index',
                KeySchema: [
                    {
                        AttributeName: 'status',
                        KeyType: 'HASH'
                    },
                    {
                        AttributeName: 'uploadedAt',
                        KeyType: 'RANGE'
                    }
                ],
                Projection: {
                    ProjectionType: 'ALL'
                }
            }
        }
    ]
};

console.log('Creating status-uploadedAt-index on trioll-prod-games table...');

dynamodb.updateTable(params, (err, data) => {
    if (err) {
        if (err.code === 'ValidationException' && err.message.includes('already exists')) {
            console.log('Index already exists');
        } else {
            console.error('Error creating index:', err);
        }
    } else {
        console.log('Index creation initiated successfully');
        console.log('Index will be available in a few minutes');
    }
});