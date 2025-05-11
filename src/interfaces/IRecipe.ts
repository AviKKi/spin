import { RecipeContext } from '../engine/RecipeEngine';

export interface IRecipe {
  name: string;
  description: string;
  execute(context: RecipeContext): Promise<void>;
  // Potentially add methods for pre-flight checks, cleanup, etc.
} 