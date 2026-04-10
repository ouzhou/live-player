# syntax=docker/dockerfile:1

ARG EMSDK_IMAGE_TAG=5.0.5
FROM emscripten/emsdk:${EMSDK_IMAGE_TAG} AS build

ARG FFMPEG_VERSION=8.1
ARG FFMPEG_SHA256=b072aed6871998cce9b36e7774033105ca29e33632be5b6347f3206898e0756a

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN curl -fsSL "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz" -o ffmpeg.tar.xz \
    && echo "${FFMPEG_SHA256}  ffmpeg.tar.xz" | sha256sum -c - \
    && tar -xf ffmpeg.tar.xz \
    && mv "ffmpeg-${FFMPEG_VERSION}" ffmpeg

WORKDIR /src/ffmpeg

ENV CFLAGS="-O3"
ENV CXXFLAGS="-O3"

RUN emconfigure ./configure \
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
      --enable-decoder=hevc \
      --enable-decoder=aac \
      --enable-parser=h264 \
      --enable-parser=hevc \
      --enable-parser=aac \
      --enable-swscale \
      --enable-swresample \
    || (cat ffbuild/config.log && false)

RUN emmake make -j"$(nproc)"
RUN emmake make install DESTDIR=/install

FROM scratch AS artifacts
COPY --from=build /install /
