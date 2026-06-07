// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getBrowser, getContext, closeBrowser } from "./browser.ts";

describe("browser helper", () => {
  it("should launch a browser", async () => {
    const browser = await getBrowser();
    expect(browser.isConnected()).toBe(true);
    await closeBrowser();
  });

  it("should create isolated contexts", async () => {
    const ctx1 = await getContext();
    const ctx2 = await getContext();

    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    expect(page1).not.toBe(page2);

    await page1.close();
    await page2.close();
    await closeBrowser();
  });

  it("should return the same browser on multiple calls", async () => {
    const b1 = await getBrowser();
    const b2 = await getBrowser();
    expect(b1).toBe(b2);
    await closeBrowser();
  });
});
