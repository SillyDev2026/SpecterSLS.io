# SpecterSLS.io · v2.5 — Figure Scan / Human-Shape Visualization

**Live website (if GitHub Pages enabled):** https://sillydev2026.github.io/SpecterSLS.io/

## New in v2.5

### See the actual camera-detected figure (not a fabricated ghost)
- **FIGURE SCAN mode** in the scanner profile selector shows a real camera feed with human-body segmentation overlays when MediaPipe supplies a mask.
- Four visualization modes: **Body Outline**, **Filled Silhouette**, **X-Ray Style**, and **Bounding Boxes**.
- A **LIVE CAMERA BODY CROP** preview uses only actual camera pixels of the detected shape. This is a crop/brightness enhancement, not AI image synthesis.
- Three evidence indicators: currently tracked shapes, average visible landmark score, and whether the real pixel mask is available.
- Body overlay cutoff (35–85%) lets you reduce stray segmentation pixels.
- **Stable Figure Tracking** waits approximately 1.5 seconds of a consistent body-like pose before writing a pose event.
- Smoothed joint positions reduce jitter between ML inference frames, and weak central-joint detections are ignored.
- Model loads GPU-first and falls back to CPU. If person segmentation is unsupported, pose landmarks/bounding boxes remain usable.

**Important:** Nothing in a phone camera or AI pose model can reveal the visual appearance of an invisible or supernatural entity. This visualization only depicts person-like shapes that are supported by camera pixels. False positives can occur with furniture, patterned walls, shadows, mirrors and screens. The percentage in Figure Scan is **landmark visibility**, NOT probability that a ghost is present.

### Reliability fixes
- Camera start/stop uses a generation token to prevent an interrupted camera/model load from restarting video after Stop.
- Closing and reusing MediaPipe segmentation masks avoids prolonged memory use.
- Cached segmentation matte avoids rebuilding the image mask on every display refresh; the cached matte is preserved until the next inference.
- Switching mobile tabs no longer resets the camera canvas during recording.
- PWA cache version upgraded to v2.5 and includes the new figure scripts/styles.
- Added automated smoke tests with a GitHub Actions workflow. Run locally with Node 22: `node tests/smoke.cjs`.

### How to use Figure Scan
1. Open the GitHub Pages site over HTTPS in Chrome.
2. Select **FIGURE SCAN** in the live camera profiles and press **START SCANNER**.
3. Permit the camera; allow the MediaPipe pose model to load.
4. In **Settings**, select Outline, Silhouette, X-Ray, or Bounding Boxes, adjust Mask Confidence and enable Stable Figure Tracking.
5. Watch the status indicators and the live **camera crop**. If it says **LANDMARKS ONLY**, your browser/model cannot supply a segmentation mask.
6. Take a screenshot/video if you want to review any physical shape. Do not infer paranormal presence from a green outline.

### Device caveats
- The Motorola Razr Ultra 2026 does **not** contain dedicated LiDAR hardware. The dot mode is optical, and the experimental AR Depth view only uses WebXR estimated depth when available.
- Actual frame rate depends on the phone's camera, thermal behavior, GPU, model and browser.
- Spirit Box modes remain synthetic RF static, local audio-clip hopping, or real internet streams (no direct analog radio tuner access).
- GitHub Pages hosting and on-device camera/AR/radio checks must be confirmed after deployment.

---


**GitHub Pages (when enabled):** https://sillydev2026.github.io/SpecterSLS.io/

## New in v2.4

### SLS-inspired camera dots (no LiDAR hardware required)
- Three optical display styles: Surface Detail, Outlines & Motion, Full Dot Grid.
- Three colors: Kinect/SLS-style green, cyan-blue and thermal-style.
- Five dot density levels and five sensitivity levels.
- Cached dot bitmap improves canvas-rendering performance between camera samples.
- Optional faint video backdrop behind the dots; animated sweep line is a visual effect.
- Exported optical points are normalized **2D pixel positions**, not 3D distance measurements.
- Disable skeleton overlays to skip pose model loading during optical-only scanning.

### Real AR depth improvements (experimental)
- Choose sample resolution, depth range (3, 6, 12 meters) and depth palette.
- Uses actual browser-provided WebXR depth-meter measurements when available.
- Adapts detail when render work is expensive. Browser and device support are not guaranteed.
- ARCore may estimate depth from the moving camera without dedicated LiDAR hardware.

### Spirit Box fixes
- Isolated Web Audio gain paths prevent synthetic RF static from leaking into user-loaded audio clips.
- Internet stream failures auto-skip; station-directory requests time out and outdated requests are ignored.
- For online radio, first tap LOAD STATIONS and then START SWEEP, preserving a direct audio user gesture on Android.
- Radio station switching needs at least 3 seconds and network buffering may take longer.
- Fast synthetic AM/FM-style frequency values are simulated, **not real terrestrial radio reception**.
- Synthesized and user-provided clips can be recorded. Arbitrary remote streams are not captured.

### Screen-relative scaling
- Main content uses fluid 64%/36% layout ratios with responsive layout, screen-height-relative camera viewport and container-relative controls.
- Small phones use stacked pages, fluid camera buttons, viewport-based sizes and viewport-safe spacing.
- CSS borders remain thin pixels; substantial positions and sizes are responsive percentages or viewport-relative units.
- Updated the PWA cache to include the new dot engine and responsive styles.

## On-phone verification
1. Open the GitHub Pages site in Chrome (HTTPS).
2. Select DOT CLOUD and Full Dot Grid, then move the phone around to inspect surfaces.
3. Try green/cyan palette and adjust dot density.
4. Verify render FPS separately from model inference FPS (neither is guaranteed).
5. In Investigation > Spirit Box, test synthesized RF and local clips independently.
6. For live streams: Real Internet Radio > Load Stations > Start Sweep.
7. Try AR DEPTH (BETA) only if Chrome exposes WebXR Depth Sensing.

The SLS visuals and sound-sweep features cannot detect ghosts or establish paranormal activity.

---


**Live site (when GitHub Pages is enabled):** https://sillydev2026.github.io/SpecterSLS.io/

## New in v2.3

### Spirit Box
- **Synthetic RF sweep**: Web Audio static/filter synthesis with an AM/FM-style readout. Adjustable hop intervals **50 ms–30 seconds**, forward/reverse/random tuning, volume control and audio spectrum visualization. Displayed RF numbers **do not represent received radio frequencies**.
- **Local clip bank**: Load audio files directly from your phone and hop between snippets at your chosen interval. Imported files remain in your browser and are never uploaded.
- **Real Internet Radio**: On demand, retrieve HTTPS streaming stations from the public [Radio Browser](https://www.radio-browser.info/) directory for the US, UK, Canada, Australia or Germany, with optional **talk** or **news** filtering, then switch stations. Minimum practical interval is **3 seconds**; station switching can be delayed by network buffering, and some stations may reject playback or be unavailable.
- **Evidence markers**: Manually mark the currently displayed frequency/stream and sweep interval in your investigation log.
- **Audio recording**: Export browser-generated static or your local clip-bank output to WebM/Opus (or supported MP4 audio). Due to cross-origin web audio protections, **internet streams cannot be recorded by this tool**.
- **Safe defaults**: Starts only with an explicit tap. Stops when the tab goes into the background and does not automatically upload audio or recordings.

### Scanner speed
- **Turbo** targets up to 30 model inferences per second when possible; **Ultra** requests up to 60 camera/render frames/s where the camera/browser support it. These are targets, **not measured guarantees**.
- The interface reports *separate live values* for canvas render FPS and model inference FPS.
- Model inference throttles adaptively when the phone is under load. Higher frame rates increase battery use and heat.
- Canvas-resolution limits reduce GPU fill-rate and improve live dot-overlay performance on foldable phones.

### Compatibility and disclosures
- The Razr Ultra 2026 has no dedicated LiDAR hardware. Optical dots remain 2D image measurements; AR Depth Beta requires WebXR/ARCore depth support exposed by the phone and browser.
- A phone browser **cannot tune physical AM/FM bands** using camera or AR APIs. Synthetic RF sounds and frequency numbers are a demonstration. Real Internet Radio switches between live online streams, **not terrestrial radio hardware**.
- An SLS pose is an algorithmic estimation of human-like landmarks. A waveform or heard syllable is not evidence of ghosts or spirits.
- Always begin at low volume, especially with headphones. Avoid using the app where situational awareness is important.

### Using the Spirit Box
1. Open the **Investigation** tab on mobile and locate **03 · Spirit Box**.
2. Choose **Synthetic RF Static**, **Local Audio Clips**, or **Real Internet Radio**.
3. Choose hop direction, time per hop, and volume. For live internet streams, load a station directory first and use a rate of 3 seconds or longer.
4. Tap **Start Sweep**. Use **Mark Audio Event** to annotate a moment.
5. In RF/clip mode, tap **Record Box** to save the audio locally. Tap Stop when done.

---


**Live site:** https://sillydev2026.github.io/SpecterSLS.io/

## New in v2.1

- **Optical DOT CLOUD**: green dots derived from live camera brightness gradients and frame-to-frame motion; density and sensitivity controls, freeze/resume, and a downloadable JSON map of normalized 2D points. This does **not** provide measured depth or LiDAR.
- **AR DEPTH (BETA)**: `depth.html` uses the WebXR Depth Sensing API for approximate real-world distances when supported. It requires HTTPS, Chrome/Android with compatible ARCore and an active immersive AR depth session. Some devices and browsers will reject the feature.
- **Direct fallback**: unsupported devices can still use the 2D optical dot view.
- **Local processing**: the page does not upload camera video or depth maps. MediaPipe assets are fetched from external hosted model resources when used.
- **Mobile-ready**: responsive UI for Motorola Razr Ultra and other Android phones.

**Important:** No mode detects spirits or proves paranormal activity. Optical dots reflect camera appearance; AR depth estimates physical scene geometry and may be noisy or unavailable.

## Deploy

This project is committed to `main`. In the repository go to **Settings → Pages → Deploy from a branch → main → /(root)**.

## Technical references

- https://developers.google.com/ar/develop/webxr/arcore-comparison
- https://www.w3.org/TR/webxr-depth-sensing-1/
- https://developer.mozilla.org/en-US/docs/Web/API/XRFrame/getDepthInformation

---

# SpecterSLS.io — Investigation Studio v2.0.0

A privacy-conscious, installable Android/desktop web app for **SLS-style camera body-pose visualization** and local field journaling.

> **Important:** SpecterSLS is **not LiDAR**, electromagnetic sensing, an infrared camera, spirit communication, or a scientifically validated paranormal detector. It maps **human-like patterns** with a real pose-estimation model. Posters, pets, furniture, silhouettes, reflections, and motion can create false positive body poses. Filters labeled *night* and *mono* are visual CSS/canvas treatments, **not actual infrared or night-vision hardware**. Audio dBFS measures digital microphone level, not calibrated dB SPL.

## Improvements over v1

- Entirely rebuilt phone-first interface with **Scanner / Investigation / Settings** views on narrow screens.
- Live tracking of up to **3 human-like body poses**, tracked across frames with stable IDs, smoothing and **900 ms temporal confirmation** for fewer spam events.
- Four live color profiles: SLS-green, green nighttime effect, monochrome and natural camera.
- Configurable joint visibility, processing speed (battery/balanced/performance), skeletal overlay and motion trails.
- Camera flipping, supported flashlight toggle, fullscreen scanner and optional screen wake lock.
- Real microphone **RMS dBFS** display and **live waveform**, with optional loud-sound event tagging (no fake EVP claims).
- Screenshot (PNG) and camera/overlay recording (WebM, mic audio only when enabled).
- Named investigations, local journal, manual field observations, filters, JSON/CSV exports, validated JSON import and independent sessions.
- PWA manifest, 192px PNG and scalable SVG icons, and app-shell service worker. Browser installation support varies.
- All captured videos/images download to the device, and are **not** secretly uploaded. Only lightweight session metadata stays in localStorage.

## Deploy to GitHub Pages

1. Create a public GitHub repository (e.g. `SpecterSLS.io`).
2. The project files are committed directly to the `main` branch, including `.nojekyll`.
3. On GitHub go to **Settings → Pages → Build and deployment → Deploy from a branch → `main` → `/ (root)` → Save**.
4. Open `https://YOURNAME.github.io/SpecterSLS.io/` once Pages is live, and grant camera/microphone permissions as needed.

No Node.js build, API tokens, backend, accounts, or cloud storage required.

### Local development

Opening `index.html` with `file://` does not support all features. Instead, serve the directory:

```sh
python3 -m http.server 8000
```

Browse `http://localhost:8000/`. Chrome for Android typically requires a publicly served **HTTPS** site. GitHub Pages uses HTTPS.

### Model

Uses Google's MediaPipe Pose Landmarker Lite model. On first use, the app dynamically downloads MediaPipe WASM/JS from jsDelivr and the `.task` model from Google Cloud Storage. The service worker **only caches the site shell**, not the ML runtime. Camera preview, notes and past session history still work if the model fails to load, but AI landmarks will not appear.

- MediaPipe API guide: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- Default model: `pose_landmarker_lite.task`
- Library pinned: `@mediapipe/tasks-vision@0.10.35`
- GPU delegate with CPU fallback.
- Pose inference runs on the main thread at a configurable throttled rate; performance depends on device, camera quality, lighting, and browser. The FPS number is actual successful inference rate, not screen refresh rate.

### Limitations / honest behaviors

- Motorola Razr Ultra 2026 has **no hardware LiDAR**. There is no physical 3D depth map.
- **Audio peaks** use a rough digital microphone amplitude threshold and cannot prove EVP.
- WebM support varies by browser. Recording pauses/no-audio limitations depend on browser capabilities.
- On Android, the flashlight toggle is exposed **only** if `MediaStreamTrack.getCapabilities().torch` is supported; otherwise it stays disabled.
- The app does **not** auto-record in the background; browsers can suspend camera and wake locks when tab visibility changes.
- Session metadata uses limited browser localStorage (max 25 investigations, 200 events per investigation). Browser storage may be erased by users, privacy mode, or OS cleanup. Export JSON for a backup. Images and videos are downloaded separately, never stored in the journal.
- Pose model cannot certify object identity, spiritual activity, or spatial accuracy. Investigate ordinary causes of unusual readings.

## Privacy

All processing happens locally in the browser except downloads of the JavaScript/MediaPipe model dependencies. No analytics, remote APIs for session content, cookies, accounts, geolocation, or tracking. Browser camera/mic permission is explicit.

## Files

- `index.html` — UI and accessible controls
- `styles.css` — mobile/desktop layout, HUD and panels
- `app.js` — webcam, MediaPipe, microphone, recording, local sessions
- `sw.js` — offline app-shell cache
- `manifest.webmanifest`, `icon-192.png`, `icon.svg` — PWA icons and installation assets
- `.nojekyll` — GitHub Pages compatible

## License

MIT. See `LICENSE`.