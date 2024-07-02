const { DynamoDBClient, DescribeTableCommand, CreateTableCommand } = require("@aws-sdk/client-dynamodb");

const Quiz = async () => {
    const client = new DynamoDBClient({
        region: 'us-west-2',
        endpoint: 'http://localhost:8000',
        
    });

    const tableName = 'Quiz';
    const tableParams = {
        TableName: tableName,
        KeySchema: [
            { AttributeName: 'quizId', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'quizId', AttributeType: 'S' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
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

module.exports = Quiz;