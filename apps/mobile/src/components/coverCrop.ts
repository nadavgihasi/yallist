/** The cover scenes' own size, in viewBox units. */
export const SCENE_W = 390;
export const SCENE_H = 300;

/**
 * Where the focal point sits in a band that crops the scene's height: two thirds down, not the
 * middle. The focal points (a tent, an umbrella) stand on the ground, so centering them filled a
 * wide band with ground; this keeps the horizon and some sky above them.
 */
const FOCUS_AT = 2 / 3;

/**
 * The viewBox of the part of the scene a `width`×`height` box shows: CSS `cover` around `focus`
 * (viewBox units), kept inside the scene.
 */
export function crop(focus: { x: number; y: number }, width: number, height: number): string {
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  if (width / height >= SCENE_W / SCENE_H) {
    const h = (SCENE_W * height) / width;
    return `0 ${clamp(focus.y - h * FOCUS_AT, SCENE_H - h)} ${SCENE_W} ${h}`;
  }
  const w = (SCENE_H * width) / height;
  return `${clamp(focus.x - w / 2, SCENE_W - w)} 0 ${w} ${SCENE_H}`;
}
