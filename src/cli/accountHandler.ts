import {
  CreateTableCommand,
  DynamoDBClient,
  TagResourceCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import { loadGlobalConfig, saveGlobalConfig } from "./config.js";
import { Account } from "../models/index.js";
import { createRepositories } from "../repositories/index.js";

export async function createNewAccount(input: {
  name: string;
  region: string;
}) {
  const { name, region } = input;
  // create dynamo db ${name}-spin-account table, to store this account's projects
  const dynamoClient = new DynamoDBClient({
    region: region,
  });
  const tableName = `${name}-spin-account`;
  const createTableCommand = new CreateTableCommand({
    TableName: tableName,
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" }, // partition key
      { AttributeName: "sk", KeyType: "RANGE" },
    ], // sort key],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  });

  const table = await dynamoClient.send(createTableCommand);

  // Wait for it to become ACTIVE (max 60 seconds by default)
  await waitUntilTableExists(
    { client: dynamoClient, maxWaitTime: 60 }, // this timeout is a potential bug 🐛🐛 @techDebt
    { TableName: tableName }
  );

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
  };
  globalConfig.accounts.push(newAccount);
  await saveGlobalConfig(globalConfig);

  // Save account to DynamoDB using AccountRepository
  const repositories = createRepositories(region, tableName);
  await repositories.accountRepo.saveAccount({
    name,
    defaultRegion: region,
    tableName,
    createdAt: new Date().toISOString(),
  });

  return newAccount;
}
