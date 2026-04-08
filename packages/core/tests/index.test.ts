import { expect, test } from "vite-plus/test";
import { LivePlayer } from "../src/index.ts";

test("LivePlayer is exported", () => {
  expect(LivePlayer).toBeTypeOf("function");
});
