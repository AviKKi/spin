import { Command } from "commander";
import { deleteResources } from "../../resourceManager/createResources.js";
import { loadProjectConfig } from "../config.js";
import { createRepositories } from "../../repositories/index.js";
import chalk from "chalk";
import Enquirer from "enquirer";

export function purgeCommand(program: Command) {
  program
    .command("purge")
    .description("Delete all AWS resources associated with the project")
    .action(async () => {
      try {
        // Get the current project
        const project = await loadProjectConfig();
        if (!project) {
          console.error(chalk.red("❌ No project found. Please run 'spin init' first."));
          process.exit(1);
        }

        // Initialize repositories
        const { projectRepo } = createRepositories(project.region, process.env.DYNAMODB_TABLE || '');

        // Confirm with user
        console.log(chalk.yellow("⚠️  This will delete all AWS resources associated with your project."));
        console.log(chalk.yellow("This action cannot be undone."));
        console.log(chalk.yellow("Resources to be deleted:"));
        console.log(chalk.yellow("- S3 Bucket"));
        console.log(chalk.yellow("- CloudFront Distribution"));
        console.log(chalk.yellow("- SSL Certificate"));
        console.log(chalk.yellow("- Route53 Records"));
        
        const { confirm } = await Enquirer.prompt<{ confirm: boolean }>({
          type: 'confirm',
          name: 'confirm',
          message: chalk.red('Are you sure you want to continue?'),
          initial: false
        });

        if (!confirm) {
          console.log(chalk.blue("Operation cancelled."));
          process.exit(0);
        }

        // Delete resources
        await deleteResources(
          project,
          projectRepo.updateProject.bind(projectRepo),
          (message) => console.log(chalk.blue(message))
        );

        console.log(chalk.green("✅ All resources have been successfully deleted."));
      } catch (error) {
        console.error(chalk.red("❌ Error purging resources:"), error);
        process.exit(1);
      }
    });
} 