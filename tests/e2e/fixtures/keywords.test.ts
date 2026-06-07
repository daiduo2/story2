// @vitest-environment node
import { describe, it, expect } from "vitest";
import { PUBLIC_KEYWORDS, HIDDEN_KEYWORDS, getExpectedRoute } from "./keywords.ts";

describe("keywords", () => {
  it("should have at least the public keywords defined in PRD", () => {
    const publicKeys = Object.keys(PUBLIC_KEYWORDS);

    expect(publicKeys).toContain("入院");
    expect(publicKeys).toContain("内科");
    expect(publicKeys).toContain("精神科");
    expect(publicKeys).toContain("护理");
    expect(publicKeys).toContain("药房");
    expect(publicKeys).toContain("临终");
    expect(publicKeys).toContain("林素琴");
    expect(publicKeys).toContain("监控");
    expect(publicKeys).toContain("停电");
  });

  it("should have at least the hidden keywords defined in PRD", () => {
    const hiddenKeys = Object.keys(HIDDEN_KEYWORDS);

    expect(hiddenKeys).toContain("4楼");
    expect(hiddenKeys).toContain("404");
    expect(hiddenKeys).toContain("体温");
    expect(hiddenKeys).toContain("多出来");
    expect(hiddenKeys).toContain("2:47");
    expect(hiddenKeys).toContain("集体癔症");
    expect(hiddenKeys).toContain("不像自己");
    expect(hiddenKeys).toContain("第七本");
    expect(hiddenKeys).toContain("给药");
    expect(hiddenKeys).toContain("零");
    expect(hiddenKeys).toContain("规则");
    expect(hiddenKeys).toContain("不对劲");
    expect(hiddenKeys).toContain("镜子");
    expect(hiddenKeys).toContain("融合");
    expect(hiddenKeys).toContain("理解");
    expect(hiddenKeys).toContain("真相");
  });

  it("should resolve public keywords to fixed pages", () => {
    expect(getExpectedRoute("入院", [])).toBe("volume-01");
    expect(getExpectedRoute("精神科", [])).toBe("volume-04");
    expect(getExpectedRoute("林素琴", [])).toBe("supplement-lin");
  });

  it("should require prior visits for hidden keywords", () => {
    expect(getExpectedRoute("4楼", [])).toBeNull();
    expect(getExpectedRoute("4楼", ["volume-04"])).toBe("volume-04");
    expect(getExpectedRoute("4楼", ["volume-08"])).toBe("volume-04"); // first candidate
  });

  it("should not contain overlap between public and hidden", () => {
    const publicKeys = new Set(Object.keys(PUBLIC_KEYWORDS));
    const hiddenKeys = Object.keys(HIDDEN_KEYWORDS);
    const overlap = hiddenKeys.filter((k) => publicKeys.has(k));

    expect(overlap).toEqual([]);
  });
});
