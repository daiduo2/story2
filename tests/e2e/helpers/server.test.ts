// @vitest-environment node
import { describe, it, expect } from "vitest";
import { SERVER_PORT } from "./server.ts";

describe("server helper", () => {
  it("should expose the configured port", () => {
    expect(typeof SERVER_PORT).toBe("number");
    expect(SERVER_PORT).toBe(3724);
  });
});
