/**
 * 将 `AudioData` 调度到 `AudioContext`；在成功或失败路径上 **`AudioData.close()`**。
 */
export class AudioPlayback {
  private readonly ctx: AudioContext;
  private readonly gain: GainNode;
  private nextPlayTime = 0;

  constructor() {
    this.ctx = new AudioContext();
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
  }

  async ensureRunning(): Promise<void> {
    await this.ctx.resume();
    if (this.ctx.state !== "running") {
      throw new Error(`AudioContext could not start (state: ${this.ctx.state})`);
    }
  }

  schedule(audioData: AudioData): void {
    try {
      const frames = audioData.numberOfFrames;
      const channels = audioData.numberOfChannels;
      const rate = audioData.sampleRate;
      const buf = this.ctx.createBuffer(channels, frames, rate);
      for (let ch = 0; ch < channels; ch++) {
        const plane = new Float32Array(frames);
        audioData.copyTo(plane, { planeIndex: ch, format: "f32-planar" });
        buf.copyToChannel(plane, ch);
      }

      if (this.nextPlayTime - this.ctx.currentTime > 2) {
        this.nextPlayTime = this.ctx.currentTime;
      }
      const t = Math.max(this.nextPlayTime, this.ctx.currentTime);

      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.gain);
      src.start(t);
      this.nextPlayTime = t + buf.duration;
    } finally {
      audioData.close();
    }
  }

  close(): void {
    try {
      this.gain.disconnect();
    } catch {
      /* ignore */
    }
    try {
      void this.ctx.close();
    } catch {
      /* ignore */
    }
  }
}
