# Hand Volume Control · AI Awareness Project

Control the volume of real music with your hand. The page runs entirely in the browser, so it works on GitHub Pages.

- **AI model:** MediaPipe Hands (pretrained, runs in the browser) finds 21 points on your hand in every camera frame.
- **Control:** the gap between the thumb tip and the index-finger tip sets the volume. Fingers together = quiet, wide apart = loud.
- **Works near or far:** the gap is divided by the size of the hand (wrist to middle knuckle), so the same finger position gives the same volume at any distance.
- **Smooth sound:** the volume is smoothed and follows a loudness curve, using the Web Audio API (also works on phones and tablets).
- **Privacy:** the camera picture stays in the browser. Nothing is recorded or uploaded.

## How to use

1. Open the page (GitHub Pages uses HTTPS, which the camera needs) and click **Start Camera**. The music starts with that click, because browsers only play sound after a click.
2. Hold up one hand, palm towards the camera.
3. Pinch to turn the music down, spread your fingers to turn it up. **▶ Play / ⏸ Pause music** toggles the music.

To try it on your computer: run `python3 -m http.server 8000` in this folder and open http://localhost:8000. Double-clicking `index.html` will not work, because the camera needs localhost or HTTPS.

## Files

- `index.html`: the page.
- `js/main.js`: hand tracking, volume calculation and music control. `CLOSED`, `OPEN` and `SMOOTHING` at the top tune how it feels.
- `static/open-hands.mp3`: the music (about 69 s, loops seamlessly).
- `static/logo.jpg`: project banner.
- `music-source/compose.py`: the program that composed and synthesised the music (Python with numpy and scipy).

## Music

“Open Hands” is original music composed for this project with `music-source/compose.py`, so it can be published and reused freely. To swap in another track, replace `static/open-hands.mp3` (or change the `src` of the `<audio>` element in `index.html`). Use only music you have the rights to publish on a website: for example, royalty-free or CC0 tracks whose licence allows website use. Free “no copyright” channels often allow only videos and streams.
