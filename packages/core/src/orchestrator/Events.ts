export type OrchestratorEvent =
  | { type: "running" }
  | { type: "awaitingInput"; text?: string }
  | { type: "question"; text?: string }
  | { type: "completed" };
