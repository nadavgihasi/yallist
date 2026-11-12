/** The cover scenes' own size, in viewBox units. */
export const SCENE_W = 390;
export const SCENE_H = 300;

/**
 * Where a trip's banner (its header, its invite page) puts the focal point in a band that crops
 * the scene's height: two thirds down, not the middle. The focal points (a tent, an umbrella) stand
 * on the ground, so centering them filled the banner with ground; this keeps the horizon and some
 * sky above them. Thinner bands (home's card) keep it centered: two thirds down there cuts the
 * tent's base.
 */
export const HORIZON = 2 / 3;

/**
 * The viewBox of the part of the scene a `width`×`height` box shows: CSS `cover` around `focus`
 * (viewBox units), kept inside the scene, with the focal point `focusAt` of the way down a band.
 */
export function crop(
  focus: { x: number; y: number },
  width: number,
  height: number,
  focusAt = 1 / 2,
): string {
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  if (width / height >= SCENE_W / SCENE_H) {
    const h = (SCENE_W * height) / width;
    return `0 ${clamp(focus.y - h * focusAt, SCENE_H - h)} ${SCENE_W} ${h}`;
  }
  const w = (SCENE_H * width) / height;
  return `${clamp(focus.x - w / 2, SCENE_W - w)} 0 ${w} ${SCENE_H}`;
}
