import { buildSceneShader, hex3 } from './common';

/**
 * SCREEN 5 — THE WATCHER
 * After Design/ref-1..3-screen5.jpg: a realistic Earth that slowly opens along
 * its equator like a pair of eyelids, revealing an eye with an Earth-blue
 * iris, then closes again. A spiral galaxy turns behind it; the Moon hangs
 * to one side. The eye looks toward the pointer.
 */

/**
 * A coarse map of the real continents: 24 rows of latitude (north to south)
 * by 48 columns of longitude (180°W to 180°E), 7.5° per cell. Each entry lists
 * the land runs in that row as [firstColumn, lastColumn]. The shader smooths
 * this and roughens the coasts with noise.
 */
const LAND_ROWS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [],
  [[12, 21], [26, 26]],
  [[0, 0], [2, 5], [8, 14], [17, 20], [27, 28], [32, 47]],
  [[0, 0], [2, 11], [14, 15], [17, 18], [21, 21], [25, 47]],
  [[4, 11], [14, 15], [23, 23], [25, 45]],
  [[7, 16], [23, 43]],
  [[7, 14], [23, 42]],
  [[8, 13], [23, 25], [29, 39], [41, 42]],
  [[9, 10], [13, 13], [22, 40]],
  [[10, 12], [13, 14], [22, 28], [30, 31], [34, 35], [37, 38], [40, 40]],
  [[12, 12], [14, 15], [22, 30], [34, 34], [37, 38], [40, 40]],
  [[14, 17], [23, 30], [37, 39]],
  [[13, 19], [25, 29], [37, 40], [42, 43]],
  [[14, 18], [26, 29], [38, 38], [41, 43]],
  [[15, 18], [26, 28], [30, 30], [40, 43]],
  [[15, 17], [26, 28], [30, 30], [39, 44]],
  [[14, 16], [26, 27], [39, 40], [42, 43]],
  [[14, 15], [43, 43], [47, 47]],
  [[14, 15], [46, 46]],
  [[15, 15]],
  [[15, 16], [30, 43]],
  [[4, 15], [22, 44]],
  [[0, 47]],
  [[0, 47]],
];

/** Pack each row into two 24-bit words (columns 0-23, then 24-47). */
const LAND_WORDS: string = LAND_ROWS.flatMap((runs) => {
  let west = 0;
  let east = 0;
  for (const [from, to] of runs) {
    for (let col = from; col <= to; col++) {
      if (col < 24) west |= 1 << col;
      else east |= 1 << (col - 24);
    }
  }
  return [`${west >>> 0}u`, `${east >>> 0}u`];
}).join(', ');

const BODY = `
const vec3 DEEP = ${hex3('#0A2A66')};
const vec3 SEA = ${hex3('#1D6BB8')};
const vec3 SHALLOW = ${hex3('#3FA7D6')};
const vec3 FOREST = ${hex3('#2E7D3C')};
const vec3 JUNGLE = ${hex3('#1E5E2F')};
const vec3 DESERT = ${hex3('#CFAE72')};
const vec3 ROCK = ${hex3('#7C6B4E')};
const vec3 ICE = ${hex3('#F1F6FB')};
const vec3 AIR = ${hex3('#5FA8FF')};
const vec3 NIGHT = ${hex3('#050B1E')};
const vec3 SCLERA = ${hex3('#F4EDE4')};
const vec3 VEIN = ${hex3('#C2282E')};
const vec3 LIDEDGE = ${hex3('#D8B98C')};
const vec3 IRIS_IN = ${hex3('#7FD0F5')};
const vec3 IRIS_MID = ${hex3('#1E6FD0')};
const vec3 IRIS_OUT = ${hex3('#0A1F4D')};
const vec3 AMBER = ${hex3('#D9A441')};
const vec3 ARM_BLUE = ${hex3('#8FA9FF')};
const vec3 ARM_PINK = ${hex3('#E7A6D8')};
const vec3 ARM_GOLD = ${hex3('#FFE2A8')};
const vec3 MOON = ${hex3('#CFCBC2')};
const vec3 WHITE = vec3(1.0, 0.98, 0.96);

const uint LAND[48] = uint[48](${LAND_WORDS});

const float D_EARTH = 2.2;
const vec3 SUN = vec3(-0.50, 0.45, 0.74);
vec2 earthC() { return vec2(0.0, 0.01); }
float earthR() { return min(0.36, 0.46 * gAspect); }

// 0 = shut, 1 = wide open. One slow open-and-close every ten seconds, with a
// single quick blink while open.
float eyeOpen() {
  float c = mod(uTime, 10.0);
  float o = smoothstep(1.0, 3.4, c) * (1.0 - smoothstep(8.0, 9.8, c));
  float blink = exp(-pow((c - 5.7) / 0.13, 2.0));
  return o * (1.0 - 0.9 * blink);
}

float landCell(int col, int row) {
  col = ((col % 48) + 48) % 48;
  row = clamp(row, 0, 23);
  uint word = LAND[row * 2 + (col >= 24 ? 1 : 0)];
  return float((word >> uint(col >= 24 ? col - 24 : col)) & 1u);
}

// Smoothed land value at a longitude / latitude (radians).
float landMap(float lon, float lat) {
  float u = (lon / TAU + 0.5) * 48.0 - 0.5;
  float v = (0.5 - lat / PI) * 24.0 - 0.5;
  int iu = int(floor(u));
  int iv = int(floor(v));
  vec2 f = vec2(u - floor(u), v - floor(v));
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(landCell(iu, iv), landCell(iu + 1, iv), f.x),
             mix(landCell(iu, iv + 1), landCell(iu + 1, iv + 1), f.x), f.y);
}

// The Earth's surface at a point on the unit sphere (view space).
void earthSurface(vec3 n, vec3 nLight, out vec3 col, out float lum, out float sp) {
  // Axial tilt, then a slow spin. Starts facing the Atlantic.
  vec3 ps = n;
  ps.xy = rot2(0.30) * ps.xy;
  float lat = asin(clamp(ps.y, -1.0, 1.0));
  float lon = atan(ps.x, ps.z) - 0.35 + uTime * 0.03;
  lon = mod(lon + PI, TAU) - PI;
  // Noise is sampled in the planet's own frame so it turns with the land.
  vec3 pe = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));

  float m = landMap(lon, lat);
  float coast = m + (fbm3(pe * 6.0) - 0.5) * 0.45 + (fbm3(pe * 17.0 + 4.0) - 0.5) * 0.18;
  float land = smoothstep(0.46, 0.56, coast);
  float alat = abs(lat);

  // Oceans: deep blue, paler on the continental shelves.
  vec3 sea = mix(DEEP, SEA, smoothstep(0.10, 0.40, coast));
  sea = mix(sea, SHALLOW, smoothstep(0.36, 0.48, coast) * 0.7);

  // Land: jungle at the equator, desert in the dry belts, forest, then tundra.
  float dry = fbm3(pe * 4.0 + 9.0);
  float relief = fbm3(pe * 22.0 + 2.0);
  vec3 ground = mix(JUNGLE, FOREST, smoothstep(0.05, 0.45, alat));
  float belt = smoothstep(0.20, 0.32, alat) * smoothstep(0.62, 0.48, alat);
  ground = mix(ground, DESERT, belt * smoothstep(0.38, 0.62, dry));
  ground = mix(ground, ROCK, smoothstep(0.58, 0.80, relief) * 0.7);
  ground = mix(ground, ROCK * 1.1, smoothstep(0.95, 1.12, alat));
  float ice = smoothstep(1.16, 1.26, alat + (relief - 0.5) * 0.12);
  ground = mix(ground, ICE, ice);
  sea = mix(sea, ICE, smoothstep(1.34, 1.42, alat));

  vec3 surf = mix(sea, ground, land);
  float bright = mix(0.30, 0.52 + 0.18 * relief, land);
  bright = mix(bright, 0.95, max(ice * land, smoothstep(1.34, 1.42, alat)));

  // Clouds: swirling weather systems drifting a little faster than the ground.
  vec3 pc = pe;
  pc.xz = rot2(uTime * 0.008) * pc.xz;
  float swirl = fbm3(pc * 3.0 + 1.0);
  float cl = fbm3(pc * vec3(5.0, 8.0, 5.0) + swirl * 2.2 + vec3(0.0, uTime * 0.004, 0.0));
  float cloud = smoothstep(0.52, 0.74, cl) * (0.75 + 0.25 * fbm3(pc * 20.0));
  surf = mix(surf, WHITE, cloud * 0.92);
  bright = mix(bright, 1.0, cloud * 0.9);

  // Sunlight, a soft terminator, a glint on open water, and blue air at the limb.
  float ndl = dot(nLight, SUN);
  float day = smoothstep(-0.18, 0.55, ndl);
  float spec = pow(max(dot(reflect(-SUN, nLight), vec3(0.0, 0.0, 1.0)), 0.0), 26.0) * (1.0 - land) * (1.0 - cloud);
  float rim = pow(1.0 - nLight.z, 3.0);
  col = mix(NIGHT * (1.0 + 2.0 * land), surf, day) * (0.36 + 0.95 * day * (0.60 + 0.40 * nLight.z));
  col += WHITE * spec * 0.6;
  col = mix(col, AIR, clamp(rim * (0.35 + 0.65 * day), 0.0, 1.0) * 0.75);
  lum = clamp(bright * (0.10 + 0.90 * day) + spec * 0.5 + rim * 0.25 + (gCellHash - 0.5) * 0.10, 0.05, 1.0);
  // A few wave strokes on open, sunlit water.
  sp = (land < 0.2 && cloud < 0.15 && day > 0.5 && gCellHash < 0.10) ? G_TILDE : 0.0;
}

void addStar(float s, float h, inout vec3 col, inout float lum, inout float sp) {
  if (s < 0.06) return;
  vec3 tint = h < 0.6 ? WHITE : (h < 0.8 ? ARM_BLUE : (h < 0.92 ? ARM_GOLD : ARM_PINK));
  col = max(col, tint * (0.32 + 1.05 * s));
  lum = max(lum, s);
  sp = starGlyph(s);
}

void sceneFar(vec2 p, out vec3 col, out float lum, out float sp) {
  float t = uTime;
  col = vec3(0.0);
  lum = 0.0;
  sp = 0.0;

  // ---- A face-on spiral galaxy behind the planet, so the Earth is its eye ----
  vec2 g = layerUV(p, 7.0) - earthC();
  g.y /= 0.86;
  float gr = length(g) / 0.80;
  float th = atan(g.y, g.x);
  float wob = (fbm(g * 2.4 + 4.0) - 0.5) * 1.1;
  float sw = 2.0 * th - 5.0 * log(gr + 0.05) - t * 0.035 + wob;
  float arm = pow(0.5 + 0.5 * cos(sw), 2.6);
  float gtex = fbm(g * 7.0 + vec2(2.0, 5.0));
  float fall = exp(-gr * 2.1) * smoothstep(1.25, 0.55, gr);
  float gal = fall * (0.06 + 2.1 * arm * (0.40 + 0.9 * gtex));
  float gl = clamp(gal, 0.0, 1.0);
  if (gl > 0.02 && gCellHash < 0.20 + gl * 2.6) {
    vec3 gc = mix(ARM_BLUE, ARM_PINK, smoothstep(0.35, 0.70, gtex));
    gc = mix(gc, ARM_GOLD, smoothstep(0.55, 0.15, gr) * 0.8);
    col = gc * (0.25 + 0.75 * gl);
    lum = 0.08 + 0.70 * gl;
    if (gCellHash < 0.07) sp = dirGlyph(vec2(-g.y, g.x));
  }

  // ---- Stars ---------------------------------------------------------------
  float sd = min(40.0, 0.30 / gCell.y);
  float veil = 1.0 - 0.6 * smoothstep(0.3, 0.8, lum);
  float h;
  float s;
  s = starField(p, 26.0, sd, 1.0, 0.52, vec2(0.0), h) * veil;
  addStar(s, h, col, lum, sp);
  s = starField(p, 14.0, sd * 0.66, 2.0, 0.44, vec2(0.0), h) * veil;
  addStar(s, h, col, lum, sp);
  float bsp;
  s = brightStar(p, 10.0, 8.0, 4.0, bsp, h);
  if (s > 0.05) {
    col = max(col, mix(WHITE, ARM_GOLD, step(0.7, h)) * (0.3 + s));
    lum = max(lum, s);
    sp = bsp;
  }

  // ---- The Moon ---------------------------------------------------------------
  float ax = gAspect / 1.78;
  vec2 ml = layerUV(p, 4.5) - vec2(0.66 * ax, -0.12);
  float mr = 0.045;
  float md = length(ml);
  if (md < mr) {
    vec3 mn = vec3(ml / mr, sqrt(max(0.0, 1.0 - md * md / (mr * mr))));
    float maria = smoothstep(0.48, 0.62, fbm3(mn * 2.4 + 4.0));
    float crater = fbm3(mn * 9.0 + 1.0);
    float mday = smoothstep(-0.15, 0.6, dot(mn, SUN));
    float ml2 = mday * (0.55 + 0.45 * crater) * (1.0 - 0.4 * maria);
    col = MOON * (0.12 + 0.95 * ml2);
    lum = clamp(0.06 + 0.85 * ml2, 0.05, 1.0);
    sp = 0.0;
  }

  meteor(p, 27.0, 1.0, ARM_BLUE, WHITE, col, lum, sp);
}

void sceneNear(vec2 p, out vec3 col, out float lum, out float sp, out float cover) {
  col = vec3(0.0);
  lum = 0.0;
  sp = 0.0;
  cover = 0.0;

  float R = earthR();
  vec2 l = layerUV(p, D_EARTH) - earthC();
  float d = length(l);

  // ---- Thin blue atmosphere outside the limb ---------------------------------
  if (d > R) {
    float a = 1.0 - (d - R) / (0.07 * R);
    if (a <= 0.0) return;
    float day = smoothstep(-0.4, 0.5, dot(normalize(vec3(l / d, 0.0)), SUN));
    float g = a * a * (0.20 + 0.80 * day) * 0.6;
    if (g < 0.05 || gCellHash > 0.25 + g * 2.5) return;
    col = AIR * g * 1.5;
    lum = g * 0.8;
    cover = 1.0;
    return;
  }

  // Work in the planet's own units (radius 1), tilted a touch for character.
  vec2 e = rot2(-0.07) * (l / R);
  float x = e.x;
  float y = e.y;
  vec3 n = vec3(l / R, sqrt(max(0.0, 1.0 - d * d / (R * R))));

  // ---- Eyelids: the planet's two hemispheres draw apart ----------------------
  float open = eyeOpen();
  const float W = 0.88;
  float span = pow(clamp(1.0 - (x / W) * (x / W), 0.0, 1.0), 0.75);
  float yu = open * 0.46 * span;             // upper lid edge
  float ylo = -open * 0.34 * span;           // lower lid edge
  bool inEye = open > 0.012 && abs(x) < W && y < yu && y > ylo;

  if (!inEye) {
    // The surface gathers toward the pole as its lid retracts: squeeze the
    // texture of each hemisphere into the part still showing.
    float edge = sqrt(max(0.0001, 1.0 - x * x));
    float ys = y;
    if (y >= 0.0) {
      ys = (y - yu) / max(edge - yu, 0.0001) * edge;
    } else {
      ys = -((-y + ylo) / max(edge + ylo, 0.0001) * edge);
    }
    vec2 es = rot2(0.07) * vec2(x, clamp(ys, -edge, edge));
    vec3 ns = vec3(es, sqrt(max(0.0, 1.0 - dot(es, es))));
    earthSurface(ns, n, col, lum, sp);
    // A soft crease where the lids meet or part.
    float seam = (y >= 0.0 ? y - yu : ylo - y);
    float crease = smoothstep(0.045, 0.0, seam) * smoothstep(0.0, 0.25, open) * step(abs(x), W);
    col *= 1.0 - 0.6 * crease;
    lum *= 1.0 - 0.5 * crease;
    cover = 1.0;
    return;
  }

  // ---- The eye -----------------------------------------------------------------
  // It looks toward the pointer (and wherever the camera drifts).
  vec2 gaze = clamp(uCam.xy * 7.0, -1.0, 1.0) * vec2(0.17, 0.09) + vec2(0.0, 0.03 * open);
  vec2 q = vec2(x, y) - gaze;
  float ri = 0.40;
  float rr = length(q) / ri;
  vec2 qd = q / max(length(q), 0.0001);

  // The upper lid shades the eyeball beneath it; the eyeball itself is round.
  float lidShade = mix(0.36, 1.0, smoothstep(0.0, 0.20, yu - y));
  float ball = 0.55 + 0.45 * n.z;
  float shade = lidShade * ball;

  // White of the eye, pinker toward the corners, with fine blood vessels.
  float corner = smoothstep(0.35, 0.86, abs(x));
  float veins = pow(1.0 - abs(2.0 * fbm(vec2(x, y) * 5.5 + 3.0) - 1.0), 12.0) * smoothstep(1.05, 1.6, rr);
  vec3 c = mix(SCLERA, mix(SCLERA, VEIN, 0.30), corner * 0.7);
  c = mix(c, VEIN, clamp(veins * (0.5 + corner), 0.0, 1.0));
  float L = 0.78 - 0.20 * corner;
  float stroke = 0.0;

  if (rr < 1.0) {
    // Iris: fine fibres running out from the pupil, Earth-blue, dark at the rim.
    float fibre = fbm(qd * 5.0 + rr * 1.3 + 3.0) * 0.6 + vnoise(qd * 26.0 + rr * 2.0) * 0.4;
    vec3 ic = mix(IRIS_IN, IRIS_MID, smoothstep(0.40, 0.74, rr));
    ic = mix(ic, IRIS_OUT, smoothstep(0.80, 1.0, rr));
    ic = mix(ic, AMBER, smoothstep(0.58, 0.80, fibre) * smoothstep(0.62, 0.44, rr) * smoothstep(0.36, 0.44, rr) * 0.8);
    c = ic * (0.55 + 0.75 * fibre);
    L = (0.30 + 0.55 * fibre) * (1.0 - 0.55 * smoothstep(0.80, 1.0, rr));
    if (gCellHash < 0.36) stroke = dirGlyph(qd);
    // Pupil: breathes slightly, widest as the eye opens.
    float rp = 0.37 + 0.03 * sin(uTime * 0.4) + 0.05 * (1.0 - open);
    float pupil = smoothstep(rp + 0.03, rp - 0.02, rr);
    c = mix(c, vec3(0.004, 0.006, 0.012), pupil);
    L = mix(L, 0.03, pupil);
    if (pupil > 0.5) stroke = 0.0;
  }

  col = c * shade;
  lum = clamp(L * shade + (gCellHash - 0.5) * 0.07, 0.03, 1.0);
  sp = stroke;

  // Catchlights: the Sun reflected in the wet surface.
  float hi = smoothstep(0.078, 0.048, length(q - vec2(-0.115, 0.125)));
  float hi2 = smoothstep(0.026, 0.012, length(q - vec2(0.10, -0.075)));
  float glint = max(hi, hi2 * 0.7) * lidShade;
  col = mix(col, WHITE, glint);
  lum = mix(lum, 1.0, glint);
  if (glint > 0.4) sp = 0.0;

  // The cut edge of each lid, catching the light.
  float upperEdge = smoothstep(0.045, 0.0, yu - y);
  float lowerEdge = smoothstep(0.036, 0.0, y - ylo);
  float rimE = max(upperEdge * 0.55, lowerEdge);
  col = mix(col, LIDEDGE * (0.45 + 0.6 * lowerEdge), rimE);
  lum = mix(lum, 0.35 + 0.35 * lowerEdge, rimE);
  if (rimE > 0.5) sp = 0.0;

  cover = 1.0;
}
`;

export const EYE_FRAG = buildSceneShader(BODY);
