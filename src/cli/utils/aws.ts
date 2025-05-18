import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { fromIni } from '@aws-sdk/credential-providers';
import chalk from 'chalk';

export interface AWSIdentity {
  userId: string;
  account: string;
  arn: string;
}

export async function checkAWSIdentity(profile?: string): Promise<AWSIdentity> {
  const client = new STSClient({
    ...(profile && { credentials: fromIni({ profile }) })
  });

  try {
    const { UserId, Account, Arn } = await client.send(new GetCallerIdentityCommand({}));
    
    if (!UserId || !Account || !Arn) {
      throw new Error('Incomplete AWS identity information');
    }

    return {
      userId: UserId,
      account: Account,
      arn: Arn
    };
  } catch (error) {
    console.error(chalk.red('Error: AWS credentials not configured or invalid'));
    console.error(chalk.yellow('Please configure AWS credentials using one of:'));
    console.error(chalk.yellow('1. AWS CLI: aws configure'));
    console.error(chalk.yellow('2. Environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY'));
    console.error(chalk.yellow('3. AWS credentials file: ~/.aws/credentials'));
    process.exit(1);
  }
} 