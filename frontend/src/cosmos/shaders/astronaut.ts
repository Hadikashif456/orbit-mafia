import { buildSceneShader, hex3 } from './common';

/**
 * SCREEN 4 — EDGE OF EVERYTHING
 * After Design/ref1..5-screen4.jpg (chiefly ref1): an astronaut sits on the
 * lip of a rock ledge, legs dangling over a blue haze of stars, the Earth far
 * off. The legs swing slowly out of step, a hand shifts on the knee, the
 * chest rises with each breath and the helmet turns a little.
 *
 * The figure is built from simple solid shapes (capsules for limbs, a sphere
 * for the helmet, boxes for the pack) evaluated per character cell and shaded
 * as rounded forms, so it reads as a lit, three-dimensional suit.
 */
const BODY = `
const vec3 NAVY = ${hex3('#07162B')};
const vec3 STEEL = ${hex3('#2C5C86')};
const vec3 FOG = ${hex3('#5FA3C2')};
const vec3 PALE = ${hex3('#BFE3F2')};
const vec3 SUIT = ${hex3('#E4ECF5')};
const vec3 SUIT_SHADE = ${hex3('#3A5574')};
const vec3 STRAP = ${hex3('#2E63B0')};
const vec3 GLOVE = ${hex3('#59667A')};
const vec3 SOLE = ${hex3('#222B38')};
const vec3 PACK = ${hex3('#C9D3DF')};
const vec3 ROCK = ${hex3('#1C2836')};
const vec3 ROCK_LIT = ${hex3('#6F8CA6')};
const vec3 VISOR = ${hex3('#0A1430')};
const vec3 VISOR_BLUE = ${hex3('#2F6BFF')};
const vec3 VISOR_MAGENTA = ${hex3('#B44BD8')};
const vec3 VISOR_FIRE = ${hex3('#FF9A3C')};
const vec3 OCEAN = ${hex3('#1D5FB0')};
const vec3 LANDG = ${hex3('#3C8A4A')};
const vec3 WHITE = vec3(1.0, 0.99, 0.97);

const float D_FIGURE = 1.7;
// Soft light from the glowing haze on the left, slightly above.
const vec3 KEY = vec3(-0.66, 0.38, 0.65);

// The figure is authored in its own units; this places and sizes it.
float figScale() { return min(1.0, gAspect / 0.62); }
vec2 figBase() { return vec2(mix(-0.05, 0.14, smoothstep(0.7, 1.5, gAspect)), 0.03); }

// Distance to a capsule (a limb). u runs 0..1 along it, w -1..1 across it.
float sdCapsule(vec2 p, vec2 a, vec2 b, float r, out float u, out float w) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  u = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  w = dot(pa, normalize(vec2(-ba.y, ba.x))) / r;
  return length(pa - ba * u) - r;
}
float sdBox(vec2 p, vec2 c, vec2 half_, float ang, float round_, out vec2 local) {
  local = rot2(ang) * (p - c);
  vec2 q = abs(local) - half_ + round_;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - round_;
}

// Shade a rounded form. n is its surface normal, base its colour, crease a
// 0..1 fabric-wrinkle value. Writes into the running colour/luminance.
void shade(float d, vec3 n, vec3 base, float crease, float dim,
           inout vec3 col, inout float lum, inout float sp, inout float cover) {
  if (d > 0.0) return;
  float ndl = dot(n, KEY);
  float dif = smoothstep(-0.30, 0.80, ndl);
  float rim = pow(1.0 - n.z, 2.5) * smoothstep(-0.2, 0.6, dot(n.xy, normalize(vec2(-1.0, 0.4))));
  float v = (0.27 + 0.62 * dif * (0.70 + 0.30 * crease) + 0.30 * rim) * dim;
  // A dark contact line where this form ends, so overlapping parts separate.
  v *= mix(0.55, 1.0, smoothstep(0.0, 0.007, -d));
  col = mix(SUIT_SHADE * 0.8, base, smoothstep(0.10, 0.70, v)) * (0.32 + 0.88 * v);
  col += PALE * rim * 0.18 * dim;
  lum = clamp(0.06 + 0.86 * v + (gCellHash - 0.5) * 0.06, 0.04, 1.0);
  sp = 0.0;
  cover = 1.0;
}

vec3 limbNormal(float w, vec2 a, vec2 b) {
  vec2 nrm = normalize(vec2(-(b - a).y, (b - a).x));
  float cw = clamp(w, -1.0, 1.0);
  return vec3(nrm * cw, sqrt(max(0.0, 1.0 - cw * cw)));
}

// A limb of soft suit fabric, with optional coloured bands near its ends.
void limb(vec2 p, vec2 a, vec2 b, float r, float seed, float bandLo, float bandHi, float dim,
          inout vec3 col, inout float lum, inout float sp, inout float cover) {
  float u;
  float w;
  float d = sdCapsule(p, a, b, r, u, w);
  if (d > 0.0) return;
  float crease = 0.5 + 0.5 * sin(u * 34.0 + 3.0 * vnoise(vec2(u * 9.0, w * 2.0) + seed)) * (0.6 + 0.4 * vnoise(vec2(w * 3.0, u * 20.0) + seed));
  vec3 base = SUIT;
  if (u < bandLo || u > bandHi) base = STRAP;
  shade(d, limbNormal(w, a, b), base, crease, dim, col, lum, sp, cover);
}

// One leg: thigh along the ledge, shin hanging from the knee, boot.
void leg(vec2 p, vec2 hip, vec2 knee, float swing, float seed, float dim,
         inout vec3 col, inout float lum, inout float sp, inout float cover) {
  vec2 s = vec2(-sin(swing), -cos(swing));          // direction of the shin
  vec2 f = vec2(-cos(swing), sin(swing));           // direction the toes point
  vec2 ankle = knee + s * 0.205;
  limb(p, hip, knee, 0.056, seed, -1.0, 2.0, dim, col, lum, sp, cover);
  limb(p, knee, ankle, 0.050, seed + 3.0, 0.13, 0.90, dim, col, lum, sp, cover);
  // Boot: a short thick capsule, with a dark sole along its underside.
  vec2 heel = ankle + s * 0.022 - f * 0.012;
  vec2 toe = heel + f * 0.092;
  float u;
  float w;
  float d = sdCapsule(p, heel, toe, 0.046, u, w);
  if (d <= 0.0) {
    bool sole = dot(p - heel, s) > 0.020;
    shade(d, limbNormal(w, heel, toe), sole ? SOLE : PACK, 0.6, dim * (sole ? 0.8 : 1.0), col, lum, sp, cover);
  }
}

void addStar(float s, float h, inout vec3 col, inout float lum, inout float sp) {
  if (s < 0.06) return;
  vec3 tint = h < 0.7 ? WHITE : (h < 0.9 ? PALE : FOG);
  col = max(col, tint * (0.32 + 1.05 * s));
  lum = max(lum, s);
  sp = starGlyph(s);
}

void sceneFar(vec2 p, out vec3 col, out float lum, out float sp) {
  float t = uTime;
  col = vec3(0.0);
  lum = 0.0;
  sp = 0.0;

  // ---- A blue haze of gas and unresolved stars, brightest low on the left ----
  vec2 q = layerUV(p, 10.0);
  vec2 w = q * 1.5 + vec2(1.3, -2.2);
  vec2 fl = vec2(fbm(w + vec2(0.0, t * 0.008)), fbm(w + vec2(4.1, 2.7) - vec2(t * 0.006, 0.0)));
  vec2 w2 = w + 1.4 * (fl - 0.5);
  float n = fbm(w2 * 1.3 + 5.0);
  float glowSide = smoothstep(0.9, -0.7, q.x / max(gAspect * 0.5, 0.3)) * smoothstep(0.55, -0.35, q.y);
  float band = exp(-pow(dot(q - vec2(-0.1, 0.05), normalize(vec2(0.45, 0.89))) / 0.42, 2.0));
  float dens = clamp(smoothstep(0.30, 0.78, n * (0.55 + 0.55 * band + 0.55 * glowSide)), 0.0, 1.0);
  vec3 hc = mix(NAVY * 2.2, STEEL, smoothstep(0.05, 0.45, dens));
  hc = mix(hc, FOG, smoothstep(0.40, 0.80, dens));
  hc = mix(hc, PALE, smoothstep(0.78, 1.0, dens) * 0.7);
  if (gCellHash < 0.16 + dens * 1.25) {
    col = hc * (0.13 + 0.50 * dens);
    lum = dens * 0.40;
  }

  // ---- The Earth, small and far away -------------------------------------------
  float ax = gAspect / 1.78;
  vec2 el = layerUV(p, 9.0) - vec2(-0.60 * ax, -0.17);
  float er = 0.115;
  float ed = length(el);
  if (ed < er * 1.12) {
    if (ed < er) {
      vec3 en = vec3(el / er, sqrt(max(0.0, 1.0 - ed * ed / (er * er))));
      vec3 ep = en;
      ep.xz = rot2(t * 0.02) * ep.xz;
      float landv = smoothstep(0.50, 0.60, fbm3(ep * 2.6 + 3.0));
      float cloud = smoothstep(0.50, 0.72, fbm3(ep * vec3(4.0, 7.0, 4.0) + 1.0 + t * 0.004));
      vec3 surf = mix(OCEAN, LANDG, landv);
      surf = mix(surf, WHITE, cloud * 0.9);
      float day = smoothstep(-0.15, 0.6, dot(en, normalize(vec3(-0.6, 0.5, 0.62))));
      float rim = pow(1.0 - en.z, 3.0);
      vec3 ec = surf * (0.10 + 0.95 * day) + FOG * rim * (0.2 + 0.6 * day);
      float eL = (0.30 + 0.25 * landv + 0.45 * cloud) * (0.10 + 0.90 * day) + rim * 0.2;
      // Seen through the haze.
      col = mix(ec, col, 0.22 * dens);
      lum = clamp(mix(eL, lum, 0.22 * dens), 0.05, 1.0);
      sp = 0.0;
    } else {
      float a = 1.0 - (ed - er) / (0.12 * er);
      col = max(col, FOG * a * a * 0.55);
      lum = max(lum, a * a * 0.4);
    }
  }

  // ---- Stars, then slow drifting motes of dust catching the light ------------
  float sd = min(40.0, 0.30 / gCell.y);
  float veil = 1.0 - 0.45 * smoothstep(0.35, 0.8, lum);
  float h;
  float s;
  s = starField(p, 30.0, sd, 1.0, 0.62, vec2(0.0), h) * veil;
  addStar(s, h, col, lum, sp);
  s = starField(p, 16.0, sd * 0.66, 2.0, 0.50, vec2(0.0), h) * veil;
  addStar(s, h, col, lum, sp);
  float bsp;
  s = brightStar(p, 11.0, 7.0, 4.0, bsp, h);
  if (s > 0.05) {
    col = max(col, WHITE * (0.3 + s));
    lum = max(lum, s);
    sp = bsp;
  }
  s = starField(p, 2.6, sd * 0.42, 6.0, 0.40, vec2(t * 0.010, -t * 0.006), h);
  if (s > 0.06) {
    col = max(col, PALE * (0.45 + s));
    lum = max(lum, 0.3 + s * 0.5);
    sp = h < 0.6 ? G_DOT : G_STAR;
  }

  meteor(p, 31.0, 1.0, FOG, WHITE, col, lum, sp);
}

void sceneNear(vec2 p, out vec3 col, out float lum, out float sp, out float cover) {
  float t = uTime;
  col = vec3(0.0);
  lum = 0.0;
  sp = 0.0;
  cover = 0.0;

  // Position in the figure's own units.
  vec2 l = (layerUV(p, D_FIGURE) - figBase()) / figScale();

  // ---- The rock ledge: a wedge reaching in from the right ---------------------
  float xTip = -0.035;
  float top = -0.172 + 0.007 * (vnoise(vec2(l.x * 40.0, 1.0)) - 0.5);
  float under = -0.205 - (l.x - xTip) * 0.62 - 0.03 * vnoise(vec2(l.x * 12.0, 4.0));
  if (l.x > xTip && l.y < top && l.y > under) {
    float tex = fbm(l * vec2(16.0, 34.0) + 2.0);
    float strata = 0.5 + 0.5 * sin((l.y + l.x * 0.3) * 150.0 + tex * 6.0);
    float lip = smoothstep(0.030, 0.0, top - l.y);                 // lit top edge
    float face = smoothstep(0.05, 0.0, l.x - xTip) * 0.45;          // the cliff face
    float v = 0.20 + 0.34 * tex + 0.10 * strata + 0.50 * lip + face * (0.3 + 0.5 * tex);
    v *= mix(1.0, 0.55, smoothstep(0.0, 0.6, top - l.y));           // falls into shadow below
    col = mix(ROCK * 1.6, ROCK_LIT, smoothstep(0.20, 0.75, v)) * (0.45 + 0.95 * v);
    lum = clamp(0.05 + 0.80 * v + (gCellHash - 0.5) * 0.10, 0.04, 0.9);
    cover = 1.0;
  }

  // ---- The astronaut --------------------------------------------------------------
  float breath = sin(t * 0.8);
  float swingA = 0.10 + 0.20 * sin(t * 0.85);
  float swingB = 0.06 + 0.20 * sin(t * 0.85 + 2.2);
  vec2 hip = vec2(0.112, -0.105);
  vec2 knee = vec2(-0.105, -0.118);

  // Far leg first, dimmer: it is on the side away from the light.
  leg(l, hip + vec2(0.030, 0.012), knee + vec2(0.036, 0.012), swingB, 11.0, 0.62, col, lum, sp, cover);

  // Life-support pack on the back.
  vec2 pl;
  float dp = sdBox(l, vec2(0.258, 0.066), vec2(0.054, 0.128), -0.12, 0.018, pl);
  if (dp <= 0.0) {
    vec2 g = normalize(vec2(pl.x / 0.054, pl.y / 0.128) + 0.0001);
    float edge = smoothstep(0.0, 0.03, -dp);
    vec3 n = normalize(vec3(rot2(0.12) * g * (1.0 - edge), 0.35 + edge));
    vec3 base = PACK;
    float port = length(pl - vec2(-0.004, -0.045));
    if (port < 0.026) base = port < 0.017 ? SOLE : GLOVE;
    if (abs(pl.y - 0.040) < 0.004 || abs(pl.y + 0.085) < 0.004) base = GLOVE;
    shade(dp, n, base, 0.7, 0.85, col, lum, sp, cover);
  }

  // Torso, rising and falling a little with each breath.
  vec2 chest = vec2(0.156, 0.140 + 0.004 * breath);
  {
    float u;
    float w;
    float d = sdCapsule(l, vec2(0.122, -0.088), chest, 0.083, u, w);
    if (d <= 0.0) {
      float crease = 0.5 + 0.5 * sin(u * 26.0 + 4.0 * vnoise(vec2(u * 7.0, w * 2.0)));
      vec3 base = SUIT;
      if (abs(u - 0.50) < 0.035 || abs(w - 0.25 + (u - 0.5) * 0.9) < 0.07) base = STRAP;   // harness
      shade(d, limbNormal(w, vec2(0.122, -0.088), chest), base, crease, 1.0, col, lum, sp, cover);
    }
  }

  // Near leg.
  leg(l, hip, knee, swingA, 1.0, 1.0, col, lum, sp, cover);

  // Arm: the hand rests on the thigh and shifts now and then.
  vec2 shoulder = vec2(0.166, 0.136 + 0.004 * breath);
  vec2 elbow = vec2(0.086 + 0.006 * sin(t * 0.6), 0.016);
  vec2 hand = vec2(0.004 + 0.010 * sin(t * 0.45 + 1.0), -0.060 + 0.007 * sin(t * 0.6));
  limb(l, shoulder, elbow, 0.046, 21.0, -1.0, 2.0, 1.0, col, lum, sp, cover);
  limb(l, elbow, hand, 0.040, 24.0, -1.0, 0.82, 1.0, col, lum, sp, cover);
  {
    float gd = length(l - hand) - 0.036;
    if (gd <= 0.0) {
      vec2 gn = (l - hand) / 0.036;
      shade(gd, vec3(gn, sqrt(max(0.0, 1.0 - dot(gn, gn)))), GLOVE, 0.6, 1.0, col, lum, sp, cover);
    }
  }

  // Neck ring, then the helmet, turning very slightly.
  limb(l, vec2(0.090, 0.198), vec2(0.170, 0.194), 0.020, 31.0, -1.0, 2.0, 0.9, col, lum, sp, cover);
  float turn = sin(t * 0.27);
  vec2 hc = vec2(0.126, 0.266 + 0.003 * breath);
  float hr = 0.079;
  float hd = length(l - hc) - hr;
  if (hd <= 0.0) {
    vec2 hn = (l - hc) / hr;
    vec3 n = vec3(hn, sqrt(max(0.0, 1.0 - dot(hn, hn))));
    shade(hd, n, SUIT, 0.8, 1.0, col, lum, sp, cover);
    // Visor: a dark dome on the side the astronaut faces, mirroring the sky.
    vec2 vq = (l - hc - vec2(-0.022 - 0.006 * turn, 0.004)) / vec2(0.054, 0.058);
    float vd = dot(vq, vq);
    if (vd < 1.0 && (l.x - hc.x) < 0.034) {
      vec3 vc = mix(VISOR, VISOR_BLUE, smoothstep(0.9, 0.1, vd) * 0.75);
      vc = mix(vc, VISOR_MAGENTA, smoothstep(0.5, 0.0, length(vq - vec2(0.10, 0.20))) * 0.6);
      float fire = exp(-dot(vq - vec2(-0.20 - 0.10 * turn, 0.05), vq - vec2(-0.20 - 0.10 * turn, 0.05)) / 0.10);
      vc = mix(vc, VISOR_FIRE, fire);
      float arc = smoothstep(0.03, 0.0, abs(length(vq - vec2(0.30, -0.30)) - 0.95)) * step(vq.y, 0.2) * 0.5;
      vc = mix(vc, WHITE, arc);
      float rimV = smoothstep(0.80, 1.0, vd);
      col = mix(vc, GLOVE, rimV) * (0.75 + 0.35 * fire);
      lum = clamp(0.16 + 0.34 * (1.0 - vd) + 0.5 * fire + 0.4 * arc + 0.2 * rimV, 0.06, 1.0);
      sp = 0.0;
    }
  }
}
`;

export const ASTRONAUT_FRAG = buildSceneShader(BODY);
