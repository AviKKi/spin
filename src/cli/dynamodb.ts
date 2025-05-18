import { DynamoDBClient, ListTablesCommand, ListTagsOfResourceCommand } from '@aws-sdk/client-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers';
import { Account } from '../models/index.js';

export async function discoverSpinAccounts(region: string, profile?: string): Promise<Account[]> {
  const client = new DynamoDBClient({
    region,
    ...(profile && { credentials: fromIni({ profile }) })
  });

  try {
    // List all tables
    const listTablesCommand = new ListTablesCommand({});
    const { TableNames } = await client.send(listTablesCommand);

    if (!TableNames) {
      return [];
    }

    // Filter tables with spin-cli tag
    const spinAccounts: Account[] = [];
    
    for (const tableName of TableNames) {
      const listTagsCommand = new ListTagsOfResourceCommand({
        ResourceArn: `arn:aws:dynamodb:${region}:*:table/${tableName}`
      });

      try {
        const { Tags } = await client.send(listTagsCommand);
        if (Tags?.some(tag => tag.Key === 'spin-cli' && tag.Value === 'true')) {
          spinAccounts.push({
            itemType: "ACCOUNT",
            pk: "ACCOUNT",
            sk: "METADATA",
            name: tableName,
            tableName,
            defaultRegion: region,createdAt: new Date().toISOString()
          });
        }
      } catch (error) {
        console.warn(`Could not get tags for table ${tableName}:`, error);
      }
    }

    return spinAccounts;
  } catch (error) {
    console.error('Error discovering Spin accounts:', error);
    throw error;
  }
} 