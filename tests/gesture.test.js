// Run with: node --test tests/gesture.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../js/gesture.js");
const { makeHand } = require("./hand-shapes.js");

const three = { thumb: true, index: true, middle: true, ring: false, little: false };
const others = {
  fist: { thumb: false, index: false, middle: false, ring: false, little: false },
  open: { thumb: true, index: true, middle: true, ring: true, little: true },
  point: { thumb: false, index: true, middle: false, ring: false, little: false },
  peace: { thumb: false, index: true, middle: true, ring: false, little: false },
  pinchPose: { thumb: true, index: true, middle: false, ring: false, little: false },
  fourFingers: { thumb: false, index: true, middle: true, ring: true, little: true },
  threeWithRing: { thumb: true, index: true, middle: true, ring: true, little: false },
};

test("each finger is read correctly, at any distance and with the hand tilted", () => {
  for (const scale of [0.4, 1, 1.6]) for (const tilt of [-0.4, 0, 0.4]) {
    for (const shape of [three, ...Object.values(others)]) {
      assert.deepEqual(G.fingers(makeHand(shape, { scale, tilt })), shape, JSON.stringify({ shape, scale, tilt }));
    }
  }
});

test("only thumb + index + middle (ring and little folded) counts as the sign", () => {
  assert.ok(G.isThreeFingerSign(makeHand(three)));
  for (const [name, shape] of Object.entries(others)) assert.ok(!G.isThreeFingerSign(makeHand(shape)), name);
});

test("the pinch used to set volume is never mistaken for the sign", () => {
  for (const pinch of [0.1, 0.5, 1, 1.5, 2]) {
    const hand = makeHand(others.pinchPose, { pinch });
    assert.ok(!G.isThreeFingerSign(hand), `pinch ${pinch}`);
  }
});

test("pinch ratio is the same near and far", () => {
  const near = G.pinchRatio(makeHand(others.pinchPose, { pinch: 1.2, scale: 1.6 }));
  const far = G.pinchRatio(makeHand(others.pinchPose, { pinch: 1.2, scale: 0.4 }));
  assert.ok(Math.abs(near - far) < 1e-9);
});

test("the sign must be held before it switches, and switches only once per showing", () => {
  const s = new G.SignSwitch({ hold: 0.8, rearm: 0.3 });
  for (let t = 0; t < 0.7; t += 0.1) assert.equal(s.update(true, 0.1), false);
  assert.equal(s.on, false, "not yet");
  assert.equal(s.update(true, 0.15), true);
  assert.equal(s.on, true, "started");
  for (let t = 0; t < 3; t += 0.1) s.update(true, 0.1); // keep holding
  assert.equal(s.on, true, "holding longer does not flip it back");
  for (let t = 0; t < 0.4; t += 0.1) s.update(false, 0.1); // lower the hand
  for (let t = 0; t < 0.9; t += 0.1) s.update(true, 0.1); // show the sign again
  assert.equal(s.on, false, "stopped");
});

test("a sign flashed briefly (a passing hand shape) does nothing", () => {
  const s = new G.SignSwitch({ hold: 0.8, rearm: 0.3 });
  for (let i = 0; i < 20; i++) { s.update(true, 0.1); s.update(false, 0.1); }
  assert.equal(s.on, false);
});
