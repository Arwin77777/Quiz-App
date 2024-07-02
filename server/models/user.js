const { DynamoDBClient, DescribeTableCommand, CreateTableCommand } = require("@aws-sdk/client-dynamodb");

const createUser = async () => {
    const client = new DynamoDBClient({
        region: 'us-west-2',
        endpoint: 'http://localhost:8000'
    });

    const tableName = 'Users';
    const tableParams = {
        TableName: tableName,
        KeySchema: [
            { AttributeName: 'email', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            // { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'email', AttributeType: 'S' },
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10
        }
    };

    try {
        const describeTableCommand = new DescribeTableCommand({ TableName: tableName });
        await client.send(describeTableCommand);
        console.log('Table already exists.');
    } catch (error) {
        if (error.name === 'ResourceNotFoundException') {
            const createTableCommand = new CreateTableCommand(tableParams);
            await client.send(createTableCommand);
            console.log('Table created successfully.');
        } else {
            throw error;
        }
    }
};

module.exports = createUser;