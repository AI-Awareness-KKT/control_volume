/*
 * Hand Volume Control
 * The camera picture goes to MediaPipe Hands, a pretrained AI model that finds 21 points on your
 * hand. The gap between the thumb tip (point 4) and the index-finger tip (point 8) sets the music
 * volume: fingers together = quiet, fingers wide apart = loud.
 *
 * The gap is divided by the size of the hand (wrist to middle-finger knuckle), so the same finger
 * position gives the same volume whether you stand near the camera or far from it.
 *
 * Start/stop sign: thumb, index and middle finger up (ring and little finger folded), held for
 * about a second. The first sign starts volume control, the next one stops it. While stopped the
 * volume stays locked. The rules live in js/gesture.js.
 */
const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");
const fillBar = document.getElementById("fill");
const volumeLabel = document.getElementById("volume-label");
const statusText = document.getElementById("status");
const audio = document.getElementById("music");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const musicBtn = document.getElementById("musicBtn");

// Finger gap ÷ hand size: at or below CLOSED the volume is 0 %, at or above OPEN it is 100 %.
const CLOSED = 0.25;
const OPEN = 1.6;
const SMOOTHING = 0.35; // 0 = frozen, 1 = no smoothing; lower is steadier but slower

let camera = null;
const signSwitch = new Gesture.SignSwitch({ hold: 0.8, rearm: 0.3 });
let lastFrameAt = performance.now();
let flashUntil = 0; // briefly highlight the badge after a start/stop
let volume = 50;        // 0–100, what the bar shows. Starts at 50 % so the music is heard straight away.
let audioContext = null;
let gainNode = null;

// ---------------------- Music with smooth volume ----------------------
// Web Audio gives smooth volume changes and works on phones and tablets where audio.volume is ignored.
function setupAudio() {
  if (audioContext) return;
  // Opened as a file (double-clicked index.html), browsers silence music routed through Web Audio.
  // Use the simple audio.volume control there instead.
  if (location.protocol === "file:") return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioContext.createGain();
    gainNode.gain.value = 0;
    audioContext.createMediaElementSource(audio).connect(gainNode).connect(audioContext.destination);
    audio.volume = 1; // Web Audio now controls the volume; the element itself stays at full volume
  } catch {
    audioContext = null; // fall back to audio.volume below
  }
}
function applyVolume(percent) {
  // Ears hear loudness on a curve, so the gain rises more slowly at first.
  const level = Math.pow(percent / 100, 1.6);
  if (gainNode && audioContext) gainNode.gain.setTargetAtTime(level, audioContext.currentTime, 0.05);
  else audio.volume = level;
}
async function playMusic() {
  setupAudio();
  try {
    if (audioContext && audioContext.state === "suspended") await audioContext.resume();
    await audio.play();
    // If Web Audio could not start, fall back to the simple volume control so the music is heard.
    if (audioContext && audioContext.state !== "running") { audioContext = null; gainNode = null; audio.volume = 1; }
    applyVolume(volume);
    musicBtn.textContent = "⏸ Pause music";
  } catch {
    status("The browser blocked the music. Click ▶ Play music to start it.");
  }
}
function pauseMusic() {
  audio.pause();
  musicBtn.textContent = "▶ Play music";
}
musicBtn.addEventListener("click", () => (audio.paused ? playMusic() : pauseMusic()));

// ---------------------- Hand tracking ----------------------
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`, // same version as index.html
});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6,
});
hands.onResults(onResults);

function status(text) {
  if (statusText.textContent !== text) statusText.textContent = text;
}

function onResults(results) {
  const w = canvasElement.width, h = canvasElement.height, now = performance.now();
  const dt = Math.min((now - lastFrameAt) / 1000, 0.2);
  lastFrameAt = now;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, w, h);
  // Mirror the picture so it moves like a mirror: your right hand appears on the right.
  canvasCtx.translate(w, 0);
  canvasCtx.scale(-1, 1);
  canvasCtx.drawImage(results.image, 0, 0, w, h);

  const landmarks = results.multiHandLandmarks && results.multiHandLandmarks[0];
  let sign = false;
  if (landmarks) {
    drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: "rgba(91, 209, 196, 0.85)", lineWidth: 3 });
    drawLandmarks(canvasCtx, landmarks, { color: "#ffffff", fillColor: "#0b74de", lineWidth: 1, radius: 4 });

    // Same units across and down (the camera picture is wider than it is tall).
    const hand = landmarks.map((p) => ({ x: (p.x * w) / h, y: p.y }));
    sign = Gesture.isThreeFingerSign(hand);
    if (signSwitch.update(sign, dt)) flashUntil = now + 1200;

    if (sign) {
      // Progress ring around the palm while the sign is being held.
      const palm = landmarks[9], r = Gesture.handSize(hand) * h * 0.9;
      canvasCtx.lineWidth = 8;
      canvasCtx.strokeStyle = "rgba(255,255,255,0.35)";
      canvasCtx.beginPath();
      canvasCtx.arc(palm.x * w, palm.y * h, r, 0, Math.PI * 2);
      canvasCtx.stroke();
      canvasCtx.strokeStyle = signSwitch.on ? "#ff8d6b" : "#3fd17f";
      canvasCtx.beginPath();
      canvasCtx.arc(palm.x * w, palm.y * h, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (signSwitch.armed ? signSwitch.progress() : 1));
      canvasCtx.stroke();
    } else if (signSwitch.on) {
      // Adjusting: the thumb-index gap sets the volume.
      const ratio = Gesture.pinchRatio(hand);
      const target = Math.min(Math.max(((ratio - CLOSED) / (OPEN - CLOSED)) * 100, 0), 100);
      volume += (target - volume) * SMOOTHING;

      const a = landmarks[4], b = landmarks[8];
      canvasCtx.strokeStyle = "#ffd84d";
      canvasCtx.lineWidth = 5;
      canvasCtx.beginPath();
      canvasCtx.moveTo(a.x * w, a.y * h);
      canvasCtx.lineTo(b.x * w, b.y * h);
      canvasCtx.stroke();
      for (const p of [a, b]) {
        canvasCtx.beginPath();
        canvasCtx.arc(p.x * w, p.y * h, 9, 0, Math.PI * 2);
        canvasCtx.fillStyle = "#ffd84d";
        canvasCtx.fill();
      }
    }
  } else {
    signSwitch.update(false, dt); // no hand counts as "sign not showing"
  }
  canvasCtx.restore();

  drawBadge(now, !!landmarks, sign);
  if (!landmarks) status("No hand found. Show one hand, palm towards the camera.");
  else if (sign && signSwitch.armed) status(signSwitch.on ? "Hold the three-finger sign to STOP changing the volume…" : "Hold the three-finger sign to START changing the volume…");
  else if (sign) status("Got it. Lower your hand or change shape to continue.");
  else if (signSwitch.on) status(`Adjusting: pinch to turn down, spread to turn up · volume ${Math.round(volume)} %`);
  else status("Volume locked. Show three fingers (thumb, index, middle) to start adjusting.");
  showVolume();
}

/** The mode badge in the top-left corner of the camera picture. */
function drawBadge(now, handSeen, sign) {
  const on = signSwitch.on, flash = now < flashUntil;
  const text = on ? "ADJUSTING · show 3 fingers to stop" : "LOCKED · show 3 fingers to start";
  canvasCtx.save();
  canvasCtx.font = "bold 30px Arial";
  const width = canvasCtx.measureText(text).width + 40;
  canvasCtx.fillStyle = flash ? (on ? "#3fd17f" : "#ff8d6b") : "rgba(10, 20, 35, 0.75)";
  canvasCtx.beginPath();
  canvasCtx.roundRect(20, 20, width, 54, 12);
  canvasCtx.fill();
  canvasCtx.fillStyle = flash ? "#0b1424" : on ? "#3fd17f" : "#ffffff";
  canvasCtx.fillText(text, 40, 58);
  canvasCtx.restore();
  fillBar.style.background = on ? "#0b74de" : "#8aa4c2";
}

function showVolume() {
  const rounded = Math.round(volume);
  fillBar.style.width = rounded + "%";
  volumeLabel.textContent = `Volume: ${rounded}%`;
  applyVolume(volume);
}

// ---------------------- Camera controls ----------------------
startBtn.addEventListener("click", async () => {
  if (camera) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    status("The camera needs HTTPS (GitHub Pages) or localhost.");
    return;
  }
  startBtn.disabled = true;
  status("Allow camera access. Loading the hand-tracking model…");
  playMusic(); // started from this click, which browsers require before playing sound
  camera = new Camera(videoElement, {
    onFrame: async () => {
      await hands.send({ image: videoElement });
    },
    width: 1280,
    height: 720,
  });
  try {
    await camera.start();
    stopBtn.disabled = false;
  } catch (error) {
    camera = null;
    startBtn.disabled = false;
    status(error && error.name === "NotAllowedError" ? "Camera permission was denied. Allow it in the browser settings and try again." : "The camera could not start. Close other apps using it and try again.");
  }
});

stopBtn.addEventListener("click", () => {
  if (!camera) return;
  camera.stop();
  camera = null;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  pauseMusic();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  status("Camera stopped.");
});

showVolume();
