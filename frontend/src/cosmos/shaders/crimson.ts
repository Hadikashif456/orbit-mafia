import { buildSceneShader, hex3 } from './common';

/**
 * SCREEN 3 — CRIMSON SINGULARITY
 * After Design/screen-3 ref.mp4: a black circular void filled with shining
 * stars, edged by a thin crimson rim, wrapped in drifting hot-pink cloud.
 *
 * Depth, far to near: stars seen through the void, clouds behind the void,
 * the void and its rim, then clouds in front (drawn in the large-glyph layer
 * so they pass over the rim). Camera travel slides these planes apart.
 */
const BODY = `
const vec3 MAROON = ${hex3('#3A0714')};
const vec3 CRIMSON = ${hex3('#C2123F')};
const vec3 ROSE = ${hex3('#F0245A')};
const vec3 PINK = ${hex3('#FF5C86')};
const vec3 BLUSH = ${hex3('#FFA3BA')};
const vec3 WHITE = ${hex3('#FFF1F4')};
const vec3 ICE = ${hex3('#C9D4FF')};

const float D_HOLE = 3.0;
vec2 holeC() { return vec2(0.0, 0.02); }
float holeR() { return min(0.33, 0.42 * gAspect); }

vec3 starTint(float h) {
  return h < 0.55 ? WHITE : (h < 0.80 ? PINK : (h < 0.92 ? ICE : ROSE));
}
void addStar(float s, float h, inout vec3 col, inout float lum, inout float sp) {
  if (s < 0.06) return;
  col = max(col, starTint(h) * (0.35 + 1.1 * s));
  lum = max(lum, s);
  sp = starGlyph(s);
}

// Soft elliptical blob used to place cloud banks.
float bank(vec2 uv, vec2 c, vec2 size) {
  vec2 d = (uv - c) / size;
  return exp(-dot(d, d));
}

// Billowing cumulus. q is a position on the cloud's plane, m says how much
// cloud belongs here (0..1). Returns density; lit is how sunlit the puff is.
float cumulus(vec2 q, float m, float seed, float speed, out float lit) {
  float t = uTime;
  vec2 w = q * vec2(3.0, 3.9) + vec2(t * speed + seed * 13.0, seed * 7.0);
  vec2 warp = vec2(fbm(w * 0.9 + vec2(0.0, t * 0.020)), fbm(w * 0.9 + vec2(5.2, 1.3) - vec2(0.0, t * 0.017)));
  vec2 w2 = w + 0.9 * (warp - 0.5);
  float n = fbm(w2);
  float billow = 1.0 - abs(2.0 * fbm(w2 * 2.3 + 3.7) - 1.0);
  float body = n * 0.75 + billow * 0.35;
  // Light falls from above: a puff is bright where the cloud thins upward.
  float above = fbm(w2 + vec2(0.0, 0.28));
  lit = clamp(smoothstep(-0.16, 0.20, n - above) * (0.40 + 0.55 * billow), 0.0, 0.9);
  // Cloud only forms where a bank is placed (m); the noise then carves its
  // billowing edge. Away from any bank there is none at all.
  return smoothstep(0.0, 0.22, m * 0.80 + (body - 0.64) * 1.2 - 0.34);
}

vec3 cloudColor(float sh) {
  vec3 c = mix(MAROON, CRIMSON, smoothstep(0.08, 0.42, sh));
  c = mix(c, ROSE, smoothstep(0.38, 0.68, sh));
  c = mix(c, PINK, smoothstep(0.64, 0.88, sh));
  c = mix(c, BLUSH, smoothstep(0.90, 1.05, sh));
  return c;
}

void sceneFar(vec2 p, out vec3 col, out float lum, out float sp) {
  col = vec3(0.0);
  lum = 0.0;
  sp = 0.0;

  float R = holeR();
  vec2 hl = layerUV(p, D_HOLE) - holeC();
  float d = length(hl);
  float dr = d - R;
  bool inside = dr < 0.0;

  // ---- Stars: dense inside the void, a scattering outside ----------------
  float sd = min(40.0, 0.30 / gCell.y);
  float h;
  float s;
  s = starField(p, 40.0, sd, 1.0, inside ? 0.82 : 0.14, vec2(0.0), h);
  addStar(s, h, col, lum, sp);
  s = starField(p, 22.0, sd * 0.7, 2.0, inside ? 0.72 : 0.12, vec2(0.0), h);
  addStar(s, h, col, lum, sp);
  s = starField(p, 12.0, sd * 0.45, 3.0, inside ? 0.62 : 0.10, vec2(0.0), h);
  addStar(s, h, col, lum, sp);
  float bsp;
  s = brightStar(p, 16.0, 8.0, 4.0, bsp, h);
  if (!inside) s *= step(0.6, h);
  if (s > 0.05) {
    col = max(col, starTint(h) * (0.3 + s));
    lum = max(lum, s);
    sp = bsp;
  }
  // Unresolved star dust deep inside the void.
  if (inside && lum < 0.05) {
    float dust = smoothstep(0.50, 0.80, fbm(layerUV(p, 30.0) * 6.0 + 3.0));
    if (gCellHash < dust * 0.75) {
      col = mix(ICE, PINK, fract(gCellHash * 7.0)) * 0.36;
      lum = 0.10;
      sp = G_DOT;
    }
  }

  if (!inside) {
    // ---- Clouds behind the void ------------------------------------------
    vec2 q = layerUV(p, 4.6);
    vec2 uv = vec2(q.x / (0.5 * gAspect), q.y);
    float m = bank(uv, vec2(0.72, -0.10), vec2(0.42, 0.14))
            + bank(uv, vec2(0.62, 0.46), vec2(0.45, 0.07))
            + bank(uv, vec2(-0.80, -0.22), vec2(0.40, 0.12))
            + bank(uv, vec2(-0.55, 0.40), vec2(0.50, 0.08)) * 0.7;
    float lit;
    float dens = cumulus(q, min(m, 1.0), 3.0, 0.006, lit);
    // The rim throws a red glow onto nearby cloud.
    float rimLight = exp(-dr * 7.0);
    float sh = clamp((0.16 + 0.62 * lit) * (0.75 + 0.6 * rimLight), 0.0, 1.0);
    float keep = step(gCellHash, 0.15 + dens * 1.6);
    if (dens * keep > 0.06) {
      col = mix(col, cloudColor(sh) * (0.30 + 0.75 * sh), dens);
      lum = mix(lum, 0.10 + 0.70 * sh * dens, dens);
      sp = dens > 0.5 ? 0.0 : sp;
    }

    // Pink motes shed just outside the rim.
    float mote = starField(p, D_HOLE, sd * 0.8, 7.0, 0.42, vec2(0.0), h) * smoothstep(0.16, 0.0, dr);
    if (mote > 0.08) {
      col = max(col, mix(ROSE, PINK, h) * (0.5 + mote));
      lum = max(lum, mote);
      sp = h < 0.5 ? G_DOT : G_STAR;
    }
  }

  // ---- The rim: a hairline of crimson, glowing outward ---------------------
  float wob = 0.75 + 0.25 * fbm(hl / max(d, 0.0001) * 3.0 + vec2(uTime * 0.02, 0.0));
  float line = exp(-abs(dr) / (gCell.x * 0.95)) * wob;
  float halo = (dr > 0.0 ? exp(-dr / 0.045) * 0.42 : exp(dr / 0.016) * 0.30) * wob;
  float rim = clamp(line + halo * step(gCellHash, 0.25 + halo * 2.2), 0.0, 1.0);
  if (rim > 0.06 && rim > lum * 0.7) {
    col = mix(col, mix(CRIMSON, PINK, smoothstep(0.2, 0.9, rim)) * (0.35 + 0.85 * rim), clamp(rim * 1.4, 0.0, 1.0));
    lum = max(lum, 0.16 + 0.7 * rim);
    sp = line > 0.5 ? dirGlyph(vec2(-hl.y, hl.x)) : 0.0;
  }

  meteor(p, 33.0, 1.0, PINK, WHITE, col, lum, sp);
}

void sceneNear(vec2 p, out vec3 col, out float lum, out float sp, out float cover) {
  col = vec3(0.0);
  lum = 0.0;
  sp = 0.0;
  cover = 0.0;

  // Distance from the rim, for the red glow it casts on the clouds.
  float dr = length(layerUV(p, D_HOLE) - holeC()) - holeR();
  float rimLight = exp(-abs(dr) * 6.0);

  // ---- Main cloud banks, in front of the void ------------------------------
  vec2 q = layerUV(p, 1.7);
  vec2 uv = vec2(q.x / (0.5 * gAspect), q.y);
  float m = bank(uv, vec2(-0.58, 0.15), vec2(0.50, 0.16))      // drifts across the upper-left limb
          + bank(uv, vec2(0.36, 0.33), vec2(0.58, 0.13))       // band above
          + bank(uv, vec2(-0.12, -0.40), vec2(0.80, 0.14))     // band below
          + bank(uv, vec2(0.56, -0.17), vec2(0.32, 0.12)) * 0.8;
  float lit;
  float dens = cumulus(q, min(m, 1.0), 1.0, 0.011, lit);
  float sh = clamp((0.20 + 0.78 * lit) * (0.80 + 0.45 * rimLight), 0.0, 1.0);

  // ---- A nearer, thinner veil low in the frame -----------------------------
  vec2 q2 = layerUV(p, 1.25);
  vec2 uv2 = vec2(q2.x / (0.5 * gAspect), q2.y);
  float m2 = bank(uv2, vec2(-0.75, -0.50), vec2(0.60, 0.10)) + bank(uv2, vec2(0.85, 0.52), vec2(0.45, 0.08));
  float lit2;
  float dens2 = cumulus(q2, min(m2, 1.0), 2.0, 0.017, lit2) * 0.9;
  if (dens2 > dens) {
    dens = dens2;
    sh = clamp(0.16 + 0.70 * lit2, 0.0, 1.0);
  }

  // Cloud edges break into scattered grains so the stars show through.
  if (dens < 0.10) return;
  if (dens < 0.45 && gCellHash > (dens - 0.10) / 0.35 * 0.8 + 0.15) return;

  col = cloudColor(sh) * (0.30 + 0.80 * sh);
  lum = clamp(0.14 + 0.70 * sh * (0.55 + 0.45 * dens) + (gCellHash - 0.5) * 0.10, 0.08, 0.9);
  cover = 1.0;
}
`;

export const CRIMSON_FRAG = buildSceneShader(BODY);
