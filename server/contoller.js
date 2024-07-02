const {
    DynamoDBClient,
    CreateTableCommand,
    ListTablesCommand,
  } = require("@aws-sdk/client-dynamodb");
  
  const {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    DeleteCommand,
    UpdateCommand,
    QueryCommand,
    ScanCommand,
  } = require("@aws-sdk/lib-dynamodb");
  
  const client = new DynamoDBClient({
    region: "local",
    endpoint: "http://localhost:8000",
  });
  const documentClient = DynamoDBDocumentClient.from(client);
  
  async function createTableIfNotExists(tableName, tableParams) {
    const command = new ListTablesCommand({});
    const response = await client.send(command);
    const responseTables = response.TableNames;
    if (!responseTables.some((x) => x === tableName)) {
      const command = new CreateTableCommand(tableParams);
      await client.send(command);
      return true;
    } else {
      return false;
    }
  }
  
 
  async function addItem(tableName, item) {
    const command = new PutCommand({
      TableName: tableName,
      Item: item,
    });
    const response = await documentClient.send(command);
    return response;
  }
  
 
  async function getItem(tableName, key) {
    const command = new GetCommand({
      TableName: tableName,
      Key: key,
    });
    const response = await documentClient.send(command);
    return response.Item;
  }
  
 
  async function updateItem(
    tableName,
    key,
    updateAttributes,
    conditionExpression = undefined
  ) {
    let expressionAttributeValues = {};
    Object.entries(updateAttributes).forEach(([key, value]) => {expressionAttributeValues[`:${key}`] = value});
    const command = new UpdateCommand({
      TableName: tableName,
      Key: key,
      ConditionExpression: conditionExpression,
      UpdateExpression: "set " + Object.keys(updateAttributes).map(attribute => `${attribute} = :${attribute}`).join(", "),
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    });
    const response = await documentClient.send(command);
    return response;
  }
  
  
  async function scanItems(tableName, filterExpression, expressionAttributeValues, projectExpression = undefined) {
    const command = new ScanCommand({
      TableName: tableName,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ProjectionExpression: projectExpression,
    });
    const response = await documentClient.send(command);
    return response.Items;
  }
  
 
  async function deleteItem(tableName, key) {
    const command = new DeleteCommand({
      TableName: tableName,
      Key: key,
    });
    const response = await documentClient.send(command);
    return response;
  }
  
 
  
  async function queryItems(tableName, KeyConditionExpression, ExpressionAttributeValues, projectExpression, filterExpression = undefined) {
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: KeyConditionExpression,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: ExpressionAttributeValues,
      ProjectionExpression: projectExpression,
    });
    const response = await documentClient.send(command);
    return response.Items;
  }
  
  module.exports = {
    createTableIfNotExists,
    addItem,
    getItem,
    updateItem,
    deleteItem,
    queryItems,
    scanItems,
  };