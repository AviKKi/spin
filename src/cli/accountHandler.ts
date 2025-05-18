import {
  CreateTableCommand,
  DynamoDBClient,
  TagResourceCommand,
} from "@aws-sdk/client-dynamodb";
import { loadGlobalConfig, saveGlobalConfig } from "./config.js";
import { Account } from "../models/index.js";

export async function createNewAccount(input: {
  name: string;
  region: string;
}) {
  const { name, region } = input;
  // create dynamo db ${name}-spin-account table, to store this account's projects
  const dynamoClient = new DynamoDBClient({
    region: region,
  });

  const createTableCommand = new CreateTableCommand({
    TableName: `${name}-spin-account`,
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 },
  });

  const table = await dynamoClient.send(createTableCommand);

  // tag table with sping-cli true
  const tagTableCommand = new TagResourceCommand({
    ResourceArn: table.TableDescription?.TableArn,
    Tags: [{ Key: "sping-cli", Value: "true" }],
  });
  await dynamoClient.send(tagTableCommand);

  // save this back into the global config
  const globalConfig = await loadGlobalConfig();
  let newAccount: Account = {
    name,
    defaultRegion: region,
    tableName: `${name}-spin-account`,
    pk: "ACCOUNT",
    sk: "METADATA",
    itemType: "ACCOUNT",
    createdAt: new Date().toISOString(),
  }
  globalConfig.accounts.push(newAccount);
  await saveGlobalConfig(globalConfig);

  return newAccount;
}
