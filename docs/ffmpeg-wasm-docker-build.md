# Docker 编译 FFmpeg（Emscripten → WASM）：只留 H.264 / AAC 解码

面向：**JS 侧已用 `FlvDemuxer`**，镜像内只编 **裁剪后的静态库 `*.a`**；**胶水 + `emcc`** 见 **[wasm/PACKAGING.md](../wasm/PACKAGING.md)**（两步脚本：`wasm/01-ffmpeg-static/build.sh`、`wasm/02-emcc-glue/build.sh`）。**`Dockerfile` 真源：** `wasm/01-ffmpeg-static/Dockerfile`。

**工具链以下表为唯一来源；升级只改该表与 `wasm/01-ffmpeg-static/Dockerfile` 内对应 `ARG`，并重新跑通 [PACKAGING.md](../wasm/PACKAGING.md) 中的两步构建。**

---

## 钉死的工具链

| 项                  | 值                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------- |
| 基础镜像            | `emscripten/emsdk:5.0.5` · [Hub](https://hub.docker.com/r/emscripten/emsdk)                  |
| 镜像 digest（可选） | `sha256:cc4dcb4ca57cb35858b7fbb606c0ee857051d9f76b452f7fcfc3d8159dae670c`                    |
| 源码                | `https://ffmpeg.org/releases/ffmpeg-8.1.tar.xz` · [发布页](https://ffmpeg.org/download.html) |
| 校验                | `b072aed6871998cce9b36e7774033105ca29e33632be5b6347f3206898e0756a`                           |

---

## 与 FFmpeg 8.1 的核对（文档依据）

以下内容已对照 **FFmpeg 8.1** 解压包内的 `configure` 与 `libavcodec`，**不依赖**任何第三方播放器的裁剪脚本。

- 存在 **`--disable-everything`**、**`--disable-autodetect`**（见 `configure --help`）。
- **`ARCH_LIST` 含 `wasm`**，交叉编译可使用 **`--arch=wasm`**（失败时再试 **`--arch=x86_32`** + `--target-os=none`，属 Emscripten 常见回退）。
- 内置解码器注册名仍为 **`h264`**、**`aac`**（`libavcodec/allcodecs.c` 中 `ff_h264_decoder`、`ff_aac_decoder`）。

静态库构建已在本地 **`docker build`** 跑通；CI 未接。若某组合上报错，以容器内 **`ffbuild/config.log`** 为准增删 `--enable-*`（例如 **`--enable-bsf=h264_mp4toannexb`**）。

---

## 为何用 Docker

用官方 [emsdk 镜像](https://emscripten.org/docs/getting_started/downloads.html#docker) 统一工具链；构建走 [BuildKit](https://docs.docker.com/build/buildkit/) 即可。

---

## 裁剪思路

`configure`：**`--disable-everything`**，再打开 `avutil`、`avcodec`、**`h264` / `aac`** 的 decoder 与 parser、**`swscale`** / **`swresample`**（不需要重采样时可关 `swresample`）。多线程 / SIMD 另议。

---

## `configure` 模板

以下为 **Emscripten** 下常见的 **`CC`/`AR`/`NM` 等** 赋值，加上与上文一致的裁剪开关；具体含义以 **`./configure --help`** 为准。

```bash
export CFLAGS="${CFLAGS:--O3}"
export CXXFLAGS="${CXXFLAGS:--O3}"

emconfigure ./configure \
  --target-os=none \
  --arch=wasm \
  --cpu=generic \
  --enable-cross-compile \
  --disable-asm \
  --disable-x86asm \
  --disable-inline-asm \
  --disable-programs \
  --disable-doc \
  --disable-debug \
  --disable-stripping \
  --disable-runtime-cpudetect \
  --disable-autodetect \
  --nm=emnm \
  --ar=emar \
  --ranlib=emranlib \
  --cc=emcc \
  --cxx=em++ \
  --objcc=emcc \
  --dep-cc=emcc \
  --extra-cflags="$CFLAGS" \
  --extra-cxxflags="$CXXFLAGS" \
  --disable-everything \
  --enable-avutil \
  --enable-avcodec \
  --enable-static \
  --disable-shared \
  --enable-decoder=h264 \
  --enable-decoder=aac \
  --enable-parser=h264 \
  --enable-parser=aac \
  --enable-swscale \
  --enable-swresample
```

---

## `Dockerfile` 与构建命令

完整 **`Dockerfile`** 与两步 **`build.sh`** 已放入仓库，避免与本文重复粘贴：

- **[wasm/PACKAGING.md](../wasm/PACKAGING.md)** — 目录树、步骤一/二命令、浏览器验证。
- **`wasm/01-ffmpeg-static/Dockerfile`** — `make install DESTDIR=/install` 后导出静态库；可选 `FROM emscripten/emsdk@sha256:cc4dcb4ca57cb35858b7fbb606c0ee857051d9f76b452f7fcfc3d8159dae670c` 钉 digest。

**说明：** 当前 FFmpeg `configure` 仍会生成 **libavformat / libavfilter / libavdevice** 等库（依赖闭合所致）；若需进一步缩小体积，可在通过构建后逐组 `--disable-*` 或收紧 enable 列表再试。

产物目录：**`wasm/artifacts/ffmpeg-static/`**（静态库）、**`wasm/artifacts/emcc-glue/`**（`shell.js` / `shell.wasm`），已 gitignore。

---

## 相关文档

- [architecture-demux-decoders.md](./architecture-demux-decoders.md)（解封装与 WebCodecs / WASM 双路径）
- [http-flv-ffmpeg-wasm-pipeline.md](./http-flv-ffmpeg-wasm-pipeline.md)
- [web-playback-mse-wasm-webcodecs.md](./web-playback-mse-wasm-webcodecs.md)

---

## 许可

内置 **H.264 / AAC** 解码多为 **LGPL**；若引入 **GPL / non-free** 三方库需另评估。

---

## 修订

| 日期       | 说明                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-09 | 初稿与工具链表。                                                                                                                 |
| 2026-04-09 | 精简：版本仅保留在表 + Dockerfile `ARG`。                                                                                        |
| 2026-04-09 | 按 FFmpeg 8.1 官方 `configure`/源码核对说明；移除第三方播放器裁剪引用。                                                          |
| 2026-04-09 | 实跑 `docker build` 通过；产物输出路径与 `.gitignore` 对齐；补充仍带 libavformat 等库的说明。                                    |
| 2026-04-09 | 增加空壳 `main` 与 Docker 内 `emcc` 脚本（后迁至 `wasm/02-emcc-glue`）。                                                         |
| 2026-04-09 | 目录收敛到 `wasm/01-ffmpeg-static`、`wasm/02-emcc-glue`、`wasm/artifacts/`，打包说明 [wasm/PACKAGING.md](../wasm/PACKAGING.md)。 |
