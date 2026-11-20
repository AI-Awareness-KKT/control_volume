/*
 * Hand-sign rules for the volume control. No camera or drawing code here, so the rules can be
 * tested on their own (see tests/gesture.test.js).
 *
 * MediaPipe numbers the 21 hand points like this:
 *   0 wrist · thumb 1–4 · index 5–8 · middle 9–12 · ring 13–16 · little finger 17–20
 *   (for each finger: knuckle, middle joint, top joint, tip)
 */
(function (global) {
  const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /** Size of the hand: wrist to middle-finger knuckle. Everything is measured relative to it. */
  function handSize(p) {
    return Math.max(gap(p[0], p[9]), 1e-6);
  }

  /**
   * A finger is "up" when its tip is clearly farther from the wrist than its middle joint.
   * This works whichever way the hand is turned.
   */
  function fingerUp(p, tip, middleJoint) {
    return gap(p[0], p[tip]) > gap(p[0], p[middleJoint]) * 1.15;
  }

  /** The thumb is "out" when its tip is well away from the palm (the middle-finger knuckle). */
  function thumbOut(p) {
    return gap(p[4], p[9]) > 0.7 * handSize(p);
  }

  /** Which fingers are up: {thumb, index, middle, ring, little}. */
  function fingers(p) {
    return {
      thumb: thumbOut(p),
      index: fingerUp(p, 8, 6),
      middle: fingerUp(p, 12, 10),
      ring: fingerUp(p, 16, 14),
      little: fingerUp(p, 20, 18),
    };
  }

  /** The start/stop sign: thumb, index and middle up; ring and little finger folded. */
  function isThreeFingerSign(p) {
    const f = fingers(p);
    return f.thumb && f.index && f.middle && !f.ring && !f.little;
  }

  /** Thumb-tip to index-tip gap divided by hand size, so it is the same near or far. */
  function pinchRatio(p) {
    return gap(p[4], p[8]) / handSize(p);
  }

  /**
   * Turns "is the sign showing?" into start/stop switches.
   * - The sign must be held for HOLD seconds before it counts (ignores passing shapes).
   * - After a switch, the sign must disappear for REARM seconds before it can switch again,
   *   so holding it longer does not flip on and off.
   */
  class SignSwitch {
    constructor({ hold = 0.8, rearm = 0.3 } = {}) {
      this.hold = hold;
      this.rearm = rearm;
      this.on = false;      // true = volume follows the fingers
      this.held = 0;        // seconds the sign has been showing
      this.away = rearm;    // seconds the sign has been absent
      this.armed = true;
    }
    /** Call once per camera frame. Returns true on the frame the switch flips. */
    update(signShowing, dt) {
      if (signShowing) {
        this.away = 0;
        this.held += dt;
        if (this.armed && this.held >= this.hold) {
          this.on = !this.on;
          this.armed = false;
          return true;
        }
      } else {
        this.held = 0;
        this.away += dt;
        if (this.away >= this.rearm) this.armed = true;
      }
      return false;
    }
    /** 0–1: how far through the hold the sign is (for the progress ring). */
    progress() {
      return this.armed ? Math.min(this.held / this.hold, 1) : 0;
    }
  }

  const api = { handSize, fingerUp, thumbOut, fingers, isThreeFingerSign, pinchRatio, SignSwitch };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.Gesture = api;
})(typeof window !== "undefined" ? window : globalThis);
