import { describe, expect, it } from "vitest";
import { baseSystemPrompt } from "./systemPrompt.js";
import { renderUserPrompt } from "./userPrompt.js";

describe("prompts", () => {
  it("renders base system prompt with rules", () => {
    const system = baseSystemPrompt();
    expect(system).toMatch(/Reply only/);
  });

  it("includes governing prompt and recent output", () => {
    const user = renderUserPrompt({
      governingPrompt: "Role: Senior TS engineer.",
      recentOutput: "Choose an option (1-3):",
    });
    expect(user).toMatch(/Governing Prompt/);
    expect(user).toMatch(/Recent Output/);
  });
});
