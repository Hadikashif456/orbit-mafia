import { buildSceneShader, hex3 } from './common';

/**
 * SCREEN 2 — OBSIDIAN SOLARIS
 * Photographic treatment: pure luminance stipple with static film-like dither,
 * no brush strokes. Light comes from the eclipsed sun itself, so moving the
 * camera changes the eclipse and the planet's illumination together.
 */
const BODY = `
const vec3 OBSIDIAN = ${hex3('#020609')};
const vec3 OCEAN = ${hex3('#071A23')};
const vec3 TEAL = ${hex3('#12434B')};
const vec3 TURQ = ${hex3('#387F80')};
const vec3 COPPER = ${hex3('#A65D39')};
const vec3 GOLD = ${hex3('#D6A568')};
const vec3 CHAMPAGNE = ${hex3('#F4D6A3')};
const vec3 IVORY = ${hex3('#F4EEE3')};

const float D_PLANET = 1.45;
const float D_SUN = 30.0;
const float SUN_R = 0.044;

vec2 planetC() { return vec2(clamp(0.5 * gAspect - 0.60, 0.0, 0.6), -0.10); }
float planetR() { return 0.36 * clamp(gAspect / 1.3, 0.6, 1.0); }
// At rest the sun sits just past the upper-left limb: a partial eclipse.
vec2 sunP() { return planetC() + normalize(vec2(-0.58, 0.81)) * planetR() * 1.045; }
float sunPulse() { return 0.93 + 0.05 * sin(uTime * 0.31) + 0.02 * sin(uTime * 0.83 + 1.7); }

vec3 starTint(float h) {
  return h < 0.62 ? IVORY : (h < 0.86 ? GOLD : TURQ * 1.5);
}
void addStar(float s, float h, inout vec3 col, inout float lum, inout float sp) {
  if (s < 0.06) return;
  col = max(col, starTint(h) * (0.30 + 1.0 * s));
  lum = max(lum, s);
  sp = starGlyph(s);
}

float ringProfile(float x) {
  float d = 0.0;
  d += 0.30 * smoothstep(1.20, 1.30, x) * smoothstep(1.52, 1.47, x);
  d += 1.00 * smoothstep(1.50, 1.55, x) * smoothstep(1.97, 1.94, x);
  d += 0.74 * smoothstep(2.02, 2.04, x) * smoothstep(2.31, 2.28, x);
  d *= 1.0 - 0.85 * smoothstep(0.012, 0.0, abs(x - 2.20));
  d *= 1.0 - 0.5 * smoothstep(0.010, 0.0, abs(x - 1.72));
  d += 0.60 * smoothstep(0.013, 0.0, abs(x - 2.40));
  float ringlets = 0.5 + 0.5 * sin(x * 150.0 + 3.0 * vnoise(vec2(x * 30.0, 1.0)));
  float fine = vnoise(vec2(x * 110.0, 3.7));
  float finer = vnoise(vec2(x * 380.0, 9.1));
  return d * (0.45 + 0.30 * fine + 0.25 * ringlets) * (0.78 + 0.22 * finer);
}

vec3 ringColor(float rho, float grain) {
  vec3 c = mix(TURQ * 0.75, COPPER, smoothstep(1.25, 1.5, rho));
  c = mix(c, GOLD, smoothstep(1.5, 1.68, rho));
  c = mix(c, CHAMPAGNE, smoothstep(1.7, 1.86, rho) * smoothstep(1.98, 1.9, rho));
  c = mix(c, COPPER * 1.1, smoothstep(2.02, 2.12, rho) * 0.75);
  c = mix(c, GOLD, smoothstep(2.2, 2.3, rho) * 0.8);
  c = mix(c, CHAMPAGNE, smoothstep(2.36, 2.4, rho));
  return mix(c, IVORY, smoothstep(0.7, 1.0, grain) * 0.75);
}

// A faint, far-off spiral galaxy.
float tinyGalaxy(vec2 q, vec2 c, float ang, float size, float incl) {
  vec2 g = rot2(ang) * (q - c);
  g.y /= incl;
  float r = length(g) / size;
  if (r > 1.7) return 0.0;
  float arm = 0.5 + 0.5 * cos(2.0 * atan(g.y, g.x) - 6.0 * log(r + 0.05));
  return exp(-r * 3.2) * (0.45 + 0.95 * arm) + exp(-r * r * 40.0) * 0.8;
}

void sceneFar(vec2 p, out vec3 col, out float lum, out float sp) {
  float t = uTime;
  col = vec3(0.0);
  lum = 0.0;
  sp = 0.0;

  vec2 sl = layerUV(p, D_SUN) - sunP();
  float ds = length(sl);
  float pulse = sunPulse();

  // ---- Teal nebula filaments and dark dust --------------------------------
  vec2 q = layerUV(p, 12.0);
  vec2 w = q * 1.3 + vec2(-2.3, 4.1);
  vec2 wr = vec2(fbm(w * 1.1 + vec2(0.0, t * 0.006)), fbm(w * 1.1 + vec2(3.7, 8.1) + vec2(t * 0.005, 0.0)));
  vec2 w2 = w + 1.9 * (wr - 0.5);
  float f1 = fbm(w2 * 1.6);
  float rid = pow(1.0 - abs(2.0 * fbm(w2 * 2.3 + 5.5) - 1.0), 3.0);
  float mask = smoothstep(0.47, 0.76, fbm(q * 0.9 + vec2(7.7, 1.2)));
  float dens = mask * (0.45 * smoothstep(0.40, 0.80, f1) + 0.75 * rid);
  float dust = smoothstep(0.52, 0.72, fbm(q * 1.7 + vec2(-4.0, 2.5) + (wr - 0.5) * 0.6));
  dens *= 1.0 - 0.78 * dust;
  dens = clamp(dens, 0.0, 1.0);
  // The sun lights nearby gas and warms its colour.
  float illum = 1.0 + 2.4 * exp(-ds * 3.2) * pulse;
  vec3 nc = mix(OCEAN * 2.2, TEAL * 1.5, smoothstep(0.05, 0.4, dens));
  nc = mix(nc, TURQ, smoothstep(0.35, 0.9, dens));
  nc = mix(nc, GOLD, exp(-ds * 4.5) * 0.65);
  col = nc * (0.25 + 0.75 * dens) * smoothstep(0.02, 0.2, dens) * illum;
  lum = clamp(dens * 0.42 * (0.7 + 0.3 * illum), 0.0, 0.8);
  // Stipple: thin gas leaves most cells empty, like grain in a long exposure.
  float h2 = hash21(gl_FragCoord.xy * 1.7 + 3.3);
  float present = step(gCellHash, 0.16 + dens * 1.25);
  col *= present;
  lum *= present;

  // ---- Distant galaxies ---------------------------------------------------
  float ax = gAspect / 1.78;
  vec2 qg = layerUV(p, 22.0);
  float tg = tinyGalaxy(qg, vec2(-0.62 * ax, -0.24), 0.5, 0.060, 0.45)
           + tinyGalaxy(qg, vec2(-0.30 * ax, 0.36), -0.7, 0.036, 0.55) * 0.8
           + tinyGalaxy(qg, vec2(0.66 * ax, 0.40), 1.1, 0.030, 0.35) * 0.7;
  tg *= 1.0 - 0.6 * dust;
  if (tg > 0.03) {
    float a = clamp(tg * 1.4, 0.0, 1.0);
    col = mix(col, mix(TURQ, CHAMPAGNE, smoothstep(0.2, 0.9, tg)) * (0.3 + 0.8 * min(tg, 1.0)), a);
    lum = mix(lum, 0.1 + 0.8 * min(tg, 1.0), a);
  }

  // Static film-like dither: gives the stippled, photographic grain.
  lum = clamp(lum + (h2 - 0.5) * 0.14 * smoothstep(0.02, 0.15, lum), 0.0, 1.0);

  // ---- Stars: dust lanes hide them ----------------------------------------
  float sd = min(40.0, 0.30 / gCell.y);
  float veil = (1.0 - 0.85 * dust) * (1.0 - 0.7 * smoothstep(0.3, 0.8, lum));
  float h;
  float s;
  s = starField(p, 26.0, sd, 1.0, 0.50, vec2(0.0), h) * veil;
  addStar(s, h, col, lum, sp);
  s = starField(p, 14.0, sd * 0.66, 2.0, 0.42, vec2(0.0), h) * veil;
  addStar(s, h, col, lum, sp);
  s = starField(p, 7.0, sd * 0.4, 3.0, 0.36, vec2(0.0), h) * veil;
  addStar(s, h, col, lum, sp);
  float bsp;
  s = brightStar(p, 9.0, 7.0, 4.0, bsp, h) * (1.0 - 0.7 * dust);
  if (s > 0.05) {
    col = max(col, starTint(h) * (0.3 + s));
    lum = max(lum, s);
    sp = bsp;
  }

  // ---- The sun: disc, streaming corona, six-point diffraction -------------
  vec2 dn = sl / max(ds, 0.0001);
  float streak = fbm(dn * 2.6 + vec2(t * 0.012, 0.0));
  float streak2 = fbm(dn * 7.0 + vec2(3.0, -t * 0.02));
  float cor = pow(SUN_R / max(ds, SUN_R), 1.05) * (0.30 + 2.6 * streak * streak2) * pulse;
  cor *= smoothstep(0.85, 0.05, ds);
  // Outer corona thins into scattered grains rather than a solid disc.
  cor *= step(gCellHash, 0.12 + cor * 3.2);
  if (cor > 0.03) {
    float ca = clamp(cor * 1.6, 0.0, 1.0);
    vec3 cc = mix(COPPER, GOLD, smoothstep(0.04, 0.25, cor));
    cc = mix(cc, CHAMPAGNE, smoothstep(0.2, 0.55, cor));
    cc = mix(cc, IVORY, smoothstep(0.5, 0.95, cor));
    col = mix(col, cc * (0.25 + 0.9 * min(cor, 1.0)), ca);
    lum = mix(lum, clamp(cor, 0.0, 1.0) * 0.92, ca);
    sp = ca > 0.35 ? 0.0 : sp;
  }
  for (int k = 0; k < 3; k++) {
    float ang = float(k) * PI / 3.0;
    vec2 dv = vec2(cos(ang), sin(ang));
    float along = abs(dot(sl, dv));
    float perp = abs(dot(sl, vec2(-dv.y, dv.x)));
    float halfW = (k == 0 ? gCell.y : gCell.x) * 0.5 / uZoom;
    if (perp < halfW && along < 0.46 && ds > SUN_R) {
      float I = 0.85 / (1.0 + along * 16.0) * pulse * smoothstep(0.46, 0.2, along);
      if (I > lum * 0.8 && I > 0.05) {
        col = mix(GOLD, IVORY, I) * (0.3 + I);
        lum = I;
        sp = k == 0 ? G_DASH : (k == 1 ? G_SLASH : G_BSLASH);
      }
    }
  }
  if (ds < SUN_R) {
    col = IVORY;
    lum = 1.0;
    sp = G_AT;
  }

  meteor(p, 37.0, 1.0, GOLD, IVORY, col, lum, sp);
}

void sceneNear(vec2 p, out vec3 col, out float lum, out float sp, out float cover) {
  col = vec3(0.0);
  lum = 0.0;
  sp = 0.0;
  cover = 0.0;

  vec2 c = planetC();
  float r = planetR();
  vec2 l = layerUV(p, D_PLANET) - c;

  // Light direction comes from where the sun actually appears on screen.
  vec2 sunS = screenOf(sunP(), D_SUN);
  vec2 dir2 = normalize(sunS - screenOf(c, D_PLANET));
  vec3 L = normalize(vec3(dir2 * 0.93, 0.36));
  float pulse = sunPulse();
  float dSun = length(p - sunS);

  float roll = 0.40;
  float B = 0.25;
  vec3 N = normalize(vec3(sin(roll) * cos(B), cos(roll) * cos(B), sin(B)));
  vec3 ex = normalize(vec3(N.y, -N.x, 0.0));
  vec3 ez = cross(ex, N);

  float d2 = dot(l, l);
  bool inDisc = d2 < r * r;
  float zs = inDisc ? sqrt(r * r - d2) : 0.0;
  float hz = -(N.x * l.x + N.y * l.y) / N.z;
  vec3 hp = vec3(l, hz);
  float rho = length(hp) / r;
  bool ringVisible = !(inDisc && hz < zs);

  // ---- The planet ---------------------------------------------------------
  if (inDisc) {
    vec3 n = vec3(l, zs) / r;
    vec3 ps0 = vec3(dot(n, ex), dot(n, N), dot(n, ez));
    float a = uTime * 0.022;
    vec3 ps = vec3(ps0.x * cos(a) + ps0.z * sin(a), ps0.y, -ps0.x * sin(a) + ps0.z * cos(a));
    float evo = uTime * 0.004;
    float warp = fbm3(ps * vec3(1.8, 4.5, 1.8) + vec3(0.0, evo, 0.0));
    float lat = ps.y;
    float fine = fbm3(ps * vec3(5.0, 30.0, 5.0) + vec3(evo * 2.0, 0.0, 0.0));
    float tex = 0.5 + 0.33 * sin(lat * 11.0 + (warp - 0.5) * 2.4)
                    + 0.16 * sin(lat * 29.0 + (warp - 0.5) * 4.5 + 0.7)
                    + (fine - 0.5) * 0.50;
    tex = clamp(tex, 0.0, 1.0);

    float ndl = dot(n, L);
    float dif = smoothstep(-0.08, 0.85, ndl);
    float limb = 0.40 + 0.60 * pow(max(n.z, 0.0), 0.6);
    float rs = 1.0;
    float tt = -dot(n * r, N) / dot(L, N);
    if (tt > 0.0) {
      vec3 qh = n * r + tt * L;
      rs = 1.0 - 0.75 * ringProfile(length(qh) / r);
    }
    // Forward scattering: a thin bright arc along the limb nearest the sun.
    float sunProx = pow(max(dot(normalize(l), dir2), 0.0), 3.0);
    float scatter = pow(1.0 - n.z, 4.0) * (0.22 + 1.7 * sunProx) * smoothstep(-0.4, 0.2, ndl) * pulse;
    // Night side: faint ring-shine plus a hairline of back-scatter round the
    // whole limb, so the dark hemisphere still reads as a sphere.
    float outline = pow(1.0 - n.z, 6.0) * 0.26;
    float amb = 0.075 * (0.45 + tex) + outline;
    float lu = dif * limb * rs * (0.18 + 0.82 * tex) * 0.92 * pulse + scatter * 0.8 + amb;

    vec3 pc = mix(COPPER * 0.8, GOLD, smoothstep(0.25, 0.7, tex));
    pc = mix(pc, CHAMPAGNE, smoothstep(0.65, 1.0, tex) * 0.8);
    pc = mix(pc, TURQ * 0.9, smoothstep(0.55, 0.95, abs(lat)) * 0.6);
    vec3 night = mix(TEAL * 1.3, TURQ * 1.1, tex);
    vec3 sc3 = mix(night, pc, smoothstep(0.04, 0.4, lu));
    sc3 = mix(sc3, mix(TURQ * 1.4, IVORY, sunProx), clamp(scatter + outline * 1.6, 0.0, 1.0));
    col = sc3 * (0.30 + 1.0 * lu);
    // Solar bloom spilling over the limb.
    float bloom = exp(-dSun * 13.0) * pulse;
    col += CHAMPAGNE * bloom * 0.55;
    lum = clamp(pow(lu, 1.2) + bloom * 0.5 + (gCellHash - 0.5) * 0.16, 0.07, 1.0);
    cover = 1.0;
  }

  // ---- Rings: stippled grains on Keplerian orbits -------------------------
  if (rho > 1.18 && rho < 2.46 && ringVisible) {
    float dens = ringProfile(rho);
    float phi = atan(dot(hp, ez), dot(hp, ex));
    float idr = floor(rho * 110.0);
    float M = 420.0;
    float om = 0.045 * pow(rho, -1.5);
    float gx = (phi / TAU + 0.5) * M + uTime * om * M / TAU + hash11(idr) * M;
    float grain = pow(pnoise1(gx, M, idr), 1.5);
    float hb = dot(hp, L);
    float sh = hb < 0.0 ? smoothstep(r * 0.84, r * 1.03, length(hp - hb * L)) : 1.0;
    float glint = 1.0 + 1.6 * exp(-dSun * 5.0) * pulse;
    float rb = dens * (0.30 + 0.70 * grain) * mix(0.07, 1.0, sh) * glint;
    float ra = clamp(dens * 1.5, 0.0, 1.0);
    if (ra > 0.05) {
      vec3 rc = ringColor(rho, grain) * (0.22 + 1.0 * min(rb, 1.2));
      // Dense ringlets are drawn as fine lines along the orbit; thin dust
      // between them is stippled, so the gaps stay visible.
      float rl = clamp(0.05 + 0.42 * rb + (gCellHash - 0.5) * 0.10, 0.03, 0.5);
      float rsp = 0.0;
      if (grain > 0.82 && sh > 0.5 && dens > 0.25) {
        rsp = G_STAR;
        rc = mix(rc, IVORY, 0.6) * 1.3;
      } else if (dens > 0.42) {
        float dg = dirGlyph(cross(N, hp).xy);
        rsp = (dg == G_DASH && dens > 0.66) ? G_EQ : dg;
      } else if (gCellHash > 0.25 + dens * 1.6) {
        ra = 0.0;
      }
      if (ra > 0.05) {
        if (inDisc) {
          col = mix(col, rc, ra);
          lum = mix(lum, rl, ra);
          sp = ra > 0.4 ? rsp : 0.0;
        } else {
          col = rc;
          lum = rl;
          sp = rsp;
        }
        cover = 1.0;
      }
    }
  }

  // ---- Thin scattering halo outside the limb ------------------------------
  if (!inDisc && cover < 0.5) {
    float d = sqrt(d2);
    float a = 1.0 - (d - r) / (0.055 * r);
    if (a > 0.0) {
      float sunProx = pow(max(dot(l / d, dir2), 0.0), 3.0);
      float g = a * a * (0.10 + 1.3 * sunProx) * pulse;
      if (g > 0.06) {
        col = mix(TEAL * 2.0, IVORY, sunProx) * min(g, 1.0);
        lum = min(g, 1.0) * 0.8;
        cover = 1.0;
      }
    }
  }

  // ---- Dark rocky moons on Keplerian orbits in the ring plane -------------
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float rhoM = i == 0 ? 2.72 : (i == 1 ? 3.25 : 3.9);
    float ph0 = i == 0 ? 2.8 : (i == 1 ? 3.7 : 4.3);
    float ph = ph0 + uTime * 0.11 * pow(rhoM, -1.5);
    vec3 m = r * rhoM * (cos(ph) * ex + sin(ph) * ez);
    float rm = r * (0.135 - fi * 0.034);
    vec2 ml = l - m.xy;
    float md = length(ml);
    if (md > rm * 1.2) continue;
    float rmE = rm * (0.86 + 0.28 * vnoise(ml / max(md, 0.0001) * 1.7 + fi * 9.0));
    if (md > rmE) continue;
    if (inDisc && m.z < zs) continue;   // behind the planet
    vec3 nm = vec3(ml / rmE, sqrt(max(0.0, 1.0 - md * md / (rmE * rmE))));
    float bump = fbm3(nm * 3.5 + fi * 11.3);
    float crater = smoothstep(0.55, 0.72, fbm3(nm * 7.0 + fi * 5.1));
    vec3 nb = normalize(nm + vec3(bump - 0.5, crater - 0.3, 0.0) * 0.7);
    float mb = dot(m, L);
    float msh = mb < 0.0 ? smoothstep(r * 0.9, r * 1.05, length(m - mb * L)) : 1.0;
    float lu = max(dot(nb, L), 0.0) * (0.40 + 0.60 * bump) * (1.0 - 0.5 * crater) * mix(0.06, 1.0, msh) * pulse + 0.035;
    vec3 rock = mix(COPPER * 0.55, CHAMPAGNE * 0.8, bump);
    col = mix(OCEAN * 1.8, rock, smoothstep(0.03, 0.45, lu)) * (0.2 + 1.0 * lu);
    lum = clamp(lu + (gCellHash - 0.5) * 0.12, 0.08, 1.0);
    sp = 0.0;
    cover = 1.0;
  }
}
`;

export const SOLARIS_FRAG = buildSceneShader(BODY);
