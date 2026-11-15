import { buildSceneShader, hex3 } from './common';

/**
 * SCREEN 1 — COSMIC DREAMSCAPE
 * Painterly treatment: glyph strokes (- ~ = / \ |) follow the flow of the gas,
 * the galaxy's orbits, the planet's cloud bands and the ring tangents.
 */
const BODY = `
const vec3 INDIGO = ${hex3('#11102A')};
const vec3 AMETHYST = ${hex3('#543078')};
const vec3 ORCHID = ${hex3('#B56CFF')};
const vec3 LAVENDER = ${hex3('#D9B8FF')};
const vec3 ROSE = ${hex3('#F4A4CF')};
const vec3 CYAN = ${hex3('#83E7F5')};
const vec3 GOLD = ${hex3('#FFE0A3')};
const vec3 WHITE = vec3(0.973, 0.957, 1.0);

const vec3 KEY_LIGHT = vec3(-0.553, 0.503, 0.664);

vec3 starTint(float h) {
  return h < 0.5 ? WHITE : (h < 0.68 ? LAVENDER : (h < 0.84 ? CYAN : GOLD));
}

void addStar(float s, float h, inout vec3 col, inout float lum, inout float sp) {
  if (s < 0.06) return;
  col = max(col, starTint(h) * (0.35 + 1.1 * s));
  lum = max(lum, s);
  sp = starGlyph(s);
}

// Radial brightness of the ring system; x is distance in planet radii.
float ringProfile(float x) {
  float d = 0.0;
  d += 0.38 * smoothstep(1.22, 1.30, x) * smoothstep(1.52, 1.48, x);
  d += 0.95 * smoothstep(1.50, 1.56, x) * smoothstep(1.96, 1.93, x);
  d += 0.72 * smoothstep(2.02, 2.05, x) * smoothstep(2.30, 2.27, x);
  d *= 1.0 - 0.8 * smoothstep(0.014, 0.0, abs(x - 2.19));
  d += 0.55 * smoothstep(0.016, 0.0, abs(x - 2.39));
  float fine = vnoise(vec2(x * 85.0, 3.7));
  float finer = vnoise(vec2(x * 240.0, 9.1));
  return d * (0.55 + 0.45 * fine) * (0.8 + 0.2 * finer);
}

vec3 ringColor(float rho, float grain) {
  vec3 c = mix(CYAN * 0.8, LAVENDER, smoothstep(1.25, 1.6, rho));
  c = mix(c, GOLD, smoothstep(1.62, 1.8, rho) * smoothstep(1.98, 1.85, rho) * 0.75);
  c = mix(c, ROSE, smoothstep(2.0, 2.15, rho));
  c = mix(c, ORCHID, smoothstep(2.2, 2.32, rho) * 0.7);
  c = mix(c, CYAN, smoothstep(2.34, 2.38, rho));
  return mix(c, WHITE, smoothstep(0.75, 1.0, grain) * 0.6);
}

// Slow wander of a distant world around its rest position, so the sky is
// never perfectly still. Each seed gets its own path and pace.
vec2 wander(float seed, float amp) {
  return amp * vec2(sin(uTime * (0.050 + 0.011 * seed) + seed * 2.1),
                    cos(uTime * (0.037 + 0.008 * seed) + seed * 1.3));
}

// A small distant world: banded sphere with a soft terminator and lit limb.
bool smallPlanet(vec2 l, float r, float seed, vec3 cA, vec3 cB,
                 inout vec3 col, inout float lum, inout float sp) {
  float d = length(l);
  if (d > r * 1.3) return false;
  if (d < r) {
    vec3 n = vec3(l / r, sqrt(max(0.0, 1.0 - d * d / (r * r))));
    vec3 ps = n;
    ps.xy = rot2(0.5 * sin(seed * 7.0)) * ps.xy;
    ps.xz = rot2(uTime * 0.11 + seed) * ps.xz;
    float tex = fbm3(ps * vec3(2.5, 7.0, 2.5) + seed * 10.0);
    float band = 0.5 + 0.5 * sin(ps.y * 8.0 + tex * 3.0 + seed);
    float ndl = dot(n, KEY_LIGHT);
    float dif = smoothstep(-0.1, 0.7, ndl);
    float rim = pow(1.0 - n.z, 3.0) * smoothstep(-0.3, 0.4, ndl);
    float lu = dif * (0.35 + 0.65 * mix(tex, band, 0.6)) + rim * 0.45 + 0.03;
    col = mix(cB, cA, band) * (0.14 + 1.0 * lu);
    lum = clamp(lu, 0.05, 1.0);
    sp = 0.0;
    return true;
  }
  float a = 1.0 - (d - r) / (0.3 * r);
  float sf = max(dot(l / d, normalize(KEY_LIGHT.xy)), 0.0);
  float g = a * a * sf * 0.4;
  if (g < 0.04) return false;
  col = cA * g * 1.5;
  lum = g;
  sp = 0.0;
  return true;
}

void sceneFar(vec2 p, out vec3 col, out float lum, out float sp) {
  float t = uTime;
  col = vec3(0.0);
  lum = 0.0;
  sp = 0.0;

  // ---- Nebulae: domain-warped gas flowing along a diagonal river ----------
  vec2 q = layerUV(p, 9.0);
  vec2 w = q * 1.45 + vec2(3.1, -1.7);
  vec2 fl = vec2(fbm(w + vec2(0.0, t * 0.022)), fbm(w + vec2(5.2, 1.3) - vec2(t * 0.018, 0.0)));
  vec2 w2 = w + 1.5 * (fl - 0.5);
  float n = fbm(w2 * 1.25 + vec2(1.7, 9.2));
  float diag = dot(q - vec2(0.06, 0.0), normalize(vec2(-0.5, 0.86)));
  float band = exp(-diag * diag / 0.10);
  float dens = smoothstep(0.36, 0.80, n * (0.62 + 0.62 * band));
  float wisp = smoothstep(0.50, 0.85, fbm(w2 * 2.9 + 3.3));
  dens = clamp(dens + wisp * 0.28 * (0.25 + band), 0.0, 1.0);
  float hueN = fbm(w2 * 0.7 + vec2(4.1, 2.7) + t * 0.004);
  vec3 nc = mix(AMETHYST, ORCHID, smoothstep(0.36, 0.58, hueN));
  nc = mix(nc, ROSE, smoothstep(0.52, 0.70, hueN) * 0.85);
  nc = mix(nc, CYAN, smoothstep(0.50, 0.34, hueN) * smoothstep(0.42, 0.70, fl.x) * 0.9);
  nc = mix(nc, LAVENDER, smoothstep(0.62, 1.0, dens) * 0.55);

  // ---- Galaxy: inclined two-arm logarithmic spiral ------------------------
  vec2 g = rot2(0.52) * (layerUV(p, 6.0) - vec2(0.21, 0.04));
  g.y /= 0.44;
  float gr = length(g) / 0.58;
  float th = atan(g.y, g.x);
  float wob = (fbm(g * 3.0 + 4.0) - 0.5) * 0.9;
  float sw = 2.0 * th - 4.6 * log(gr + 0.04) + t * 0.09 + wob;
  float arm = pow(0.5 + 0.5 * cos(sw), 3.0);
  float gtex = fbm(g * 9.0 + vec2(2.0, 5.0));
  float fall = exp(-gr * 2.0) * smoothstep(1.25, 0.6, gr);
  float lane = pow(0.5 + 0.5 * cos(sw + 2.4), 5.0) * smoothstep(0.42, 0.7, gtex);
  float gal = fall * (0.05 + 1.5 * arm * (0.45 + 0.9 * gtex)) * (1.0 - 0.7 * lane);
  // The core breathes: a slow, slightly irregular pulse.
  float pulse = 1.0 + 0.10 * sin(t * 0.55) + 0.05 * sin(t * 1.3 + 1.7);
  float bulge = (exp(-gr * gr * 60.0) * 0.75 + exp(-gr * 7.0) * 0.35) * pulse;
  float gl = clamp(gal + bulge, 0.0, 1.2);
  vec3 gc = mix(ORCHID, LAVENDER, smoothstep(0.08, 0.45, gl));
  gc = mix(gc, CYAN, smoothstep(0.40, 0.95, gr) * 0.75);
  gc = mix(gc, ROSE, smoothstep(0.2, 0.55, gl) * arm * 0.6);
  gc = mix(gc, GOLD, smoothstep(0.55, 1.0, gl) * smoothstep(0.45, 0.1, gr));
  gc = mix(gc, WHITE, smoothstep(1.0, 1.2, gl));
  // The galaxy sits in a clearing: gas thins out around it.
  dens *= 1.0 - 0.65 * smoothstep(1.1, 0.25, gr);

  // The core lights the surrounding gas (volumetric illumination).
  float coreLight = exp(-gr * 2.2);
  float nb = (0.20 + 0.80 * dens) * smoothstep(0.02, 0.22, dens) * (1.0 + 0.9 * coreLight);
  col = nc * nb;
  lum = dens * 0.60;
  float ga = clamp(gl * 1.6, 0.0, 1.0);
  col = mix(col, gc * (0.26 + 0.72 * min(gl, 1.0)), ga);
  lum = mix(lum, 0.08 + 0.80 * min(gl, 1.0), ga);

  // Brush strokes: a minority of cells carry a stroke aligned to the orbits
  // inside the galaxy and to the contours of the gas outside it.
  if (gCellHash < 0.17 && lum > 0.16 && lum < 0.70) {
    vec2 grad = vec2(dFdx(n) / gCell.x, dFdy(n) / gCell.y);
    vec2 dirv = ga > 0.3
      ? rot2(-0.52) * vec2(-g.y, g.x * 0.44)
      : vec2(-grad.y, grad.x) + vec2(0.0001);
    float dg = dirGlyph(dirv);
    sp = (dg == G_DASH && gCellHash < 0.08) ? G_TILDE : dg;
  }

  // ---- Stars at four depths; dense gas veils the ones behind it -----------
  float sd = min(40.0, 0.30 / gCell.y);
  float veil = 1.0 - 0.75 * smoothstep(0.25, 0.8, lum);
  float h;
  float s;
  s = starField(p, 18.0, sd, 1.0, 0.55, vec2(0.0), h) * veil;
  addStar(s, h, col, lum, sp);
  s = starField(p, 10.0, sd * 0.7, 2.0, 0.50, vec2(0.0), h) * veil;
  addStar(s, h, col, lum, sp);
  s = starField(p, 5.5, sd * 0.45, 3.0, 0.45, vec2(0.0), h) * veil;
  addStar(s, h, col, lum, sp);
  // Drifting cosmic particles, close to the camera.
  s = starField(p, 2.4, sd * 0.5, 5.0, 0.28, vec2(t * 0.004, t * 0.0015), h) * 0.7;
  if (s > 0.06) {
    col = max(col, mix(LAVENDER, CYAN, h) * (0.25 + s));
    lum = max(lum, s);
    sp = G_DOT;
  }
  float bsp;
  s = brightStar(p, 7.0, 9.0, 4.0, bsp, h);
  if (s > 0.0) {
    col = max(col, starTint(h) * (0.3 + s));
    lum = max(lum, s);
    sp = bsp;
  }

  // ---- Distant planets ----------------------------------------------------
  float ax = gAspect / 1.78;
  vec2 l;
  l = layerUV(p, 5.0) - vec2(0.02 * ax, 0.37) - wander(1.0, 0.010);
  smallPlanet(l, 0.036, 1.0, LAVENDER, AMETHYST, col, lum, sp);
  l = layerUV(p, 3.0) - vec2(0.76 * ax, -0.06) - wander(3.0, 0.016);
  smallPlanet(l, 0.078, 3.0, ROSE, AMETHYST, col, lum, sp);
  l = layerUV(p, 4.2) - vec2(0.50 * ax, -0.36) - wander(4.0, 0.012);
  smallPlanet(l, 0.040, 4.0, GOLD, ROSE * 0.6, col, lum, sp);

  // A small ringed world, upper right.
  l = layerUV(p, 3.6) - vec2(0.47 * ax, 0.33) - wander(2.0, 0.012);
  float pr = 0.056;
  bool hit = smallPlanet(l, pr, 2.0, CYAN, ORCHID, col, lum, sp);
  vec2 rl = rot2(-0.45) * l;
  rl.y /= 0.28;
  float rr = length(rl) / pr;
  bool behind = rl.y > 0.0 && length(l) < pr;
  if (rr > 1.5 && rr < 2.3 && !behind) {
    float rd = 0.55 + 0.45 * sin(rr * 26.0);
    col = mix(LAVENDER, CYAN, smoothstep(1.5, 2.3, rr)) * (0.30 + 0.6 * rd);
    lum = 0.3 + 0.3 * rd;
    sp = rd < 0.3 ? G_DOT : dirGlyph(rot2(0.45) * vec2(-rl.y, rl.x * 0.28));
  } else if (hit) {
    // keep the sphere
  }

  // ---- Rare shooting stars ------------------------------------------------
  meteor(p, 11.0, 1.0, LAVENDER, WHITE, col, lum, sp);
  meteor(p, 17.0, 2.0, CYAN, WHITE, col, lum, sp);
  meteor(p, 23.0, 3.0, ROSE, WHITE, col, lum, sp);
}

void sceneNear(vec2 p, out vec3 col, out float lum, out float sp, out float cover) {
  col = vec3(0.0);
  lum = 0.0;
  sp = 0.0;
  cover = 0.0;

  // ---- The giant ringed planet, left of frame -----------------------------
  float D = 1.6;
  float sc = clamp(gAspect / 1.5, 0.62, 1.0);
  vec2 c = vec2(mix(-0.02, -0.5 * gAspect + 0.40, smoothstep(0.7, 1.5, gAspect)),
                0.06 + 0.007 * sin(uTime * 0.11));
  float r = 0.235 * sc;
  vec2 l = layerUV(p, D) - c;
  if (length(l) > r * 2.6) return;

  vec3 L = KEY_LIGHT;
  // Ring plane: N is the spin axis, tilted toward the viewer by B and rolled.
  float roll = 0.36;
  float B = 0.42;
  vec3 N = normalize(vec3(sin(roll) * cos(B), cos(roll) * cos(B), sin(B)));
  vec3 ex = normalize(vec3(N.y, -N.x, 0.0));
  vec3 ez = cross(ex, N);

  float d2 = dot(l, l);
  bool inDisc = d2 < r * r;
  float zs = inDisc ? sqrt(r * r - d2) : 0.0;

  // Where the view ray through this cell meets the ring plane.
  float hz = -(N.x * l.x + N.y * l.y) / N.z;
  vec3 hp = vec3(l, hz);
  float rho = length(hp) / r;
  bool ringVisible = !(inDisc && hz < zs);

  if (inDisc) {
    vec3 n = vec3(l, zs) / r;
    vec3 ps0 = vec3(dot(n, ex), dot(n, N), dot(n, ez));
    float a = uTime * 0.06;
    vec3 ps = vec3(ps0.x * cos(a) + ps0.z * sin(a), ps0.y, -ps0.x * sin(a) + ps0.z * cos(a));
    float evo = uTime * 0.012;
    float warp = fbm3(ps * vec3(2.2, 5.0, 2.2) + vec3(0.0, evo, 0.0));
    float lat = ps.y;
    float bands = 0.5 + 0.5 * sin(lat * 15.0 + (warp - 0.5) * 5.0);
    float bands2 = 0.5 + 0.5 * sin(lat * 37.0 + (warp - 0.5) * 9.0 + 1.3);
    float fine = fbm3(ps * vec3(6.0, 26.0, 6.0) + vec3(evo * 2.0, 0.0, 0.0));
    float storm = smoothstep(0.60, 0.78, fbm3(ps * vec3(4.0, 9.0, 4.0) + 7.3));
    float tex = clamp(0.50 * bands + 0.22 * bands2 + 0.30 * fine + 0.25 * storm - 0.1, 0.0, 1.0);

    float ndl = dot(n, L);
    float dif = smoothstep(-0.25, 0.60, ndl);
    float limb = 0.50 + 0.50 * pow(max(n.z, 0.0), 0.5);
    // Shadow the rings cast onto the cloud tops.
    float rs = 1.0;
    float tt = -dot(n * r, N) / dot(L, N);
    if (tt > 0.0) {
      vec3 qh = n * r + tt * L;
      rs = 1.0 - 0.7 * ringProfile(length(qh) / r);
    }
    // Lit rim on the day side, plus a faint ring of back-scatter all the way
    // round so the night side still reads as a sphere.
    float rim = pow(1.0 - n.z, 2.6) * smoothstep(-0.25, 0.45, ndl) + pow(1.0 - n.z, 5.0) * 0.30;
    float lu = dif * limb * rs * (0.22 + 0.78 * tex) + rim * 0.55 + 0.07 * (0.4 + tex);

    vec3 pc = mix(AMETHYST, ORCHID, smoothstep(0.2, 0.6, tex));
    pc = mix(pc, ROSE, smoothstep(0.5, 0.85, bands2 * tex + storm * 0.3) * 0.7);
    pc = mix(pc, LAVENDER, smoothstep(0.55, 0.95, tex) * 0.6);
    pc = mix(pc, GOLD, storm * 0.5 * dif);
    vec3 shadowC = mix(INDIGO * 1.6, AMETHYST, 0.35);
    vec3 sc3 = mix(shadowC * (0.5 + tex), pc, smoothstep(0.03, 0.45, lu));
    sc3 = mix(sc3, CYAN, clamp(rim * 0.75, 0.0, 1.0));
    col = sc3 * (0.16 + 1.05 * lu);
    lum = clamp(lu, 0.05, 1.0);
    cover = 1.0;
    // Strokes follow the lines of latitude, so the bands read as curved.
    if (gCellHash < 0.18 && lu > 0.12 && lu < 0.85) {
      float dg = dirGlyph(cross(N, n).xy);
      sp = dg == G_DASH ? (bands > 0.6 ? G_EQ : (bands > 0.35 ? G_TILDE : G_DASH)) : dg;
    }
  }

  if (rho > 1.2 && rho < 2.45 && ringVisible) {
    float dens = ringProfile(rho);
    float phi = atan(dot(hp, ez), dot(hp, ex));
    float idr = floor(rho * 64.0);
    float M = 220.0;
    // Keplerian: inner ringlets orbit faster than outer ones.
    float om = 0.09 * pow(rho, -1.5);
    float gx = (phi / TAU + 0.5) * M + uTime * om * M / TAU + hash11(idr) * M;
    float grain = pnoise1(gx, M, idr);
    // Planet's shadow across the rings.
    float hb = dot(hp, L);
    float sh = hb < 0.0 ? smoothstep(r * 0.86, r * 1.02, length(hp - hb * L)) : 1.0;
    float rb = dens * (0.5 + 0.5 * grain) * mix(0.10, 1.0, sh);
    float ra = clamp(dens * 1.3, 0.0, 1.0);
    if (ra > 0.06) {
      vec3 rc = ringColor(rho, grain) * (0.22 + 0.95 * rb);
      float rl = 0.15 + 0.7 * rb;
      // Thin dust is dotted; the body is hatched along the orbit; the
      // brightest grains glint.
      float rsp;
      if (grain > 0.86 && sh > 0.5 && dens > 0.3) {
        rsp = gCellHash < 0.5 ? G_STAR : G_PLUS;
        rc = mix(rc, WHITE, 0.5) * 1.25;
      } else if (dens < 0.26) {
        rsp = dens < 0.14 ? G_DOT : G_COLON;
      } else {
        float dg = dirGlyph(cross(N, hp).xy);
        rsp = (dg == G_DASH && dens > 0.7) ? G_EQ : dg;
      }
      if (inDisc) {
        col = mix(col, rc, ra);
        lum = mix(lum, rl, ra);
        sp = ra > 0.45 ? rsp : sp;
      } else {
        col = rc;
        lum = rl;
        sp = rsp;
      }
      cover = 1.0;
    }
  }

  // Atmospheric halo just outside the limb, brightest on the sunward side.
  if (!inDisc && cover < 0.5) {
    float d = sqrt(d2);
    float a = 1.0 - (d - r) / (0.10 * r);
    if (a > 0.0) {
      float sf = max(dot(l / d, normalize(L.xy)), 0.0);
      float g = a * a * (0.12 + 0.88 * sf) * 0.5;
      if (g > 0.05) {
        col = mix(ORCHID, CYAN, sf) * g * 1.6;
        lum = g * 0.8;
        cover = 1.0;
      }
    }
  }
}
`;

export const DREAMSCAPE_FRAG = buildSceneShader(BODY);
