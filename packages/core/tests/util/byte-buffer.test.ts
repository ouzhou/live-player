import { expect, test } from "vite-plus/test";
import { GrowableBuffer } from "../../src/util/byte-buffer.ts";

test("GrowableBuffer append then consume compacts", () => {
  const b = new GrowableBuffer(4);
  b.append(new Uint8Array([1, 2]));
  b.append(new Uint8Array([3, 4, 5]));
  expect(b.used).toBe(5);
  b.consume(2);
  expect(b.used).toBe(3);
  expect(Array.from(b.view().subarray(0, 3))).toEqual([3, 4, 5]);
});
