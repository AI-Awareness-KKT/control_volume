/*
 * Hand Volume Control
 * The camera picture goes to MediaPipe Hands, a pretrained AI model that finds 21 points on your
 * hand. The gap between the thumb tip (point 4) and the index-finger tip (point 8) sets the music
 * volume: fingers together = quiet, fingers wide apart = loud.
 *
 * The gap is divided by the size of the hand (wrist to middle-finger knuckle), so the same finger
 * position gives the same volume whether you stand near the camera or far from it.
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
let volume = 0;         // 0–100, what the bar shows
let audioContext = null;
let gainNode = null;

// ---------------------- Music with smooth volume ----------------------
// Web Audio gives smooth volume changes and works on phones and tablets where audio.volume is ignored.
function setupAudio() {
  if (audioContext) return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioContext.createGain();
    gainNode.gain.value = 0;
    audioContext.createMediaElementSource(audio).connect(gainNode).connect(audioContext.destination);
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
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
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

/** Finger gap divided by hand size, with x and y in the same units (pixels). */
function pinchRatio(landmarks, width, height) {
  const px = (p) => ({ x: p.x * width, y: p.y * height });
  const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const thumb = px(landmarks[4]), index = px(landmarks[8]);
  const wrist = px(landmarks[0]), knuckle = px(landmarks[9]);
  return gap(thumb, index) / Math.max(gap(wrist, knuckle), 1);
}

function onResults(results) {
  const w = canvasElement.width, h = canvasElement.height;
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, w, h);
  // Mirror the picture so it moves like a mirror: your right hand appears on the right.
  canvasCtx.translate(w, 0);
  canvasCtx.scale(-1, 1);
  canvasCtx.drawImage(results.image, 0, 0, w, h);

  const landmarks = results.multiHandLandmarks && results.multiHandLandmarks[0];
  if (landmarks) {
    drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: "rgba(91, 209, 196, 0.85)", lineWidth: 3 });
    drawLandmarks(canvasCtx, landmarks, { color: "#ffffff", fillColor: "#0b74de", lineWidth: 1, radius: 4 });

    const ratio = pinchRatio(landmarks, w, h);
    const target = Math.min(Math.max(((ratio - CLOSED) / (OPEN - CLOSED)) * 100, 0), 100);
    volume += (target - volume) * SMOOTHING;

    // The line between thumb and index tip, the "control" the AI is measuring.
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
    status(`Hand found · finger gap ${ratio.toFixed(2)} × hand size → volume ${Math.round(volume)} %`);
  } else {
    status("No hand found: the volume stays where it was. Show one hand, palm towards the camera.");
  }
  canvasCtx.restore();
  showVolume();
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
