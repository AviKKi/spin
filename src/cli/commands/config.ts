import { Command } from 'commander';
import chalk from 'chalk';
import Enquirer from 'enquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.spin.json');

interface ProviderConfig {
  // Provider-specific options will go here
}

interface AWSProviderConfig extends ProviderConfig {
  deploymentStateStorage: 's3' | 'local';
  s3Bucket?: string; // For S3 state storage
  logStorage: 'cloudwatch' | 'local';
  logGroupName?: string; // For CloudWatch logs
}

interface LocalProviderConfig extends ProviderConfig {
  deploymentStateStorage: 'local';
  logStorage: 'local';
}

interface Workspace {
  name: string;
  provider: 'aws' | 'local';
  providerConfig: AWSProviderConfig | LocalProviderConfig;
  // Common workspace settings
  projectPath?: string; // Path to the project this workspace is associated with (optional)
}

interface GlobalConfig {
  workspaces: Workspace[];
  activeWorkspace?: string;
}

// Helper function to read global config
function readGlobalConfig(): GlobalConfig {
  if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
    const rawData = fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf-8');
    try {
      return JSON.parse(rawData) as GlobalConfig;
    } catch (error) {
      console.error(chalk.red('Error parsing global config file:'), error);
      // Return a default empty config if parsing fails
      return { workspaces: [] };
    }
  }
  return { workspaces: [] }; // Default if file doesn't exist
}

// Helper function to write global config
function writeGlobalConfig(config: GlobalConfig): void {
  try {
    fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(chalk.red('Error writing global config file:'), error);
    process.exit(1);
  }
}

async function promptUser(message: string, defaultValue?: string): Promise<string> {
  const response = await Enquirer.prompt({
    type: 'input',
    name: 'value',
    message,
    initial: defaultValue,
  });
  return (response as any).value;
}

async function selectPrompt<T extends string>(message: string, choices: T[], initial?: T): Promise<T> {
  const response = await (Enquirer.prompt({
    type: 'select',
    name: 'value',
    message,
    choices: choices as string[],
    initial: initial as string,
  }) as Promise<{ value: T }>);
  return response.value;
}

async function confirmUser(message: string, initial: boolean): Promise<boolean> {
  const response = await Enquirer.prompt({
    type: 'confirm',
    name: 'value',
    message,
    initial,
  });
  return (response as any).value;
}


async function handleCreateWorkspace(): Promise<void> {
  console.log(chalk.blue('Creating a new workspace...'));
  const config = readGlobalConfig();

  const workspaceName = await promptUser('Enter workspace name:');
  if (config.workspaces.find(ws => ws.name === workspaceName)) {
    console.error(chalk.red(`Workspace "${workspaceName}" already exists.`));
    return;
  }

  const provider = await selectPrompt('Choose a provider:', ['aws', 'local']);

  let providerConfig: AWSProviderConfig | LocalProviderConfig;
  let deploymentStateStorage: 's3' | 'local' | 'cloudwatch'; // Union of possible types
  let logStorage: 'cloudwatch' | 'local';

  if (provider === 'aws') {
    deploymentStateStorage = await selectPrompt(
      'Where to store deployment state?', 
      ['s3', 'local'], 
      's3'
    );
    
    let s3Bucket: string | undefined;
    if (deploymentStateStorage === 's3') {
      s3Bucket = await promptUser('Enter S3 bucket name for deployment state (optional, will be generated if blank):');
    }

    logStorage = await selectPrompt(
      'Where to store logs?',
      ['cloudwatch', 'local'],
      'cloudwatch'
    );

    let logGroupName: string | undefined;
    if (logStorage === 'cloudwatch') {
      logGroupName = await promptUser('Enter CloudWatch Log Group name (optional, will be generated if blank):');
    }
    
    providerConfig = {
      deploymentStateStorage: deploymentStateStorage as 's3' | 'local', // Cast based on context
      s3Bucket,
      logStorage: logStorage as 'cloudwatch' | 'local', // Cast based on context
      logGroupName,
    };

  } else { // provider === 'local'
    deploymentStateStorage = 'local';
    logStorage = 'local';
    providerConfig = {
      deploymentStateStorage,
      logStorage,
    };
  }

  const newWorkspace: Workspace = {
    name: workspaceName,
    provider,
    providerConfig,
  };

  config.workspaces.push(newWorkspace);
  if (!config.activeWorkspace || await confirmUser(`Set "${workspaceName}" as active workspace?`, true)) {
    config.activeWorkspace = workspaceName;
  }

  writeGlobalConfig(config);
  console.log(chalk.green(`Workspace "${workspaceName}" created successfully.`));
  if (config.activeWorkspace === workspaceName) {
    console.log(chalk.cyan(`"${workspaceName}" is now the active workspace.`));
  }
}

async function handleDeleteWorkspace(): Promise<void> {
  console.log(chalk.blue('Deleting a workspace...'));
  const config = readGlobalConfig();
  if (config.workspaces.length === 0) {
    console.log(chalk.yellow('No workspaces to delete.'));
    return;
  }

  const workspaceToDelete = await selectPrompt(
    'Select workspace to delete:',
    config.workspaces.map(ws => ws.name)
  );

  if (!workspaceToDelete) return; // User cancelled

  const confirmation = await confirmUser(
    `Are you sure you want to delete workspace "${workspaceToDelete}"? This cannot be undone.`,
    false
  );

  if (confirmation) {
    config.workspaces = config.workspaces.filter(ws => ws.name !== workspaceToDelete);
    if (config.activeWorkspace === workspaceToDelete) {
      config.activeWorkspace = config.workspaces.length > 0 ? config.workspaces[0].name : undefined;
      console.log(chalk.yellow(`Active workspace was deleted. New active workspace: ${config.activeWorkspace || 'None'}`));
    }
    writeGlobalConfig(config);
    console.log(chalk.green(`Workspace "${workspaceToDelete}" deleted successfully.`));
  } else {
    console.log(chalk.yellow('Workspace deletion cancelled.'));
  }
}

async function handleUpdateWorkspace(): Promise<void> {
  console.log(chalk.blue('Updating a workspace...'));
  const config = readGlobalConfig();
  if (config.workspaces.length === 0) {
    console.log(chalk.yellow('No workspaces to update.'));
    return;
  }

  const workspaceToUpdateName = await selectPrompt(
    'Select workspace to update:',
    config.workspaces.map(ws => ws.name)
  );

  if (!workspaceToUpdateName) return;

  const workspaceIndex = config.workspaces.findIndex(ws => ws.name === workspaceToUpdateName);
  if (workspaceIndex === -1) {
    console.error(chalk.red('Selected workspace not found. This should not happen.'));
    return;
  }
  
  const workspace = config.workspaces[workspaceIndex];

  console.log(chalk.cyan(`
Updating workspace: ${workspace.name}`));
  console.log(chalk.gray(`Current provider: ${workspace.provider}`));
  // For simplicity, we'll re-prompt for most settings. A more advanced CLI might allow partial updates.

  const provider = await selectPrompt('Choose a provider:', ['aws', 'local'], workspace.provider);

  let providerConfig: AWSProviderConfig | LocalProviderConfig;
  let deploymentStateStorage: 's3' | 'local' | 'cloudwatch';
  let logStorage: 'cloudwatch' | 'local';

  if (provider === 'aws') {
    const currentAwsConfig = workspace.provider === 'aws' ? workspace.providerConfig as AWSProviderConfig : {} as AWSProviderConfig;
    
    deploymentStateStorage = await selectPrompt(
      'Where to store deployment state?', 
      ['s3', 'local'], 
      currentAwsConfig.deploymentStateStorage || 's3'
    );
    
    let s3Bucket: string | undefined = currentAwsConfig.s3Bucket;
    if (deploymentStateStorage === 's3') {
      s3Bucket = await promptUser(
        'Enter S3 bucket name for deployment state (optional, will be generated if blank):',
        s3Bucket
      );
    } else {
      s3Bucket = undefined; // Clear if not using S3
    }

    logStorage = await selectPrompt(
      'Where to store logs?',
      ['cloudwatch', 'local'],
      currentAwsConfig.logStorage || 'cloudwatch'
    );

    let logGroupName: string | undefined = currentAwsConfig.logGroupName;
    if (logStorage === 'cloudwatch') {
      logGroupName = await promptUser(
        'Enter CloudWatch Log Group name (optional, will be generated if blank):',
        logGroupName
      );
    } else {
      logGroupName = undefined; // Clear if not using CloudWatch
    }
    
    providerConfig = {
      deploymentStateStorage: deploymentStateStorage as 's3' | 'local',
      s3Bucket,
      logStorage: logStorage as 'cloudwatch' | 'local',
      logGroupName,
    };

  } else { // provider === 'local'
    deploymentStateStorage = 'local';
    logStorage = 'local';
    providerConfig = {
      deploymentStateStorage,
      logStorage,
    };
  }

  config.workspaces[workspaceIndex] = {
    ...workspace, // Preserve name and any other top-level settings
    provider,
    providerConfig,
  };
  
  writeGlobalConfig(config);
  console.log(chalk.green(`Workspace "${workspaceToUpdateName}" updated successfully.`));
}

async function handleListWorkspaces(): Promise<void> {
    const config = readGlobalConfig();
    if (config.workspaces.length === 0) {
        console.log(chalk.yellow("No workspaces configured yet. Use 'spin config create' to add one."));
        return;
    }

    console.log(chalk.blue("Available workspaces:"));
    config.workspaces.forEach(ws => {
        const isActive = ws.name === config.activeWorkspace ? chalk.green(' (active)') : '';
        console.log(`- ${chalk.bold(ws.name)}${isActive}`);
        console.log(`  Provider: ${ws.provider}`);
        if (ws.provider === 'aws') {
            const awsConfig = ws.providerConfig as AWSProviderConfig;
            console.log(`  Deployment State: ${awsConfig.deploymentStateStorage}${awsConfig.s3Bucket ? ` (Bucket: ${awsConfig.s3Bucket})` : ''}`);
            console.log(`  Log Storage: ${awsConfig.logStorage}${awsConfig.logGroupName ? ` (Group: ${awsConfig.logGroupName})` : ''}`);
        } else {
            const localConfig = ws.providerConfig as LocalProviderConfig;
            console.log(`  Deployment State: ${localConfig.deploymentStateStorage}`);
            console.log(`  Log Storage: ${localConfig.logStorage}`);
        }
        if(ws.projectPath) console.log(`  Project Path: ${ws.projectPath}`);
    });
}

async function handleSetActiveWorkspace(): Promise<void> {
    const config = readGlobalConfig();
    if (config.workspaces.length === 0) {
        console.log(chalk.yellow("No workspaces configured. Cannot set active workspace."));
        return;
    }

    const workspaceToSetActive = await selectPrompt(
        'Select workspace to set as active:',
        config.workspaces.map(ws => ws.name),
        config.activeWorkspace
    );

    if (workspaceToSetActive) {
        config.activeWorkspace = workspaceToSetActive;
        writeGlobalConfig(config);
        console.log(chalk.green(`Workspace "${workspaceToSetActive}" is now active.`));
    } else {
        console.log(chalk.yellow('No workspace selected. Active workspace unchanged.'));
    }
}


export function registerConfigCommand(program: Command): void {
  const configCommand = program
    .command('config')
    .description('Manage global Spin CLI configuration and workspaces.');

  configCommand
    .command('create')
    .description('Create a new workspace.')
    .action(handleCreateWorkspace);

  configCommand
    .command('delete')
    .description('Delete an existing workspace.')
    .action(handleDeleteWorkspace);

  configCommand
    .command('update')
    .description('Update an existing workspace.')
    .action(handleUpdateWorkspace);
  
  configCommand
    .command('list')
    .description('List all configured workspaces.')
    .action(handleListWorkspaces);

  configCommand
    .command('set-active')
    .description('Set the active workspace.')
    .action(handleSetActiveWorkspace);
    
  configCommand
    .action(() => {
        // If no subcommand is given, list workspaces or show help
        if (process.argv.length <= 3) { // spin config (no args)
             handleListWorkspaces();
        } else {
            configCommand.outputHelp();
        }
    });
} 