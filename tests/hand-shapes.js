/*
 * Builds fake 21-point hands for the tests: a hand pointing up, palm to the camera.
 * up = {thumb, index, middle, ring, little}: true = finger up, false = folded.
 * `pinch` (optional): thumb-tip to index-tip gap as a multiple of hand size, for volume tests.
 * `scale` and `at` move and resize the hand, like standing nearer or farther.
 */
function makeHand(up, { pinch = null, scale = 1, at = { x: 0.5, y: 0.6 }, tilt = 0 } = {}) {
  const S = 0.16 * scale; // wrist to middle knuckle
  const rot = (x, y) => ({ x: x * Math.cos(tilt) - y * Math.sin(tilt), y: x * Math.sin(tilt) + y * Math.cos(tilt) });
  const P = (x, y) => { const r = rot(x * S, y * S); return { x: at.x + r.x, y: at.y + r.y }; };
  const pts = new Array(21);
  pts[0] = P(0, 1);
  const knuckles = { index: [-0.28, 0.05], middle: [0, 0], ring: [0.26, 0.05], little: [0.48, 0.16] };
  const first = { index: 5, middle: 9, ring: 13, little: 17 };
  for (const [name, [kx, ky]] of Object.entries(knuckles)) {
    const i = first[name];
    pts[i] = P(kx, ky);
    if (up[name]) { pts[i + 1] = P(kx, ky - 0.35); pts[i + 2] = P(kx, ky - 0.6); pts[i + 3] = P(kx, ky - 0.8); }
    else { pts[i + 1] = P(kx, ky - 0.25); pts[i + 2] = P(kx, ky - 0.05); pts[i + 3] = P(kx, ky + 0.12); }
  }
  pts[1] = P(-0.3, 0.75);
  if (up.thumb) { pts[2] = P(-0.55, 0.55); pts[3] = P(-0.78, 0.38); pts[4] = P(-0.98, 0.25); }
  else { pts[2] = P(-0.4, 0.5); pts[3] = P(-0.25, 0.35); pts[4] = P(-0.08, 0.3); }
  if (pinch !== null) {
    // Thumb tip placed `pinch` hand-sizes away from the index tip, out to the side.
    const tip = pts[8];
    const r = rot(-pinch * S * 0.95, pinch * S * 0.3);
    pts[4] = { x: tip.x + r.x, y: tip.y + r.y };
    pts[3] = { x: (pts[4].x + pts[2].x) / 2, y: (pts[4].y + pts[2].y) / 2 };
  }
  return pts;
}
if (typeof module !== "undefined") module.exports = { makeHand };
else window.makeHand = makeHand;
