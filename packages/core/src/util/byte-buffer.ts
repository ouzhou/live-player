/** 可增长字节缓冲：追加后顺序消费，消费后前移剩余数据。 */
export class GrowableBuffer {
  private buf: Uint8Array;
  private len = 0;

  constructor(initialCapacity = 64 * 1024) {
    this.buf = new Uint8Array(initialCapacity);
  }

  get used(): number {
    return this.len;
  }

  /** 当前有效数据的只读视图（长度 `used`）。 */
  view(): Uint8Array {
    return this.buf.subarray(0, this.len);
  }

  append(chunk: Uint8Array): void {
    const need = this.len + chunk.length;
    if (need > this.buf.length) {
      let next = this.buf.length;
      while (next < need) next *= 2;
      const nextBuf = new Uint8Array(next);
      nextBuf.set(this.buf.subarray(0, this.len));
      this.buf = nextBuf;
    }
    this.buf.set(chunk, this.len);
    this.len += chunk.length;
  }

  /** 丢弃前 `n` 字节；将剩余数据移到偏移 0。 */
  consume(n: number): void {
    if (n < 0 || n > this.len) {
      throw new RangeError("consume out of range");
    }
    if (n === 0) return;
    if (n === this.len) {
      this.len = 0;
      return;
    }
    this.buf.copyWithin(0, n, this.len);
    this.len -= n;
  }
}
