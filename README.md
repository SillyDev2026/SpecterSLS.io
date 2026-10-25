# SpecterSLS.io · v2.1 (Optical Dots + Experimental AR Depth)

**Live site:** https://sillydev2026.github.io/SpecterSLS.io/

## New in v2.1

- **Optical DOT CLOUD**: green dots derived from live camera brightness gradients and frame-to-frame motion; dot density and sensitivity are configurable. This does **not** provide measured depth or LiDAR.
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