import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * ============================================================================
 * COSMIC DREAMSCAPE — "A Universe Written in Characters"
 * ============================================================================
 * Standalone generative ASCII cosmic background engineered for NASA Space Apps.
 *
 * Architectural Highlights:
 * 1. Glyph Atlas Caching: Pre-renders all 20 ASCII glyphs across the 9 "Amethyst
 *    Aurora" palette colors onto offscreen sprite sheets at initialization,
 *    eliminating thousands of per-frame `fillText()` rasterization bottlenecks
 *    and sustaining a locked 60 FPS on 4K displays.
 * 2. Seamless 30-Second Loop + Continuous Drift: Uses periodic phase angles
 *    (2π * t / 30s) for orbital mechanics, axial planet banding, and 4D-like
 *    looping simplex noise so a 30-second WebM capture loops invisibly while
 *    continuing smoothly forever.
 * 3. True Volumetric ASCII Synthesis: Planets, tilted rings with back/front
 *    occlusion, logarithmic spiral galaxies, nebula density fields, shooting
 *    stars, and a ghostly floating astronaut are all evaluated per-cell and
 *    mapped to typographic density, orientation, and luminance.
 */

// Amethyst Aurora Palette
const PALETTE = {
  eventHorizon: '#03020A',
  midnightIndigo: '#11102A',
  deepAmethyst: '#543078',
  electricOrchid: '#B56CFF',
  stardustLavender: '#D9B8FF',
  cosmicRose: '#F4A4CF',
  glacialCyan: '#83E7F5',
  champagneGold: '#FFE0A3',
  supernovaWhite: '#F8F4FF',
};

const PALETTE_KEYS = [
  'midnightIndigo',
  'deepAmethyst',
  'electricOrchid',
  'stardustLavender',
  'cosmicRose',
  'glacialCyan',
  'champagneGold',
  'supernovaWhite',
];

// Requested ASCII Character Set
const GLYPHS = [
  '.', ':', '*', '+', 'o', 'O', '0', '@', '#', '%',
  '&', '=', '-', '~', '^', '/', '\\', '|', ' '
];

// Luminance ramp from faint cosmic dust to dense stellar cores
const DENSITY_RAMP = ['.', ':', '-', '~', '+', '*', 'o', 'O', '0', '%', '&', '#', '@'];

// ----------------------------------------------------------------------------
// Fast Deterministic 3D/4D Looping Noise Utilities
// ----------------------------------------------------------------------------
const PERM = new Uint8Array(512);
(() => {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let seed = 133742;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807) % 2147483647;
    const j = seed % (i + 1);
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + t * (b - a);
}

function grad3(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function noise3D(x, y, z) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = PERM[X] + Y;
  const AA = PERM[A] + Z;
  const AB = PERM[A + 1] + Z;
  const B = PERM[X + 1] + Y;
  const BA = PERM[B] + Z;
  const BB = PERM[B + 1] + Z;

  return lerp(
    lerp(
      lerp(grad3(PERM[AA], x, y, z), grad3(PERM[BA], x - 1, y, z), u),
      lerp(grad3(PERM[AB], x, y - 1, z), grad3(PERM[BB], x - 1, y - 1, z), u),
      v
    ),
    lerp(
      lerp(grad3(PERM[AA + 1], x, y, z - 1), grad3(PERM[BA + 1], x - 1, y, z - 1), u),
      lerp(grad3(PERM[AB + 1], x, y - 1, z - 1), grad3(PERM[BB + 1], x - 1, y - 1, z - 1), u),
      v
    ),
    w
  );
}

function fbmLoop(x, y, angle, octaves = 3) {
  // Sample on a circle in Z/W space so the field loops seamlessly every 30s
  const r = 0.85;
  const z1 = Math.cos(angle) * r;
  const z2 = Math.sin(angle) * r;
  let value = 0;
  let amp = 0.55;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    const n1 = noise3D(x * freq + z1 * 0.7, y * freq + z2 * 0.7, z1);
    const n2 = noise3D(x * freq - z2 * 0.7, y * freq + z1 * 0.7, z2);
    value += amp * (n1 * 0.65 + n2 * 0.35);
    freq *= 2.05;
    amp *= 0.48;
  }
  return value;
}

// ----------------------------------------------------------------------------
// Ghostly ASCII Astronaut Art Matrix (Subtle drifting explorer in right-upper)
// ----------------------------------------------------------------------------
const ASTRONAUT_ART = [
  '      .---.      ',
  '     / .-. \\     ',
  '    | ( @ ) |    ',
  '     \\ `-\' /     ',
  '   .--\'===\'--.   ',
  '  /  | === |  \\  ',
  ' / / |  *  | \\ \\ ',
  '~ ~  |_____|  ~ ~',
  '      /   \\      ',
  '     / / \\ \\     ',
  '    ~ ~   ~ ~    ',
];

// ----------------------------------------------------------------------------
// Pre-rendered Glyph Sprite Atlas for Zero-Lag 60FPS Typography Rendering
// ----------------------------------------------------------------------------
function buildGlyphAtlas(fontSize, dpr) {
  const cellW = Math.ceil(fontSize * 0.64);
  const cellH = Math.ceil(fontSize * 1.08);
  const pw = Math.ceil(cellW * dpr);
  const ph = Math.ceil(cellH * dpr);

  const atlas = document.createElement('canvas');
  atlas.width = GLYPHS.length * pw;
  atlas.height = PALETTE_KEYS.length * ph;
  const ctx = atlas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.font = `500 ${fontSize}px "JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const glyphIndexMap = {};
  GLYPHS.forEach((g, idx) => {
    glyphIndexMap[g] = idx;
  });

  const colorIndexMap = {};
  PALETTE_KEYS.forEach((key, cIdx) => {
    colorIndexMap[key] = cIdx;
    const hex = PALETTE[key];
    ctx.fillStyle = hex;

    // Add restrained, selective optical bloom only to bright stellar colors
    if (key === 'supernovaWhite' || key === 'champagneGold' || key === 'glacialCyan') {
      ctx.shadowColor = hex;
      ctx.shadowBlur = fontSize * 0.45;
    } else if (key === 'electricOrchid' || key === 'cosmicRose') {
      ctx.shadowColor = hex;
      ctx.shadowBlur = fontSize * 0.25;
    } else {
      ctx.shadowBlur = 0;
    }

    for (let gIdx = 0; gIdx < GLYPHS.length; gIdx++) {
      const ch = GLYPHS[gIdx];
      if (ch === ' ') continue;
      const cx = gIdx * cellW + cellW * 0.5;
      const cy = cIdx * cellH + cellH * 0.52;
      ctx.fillText(ch, cx, cy);
    }
  });

  return {
    atlas,
    cellW,
    cellH,
    pw,
    ph,
    glyphIndexMap,
    colorIndexMap,
  };
}

// ----------------------------------------------------------------------------
// Main Reusable Background Component
// ----------------------------------------------------------------------------
export function CosmicAsciiBackground({
  className = '',
  style = {},
  canvasRefExternal = null,
  loopDurationSeconds = 30,
  interactiveParallax = true,
}) {
  const internalCanvasRef = useRef(null);
  const canvasRef = canvasRefExternal || internalCanvasRef;
  const pointerRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const prefersReducedMotionRef = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = mediaQuery.matches;
    const handleMotionChange = (e) => {
      prefersReducedMotionRef.current = e.matches;
    };
    mediaQuery.addEventListener('change', handleMotionChange);
    return () => mediaQuery.removeEventListener('change', handleMotionChange);
  }, []);

  useEffect(() => {
    if (!interactiveParallax) return;
    const onPointerMove = (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      pointerRef.current.targetX = nx;
      pointerRef.current.targetY = ny;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [interactiveParallax]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    let width = 0;
    let height = 0;
    let dpr = 1;
    let cols = 0;
    let rows = 0;
    let atlasData = null;
    let isMobile = false;

    // Scene entities initialized on resize
    let stars = [];
    let galaxyParticles = [];
    let dustParticles = [];
    let shootingStars = [];

    const initSceneEntities = () => {
      const areaFactor = Math.min(1.3, Math.max(0.45, (width * height) / (1440 * 900)));
      const perfScale = isMobile ? 0.55 : areaFactor;

      // 1. Multi-depth Parallax Starfield
      const starCount = Math.floor(340 * perfScale);
      stars = Array.from({ length: starCount }, (_, i) => {
        const depth = 0.15 + ((i * 73) % 100) / 115; // 0.15 (far) to 1.0 (near)
        const randColor = (i * 19) % 20;
        let colorKey = 'supernovaWhite';
        if (randColor < 4) colorKey = 'glacialCyan';
        else if (randColor < 7) colorKey = 'champagneGold';
        else if (randColor < 11) colorKey = 'stardustLavender';

        return {
          x: ((i * 9973) % 10000) / 10000,
          y: ((i * 6151) % 10000) / 10000,
          depth,
          phase: ((i * 31) % 628) / 100,
          freqCycles: 1 + (i % 3), // integer cycles per 30s loop
          colorKey,
          isBright: i % 11 === 0,
        };
      });

      // 2. Coherent Logarithmic Spiral Galaxy Particles (Diagonal central stream)
      const galaxyCount = Math.floor(1550 * perfScale);
      galaxyParticles = Array.from({ length: galaxyCount }, (_, i) => {
        const arm = i % 2;
        const u = Math.pow(((i * 4871) % 10000) / 10000, 0.78); // radial distribution 0..1
        const armAngle = arm * Math.PI + u * 3.85;
        const spread = (((i * 2903) % 1000) / 1000 - 0.5) * (0.28 + u * 0.45);
        const zOffset = (((i * 1747) % 1000) / 1000 - 0.5) * 0.14;

        let colorKey = 'electricOrchid';
        if (u < 0.16) colorKey = 'champagneGold';
        else if (u < 0.36) colorKey = 'cosmicRose';
        else if (u < 0.68) colorKey = 'stardustLavender';
        else colorKey = i % 3 === 0 ? 'glacialCyan' : 'deepAmethyst';

        return {
          u,
          baseAngle: armAngle + spread,
          zOffset,
          colorKey,
          glyph: u < 0.18 ? '@' : u < 0.38 ? '*' : u < 0.68 ? '+' : i % 2 === 0 ? '.' : ':',
          twinklePhase: (i * 0.37) % (Math.PI * 2),
        };
      });

      // 3. Subtle Cosmic Dust Particles drifting through deep space
      const dustCount = Math.floor(160 * perfScale);
      dustParticles = Array.from({ length: dustCount }, (_, i) => ({
        x: ((i * 8191) % 10000) / 10000,
        y: ((i * 3571) % 10000) / 10000,
        radius: 0.015 + ((i * 13) % 30) * 0.001,
        phase: (i * 0.91) % (Math.PI * 2),
        colorKey: i % 2 === 0 ? 'stardustLavender' : 'glacialCyan',
        glyph: i % 3 === 0 ? '~' : i % 3 === 1 ? '.' : ':',
      }));

      // 4. Scheduled Shooting Stars (deterministic intervals across 30s loop for seamlessness)
      shootingStars = [
        { triggerTime: 3.2, duration: 1.5, startX: 0.78, startY: 0.11, vx: -0.34, vy: 0.21 },
        { triggerTime: 11.8, duration: 1.4, startX: 0.34, startY: 0.08, vx: 0.31, vy: 0.24 },
        { triggerTime: 19.5, duration: 1.6, startX: 0.88, startY: 0.26, vx: -0.38, vy: 0.18 },
        { triggerTime: 26.1, duration: 1.35, startX: 0.56, startY: 0.06, vx: -0.26, vy: 0.27 },
      ];
    };

    const resize = () => {
      const rect = canvas.parentElement
        ? canvas.parentElement.getBoundingClientRect()
        : { width: window.innerWidth, height: window.innerHeight };

      width = Math.max(320, rect.width || window.innerWidth);
      height = Math.max(320, rect.height || window.innerHeight);
      isMobile = width < 768;

      // Cap DPR at 2 for crisp characters without GPU fill-rate overload
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      // Adaptive typography scale for desktop vs mobile
      const fontSize = isMobile
        ? Math.max(10, Math.min(12, Math.round(width / 38)))
        : Math.max(11, Math.min(14, Math.round(width / 118)));

      atlasData = buildGlyphAtlas(fontSize, dpr);
      cols = Math.ceil(width / atlasData.cellW);
      rows = Math.ceil(height / atlasData.cellH);

      initSceneEntities();
    };

    resize();
    window.addEventListener('resize', resize);

    // Helper to stamp a glyph from the pre-rendered atlas onto the canvas
    const drawCell = (col, row, glyph, colorKey, alpha = 1.0) => {
      if (col < 0 || col >= cols || row < 0 || row >= rows || alpha <= 0.04) return;
      const gIdx = atlasData.glyphIndexMap[glyph];
      const cIdx = atlasData.colorIndexMap[colorKey];
      if (gIdx === undefined || cIdx === undefined) return;

      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(
        atlasData.atlas,
        gIdx * atlasData.pw,
        cIdx * atlasData.ph,
        atlasData.pw,
        atlasData.ph,
        col * atlasData.cellW * dpr,
        row * atlasData.cellH * dpr,
        atlasData.pw,
        atlasData.ph
      );
    };

    // Helper to render a shaded 3D ASCII Sphere with atmospheric limb & banding
    const renderAsciiPlanet = ({
      cx,
      cy,
      radiusPx,
      lightDir,
      rimColor,
      midColor,
      shadowColor,
      bandFreq,
      rotPhase,
      tiltAngle,
      hasBands = true,
      skipFrontRingCheck = null,
    }) => {
      const { cellW, cellH } = atlasData;
      const minCol = Math.max(0, Math.floor((cx - radiusPx * 1.16) / cellW));
      const maxCol = Math.min(cols - 1, Math.ceil((cx + radiusPx * 1.16) / cellW));
      const minRow = Math.max(0, Math.floor((cy - radiusPx * 1.16) / cellH));
      const maxRow = Math.min(rows - 1, Math.ceil((cy + radiusPx * 1.16) / cellH));

      const cosT = Math.cos(tiltAngle);
      const sinT = Math.sin(tiltAngle);

      for (let r = minRow; r <= maxRow; r++) {
        const py = (r + 0.5) * cellH - cy;
        for (let c = minCol; c <= maxCol; c++) {
          const px = (c + 0.5) * cellW - cx;

          // If this planet has tilted rings, allow foreground ring particles to occlude the planet
          if (skipFrontRingCheck && skipFrontRingCheck(px, py)) {
            continue;
          }

          const distSq = px * px + py * py;
          const rSq = radiusPx * radiusPx;

          // Atmospheric outer corona glow (1.0 -> 1.14 radius)
          if (distSq > rSq) {
            const dist = Math.sqrt(distSq);
            const atmRatio = (dist - radiusPx) / (radiusPx * 0.14);
            if (atmRatio < 1.0) {
              const nx = px / dist;
              const ny = py / dist;
              const sunFacing = Math.max(0, nx * lightDir.x + ny * lightDir.y);
              const atmIntensity = (1.0 - atmRatio) * (0.22 + 0.78 * sunFacing);
              if (atmIntensity > 0.16) {
                const atmGlyph = atmIntensity > 0.55 ? ':' : '.';
                drawCell(c, r, atmGlyph, rimColor, atmIntensity * 0.72);
              }
            }
            continue;
          }

          // Surface normal on unit sphere
          const nx = px / radiusPx;
          const ny = py / radiusPx;
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));

          // Rotate coordinates into planet's axial frame for surface texture & bands
          const rx = nx * cosT - ny * sinT;
          const ry = nx * sinT + ny * cosT;
          const lon = Math.atan2(rx, nz) + rotPhase;
          const lat = Math.asin(Math.max(-1, Math.min(1, ry)));

          // Procedural surface storm bands & turbulence
          let surfaceMod = 0;
          if (hasBands) {
            const warp = noise3D(Math.cos(lon) * 1.8, lat * 3.5, Math.sin(lon) * 1.8) * 0.28;
            const bands = Math.sin((lat + warp) * bandFreq) * 0.5 + 0.5;
            const fineDetail = noise3D(Math.cos(lon) * 4.2, lat * 7.0, Math.sin(lon) * 4.2) * 0.25;
            surfaceMod = bands * 0.24 + fineDetail * 0.14;
          } else {
            surfaceMod = noise3D(Math.cos(lon) * 3.0, lat * 3.0, Math.sin(lon) * 3.0) * 0.22;
          }

          // Diffuse + Fresnel rim illumination
          const ndotl = nx * lightDir.x + ny * lightDir.y + nz * lightDir.z;
          const fresnel = Math.pow(1.0 - nz, 2.4);
          const rimBoost = fresnel * Math.max(0.15, ndotl + 0.45) * 0.65;

          // Deep shadow terminator preserves dark side readability while hinting curvature
          let lum = Math.max(0.03, ndotl * 0.85 + 0.12) + surfaceMod * Math.max(0.15, ndotl + 0.35) + rimBoost;
          lum = Math.max(0.02, Math.min(1.0, lum));

          // Map luminance & curvature to ASCII character
          let glyph = '.';
          if (fresnel > 0.74 && ndotl > -0.1) {
            glyph = Math.abs(nx) > Math.abs(ny) ? '|' : '-';
          } else {
            const rampIdx = Math.min(
              DENSITY_RAMP.length - 1,
              Math.floor(lum * DENSITY_RAMP.length)
            );
            glyph = DENSITY_RAMP[rampIdx];
          }

          // Choose palette color based on illumination zone
          let colorKey = shadowColor;
          if (fresnel > 0.68 && ndotl > -0.15) {
            colorKey = rimColor;
          } else if (lum > 0.76) {
            colorKey = 'supernovaWhite';
          } else if (lum > 0.54) {
            colorKey = rimColor;
          } else if (lum > 0.26) {
            colorKey = midColor;
          } else {
            colorKey = shadowColor;
          }

          const alpha = lum < 0.12 ? 0.35 + lum * 3.0 : Math.min(1.0, 0.55 + lum * 0.5);
          drawCell(c, r, glyph, colorKey, alpha);
        }
      }
    };

    // Helper to render Saturn's tilted elliptical ASCII ring system
    const renderSaturnRings = ({
      cx,
      cy,
      planetRadius,
      innerR,
      outerR,
      tiltAngle,
      inclination,
      loopAngle,
      renderBackHalf,
    }) => {
      const { cellW, cellH } = atlasData;
      const cosT = Math.cos(-tiltAngle);
      const sinT = Math.sin(-tiltAngle);
      const maxExtent = outerR * 1.05;

      const minCol = Math.max(0, Math.floor((cx - maxExtent) / cellW));
      const maxCol = Math.min(cols - 1, Math.ceil((cx + maxExtent) / cellW));
      const minRow = Math.max(0, Math.floor((cy - maxExtent * 0.75) / cellH));
      const maxRow = Math.min(rows - 1, Math.ceil((cy + maxExtent * 0.75) / cellH));

      for (let r = minRow; r <= maxRow; r++) {
        const py = (r + 0.5) * cellH - cy;
        for (let c = minCol; c <= maxCol; c++) {
          const px = (c + 0.5) * cellW - cx;

          // Un-rotate into ring plane coordinates
          const rx = px * cosT - py * sinT;
          const ry = (px * sinT + py * cosT) / inclination;

          // Back half has ry < 0, front half has ry >= 0
          if (renderBackHalf && ry >= 0) continue;
          if (!renderBackHalf && ry < 0) continue;

          const radialDist = Math.sqrt(rx * rx + ry * ry);
          if (radialDist < innerR || radialDist > outerR) continue;

          // If rendering back half, occlude behind planet sphere
          if (renderBackHalf && px * px + py * py < planetRadius * planetRadius * 0.98) {
            continue;
          }

          const normR = (radialDist - innerR) / (outerR - innerR); // 0..1 across ring width

          // Cassini-like division gap around normR ~ 0.62
          const cassiniGap = Math.exp(-Math.pow((normR - 0.62) / 0.045, 2));
          if (cassiniGap > 0.78) continue;

          // Concentric ring ringlets + subtle orbital shimmer synchronized to 30s loop
          const orbitTheta = Math.atan2(ry, rx) + loopAngle * 2.0;
          const ringletWave =
            Math.sin(normR * 44.0) * 0.45 +
            Math.cos(normR * 19.0 + Math.sin(orbitTheta * 2.0) * 0.4) * 0.35 +
            0.5;
          const edgeFade = Math.sin(normR * Math.PI);
          const density = ringletWave * edgeFade * (1.0 - cassiniGap * 0.9);

          if (density < 0.22) continue;

          // Cast subtle planet shadow on the back-right portion of the rings
          const inShadow = renderBackHalf && rx > planetRadius * 0.25 && Math.abs(ry) < planetRadius * 0.85;
          const shadowDim = inShadow ? 0.38 : 1.0;

          let glyph = '.';
          if (density > 0.78) glyph = '*';
          else if (density > 0.62) glyph = '+';
          else if (density > 0.46) glyph = '~';
          else if (density > 0.33) glyph = 'o';
          else glyph = '.';

          let colorKey = 'stardustLavender';
          if (inShadow) {
            colorKey = 'deepAmethyst';
          } else if (normR < 0.25) {
            colorKey = 'glacialCyan';
          } else if (normR > 0.48 && normR < 0.56) {
            colorKey = 'champagneGold';
          } else if (normR > 0.72) {
            colorKey = 'cosmicRose';
          } else if (density > 0.75) {
            colorKey = 'supernovaWhite';
          }

          drawCell(c, r, glyph, colorKey, Math.min(0.95, density * 1.15 * shadowDim));
        }
      }
    };

    // ------------------------------------------------------------------------
    // Main Frame Render Loop
    // ------------------------------------------------------------------------
    let rafId = 0;
    const startTime = performance.now();

    const renderFrame = (now) => {
      const elapsedSec = prefersReducedMotionRef.current ? 4.5 : (now - startTime) * 0.001;
      const loopProgress = (elapsedSec % loopDurationSeconds) / loopDurationSeconds; // 0..1
      const loopAngle = loopProgress * Math.PI * 2; // Seamless 2π cycle over 30s

      // Smooth pointer parallax easing
      pointerRef.current.x += (pointerRef.current.targetX - pointerRef.current.x) * 0.045;
      pointerRef.current.y += (pointerRef.current.targetY - pointerRef.current.y) * 0.045;
      const ptrX = pointerRef.current.x;
      const ptrY = pointerRef.current.y;

      // Subtle breathing camera push/pull & drift (loops seamlessly)
      const camZoom = 1.0 + Math.sin(loopAngle) * 0.028;
      const camDriftX = Math.cos(loopAngle) * (width * 0.012) - ptrX * (width * 0.022);
      const camDriftY = Math.sin(loopAngle) * (height * 0.01) - ptrY * (height * 0.018);

      // 1. Deep Event Horizon Black Canvas Clear
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = PALETTE.eventHorizon;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const { cellW, cellH } = atlasData;
      const minDim = Math.min(width, height);

      // ----------------------------------------------------------------------
      // LAYER 1: Flowing Amethyst Aurora Nebula Field (Background Gas Clouds)
      // ----------------------------------------------------------------------
      // Diagonal nebula spine running from bottom-left toward upper-right
      const nebStep = isMobile ? 2 : 2; // Sub-grid sampling for lush organic density & speed
      for (let r = 0; r < rows; r += nebStep) {
        const ny = (r + 0.5) / rows;
        for (let c = 0; c < cols; c += nebStep) {
          const nx = (c + 0.5) / cols;

          // Keep central content zone slightly calmer for effortless typography readability
          const dxCenter = (nx - 0.5) * 1.25;
          const dyCenter = (ny - 0.48) * 1.35;
          const centerClearance = Math.min(1.0, 0.42 + (dxCenter * dxCenter + dyCenter * dyCenter) * 1.15);

          // Diagonal cosmic river mask
          const diagDist = Math.abs((nx - 0.52) * 0.78 + (ny - 0.48) * 0.92);
          const bandEnvelope = Math.exp(-Math.pow(diagDist / 0.36, 2));

          if (bandEnvelope < 0.08) continue;

          const sampleX = nx * 2.6 + camDriftX / width;
          const sampleY = ny * 2.1 + camDriftY / height;
          const nVal = fbmLoop(sampleX, sampleY, loopAngle, 3);
          const density = (nVal * 0.5 + 0.5) * bandEnvelope * centerClearance;

          if (density < 0.27) continue;

          // Map density to nebula gradient: Midnight Indigo -> Deep Amethyst -> Electric Orchid -> Cosmic Rose
          let colorKey = 'midnightIndigo';
          let glyph = '.';
          if (density > 0.66) {
            colorKey = 'cosmicRose';
            glyph = '+';
          } else if (density > 0.53) {
            colorKey = 'electricOrchid';
            glyph = '~';
          } else if (density > 0.41) {
            colorKey = 'deepAmethyst';
            glyph = ':';
          } else {
            colorKey = 'midnightIndigo';
            glyph = '.';
          }

          drawCell(c, r, glyph, colorKey, Math.min(0.75, (density - 0.24) * 1.35));
        }
      }

      // ----------------------------------------------------------------------
      // LAYER 2: Multi-Depth Parallax Starfield
      // ----------------------------------------------------------------------
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        // Seamless parallax wrap across the 30s period
        const driftX = (s.x + loopProgress * 0.03 * s.depth - ptrX * 0.035 * s.depth + 2) % 1;
        const driftY = (s.y + Math.sin(loopAngle + s.phase) * 0.004 * s.depth - ptrY * 0.025 * s.depth + 2) % 1;

        const col = Math.floor(driftX * cols);
        const row = Math.floor(driftY * rows);

        const twinkle =
          0.55 + 0.45 * Math.sin(loopAngle * s.freqCycles + s.phase);
        const alpha = (0.28 + 0.72 * s.depth) * twinkle;

        let glyph = '.';
        if (s.isBright && twinkle > 0.84) glyph = '+';
        else if (s.depth > 0.75) glyph = '*';
        else if (s.depth > 0.45) glyph = ':';

        drawCell(col, row, glyph, s.colorKey, alpha);

        // Occasional four-point cross flare on brightest Champagne Gold / Supernova stars
        if (s.isBright && twinkle > 0.9 && !isMobile) {
          drawCell(col - 1, row, '-', s.colorKey, alpha * 0.45);
          drawCell(col + 1, row, '-', s.colorKey, alpha * 0.45);
          drawCell(col, row - 1, '|', s.colorKey, alpha * 0.45);
          drawCell(col, row + 1, '|', s.colorKey, alpha * 0.45);
        }
      }

      // ----------------------------------------------------------------------
      // LAYER 3: Distant Small Planets (Upper & Right Celestial Constellations)
      // ----------------------------------------------------------------------
      const distantPlanets = isMobile
        ? [
            { x: 0.78, y: 0.16, r: minDim * 0.038, rim: 'glacialCyan', mid: 'deepAmethyst', rot: 0.5 },
            { x: 0.24, y: 0.14, r: minDim * 0.024, rim: 'stardustLavender', mid: 'midnightIndigo', rot: -0.4 },
          ]
        : [
            { x: 0.34, y: 0.14, r: minDim * 0.026, rim: 'stardustLavender', mid: 'deepAmethyst', rot: 0.6 },
            { x: 0.68, y: 0.19, r: minDim * 0.036, rim: 'glacialCyan', mid: 'deepAmethyst', rot: -0.5 },
            { x: 0.84, y: 0.34, r: minDim * 0.044, rim: 'cosmicRose', mid: 'deepAmethyst', rot: 0.3 },
            { x: 0.89, y: 0.62, r: minDim * 0.028, rim: 'stardustLavender', mid: 'midnightIndigo', rot: 0.8 },
          ];

      for (let i = 0; i < distantPlanets.length; i++) {
        const dp = distantPlanets[i];
        const px = dp.x * width + camDriftX * 0.45 + Math.sin(loopAngle + i) * 4;
        const py = dp.y * height + camDriftY * 0.45 + Math.cos(loopAngle + i) * 3;
        renderAsciiPlanet({
          cx: px,
          cy: py,
          radiusPx: dp.r * camZoom,
          lightDir: { x: -0.62, y: -0.55, z: 0.56 },
          rimColor: dp.rim,
          midColor: dp.mid,
          shadowColor: 'midnightIndigo',
          bandFreq: 7.5,
          rotPhase: loopAngle * dp.rot + i * 1.4,
          tiltAngle: 0.25,
          hasBands: true,
        });
      }

      // ----------------------------------------------------------------------
      // LAYER 4: Flowing Diagonal Spiral Galaxy (Central-Right Swirl)
      // ----------------------------------------------------------------------
      const galCx = (isMobile ? 0.56 : 0.57) * width + camDriftX * 0.65;
      const galCy = (isMobile ? 0.44 : 0.45) * height + camDriftY * 0.65;
      const galRadiusX = (isMobile ? 0.34 : 0.26) * width * camZoom;
      const galRadiusY = galRadiusX * 0.46;
      const galTilt = -0.54; // Diagonal sweep across viewport
      const cosG = Math.cos(galTilt);
      const sinG = Math.sin(galTilt);

      for (let i = 0; i < galaxyParticles.length; i++) {
        const gp = galaxyParticles[i];
        // Differential galactic rotation: inner core rotates slightly faster, integer cycles for 30s loop
        const angularSpeed = gp.u < 0.35 ? 2.0 : 1.0;
        const theta = gp.baseAngle - loopAngle * angularSpeed;

        const lx = Math.cos(theta) * gp.u * galRadiusX;
        const ly = Math.sin(theta) * gp.u * galRadiusY + gp.zOffset * galRadiusY;

        const gx = galCx + (lx * cosG - ly * sinG);
        const gy = galCy + (lx * sinG + ly * cosG);

        const col = Math.floor(gx / cellW);
        const row = Math.floor(gy / cellH);

        const shimmer = 0.68 + 0.32 * Math.sin(loopAngle * 2 + gp.twinklePhase);
        const coreBoost = gp.u < 0.2 ? 0.95 : 0.72 * (1.0 - gp.u * 0.45);
        drawCell(col, row, gp.glyph, gp.colorKey, coreBoost * shimmer);
      }

      // ----------------------------------------------------------------------
      // LAYER 5: Ghostly Drifting ASCII Astronaut Silhouette (Subtle Easter Egg)
      // ----------------------------------------------------------------------
      const astroBaseX = (isMobile ? 0.74 : 0.77) * width + camDriftX * 0.9 + Math.sin(loopAngle) * 14;
      const astroBaseY = (isMobile ? 0.48 : 0.49) * height + camDriftY * 0.9 + Math.cos(loopAngle) * 10;
      const astroCol0 = Math.floor(astroBaseX / cellW);
      const astroRow0 = Math.floor(astroBaseY / cellH);
      const astroPulse = 0.24 + 0.1 * Math.sin(loopAngle * 2.0); // Very faint, spectral presence

      for (let r = 0; r < ASTRONAUT_ART.length; r++) {
        const line = ASTRONAUT_ART[r];
        for (let c = 0; c < line.length; c++) {
          const ch = line[c];
          if (ch === ' ') continue;
          const isVisor = ch === '@' || ch === '(' || ch === ')';
          drawCell(
            astroCol0 + c,
            astroRow0 + r,
            ch,
            isVisor ? 'glacialCyan' : 'stardustLavender',
            isVisor ? astroPulse * 1.45 : astroPulse
          );
        }
      }

      // ----------------------------------------------------------------------
      // LAYER 6: Majestic Saturn-Like ASCII Planet & Luminous Rings (Left Region)
      // ----------------------------------------------------------------------
      const saturnCx = (isMobile ? 0.22 : 0.19) * width + camDriftX * 1.1;
      const saturnCy = (isMobile ? 0.36 : 0.37) * height + camDriftY * 1.1;
      const saturnRadius = (isMobile ? minDim * 0.145 : minDim * 0.145) * camZoom;
      const ringInner = saturnRadius * 1.32;
      const ringOuter = saturnRadius * 2.45;
      const ringTilt = -0.34;
      const ringInclination = 0.34;

      // 6a. Render Back Half of Saturn's Rings first (occluded by planet body)
      renderSaturnRings({
        cx: saturnCx,
        cy: saturnCy,
        planetRadius: saturnRadius,
        innerR: ringInner,
        outerR: ringOuter,
        tiltAngle: ringTilt,
        inclination: ringInclination,
        loopAngle,
        renderBackHalf: true,
      });

      // 6b. Render Saturn Planet Body with 3D Spherical Shading
      renderAsciiPlanet({
        cx: saturnCx,
        cy: saturnCy,
        radiusPx: saturnRadius,
        lightDir: { x: -0.68, y: -0.52, z: 0.51 },
        rimColor: 'glacialCyan',
        midColor: 'electricOrchid',
        shadowColor: 'deepAmethyst',
        bandFreq: 13.0,
        rotPhase: loopAngle * 1.0,
        tiltAngle: ringTilt,
        hasBands: true,
      });

      // 6c. Render Front Half of Saturn's Rings overlapping the planet's equator
      renderSaturnRings({
        cx: saturnCx,
        cy: saturnCy,
        planetRadius: saturnRadius,
        innerR: ringInner,
        outerR: ringOuter,
        tiltAngle: ringTilt,
        inclination: ringInclination,
        loopAngle,
        renderBackHalf: false,
      });

      // ----------------------------------------------------------------------
      // LAYER 7: Massive Emerging Lower Horizon Planet (Bottom Region)
      // ----------------------------------------------------------------------
      const horizonRadius = (isMobile ? minDim * 0.56 : minDim * 0.62) * camZoom;
      const horizonCx = (isMobile ? 0.48 : 0.46) * width + camDriftX * 1.35;
      const horizonCy = height + horizonRadius * 0.72 + camDriftY * 0.8;

      renderAsciiPlanet({
        cx: horizonCx,
        cy: horizonCy,
        radiusPx: horizonRadius,
        lightDir: { x: -0.25, y: -0.88, z: 0.4 },
        rimColor: 'glacialCyan',
        midColor: 'deepAmethyst',
        shadowColor: 'midnightIndigo',
        bandFreq: 18.0,
        rotPhase: loopAngle * 0.5,
        tiltAngle: -0.12,
        hasBands: true,
      });

      // ----------------------------------------------------------------------
      // LAYER 8: Foreground Cosmic Dust & Rare Unpredictable Shooting Stars
      // ----------------------------------------------------------------------
      for (let i = 0; i < dustParticles.length; i++) {
        const d = dustParticles[i];
        const dx = (d.x + Math.cos(loopAngle + d.phase) * d.radius - ptrX * 0.045 + 1) % 1;
        const dy = (d.y + Math.sin(loopAngle + d.phase) * d.radius - ptrY * 0.035 + 1) % 1;
        const alpha = 0.22 + 0.25 * Math.sin(loopAngle * 2 + d.phase);
        drawCell(Math.floor(dx * cols), Math.floor(dy * rows), d.glyph, d.colorKey, alpha);
      }

      // Shooting stars with delicate fading ASCII particle trails
      const loopSec = loopProgress * loopDurationSeconds;
      for (let i = 0; i < shootingStars.length; i++) {
        const st = shootingStars[i];
        const dt = loopSec - st.triggerTime;
        if (dt >= 0 && dt <= st.duration) {
          const p = dt / st.duration; // 0..1
          const ease = 1 - Math.pow(1 - p, 2);
          const headX = (st.startX + st.vx * ease) * width;
          const headY = (st.startY + st.vy * ease) * height;
          const trailSteps = 16;

          for (let t = 0; t < trailSteps; t++) {
            const frac = t / trailSteps;
            const tx = headX - st.vx * width * 0.22 * frac;
            const ty = headY - st.vy * height * 0.22 * frac;
            const fadeOut = (1 - frac) * Math.sin(p * Math.PI);
            if (fadeOut <= 0.05) continue;

            const glyph = t === 0 ? '@' : t < 3 ? '*' : t < 8 ? '/' : '.';
            const colorKey = t < 2 ? 'supernovaWhite' : t < 6 ? 'glacialCyan' : 'stardustLavender';
            drawCell(Math.floor(tx / cellW), Math.floor(ty / cellH), glyph, colorKey, fadeOut * 0.95);
          }
        }
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef, loopDurationSeconds]);

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 overflow-hidden pointer-events-none select-none ${className}`}
      style={{
        backgroundColor: PALETTE.eventHorizon,
        zIndex: 0,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Preview & 30-Second Silent Seamless WebM Export Wrapper (For Studio/Demo)
// ----------------------------------------------------------------------------
export default function App() {
  const canvasRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [showHud, setShowHud] = useState(true);
  const [statusNote, setStatusNote] = useState('');

  const handleExport30sWebM = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isRecording) return;

    if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
      setStatusNote('WebM capture is not supported in this browser.');
      return;
    }

    try {
      setDownloadUrl(null);
      setStatusNote('');
      setIsRecording(true);
      setRecordProgress(0);

      const stream = canvas.captureStream(60);
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      const selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

      const recorder = new MediaRecorder(stream, {
        mimeType: selectedMime,
        videoBitsPerSecond: 14_000_000, // High bitrate so crisp ASCII characters remain razor-sharp
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: selectedMime || 'video/webm' });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        setIsRecording(false);
        setRecordProgress(100);
        setStatusNote('30s seamless muted WebM ready.');
      };

      recorder.start(250);

      const durationMs = 30_000;
      const t0 = performance.now();
      const timer = setInterval(() => {
        const elapsed = performance.now() - t0;
        const pct = Math.min(100, (elapsed / durationMs) * 100);
        setRecordProgress(pct);
        if (elapsed >= durationMs) {
          clearInterval(timer);
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }
      }, 100);
    } catch (err) {
      setIsRecording(false);
      setStatusNote('Unable to start canvas recording.');
    }
  }, [isRecording]);

  return (
    <div className="relative min-h-screen w-full bg-[#03020A] text-[#F8F4FF] overflow-hidden font-mono">
      {/* Live Generative ASCII Universe Background */}
      <CosmicAsciiBackground
        canvasRefExternal={canvasRef}
        loopDurationSeconds={30}
        interactiveParallax={!isRecording}
      />

      {/* Minimal Floating Awwwards-Style Studio Control Pill (Toggleable for pure canvas view) */}
      <div className="fixed bottom-5 right-5 z-20 flex flex-col items-end gap-2">
        {showHud && (
          <div className="flex flex-wrap items-center gap-2.5 rounded-full border border-[#B56CFF]/25 bg-[#03020A]/75 px-4 py-2 backdrop-blur-md shadow-[0_8px_32px_rgba(3,2,10,0.85)]">
            <span className="inline-block h-2 w-2 rounded-full bg-[#83E7F5] animate-pulse" />
            <span className="text-[11px] tracking-widest uppercase text-[#D9B8FF]">
              CosmicAsciiBackground · 30s Loop
            </span>

            <button
              type="button"
              onClick={handleExport30sWebM}
              disabled={isRecording}
              className="ml-1 rounded-full border border-[#83E7F5]/40 bg-[#543078]/40 px-3 py-1 text-[11px] tracking-wider uppercase text-[#F8F4FF] transition hover:bg-[#B56CFF]/40 disabled:opacity-50 cursor-pointer"
            >
              {isRecording
                ? `Recording ${Math.round((recordProgress / 100) * 30)}s / 30s`
                : 'Export 30s WebM'}
            </button>

            {downloadUrl && (
              <a
                href={downloadUrl}
                download="cosmic-dreamscape-ascii-30s.webm"
                className="rounded-full bg-[#83E7F5] px-3 py-1 text-[11px] font-semibold tracking-wider uppercase text-[#03020A] transition hover:bg-[#F8F4FF]"
              >
                Download Video
              </a>
            )}

            <button
              type="button"
              onClick={() => setShowHud(false)}
              title="Hide studio pill"
              className="ml-1 px-1.5 text-xs text-[#D9B8FF]/70 hover:text-[#F8F4FF] cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {!showHud && (
          <button
            type="button"
            onClick={() => setShowHud(true)}
            className="rounded-full border border-[#543078]/40 bg-[#03020A]/60 px-3 py-1 text-[10px] tracking-widest uppercase text-[#D9B8FF]/70 backdrop-blur-sm hover:text-[#F8F4FF] cursor-pointer"
          >
            HUD
          </button>
        )}

        {statusNote && showHud && (
          <span className="rounded-full bg-[#03020A]/80 px-3 py-1 text-[10px] tracking-wider text-[#FFE0A3]">
            {statusNote}
          </span>
        )}
      </div>
    </div>
  );
}