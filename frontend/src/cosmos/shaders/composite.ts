/** Fullscreen triangle; no vertex buffers needed. */
export const FULLSCREEN_VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

/**
 * Composite pass: turns the per-cell scene buffers into real glyphs.
 * Two character grids are layered — small glyphs for deep space, large glyphs
 * for nearby bodies — so character size depends on depth. During a scene
 * change, two scenes are dissolved cell by cell along a diagonal sweep.
 */
export const COMPOSITE_FRAG = `#version 300 es
precision highp float;

uniform vec2 uResPx;
uniform vec2 uCellN;
uniform vec2 uCellF;
uniform vec2 uGridN;
uniform vec2 uGridF;
uniform float uGlyphs;
uniform sampler2D uAtlasN;
uniform sampler2D uAtlasF;
uniform sampler2D uFarC0;
uniform sampler2D uFarG0;
uniform sampler2D uNearC0;
uniform sampler2D uNearG0;
uniform sampler2D uFarC1;
uniform sampler2D uFarG1;
uniform sampler2D uNearC1;
uniform sampler2D uNearG1;
uniform float uMix;
uniform float uTime;
uniform vec4 uFx0;   // glow, grain, vignette, gain
uniform vec4 uFx1;
uniform vec3 uBg0;
uniform vec3 uBg1;

out vec4 fragColor;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Coverage of the glyph chosen for this cell at a position inside the cell.
float glyphMask(sampler2D atlas, vec2 cellPx, vec2 local, vec4 g) {
  vec2 lc = vec2(clamp(local.x, 0.5 / cellPx.x, 1.0 - 0.5 / cellPx.x), local.y);
  float special = floor(g.g * 255.0 + 0.5);
  if (special > 0.5) {
    return texture(atlas, vec2((special + lc.x) / uGlyphs, lc.y)).r;
  }
  // Density ramp: cross-fade between neighbouring glyphs so brightness
  // changes melt into each other instead of popping.
  float f = clamp(g.r, 0.0, 1.0) * 13.0;
  float i0 = floor(f);
  float i1 = min(i0 + 1.0, 13.0);
  float a = texture(atlas, vec2((i0 + lc.x) / uGlyphs, lc.y)).r;
  float b = texture(atlas, vec2((i1 + lc.x) / uGlyphs, lc.y)).r;
  return mix(a, b, smoothstep(0.25, 0.75, f - i0));
}

// Soft upsample of the cell colours: the bloom that sits behind the glyphs.
vec4 soft(sampler2D tex, vec2 uv, vec2 texel) {
  vec4 s = texture(tex, uv) * 0.36;
  s += texture(tex, uv + texel * vec2(0.9, 0.9)) * 0.16;
  s += texture(tex, uv + texel * vec2(-0.9, 0.9)) * 0.16;
  s += texture(tex, uv + texel * vec2(0.9, -0.9)) * 0.16;
  s += texture(tex, uv + texel * vec2(-0.9, -0.9)) * 0.16;
  return s;
}

vec3 sceneColor(sampler2D farC, sampler2D farG, sampler2D nearC, sampler2D nearG,
                vec2 fp, vec4 fx, vec3 bg) {
  vec2 cf = fp / uCellF;
  vec2 idf = floor(cf);
  vec2 uvf = vec2((idf.x + 0.5) / uGridF.x, 1.0 - (idf.y + 0.5) / uGridF.y);
  vec3 farCol = texture(farC, uvf).rgb * glyphMask(uAtlasF, uCellF, fract(cf), texture(farG, uvf));

  vec2 cn = fp / uCellN;
  vec2 idn = floor(cn);
  vec2 uvn = vec2((idn.x + 0.5) / uGridN.x, 1.0 - (idn.y + 0.5) / uGridN.y);
  vec4 nc = texture(nearC, uvn);
  vec3 nearCol = nc.rgb * glyphMask(uAtlasN, uCellN, fract(cn), texture(nearG, uvn));

  vec3 c = mix(farCol, nearCol, step(0.5, nc.a));

  vec4 gn = soft(nearC, vec2(cn.x / uGridN.x, 1.0 - cn.y / uGridN.y), 1.0 / uGridN);
  vec3 gf = soft(farC, vec2(cf.x / uGridF.x, 1.0 - cf.y / uGridF.y), 1.0 / uGridF).rgb;
  vec3 glow = mix(gf, gn.rgb, clamp(gn.a, 0.0, 1.0));
  c += glow * glow * fx.x * 2.0 + glow * fx.x * 0.35;

  return bg + c * fx.w;
}

void main() {
  vec2 fp = vec2(gl_FragCoord.x, uResPx.y - gl_FragCoord.y);
  vec2 uv = fp / uResPx;

  vec3 col = sceneColor(uFarC0, uFarG0, uNearC0, uNearG0, fp, uFx0, uBg0);
  vec4 fx = uFx0;

  if (uMix > 0.0) {
    vec3 col1 = sceneColor(uFarC1, uFarG1, uNearC1, uNearG1, fp, uFx1, uBg1);
    vec2 cell = floor(fp / uCellN);
    float th = hash21(cell) * 0.42 + 0.58 * (uv.x * 0.6 + uv.y * 0.4);
    float prog = uMix * 1.16 - 0.08;
    float m = smoothstep(th - 0.035, th + 0.035, prog);
    float edge = smoothstep(0.07, 0.0, abs(prog - th));
    col = mix(col, col1, m);
    col += edge * 0.07 * mix(uFx0.w, uFx1.w, m) * vec3(1.0, 0.95, 0.9);
    col *= 1.0 - 0.30 * sin(3.14159265 * uMix);
    fx = mix(uFx0, uFx1, uMix);
  }

  // Vignette, then fine cinematic grain.
  vec2 vc = (uv - 0.5) * vec2(1.05, 1.2);
  float vig = smoothstep(1.05, 0.30, length(vc));
  col *= mix(1.0, vig, fx.z);
  float gr = hash21(fp + fract(uTime * 7.31) * 311.0) - 0.5;
  col += gr * fx.y * (0.35 + 1.4 * dot(col, vec3(0.333)));

  fragColor = vec4(max(col, 0.0), 1.0);
}
`;
