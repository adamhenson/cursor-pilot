#!/usr/bin/env node
import { Orchestrator } from "@cursor-pilot/core";

function main(): void {
  const orchestrator = new Orchestrator();
  orchestrator.start();
  // Placeholder: later parse args and wire flags
  // eslint-disable-next-line no-console
  console.log("CursorPilot CLI started. State:", orchestrator.getState());
}

main();
