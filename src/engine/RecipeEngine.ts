import { IRecipe } from '../interfaces/IRecipe';

export interface RecipeContext {
  provider: any; // Should be a specific provider type, e.g., AWSProvider
  config: any;   // Parsed .spinrc config + CLI flags
  // Add other context information as needed, e.g., logger
}

export class RecipeEngine {
  constructor() {}

  async execute(recipe: IRecipe, context: RecipeContext): Promise<void> {
    console.log(`Executing recipe: ${recipe.name}`);
    try {
      await recipe.execute(context);
      console.log(`Recipe ${recipe.name} executed successfully.`);
    } catch (error) {
      console.error(`Error executing recipe ${recipe.name}:`, error);
      throw error;
    }
  }
} 