/** Camera pose for one frame. Angles in degrees; eyeY includes the walking bob. */
export interface CameraState { x: number; z: number; eyeY: number; yaw: number; pitch: number }

export interface RoomRenderer {
  /** false if this renderer cannot run here (e.g. no WebGL) */
  init(canvas: HTMLCanvasElement, opts: { logoUrl: string; onNeedsRender: () => void }): boolean;
  resize(cssW: number, cssH: number, pixelRatio: number): void;
  render(camera: CameraState, day: number /* 1 = light, 0 = dark */): void;
  /** world point → CSS px in the canvas, or null if behind the camera (w <= 0.2) */
  project(p: [number, number, number]): [number, number] | null;
  dispose(): void;
}
