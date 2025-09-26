export type OrchestratorState =
  | "INIT"
  | "RUNNING"
  | "ASKING_QUESTION"
  | "AWAITING_INPUT"
  | "ANSWERING"
  | "COMPLETED"
  | "ERROR"
  | "ABORTED";

export class Orchestrator {
  private state: OrchestratorState = "INIT";

  public getState(): OrchestratorState {
    return this.state;
  }

  public start(): void {
    this.state = "RUNNING";
  }
}
