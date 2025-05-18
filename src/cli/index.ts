#!/usr/bin/env node

import { Command, CommanderError } from "commander";
// import { upCommand } from './commands/up.js';
import { initCommand } from "./commands/init.js";
import { checkAWSIdentity } from "./utils/aws.js";
import chalk from "chalk";
import { upCommand } from "./commands/up.js";

const program = new Command();

program
  .name("spin")
  .description("CLI tool for managing Spin accounts and deployments")
  .version("1.0.0")
  .hook("preSubcommand", async (thisCommand, actionCommand) => {
    // Check AWS identity first
    const identity = await checkAWSIdentity();
    console.log(chalk.blue(`Using AWS account: ${identity.account}`));
  })
  .exitOverride((err) => {
    if (err instanceof CommanderError) {
    //   // these are errors like unknown option, missing argument, etc.
      console.error(err.message);
      process.exit(err.exitCode);
    }
    // any other error (including from your action handlers):
    console.error("❌ Unhandled error:\n", (err as Error).stack);
    process.exit(1);
  });

// Register commands
upCommand(program);
initCommand(program);

program.parse();