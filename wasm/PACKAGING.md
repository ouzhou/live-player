# FFmpeg WASM 打包说明

两步构建：**① 静态库 `*.a`** → **② 胶水 `emcc` 生成 `shell.js` + `shell.wasm`**。工具链版本见 [docs/ffmpeg-wasm-docker-build.md](../docs/ffmpeg-wasm-docker-build.md)。播放器侧架构见 [docs/architecture-demux-decoders.md](../docs/architecture-demux-decoders.md)。

---

## 目录结构（与本流程相关）

```text
wasm/
├── PACKAGING.md                 ← 本文
├── 01-ffmpeg-static/
│   ├── Dockerfile               步骤一：FFmpeg 交叉编译
│   └── build.sh                 步骤一：一键执行（写入 artifacts）
├── 02-emcc-glue/
│   ├── API.md                   与 FlvDemuxer 对齐的 WASM 参数约定
│   ├── build.sh                 步骤二：Docker 内 emcc
│   ├── minimal-shell/
│   │   └── main.cpp             解码器 C API（当前为桩）
│   ├── mock/                    fixtures + harness 烟测
│   └── test.html                最小加载烟测
└── artifacts/                   构建产物（已在仓库根 `.gitignore` 中忽略）
    ├── ffmpeg-static/           步骤一输出：usr/local/lib/*.a、include/
    └── emcc-glue/               步骤二输出：shell.js、shell.wasm
```

---

## 步骤一：打包静态库（`.a`）

在**仓库根目录**执行（或任意目录用绝对路径调用脚本）：

```bash
chmod +x wasm/01-ffmpeg-static/build.sh
./wasm/01-ffmpeg-static/build.sh
```

等价于对 `wasm/artifacts/ffmpeg-static` 做 `docker build -o`；头文件与库在 **`wasm/artifacts/ffmpeg-static/usr/local/`**。

---

## 步骤二：打包胶水与 WASM

依赖步骤一产物存在：

```bash
chmod +x wasm/02-emcc-glue/build.sh
./wasm/02-emcc-glue/build.sh
```

生成 **`wasm/artifacts/emcc-glue/shell.js`** 与 **`shell.wasm`**。

---

## 浏览器验证（可选）

需 HTTP，在**仓库根目录**启动静态服务：

```bash
python3 -m http.server 8765
```

| 页面     | URL                                    | 说明                                            |
| -------- | -------------------------------------- | ----------------------------------------------- |
| 最小加载 | `/wasm/02-emcc-glue/test.html`         | 仅验证 `Module` 初始化                          |
| API 烟测 | `/wasm/02-emcc-glue/mock/harness.html` | 调用 `wasm_get_version` / `wasm_init` / 各 stub |

参数约定与 mock 数据说明见 **[02-emcc-glue/API.md](./02-emcc-glue/API.md)**、**[02-emcc-glue/mock/README.md](./02-emcc-glue/mock/README.md)**。

---

## 环境变量

| 变量          | 默认                     | 用途                                         |
| ------------- | ------------------------ | -------------------------------------------- |
| `EMSDK_IMAGE` | `emscripten/emsdk:5.0.5` | 步骤二 `docker run` 镜像，需与文档钉版本一致 |

---

## 与旧路径对照（若本地仍有残留）

| 旧                                                          | 新                                 |
| ----------------------------------------------------------- | ---------------------------------- |
| `docker/ffmpeg-wasm-h264-aac/Dockerfile`                    | `wasm/01-ffmpeg-static/Dockerfile` |
| `docker/ffmpeg-wasm-h264-aac/out/`                          | `wasm/artifacts/ffmpeg-static/`    |
| `docker/ffmpeg-wasm-h264-aac/scripts/build-minimal-wasm.sh` | `wasm/02-emcc-glue/build.sh`       |
| `wasm/minimal-shell/dist/`                                  | `wasm/artifacts/emcc-glue/`        |

可删除旧目录下的 `out/` 与空壳 `dist/`，避免混淆。
