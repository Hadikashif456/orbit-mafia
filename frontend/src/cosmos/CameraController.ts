/**
 * Camera for the cosmic scenes: keyboard, on-screen pad, wheel and pointer in;
 * a smoothly damped position out. No rendering code lives here.
 */

export type MoveDirection = 'left' | 'right' | 'forward' | 'back';

export interface CameraState {
  x: number;
  y: number;
  z: number;
  zoom: number;
}

/** Per-scene feel: how the camera accelerates, settles and drifts on its own. */
export interface CameraProfile {
  accel: number;
  maxSpeed: number;
  damping: number;
  driftX: number;
  driftY: number;
  driftZ: number;
  driftRate: number;
  parallax: number;
}

export const CAMERA_LIMITS = {
  xMin: -0.55,
  xMax: 0.55,
  zMin: -0.6,
  zMax: 0.7,
  zoomMin: 0.8,
  zoomMax: 1.9,
} as const;

const KEY_TO_DIRECTION: Record<string, MoveDirection> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'forward',
  ArrowDown: 'back',
};

const EDGE_MARGIN = 0.22;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const smooth01 = (v: number): number => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Thrust fades to zero as the camera nears a limit, so it glides to a stop. */
const edgeFade = (pos: number, dir: number, min: number, max: number): number => {
  if (dir > 0) return smooth01((max - pos) / EDGE_MARGIN);
  if (dir < 0) return smooth01((pos - min) / EDGE_MARGIN);
  return 0;
};

/** True when the event target is somewhere the user types or adjusts a value. */
export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  const role = target.getAttribute('role');
  return role === 'textbox' || role === 'slider' || role === 'spinbutton' || role === 'listbox';
};

export class CameraController {
  private x = 0;
  private z = 0;
  private vx = 0;
  private vz = 0;
  private zoom = 1;
  private zoomTarget = 1;
  private pointerX = 0;
  private pointerY = 0;
  private pointerTargetX = 0;
  private pointerTargetY = 0;
  private held: Record<MoveDirection, boolean> = {
    left: false,
    right: false,
    forward: false,
    back: false,
  };
  private interactive = false;

  /** Keyboard and wheel only steer the camera while interactive. */
  setInteractive(on: boolean): void {
    this.interactive = on;
    if (!on) this.releaseAll();
  }

  setHeld(direction: MoveDirection, on: boolean): void {
    this.held[direction] = on;
  }

  /** A single push, for keyboard activation of the on-screen pad. */
  nudge(direction: MoveDirection): void {
    const kick = 0.22;
    if (direction === 'left') this.vx -= kick;
    if (direction === 'right') this.vx += kick;
    if (direction === 'forward') this.vz += kick;
    if (direction === 'back') this.vz -= kick;
  }

  zoomBy(deltaY: number): void {
    this.zoomTarget = clamp(
      this.zoomTarget * Math.exp(-deltaY * 0.0011),
      CAMERA_LIMITS.zoomMin,
      CAMERA_LIMITS.zoomMax,
    );
  }

  setPointer(nx: number, ny: number): void {
    this.pointerTargetX = clamp(nx, -1, 1);
    this.pointerTargetY = clamp(ny, -1, 1);
  }

  /** Ease back to the starting view. */
  reset(): void {
    this.returning = true;
    this.zoomTarget = 1;
  }

  private returning = false;

  private releaseAll(): void {
    this.held.left = false;
    this.held.right = false;
    this.held.forward = false;
    this.held.back = false;
  }

  /** Advance the simulation and return the camera the renderer should use. */
  update(dt: number, time: number, profile: CameraProfile, reducedMotion = false): CameraState {
    const step = clamp(dt, 0, 0.05);
    const ax = (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
    const az = (this.held.forward ? 1 : 0) - (this.held.back ? 1 : 0);
    if (ax !== 0 || az !== 0) this.returning = false;

    if (this.returning) {
      const k = 1 - Math.exp(-2.4 * step);
      this.x += (0 - this.x) * k;
      this.z += (0 - this.z) * k;
      this.vx = 0;
      this.vz = 0;
      if (Math.abs(this.x) < 0.001 && Math.abs(this.z) < 0.001) this.returning = false;
    } else {
      this.vx += ax * profile.accel * edgeFade(this.x, ax, CAMERA_LIMITS.xMin, CAMERA_LIMITS.xMax) * step;
      this.vz += az * profile.accel * edgeFade(this.z, az, CAMERA_LIMITS.zMin, CAMERA_LIMITS.zMax) * step;
      const drag = Math.exp(-profile.damping * step);
      this.vx = clamp(this.vx * drag, -profile.maxSpeed, profile.maxSpeed);
      this.vz = clamp(this.vz * drag, -profile.maxSpeed, profile.maxSpeed);
      this.x += this.vx * step;
      this.z += this.vz * step;
      if (this.x <= CAMERA_LIMITS.xMin || this.x >= CAMERA_LIMITS.xMax) this.vx = 0;
      if (this.z <= CAMERA_LIMITS.zMin || this.z >= CAMERA_LIMITS.zMax) this.vz = 0;
      this.x = clamp(this.x, CAMERA_LIMITS.xMin, CAMERA_LIMITS.xMax);
      this.z = clamp(this.z, CAMERA_LIMITS.zMin, CAMERA_LIMITS.zMax);
    }

    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-6 * step));
    const pk = 1 - Math.exp(-3 * step);
    this.pointerX += (this.pointerTargetX - this.pointerX) * pk;
    this.pointerY += (this.pointerTargetY - this.pointerY) * pk;

    // Reduced motion: no idle drift and no pointer sway, only deliberate moves.
    const ambient = reducedMotion ? 0 : 1;
    const rate = profile.driftRate;
    return {
      x: this.x + ambient * (Math.sin(time * rate) * profile.driftX + this.pointerX * profile.parallax),
      y: ambient * (Math.sin(time * rate * 0.74 + 1.3) * profile.driftY - this.pointerY * profile.parallax * 0.7),
      z: this.z + ambient * Math.sin(time * rate * 0.61 + 0.5) * profile.driftZ,
      zoom: this.zoom,
    };
  }

  /** Listen for keyboard, wheel and pointer input. Returns the cleanup function. */
  attach(target: Window): () => void {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!this.interactive || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isEditableTarget(e.target)) return;
      const direction = KEY_TO_DIRECTION[e.key];
      if (!direction) return;
      e.preventDefault();
      this.held[direction] = true;
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      const direction = KEY_TO_DIRECTION[e.key];
      if (direction) this.held[direction] = false;
    };
    const onWheel = (e: WheelEvent): void => {
      if (!this.interactive || e.ctrlKey || isEditableTarget(e.target)) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      this.zoomBy(clamp(e.deltaY * unit, -240, 240));
    };
    const onPointerMove = (e: PointerEvent): void => {
      if (e.pointerType === 'touch') return;
      this.setPointer((e.clientX / target.innerWidth) * 2 - 1, (e.clientY / target.innerHeight) * 2 - 1);
    };
    const onBlur = (): void => this.releaseAll();

    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('keyup', onKeyUp);
    target.addEventListener('wheel', onWheel, { passive: false });
    target.addEventListener('pointermove', onPointerMove, { passive: true });
    target.addEventListener('blur', onBlur);
    return () => {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('wheel', onWheel);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('blur', onBlur);
    };
  }
}
