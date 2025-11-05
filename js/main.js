const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");

const fillBar = document.getElementById("fill");
const volumeLabel = document.getElementById("volume-label");
const audio = document.getElementById("sampleAudio");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

let camera = null;

// Initialize MediaPipe Hands
const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  },
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

hands.onResults(onResults);

// ---------------------- DRAWING + LOGIC ----------------------
function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
        color: "rgba(0,255,0,0.6)",
        lineWidth: 1.5,
      });
      drawLandmarks(canvasCtx, landmarks, {
        color: "#FF0000",
        lineWidth: 0.5,
        radius: 2,
      });
      updateVolume(landmarks);
    }
  }
  canvasCtx.restore();
}

// ---------------------- SIMULATED VOLUME LOGIC ----------------------
function updateVolume(landmarks) {
  const thumb = landmarks[4];
  const index = landmarks[8];
  const dx = thumb.x - index.x;
  const dy = thumb.y - index.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const minDist = 0.02;
  const maxDist = 0.25;
  let volPercent = ((dist - minDist) / (maxDist - minDist)) * 100;
  volPercent = Math.min(Math.max(volPercent, 0), 100);
  const roundedVol = Math.round(volPercent);

  fillBar.style.width = roundedVol + "%";
  volumeLabel.textContent = `Volume: ${roundedVol}%`;
  audio.volume = roundedVol / 100;
}

// ---------------------- CAMERA CONTROLS ----------------------
startBtn.addEventListener("click", () => {
  if (camera) return;

  camera = new Camera(videoElement, {
    onFrame: async () => {
      await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480,
  });

  camera.start();
  startBtn.disabled = true;
  stopBtn.disabled = false;

  audio.play();
  audio.volume = 0;
});

stopBtn.addEventListener("click", () => {
  if (!camera) return;
  camera.stop();
  camera = null;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  audio.pause();
});
