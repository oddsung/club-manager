import { describe, expect, it } from "vitest";
import { APP_NAME } from "../src/index";

describe("smoke", () => {
  it("모듈을 불러올 수 있다", () => {
    expect(APP_NAME).toBe("club-manager");
  });
});
