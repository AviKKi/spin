import { Command } from 'commander';
import chalk from 'chalk';
import Enquirer from 'enquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';

async function promptUser(message: string, defaultValue?: string): Promise<string> {
  // This is a stub. In a real CLI, you'd use Enquirer or similar.
  // For now, it simulates user input, often preferring defaults if provided.
  console.log(chalk.cyan(`[PROMPT] ${message}${defaultValue ? chalk.gray(` (default: ${defaultValue})`) : ''}`));
  const response = await Enquirer.prompt({ type: 'input', name: 'value', message, initial: defaultValue });
  return (response as any).value;
}

async function confirmUser(message: string, defaultValue: boolean): Promise<boolean> {
  // This is a stub.
  console.log(chalk.cyan(`[CONFIRM] ${message}${defaultValue ? chalk.gray(' (default: yes)') : chalk.gray(' (default: no)')}`));
  const response = await Enquirer.prompt({ type: 'confirm', name: 'value', message, initial: defaultValue });
  return (response as any).value;
}

// Function to get default recipe options (specifically for SPA_Bucket_CDN for now)
// In a real app, this might come from the recipe definition itself.
function getDefaultRecipeOptions(projectName: string, existingConfig?: any): any {
  const baseBucketName = projectName ? `spin-spa-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '')}` : undefined;
  return {
    aws: {
      region: existingConfig?.aws?.region || 'us-east-1',
      bucketName: existingConfig?.aws?.bucketName || baseBucketName,
      autoCert: existingConfig?.aws?.autoCert !== undefined ? existingConfig.aws.autoCert : true,
      useRoute53: existingConfig?.aws?.useRoute53 !== undefined ? existingConfig.aws.useRoute53 : true,
      hostedZoneId: existingConfig?.aws?.hostedZoneId || '', // User must provide if useRoute53 is true
    },
    domains: existingConfig?.domains || [],
    // Add other recipe-specific defaults here
  };
}


export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Interactive wizard to initialize a new Spin project and create .spin.json')
    .action(async () => {
      console.log(chalk.blue('Initializing new Spin project...'));
      const workspaceRoot = process.cwd();
      const spinJsonPath = path.join(workspaceRoot, '.spin.json');

      if (fs.existsSync(spinJsonPath)) {
        console.error(chalk.red(`Error: .spin.json already exists at ${spinJsonPath}.`));
        console.log(chalk.yellow('If you want to re-initialize, please remove the existing file first.'));
        process.exit(1);
        return;
      }

      try {
        // 1. Gather Project Information
        let defaultProjectName: string;
        try {
          const packageJsonPath = path.join(workspaceRoot, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
            const packageJsonData = JSON.parse(packageJsonContent);
            defaultProjectName = packageJsonData.name || path.basename(workspaceRoot);
          } else {
            defaultProjectName = path.basename(workspaceRoot);
          }
        } catch (e) {
          console.warn(chalk.yellow("Could not read project name from package.json, using directory name."));
          defaultProjectName = path.basename(workspaceRoot);
        }

        const projectName = await promptUser('Enter project name:', defaultProjectName);
        const buildCommand = await promptUser('Enter build command (e.g., npm run build, yarn build):', 'npm run build');
        const outputDirectory = await promptUser('Enter output directory (relative to project root, e.g., dist, build):', 'dist');

        // 2. Select Recipe (Simplified: Assume SPA_Bucket_CDN for now)
        // In a real scenario, you'd list available recipes.
        // const availableRecipes = ['SPA_Bucket_CDN', 'Backend_Lambda_API']; // Example
        // const selectedRecipeName = await Enquirer.prompt({ type: 'select', name: 'recipe', message: 'Select a recipe:', choices: availableRecipes});
        const selectedRecipeName = 'SPA_Bucket_CDN'; // Hardcoded for now
        console.log(chalk.green(`Selected recipe: ${selectedRecipeName}`));


        // 3. Configure Recipe Options (for SPA_Bucket_CDN)
        console.log(chalk.blue(`\nConfiguring options for recipe: ${selectedRecipeName}`));
        let recipeSpecificConfig = getDefaultRecipeOptions(projectName);

        console.log(chalk.yellow('Default recipe options:'));
        console.log(JSON.stringify(recipeSpecificConfig, null, 2));
        
        const useCustomOptions = await confirmUser('Do you want to customize the default recipe options?', false);

        if (useCustomOptions) {
          console.log(chalk.blue('Enter custom recipe configurations:'));
          recipeSpecificConfig.aws.region = await promptUser('AWS Region:', recipeSpecificConfig.aws.region);
          
          const domainInput = await promptUser(`Custom Domain (e.g., myapp.com, leave blank if none):`, recipeSpecificConfig.domains?.[0] || "");
          recipeSpecificConfig.domains = domainInput ? [domainInput] : [];

          const defaultBucket = recipeSpecificConfig.aws.bucketName || `spin-spa-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '')}-${Date.now().toString().slice(-6)}`;
          recipeSpecificConfig.aws.bucketName = await promptUser(`S3 Bucket Name (leave blank for generated: ${defaultBucket}):`, defaultBucket);
          if (!recipeSpecificConfig.aws.bucketName) recipeSpecificConfig.aws.bucketName = defaultBucket;


          if (recipeSpecificConfig.domains.length > 0) {
            recipeSpecificConfig.aws.autoCert = await confirmUser(
              `Automatically request SSL certificate for ${recipeSpecificConfig.domains[0]} via ACM?`,
              recipeSpecificConfig.aws.autoCert
            );
            recipeSpecificConfig.aws.useRoute53 = await confirmUser(
              `Automatically configure Route53 DNS for ${recipeSpecificConfig.domains[0]}?`,
              recipeSpecificConfig.aws.useRoute53
            );
            if (recipeSpecificConfig.aws.useRoute53) {
              recipeSpecificConfig.aws.hostedZoneId = await promptUser(
                `AWS Hosted Zone ID for domain ${recipeSpecificConfig.domains[0]} (required if using Route53):`, 
                recipeSpecificConfig.aws.hostedZoneId || ''
              );
            }
          } else {
            recipeSpecificConfig.aws.autoCert = false;
            recipeSpecificConfig.aws.useRoute53 = false;
            recipeSpecificConfig.aws.hostedZoneId = '';
          }
        }

        // 4. Create .spin.json
        const spinConfigData = {
          projectName,
          buildCommand,
          outputDirectory,
          selectedRecipe: selectedRecipeName,
          recipeConfig: { // This nests recipe-specific config under a key, e.g., SPA_Bucket_CDN
            [selectedRecipeName]: recipeSpecificConfig 
          }
        };

        fs.writeFileSync(spinJsonPath, JSON.stringify(spinConfigData, null, 2));
        console.log(chalk.greenBright(`\n✅ Project initialized successfully! Configuration saved to ${spinJsonPath}`));
        console.log(chalk.cyan('You can now run other spin commands, like "spin deploy".'));

      } catch (error: any) {
        if (error.isTtyError) {
          console.error(chalk.red('Error: Prompt could not be rendered in the current environment.'));
        } else {
          console.error(chalk.red('Error during init:'), error.message || error);
        }
        process.exit(1);
      }
    });
} 