// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getPageInventory, PageCategory } from "./page-inventory.ts";

describe("page-inventory", () => {
  it("should discover all volume pages", () => {
    const inventory = getPageInventory();
    const volumes = inventory.filter((p) => p.category === "volume");

    expect(volumes.length).toBe(24);
    expect(volumes.some((p) => p.id === "volume-01")).toBe(true);
    expect(volumes.some((p) => p.id === "volume-24")).toBe(true);
  });

  it("should discover supplement pages", () => {
    const inventory = getPageInventory();
    const supplements = inventory.filter((p) => p.category === "supplement");

    expect(supplements.length).toBeGreaterThan(0);
    expect(supplements.some((p) => p.id === "supplement-lin")).toBe(true);
  });

  it("should discover meta pages", () => {
    const inventory = getPageInventory();
    const meta = inventory.filter((p) => p.category === "meta");

    expect(meta.some((p) => p.id === "notice")).toBe(true);
    expect(meta.some((p) => p.id === "about")).toBe(true);
    expect(meta.some((p) => p.id === "archives")).toBe(true);
  });

  it("should construct correct URL for each page", () => {
    const inventory = getPageInventory();

    for (const page of inventory) {
      expect(page.url).toMatch(/^\/pages\/[a-z0-9-]+$/);
    }
  });

  it("should include variant pages", () => {
    const inventory = getPageInventory();
    const variants = inventory.filter((p) => p.category === "variant");

    expect(variants.length).toBeGreaterThan(0);
    expect(variants.some((p) => p.id === "volume-04-awakened")).toBe(true);
  });
});
