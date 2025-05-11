import { Command } from 'commander';
import { registerInitCommand } from './commands/init';
import { registerDeployCommand } from './commands/deploy';
// Import other command registration functions here

export function loadCommands(program: Command): void {
  registerInitCommand(program);
  registerDeployCommand(program);
  // Register other commands here

  // Fallback for unknown commands
  program.on('command:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
    process.exit(1);
  });
} 