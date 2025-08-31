import { describe, it, expect } from "vitest";
import { mbtiToTraits } from "@/lib/mbtiToTraits";

describe("mbtiToTraits", () => {
  it("MBTI 키를 모두 포함한다", () => {
    const v = mbtiToTraits("INTP");
    expect(Object.keys(v).sort()).toEqual(
      ["social", "novelty", "structure", "flexibility", "sensory", "culture"].sort()
    );
  });

  it("값은 0~1 범위", () => {
    const v = mbtiToTraits("ENFJ");
    Object.values(v).forEach((x) => expect(x).toBeGreaterThanOrEqual(0));
    Object.values(v).forEach((x) => expect(x).toBeLessThanOrEqual(1));
  });
});