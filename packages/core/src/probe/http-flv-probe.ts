import { FlvDemuxer } from "../demux/flv-demux.ts";
import { GrowableBuffer } from "../util/byte-buffer.ts";

/** 从 HTTP-FLV 流头部解析出的轨信息（用于探测，不启动解码器）。 */
export type FlvStreamProbeResult = {
  ok: boolean;
  video?: { codec: string; description: Uint8Array };
  audio?: { codec: string; description: Uint8Array };
  /** 从响应体读取的字节数 */
  bytesRead: number;
  /** HTTP 或解封装错误 */
  error?: string;
  /** 达到 `maxBytes` 上限，或流结束时尚未同时拿到音视频配置 */
  truncated?: boolean;
};

const DEFAULT_MAX_BYTES = 512 * 1024;

/**
 * 拉取 URL 的前若干字节，解析 FLV 直至拿到音视频 `config` / `audio_config`，或出错 / 达到上限。
 * 需与播放相同跨域（CORS）条件。
 */
export async function probeHttpFlv(
  url: string,
  options?: { signal?: AbortSignal; maxBytes?: number },
): Promise<FlvStreamProbeResult> {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const signal = options?.signal;

  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, bytesRead: 0, error: `请求失败: ${msg}` };
  }

  if (!res.ok) {
    return {
      ok: false,
      bytesRead: 0,
      error: `HTTP ${res.status} ${res.statusText || ""}`.trim(),
    };
  }

  const body = res.body;
  if (!body) {
    return { ok: false, bytesRead: 0, error: "响应无 body" };
  }

  const buffer = new GrowableBuffer();
  const demux = new FlvDemuxer();
  let video: FlvStreamProbeResult["video"];
  let audio: FlvStreamProbeResult["audio"];
  let bytesRead = 0;
  let truncated = false;

  const reader = body.getReader();

  try {
    while (video === undefined || audio === undefined) {
      if (signal?.aborted) {
        return {
          ok: false,
          bytesRead,
          error: "已取消",
          video,
          audio,
          truncated: true,
        };
      }

      const { done, value } = await reader.read();
      if (done) {
        truncated = video === undefined || audio === undefined;
        break;
      }
      if (value && value.byteLength > 0) {
        bytesRead += value.byteLength;
        buffer.append(value);
        if (buffer.used > maxBytes) {
          truncated = true;
          break;
        }
      }

      for (;;) {
        const { events, consumed } = demux.parse(buffer.view());
        if (consumed === 0) {
          break;
        }
        buffer.consume(consumed);
        for (const ev of events) {
          if (ev.kind === "error") {
            return {
              ok: false,
              bytesRead,
              error: ev.message,
              video,
              audio,
            };
          }
          if (ev.kind === "config" && video === undefined) {
            video = {
              codec: ev.codec,
              description: new Uint8Array(ev.description),
            };
          } else if (ev.kind === "audio_config" && audio === undefined) {
            audio = {
              codec: ev.codec,
              description: new Uint8Array(ev.description),
            };
          }
        }
      }

      if (video !== undefined && audio !== undefined) {
        break;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }

  if (video !== undefined && audio !== undefined) {
    return { ok: true, video, audio, bytesRead, truncated: false };
  }

  let error: string | undefined;
  if (truncated) {
    error =
      bytesRead >= maxBytes
        ? `已读取 ${bytesRead} 字节（达到上限 ${maxBytes}），仍未解析到完整音视频配置`
        : "流已结束，但未解析到完整音视频配置";
  }

  return {
    ok: false,
    video,
    audio,
    bytesRead,
    truncated: true,
    error,
  };
}
