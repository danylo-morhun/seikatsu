// No zod here: AppHeader loads on every page and imports this.
/** Filter params carry between All and Stats; the view, sort and page stay on All. */
export const CARRY_PARAMS = ["source", "method", "from", "to", "q"] as const;
