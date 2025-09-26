export type PlanStep = {
  name: string;
  run?: string[];
  cursor?: string[];
};

export type Plan = {
  name: string;
  steps: PlanStep[];
};
