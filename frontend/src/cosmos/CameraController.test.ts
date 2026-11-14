import { describe, expect, it } from 'vitest';
import { CAMERA_LIMITS, CameraController } from './CameraController';
import type { CameraProfile } from './CameraController';

// No idle drift or pointer sway, so only deliberate input moves the camera.
const STILL: CameraProfile = {
  accel: 1.5,
  maxSpeed: 0.42,
  damping: 2.4,
  driftX: 0,
  driftY: 0,
  driftZ: 0,
  driftRate: 0,
  parallax: 0,
};

const run = (camera: CameraController, seconds: number) => {
  let state = camera.update(0, 0, STILL);
  for (let i = 0; i < seconds * 60; i++) state = camera.update(1 / 60, i / 60, STILL);
  return state;
};

describe('CameraController', () => {
  it('starts at rest', () => {
    expect(run(new CameraController(), 1)).toEqual({ x: 0, y: 0, z: 0, zoom: 1 });
  });

  it('moves in the held direction and eases in rather than jumping', () => {
    const camera = new CameraController();
    camera.setHeld('right', true);
    const first = camera.update(1 / 60, 0, STILL);
    expect(first.x).toBeGreaterThan(0);
    expect(first.x).toBeLessThan(0.001);
    expect(run(camera, 1).x).toBeGreaterThan(0.1);
  });

  it('maps forward and back to the z axis', () => {
    const camera = new CameraController();
    camera.setHeld('forward', true);
    expect(run(camera, 1).z).toBeGreaterThan(0.1);
    camera.setHeld('forward', false);
    camera.setHeld('back', true);
    expect(run(camera, 4).z).toBeLessThan(0);
  });

  it('coasts to a stop after release', () => {
    const camera = new CameraController();
    camera.setHeld('left', true);
    run(camera, 1);
    camera.setHeld('left', false);
    const a = run(camera, 4).x;
    const b = run(camera, 1).x;
    expect(Math.abs(a - b)).toBeLessThan(0.001);
  });

  it('never leaves its limits', () => {
    const camera = new CameraController();
    camera.setHeld('right', true);
    camera.setHeld('forward', true);
    const state = run(camera, 30);
    expect(state.x).toBeLessThanOrEqual(CAMERA_LIMITS.xMax);
    expect(state.z).toBeLessThanOrEqual(CAMERA_LIMITS.zMax);
  });

  it('clamps zoom', () => {
    const camera = new CameraController();
    for (let i = 0; i < 50; i++) camera.zoomBy(-240);
    expect(run(camera, 3).zoom).toBeCloseTo(CAMERA_LIMITS.zoomMax, 2);
    for (let i = 0; i < 100; i++) camera.zoomBy(240);
    expect(run(camera, 3).zoom).toBeCloseTo(CAMERA_LIMITS.zoomMin, 2);
  });

  it('releases held input when interaction is switched off', () => {
    const camera = new CameraController();
    camera.setInteractive(true);
    camera.setHeld('right', true);
    camera.setInteractive(false);
    const a = run(camera, 3).x;
    expect(Math.abs(run(camera, 1).x - a)).toBeLessThan(0.001);
  });

  it('travels in and out when pushed by the mouse, then coasts to a stop', () => {
    const camera = new CameraController();
    camera.travel(0.6);
    const pushedIn = run(camera, 3).z;
    expect(pushedIn).toBeGreaterThan(0.05);
    expect(Math.abs(run(camera, 1).z - pushedIn)).toBeLessThan(0.001);
    for (let i = 0; i < 40; i++) {
      camera.travel(-0.6);
      run(camera, 0.5);
    }
    const state = run(camera, 3);
    expect(state.z).toBeLessThan(0);
    expect(state.z).toBeGreaterThanOrEqual(CAMERA_LIMITS.zMin);
  });

  it('eases back to the origin on reset', () => {
    const camera = new CameraController();
    camera.setHeld('right', true);
    run(camera, 2);
    camera.setHeld('right', false);
    camera.reset();
    const state = run(camera, 6);
    expect(Math.abs(state.x)).toBeLessThan(0.002);
    expect(state.zoom).toBeCloseTo(1, 2);
  });
});
