/**
 * Shared GLSL for every cosmic scene.
 *
 * A scene shader is evaluated once per CHARACTER CELL, not per pixel. It writes
 * two render targets:
 *   oColor  rgb = glyph colour (brightness included), a = coverage (near layer)
 *   oGlyph  r   = luminance, mapped to the density ramp " .:;-~=+*oO0&%#@"
 *           g   = explicit glyph index / 255 (0 = use the ramp)
 * The composite pass then stamps real glyphs from the atlas into each cell.
 */

/** "#RRGGBB" -> "vec3(r, g, b)" so palettes stay readable as hex. */
export const hex3 = (hex: string): string => {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(4));
  return `vec3(${c.join(', ')})`;
};

const SCENE_COMMON = `#version 300 es
precision highp float;
precision highp int;

uniform float uTime;
uniform vec3 uCam;      // camera position: x, y lateral, z forward
uniform float uZoom;
uniform vec2 uGrid;     // cols, rows of this layer
uniform vec2 uCellPx;   // cell size of this layer in device px
uniform vec2 uResPx;    // canvas size in device px
uniform int uLayer;     // 0 = far (small glyphs), 1 = near (large glyphs)

layout(location = 0) out vec4 oColor;
layout(location = 1) out vec4 oGlyph;

#define PI 3.14159265359
#define TAU 6.28318530718

// Indices into the glyph atlas (see GLYPHS in AsciiRenderer.ts).
const float G_DOT = 1.0;
const float G_COLON = 2.0;
const float G_TILDE = 4.0;
const float G_PLUS = 5.0;
const float G_STAR = 6.0;
const float G_AT = 13.0;
const float G_DASH = 14.0;
const float G_EQ = 15.0;
const float G_SLASH = 16.0;
const float G_BSLASH = 17.0;
const float G_PIPE = 18.0;

float gAspect;    // canvas width / height
vec2 gCell;       // cell size in screen units (screen height = 1)
float gCellHash;  // static per-cell random, stable across frames

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
// Gradient noise, roughly -0.7..0.7. Unlike value noise it has no visible lattice.
float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash22(i) * 2.0 - 1.0, f);
  float b = dot(hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0, f - vec2(1.0, 0.0));
  float c = dot(hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0, f - vec2(0.0, 1.0));
  float d = dot(hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0, f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// Fractal noise, normalised to roughly 0..1 with mean 0.5.
float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
  p = m * p;
  for (int i = 0; i < 5; i++) {
    s += a * gnoise(p);
    p = m * p * 2.03 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return clamp(0.5 + s * 1.05, 0.0, 1.0);
}
float fbm3(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise3(p);
    p = p.yzx * 2.07 + vec3(11.7, 5.3, 8.9);
    a *= 0.5;
  }
  return s / 0.9375;
}
// 1D value noise that wraps every M units: used for grains travelling round a ring.
float pnoise1(float x, float M, float seed) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash21(vec2(mod(i, M), seed)), hash21(vec2(mod(i + 1.0, M), seed)), f);
}

// rot2(a) * v rotates v by -a (aligns an axis tilted by +a with x).
mat2 rot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

// ---- Perspective camera -------------------------------------------------
// Every object lives on a plane at depth D. Positions are authored in "rest"
// units: where the object sits on screen when the camera is at the origin.
// Near planes react strongly to camera travel, far planes barely move.
vec2 layerUV(vec2 p, float D) { return (p * (D - uCam.z) + uCam.xy) / D; }
vec2 screenOf(vec2 P, float D) { return (P * D - uCam.xy) / (D - uCam.z); }
float layerScale(float D) { return D / (D - uCam.z) * uZoom; }

// Glyph whose stroke follows a screen-space direction.
float dirGlyph(vec2 d) {
  float a = mod(atan(d.y, d.x), PI);
  if (a < PI * 0.125 || a > PI * 0.875) return G_DASH;
  if (a < PI * 0.375) return G_SLASH;
  if (a < PI * 0.625) return G_PIPE;
  return G_BSLASH;
}
float starGlyph(float s) {
  return s < 0.30 ? G_DOT : (s < 0.48 ? G_COLON : (s < 0.66 ? G_PLUS : G_STAR));
}

// One star per lattice cell of a plane at depth D. Returns its brightness when
// the star falls inside the current character cell, else 0.
float starField(vec2 p, float D, float dens, float seed, float keep, vec2 drift, out float h) {
  vec2 u = (layerUV(p, D) + drift) * dens + seed * 31.7;
  vec2 id = floor(u);
  vec2 f = fract(u);
  float b = hash21(id + seed * 7.3);
  h = hash21(id * 1.31 + 11.7 + seed);
  if (b > keep) return 0.0;
  vec2 pos = 0.18 + 0.64 * hash22(id + seed * 3.1);
  vec2 d = (f - pos) / dens * layerScale(D);
  if (abs(d.x) > gCell.x * 0.5 || abs(d.y) > gCell.y * 0.5) return 0.0;
  float mag = pow(b / keep, 5.0);
  float tw = 0.82 + 0.18 * sin(uTime * (0.25 + h * 0.6) + h * 50.0);
  return (0.16 + 0.62 * mag) * tw;
}

// Sparse bright stars with diffraction spikes drawn as - and | glyphs.
float brightStar(vec2 p, float D, float dens, float seed, out float sp, out float h) {
  sp = 0.0;
  vec2 u = layerUV(p, D) * dens + seed * 13.1;
  vec2 id = floor(u);
  vec2 f = fract(u);
  float b = hash21(id + seed * 5.7);
  h = hash21(id * 2.3 + seed);
  if (b > 0.42) return 0.0;
  vec2 pos = 0.3 + 0.4 * hash22(id + seed);
  vec2 d = (f - pos) / dens * layerScale(D);
  vec2 c = abs(d) / gCell;
  float tw = 0.86 + 0.14 * sin(uTime * (0.2 + h * 0.5) + h * 40.0);
  if (c.x < 0.5 && c.y < 0.5) { sp = G_STAR; return 0.95 * tw; }
  float len = 1.5 + 2.0 * h;
  if (c.y < 0.5 && c.x < len + 0.5) {
    sp = G_DASH;
    return (0.42 * (1.0 - c.x / (len + 0.5)) + 0.10) * tw;
  }
  float vlen = len * 0.6;
  if (c.x < 0.5 && c.y < vlen + 0.5) {
    sp = G_PIPE;
    return (0.42 * (1.0 - c.y / (vlen + 0.5)) + 0.10) * tw;
  }
  return 0.0;
}

// A rare meteor: a thin fading streak of / or \\ glyphs.
void meteor(vec2 p, float period, float slot, vec3 tailCol, vec3 headCol,
            inout vec3 col, inout float lum, inout float sp) {
  float k = floor(uTime / period + slot * 0.37);
  float ph = (fract(uTime / period + slot * 0.37)) * period;
  float dur = 1.25;
  if (ph > dur) return;
  vec2 h = hash22(vec2(k, slot * 13.7));
  float sgn = h.x > 0.5 ? -1.0 : 1.0;
  vec2 a = vec2((h.x - 0.5) * gAspect * 0.8, 0.12 + 0.34 * h.y) / uZoom;
  vec2 dir = normalize(vec2(sgn, -0.55 - 0.35 * hash11(k + slot)));
  float s = ph / dur;
  float head = s * 0.62 / uZoom;
  float tail = 0.17 / uZoom;
  vec2 rel = p - a;
  float along = dot(rel, dir);
  float perp = abs(dot(rel, vec2(-dir.y, dir.x)));
  if (perp > gCell.x * 0.75 / uZoom || along > head || along < head - tail) return;
  float f = 1.0 - (head - along) / tail;
  float I = f * f * sin(s * PI);
  if (I < 0.04) return;
  col = mix(tailCol, headCol, f) * (0.25 + 1.0 * I);
  lum = max(lum, I);
  sp = f > 0.9 ? G_STAR : (sgn > 0.0 ? G_BSLASH : G_SLASH);
}
`;

const SCENE_MAIN = `
void main() {
  gAspect = uResPx.x / uResPx.y;
  gCell = uCellPx / uResPx.y;
  gCellHash = hash21(gl_FragCoord.xy + float(uLayer) * 91.7);

  // Centre of this character cell, in screen units with y up and height = 1.
  vec2 fc = gl_FragCoord.xy;
  vec2 px = vec2(fc.x * uCellPx.x, (uGrid.y - fc.y) * uCellPx.y);
  vec2 p = vec2(px.x - 0.5 * uResPx.x, 0.5 * uResPx.y - px.y) / uResPx.y / uZoom;

  vec3 col = vec3(0.0);
  float lum = 0.0;
  float sp = 0.0;
  float cover = 1.0;
  if (uLayer == 0) {
    sceneFar(p, col, lum, sp);
  } else {
    sceneNear(p, col, lum, sp, cover);
  }
  oColor = vec4(clamp(col, 0.0, 1.0), cover);
  oGlyph = vec4(clamp(lum, 0.0, 1.0), sp / 255.0, 0.0, 1.0);
}
`;

/** Wrap a scene body (defining sceneFar and sceneNear) into a full fragment shader. */
export const buildSceneShader = (body: string): string => `${SCENE_COMMON}\n${body}\n${SCENE_MAIN}`;
