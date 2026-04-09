/**
 * I420（YUV420P）三平面 → WebGL2 RGB，与 wasm/02-emcc-glue 浏览器烟测 shader 一致。
 */
export class I420WebGLRenderer {
  private readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private locY: WebGLUniformLocation | null = null;
  private locU: WebGLUniformLocation | null = null;
  private locV: WebGLUniformLocation | null = null;
  private texY: WebGLTexture | null = null;
  private texU: WebGLTexture | null = null;
  private texV: WebGLTexture | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  private ensureGL(): WebGL2RenderingContext {
    if (this.gl) {
      return this.gl;
    }
    const gl = this.canvas.getContext("webgl2", { alpha: false, antialias: false });
    if (!gl) {
      throw new Error("WebGL2 is not available (required for WASM video path)");
    }
    this.gl = gl;

    const vs = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;
    const fs = `#version 300 es
precision highp float;
uniform sampler2D u_y;
uniform sampler2D u_u;
uniform sampler2D u_v;
in vec2 v_uv;
out vec4 o_color;
void main() {
  vec2 st = vec2(v_uv.x, 1.0 - v_uv.y);
  float Y = texture(u_y, st).r;
  float U = texture(u_u, st).r - 0.5;
  float V = texture(u_v, st).r - 0.5;
  float r = Y + 1.402 * V;
  float g = Y - 0.344136 * U - 0.714136 * V;
  float b = Y + 1.772 * U;
  o_color = vec4(clamp(vec3(r, g, b), 0.0, 1.0), 1.0);
}`;

    const compile = (type: number, src: string): WebGLShader => {
      const sh = gl.createShader(type);
      if (!sh) {
        throw new Error("createShader");
      }
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || "shader compile");
      }
      return sh;
    };

    const prog = gl.createProgram();
    if (!prog) {
      throw new Error("createProgram");
    }
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "link");
    }
    this.program = prog;
    this.locY = gl.getUniformLocation(prog, "u_y");
    this.locU = gl.getUniformLocation(prog, "u_u");
    this.locV = gl.getUniformLocation(prog, "u_v");

    this.texY = gl.createTexture();
    this.texU = gl.createTexture();
    this.texV = gl.createTexture();

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const locPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

    return gl;
  }

  /** 上传三平面并绘制；会设置 canvas 像素尺寸为 w×h。 */
  drawI420(w: number, h: number, yPlane: Uint8Array, uPlane: Uint8Array, vPlane: Uint8Array): void {
    const gl = this.ensureGL();
    const cw = (w / 2) | 0;
    const ch = (h / 2) | 0;

    this.canvas.width = w;
    this.canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.program);

    const uploadR8 = (
      tex: WebGLTexture | null,
      width: number,
      height: number,
      data: Uint8Array,
    ) => {
      if (!tex) {
        return;
      }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    };

    gl.activeTexture(gl.TEXTURE0);
    uploadR8(this.texY, w, h, yPlane);
    gl.uniform1i(this.locY, 0);
    gl.activeTexture(gl.TEXTURE1);
    uploadR8(this.texU, cw, ch, uPlane);
    gl.uniform1i(this.locU, 1);
    gl.activeTexture(gl.TEXTURE2);
    uploadR8(this.texV, cw, ch, vPlane);
    gl.uniform1i(this.locV, 2);

    gl.clearColor(0.05, 0.05, 0.05, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) {
      return;
    }
    if (this.texY) {
      gl.deleteTexture(this.texY);
    }
    if (this.texU) {
      gl.deleteTexture(this.texU);
    }
    if (this.texV) {
      gl.deleteTexture(this.texV);
    }
    if (this.program) {
      gl.deleteProgram(this.program);
    }
    this.texY = this.texU = this.texV = null;
    this.program = null;
    this.gl = null;
  }
}
