// api/test/zkConfigPath.test.ts
// Checks that the ZK config path points at the compiler's output. Split out
// of contract.test.ts so it runs on a machine without the compiled circuit:
// this module reaches node:url and nothing else.

import { describe, expect, it } from "vitest";
import { zkConfigPath } from "../src/zkConfigPath.js";

describe("zkConfigPath", () => {
  it("points at the compiler's output directory for the backing circuit", () => {
    expect(zkConfigPath().replace(/\\/g, "/")).toMatch(/contract\/src\/managed\/backing$/);
  });
});
