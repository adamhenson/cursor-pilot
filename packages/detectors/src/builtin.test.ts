import { describe, expect, it } from "vitest";
import { defaultDetectorPatterns } from "./builtin.js";

describe("defaultDetectorPatterns", () => {
  it("matches yes/no confirmation", () => {
    const text = "Confirm yes/no:";
    const matched = defaultDetectorPatterns.question.some((re) => re.test(text));
    expect(matched).toBe(true);
  });

  it("matches completion lines", () => {
    const text = "✅ Scaffold complete";
    const matched = defaultDetectorPatterns.completion.some((re) => re.test(text));
    expect(matched).toBe(true);
  });
});
