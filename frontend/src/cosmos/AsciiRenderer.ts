import type { CameraState } from './CameraController';
import type { SceneDefinition, SceneId } from './scenes';
import { COMPOSITE_FRAG, FULLSCREEN_VERT } from './shaders/composite';

/**
 * WebGL2 ASCII renderer.
 *
 * Each scene is a fragment shader evaluated once per character cell, into two
 * low-resolution grids (far = small glyphs, near = large glyphs). A composite
 * pass then draws the actual characters from a glyph atlas. Nothing on screen
 * is an image: every lit pixel belongs to a glyph, plus a faint bloom behind.
 *
 * Performance: scene shaders and framebuffers are compiled/allocated lazily on
 * first use rather than all upfront, avoiding multi-second startup stalls.
 */

/**
 * Atlas order. Indices 0-13 are the luminance ramp, sparse to dense;
 * 14-18 are stroke glyphs addressed directly by the shaders.
 */
export const GLYPHS: readonly string[] = [
  ' ', '.', ':', ';', '~', '+', '*', 'o', 'O', '0', '&', '%', '#', '@', '-', '=', '/', '\\', '|',
];

const FONT_STACK = 'ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';

/** Character cell sizes in CSS px. Far glyphs are smaller: size encodes depth. */
const NEAR_CELL: readonly [number, number] = [8, 14];
const FAR_CELL: readonly [number, number] = [6, 11];

export interface FrameParams {
  time: number;
  camera: CameraState;
  from: SceneId;
  to: SceneId;
  /** 0 = only "from" is shown, 1 = fully "to". */
  mix: number;
}

interface Program {
  handle: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
}

interface LayerTarget {
  fbo: WebGLFramebuffer;
  color: WebGLTexture;
  glyph: WebGLTexture;
  cols: number;
  rows: number;
}

interface SceneGpu {
  definition: SceneDefinition;
  program: Program;
  far: LayerTarget | null;
  near: LayerTarget | null;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export class AsciiRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly definitionsById = new Map<SceneId, SceneDefinition>();
  private scenes = new Map<SceneId, SceneGpu>();
  private composite: Program | null = null;
  private atlasNear: WebGLTexture | null = null;
  private atlasFar: WebGLTexture | null = null;
  private cellNear: [number, number] = [0, 0];
  private cellFar: [number, number] = [0, 0];
  private width = 0;
  private height = 0;
  private lost = false;

  constructor(canvas: HTMLCanvasElement, definitions: readonly SceneDefinition[]) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available');
    this.canvas = canvas;
    this.gl = gl;
    for (const def of definitions) {
      this.definitionsById.set(def.id, def);
    }
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.build();
  }

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.lost = true;
  };

  private onContextRestored = (): void => {
    const { width, height, cellNear, cellFar } = this;
    this.build();
    this.lost = false;
    if (width > 0 && height > 0) {
      this.allocate(width, height, cellNear, cellFar);
    }
  };

  /** Compile composite program at startup; individual scenes compile lazily on demand. */
  private build(): void {
    this.scenes = new Map();
    this.atlasNear = null;
    this.atlasFar = null;
    this.width = 0;
    this.height = 0;
    this.composite = this.link(COMPOSITE_FRAG, 'composite');
  }

  /** Lazily compile a scene shader and allocate its render layers when first needed. */
  private ensureScene(id: SceneId): SceneGpu | null {
    let scene = this.scenes.get(id);
    if (!scene) {
      const definition = this.definitionsById.get(id);
      if (!definition) return null;
      scene = {
        definition,
        program: this.link(definition.fragment, definition.id),
        far: null,
        near: null,
      };
      this.scenes.set(id, scene);
    }
    if (this.width > 0 && this.height > 0 && this.cellFar[0] > 0 && this.cellNear[0] > 0) {
      if (!scene.far) {
        scene.far = this.makeLayer(
          Math.ceil(this.width / this.cellFar[0]),
          Math.ceil(this.height / this.cellFar[1]),
        );
      }
      if (!scene.near) {
        scene.near = this.makeLayer(
          Math.ceil(this.width / this.cellNear[0]),
          Math.ceil(this.height / this.cellNear[1]),
        );
      }
    }
    return scene;
  }

  private compile(type: number, source: string, label: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error(`Could not create shader (${label})`);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) ?? 'unknown error';
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed (${label}): ${log}`);
    }
    return shader;
  }

  private link(fragment: string, label: string): Program {
    const gl = this.gl;
    const vs = this.compile(gl.VERTEX_SHADER, FULLSCREEN_VERT, `${label} vertex`);
    const fs = this.compile(gl.FRAGMENT_SHADER, fragment, `${label} fragment`);
    const handle = gl.createProgram();
    if (!handle) throw new Error(`Could not create program (${label})`);
    gl.attachShader(handle, vs);
    gl.attachShader(handle, fs);
    gl.linkProgram(handle);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(handle) ?? 'unknown error';
      gl.deleteProgram(handle);
      throw new Error(`Program link failed (${label}): ${log}`);
    }
    return { handle, locations: new Map() };
  }

  private loc(program: Program, name: string): WebGLUniformLocation | null {
    let location = program.locations.get(name);
    if (location === undefined) {
      location = this.gl.getUniformLocation(program.handle, name);
      program.locations.set(name, location);
    }
    return location;
  }

  /** Rasterise every glyph once, at exactly one device pixel per texel. */
  private buildAtlas(cellW: number, cellH: number): WebGLTexture {
    const gl = this.gl;
    const sheet = document.createElement('canvas');
    sheet.width = cellW * GLYPHS.length;
    sheet.height = cellH;
    const ctx = sheet.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available for the glyph atlas');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${Math.min(cellW / 0.6, cellH * 0.92)}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    GLYPHS.forEach((glyph, i) => {
      if (glyph === ' ') return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(i * cellW, 0, cellW, cellH);
      ctx.clip();
      ctx.fillText(glyph, i * cellW + cellW / 2, cellH * 0.52);
      ctx.restore();
    });

    const texture = gl.createTexture();
    if (!texture) throw new Error('Could not create atlas texture');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  private makeTexture(cols: number, rows: number, filter: number): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error('Could not create render texture');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  private makeLayer(cols: number, rows: number): LayerTarget {
    const gl = this.gl;
    // Colour is filtered (it doubles as the bloom source); glyph ids are not.
    const color = this.makeTexture(cols, rows, gl.LINEAR);
    const glyph = this.makeTexture(cols, rows, gl.NEAREST);
    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error('Could not create framebuffer');
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, glyph, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Cell framebuffer is incomplete');
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, color, glyph, cols, rows };
  }

  private freeLayer(layer: LayerTarget | null): void {
    if (!layer) return;
    const gl = this.gl;
    gl.deleteFramebuffer(layer.fbo);
    gl.deleteTexture(layer.color);
    gl.deleteTexture(layer.glyph);
  }

  private allocate(width: number, height: number, cellNear: [number, number], cellFar: [number, number]): void {
    const gl = this.gl;
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;

    const cellsChanged =
      cellNear[0] !== this.cellNear[0] || cellNear[1] !== this.cellNear[1] ||
      cellFar[0] !== this.cellFar[0] || cellFar[1] !== this.cellFar[1];
    if (cellsChanged || !this.atlasNear || !this.atlasFar) {
      if (this.atlasNear) gl.deleteTexture(this.atlasNear);
      if (this.atlasFar) gl.deleteTexture(this.atlasFar);
      this.cellNear = cellNear;
      this.cellFar = cellFar;
      this.atlasNear = this.buildAtlas(cellNear[0], cellNear[1]);
      this.atlasFar = this.buildAtlas(cellFar[0], cellFar[1]);
    }

    // Re-allocate framebuffers only for scenes already compiled; uncompiled scenes allocate on first use.
    for (const scene of this.scenes.values()) {
      this.freeLayer(scene.far);
      this.freeLayer(scene.near);
      scene.far = this.makeLayer(Math.ceil(width / cellFar[0]), Math.ceil(height / cellFar[1]));
      scene.near = this.makeLayer(Math.ceil(width / cellNear[0]), Math.ceil(height / cellNear[1]));
    }
  }

  /** Compile and allocate a single scene ahead of time (e.g., during browser idle). */
  warmup(id: SceneId): void {
    if (this.lost || this.width === 0) return;
    this.ensureScene(id);
  }

  /**
   * Match the canvas to its CSS box. `quality` > 1 enlarges the cells, which
   * cuts the amount of shading work on slow machines.
   */
  resize(cssWidth: number, cssHeight: number, dpr: number, quality = 1): void {
    if (this.lost) return;
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));
    const scale = dpr * quality;
    const cellNear: [number, number] = [
      Math.max(4, Math.round(NEAR_CELL[0] * scale)),
      Math.max(7, Math.round(NEAR_CELL[1] * scale)),
    ];
    const cellFar: [number, number] = [
      Math.max(3, Math.round(FAR_CELL[0] * scale)),
      Math.max(6, Math.round(FAR_CELL[1] * scale)),
    ];
    const unchanged =
      width === this.width && height === this.height &&
      cellNear[0] === this.cellNear[0] && cellNear[1] === this.cellNear[1] &&
      cellFar[0] === this.cellFar[0] && cellFar[1] === this.cellFar[1];
    if (unchanged) return;
    this.allocate(width, height, cellNear, cellFar);
  }

  private drawLayer(scene: SceneGpu, layer: LayerTarget, layerIndex: number, cell: [number, number], frame: FrameParams): void {
    const gl = this.gl;
    const program = scene.program;
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.fbo);
    gl.viewport(0, 0, layer.cols, layer.rows);
    gl.useProgram(program.handle);
    gl.uniform1f(this.loc(program, 'uTime'), frame.time);
    gl.uniform3f(this.loc(program, 'uCam'), frame.camera.x, frame.camera.y, frame.camera.z);
    gl.uniform1f(this.loc(program, 'uZoom'), frame.camera.zoom);
    gl.uniform2f(this.loc(program, 'uGrid'), layer.cols, layer.rows);
    gl.uniform2f(this.loc(program, 'uCellPx'), cell[0], cell[1]);
    gl.uniform2f(this.loc(program, 'uResPx'), this.width, this.height);
    gl.uniform1i(this.loc(program, 'uLayer'), layerIndex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private drawScene(scene: SceneGpu, frame: FrameParams): void {
    if (!scene.far || !scene.near) return;
    this.drawLayer(scene, scene.far, 0, this.cellFar, frame);
    this.drawLayer(scene, scene.near, 1, this.cellNear, frame);
  }

  private bindTexture(unit: number, texture: WebGLTexture | null, program: Program, name: string): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.loc(program, name), unit);
  }

  render(frame: FrameParams): void {
    const program = this.composite;
    if (this.lost || this.width === 0 || !program) return;

    const from = this.ensureScene(frame.from);
    if (!from || !from.far || !from.near) return;

    const blending = frame.mix > 0 && frame.from !== frame.to;
    const to = blending ? this.ensureScene(frame.to) : from;
    if (!to || !to.far || !to.near) return;

    const gl = this.gl;
    this.drawScene(from, frame);
    if (blending) this.drawScene(to, frame);
    const second = blending ? to : from;
    if (!second.far || !second.near) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(program.handle);
    gl.uniform2f(this.loc(program, 'uResPx'), this.width, this.height);
    gl.uniform2f(this.loc(program, 'uCellN'), this.cellNear[0], this.cellNear[1]);
    gl.uniform2f(this.loc(program, 'uCellF'), this.cellFar[0], this.cellFar[1]);
    gl.uniform2f(this.loc(program, 'uGridN'), from.near.cols, from.near.rows);
    gl.uniform2f(this.loc(program, 'uGridF'), from.far.cols, from.far.rows);
    gl.uniform1f(this.loc(program, 'uGlyphs'), GLYPHS.length);
    gl.uniform1f(this.loc(program, 'uMix'), blending ? Math.min(1, frame.mix) : 0);
    gl.uniform1f(this.loc(program, 'uTime'), frame.time);

    const fx0 = from.definition.fx;
    const fx1 = second.definition.fx;
    gl.uniform4f(this.loc(program, 'uFx0'), fx0.glow, fx0.grain, fx0.vignette, fx0.gain);
    gl.uniform4f(this.loc(program, 'uFx1'), fx1.glow, fx1.grain, fx1.vignette, fx1.gain);
    gl.uniform3fv(this.loc(program, 'uBg0'), hexToRgb(from.definition.background));
    gl.uniform3fv(this.loc(program, 'uBg1'), hexToRgb(second.definition.background));

    this.bindTexture(0, this.atlasNear, program, 'uAtlasN');
    this.bindTexture(1, this.atlasFar, program, 'uAtlasF');
    this.bindTexture(2, from.far.color, program, 'uFarC0');
    this.bindTexture(3, from.far.glyph, program, 'uFarG0');
    this.bindTexture(4, from.near.color, program, 'uNearC0');
    this.bindTexture(5, from.near.glyph, program, 'uNearG0');
    this.bindTexture(6, second.far.color, program, 'uFarC1');
    this.bindTexture(7, second.far.glyph, program, 'uFarG1');
    this.bindTexture(8, second.near.color, program, 'uNearC1');
    this.bindTexture(9, second.near.glyph, program, 'uNearG1');
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Unbind so the next frame can render into these textures again.
    for (let unit = 2; unit <= 9; unit++) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
  }

  dispose(): void {
    const gl = this.gl;
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    for (const scene of this.scenes.values()) {
      this.freeLayer(scene.far);
      this.freeLayer(scene.near);
      gl.deleteProgram(scene.program.handle);
    }
    if (this.composite) gl.deleteProgram(this.composite.handle);
    if (this.atlasNear) gl.deleteTexture(this.atlasNear);
    if (this.atlasFar) gl.deleteTexture(this.atlasFar);
    this.scenes = new Map();
    this.composite = null;
    this.atlasNear = null;
    this.atlasFar = null;
    this.width = 0;
    this.height = 0;
  }
}
