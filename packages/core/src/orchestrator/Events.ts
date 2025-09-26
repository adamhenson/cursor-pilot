/** Events that the orchestrator can emit while processing output. */
export type OrchestratorEvent =
  | { type: 'running' }
  | { type: 'awaitingInput'; text?: string }
  | { type: 'question'; text?: string }
  | { type: 'completed' };
