const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
    region: 'us-west-2',
    endpoint: 'http://localhost:8000'
});

const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
    unmarshallOptions: { removeUndefinedValues: true }
});

module.exports = { docClient, client };