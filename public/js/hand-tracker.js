// Pembungkus MediaPipe Hand Landmarker (21 titik per tangan, maksimal 2 tangan).

const VERSION = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export async function createHandLandmarker() {
  const { FilesetResolver, HandLandmarker } = await import(`${CDN}/vision_bundle.mjs`);
  const fileset = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.5,
  });
  try {
    return await HandLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (err) {
    console.warn('GPU tidak tersedia, pakai CPU:', err);
    return HandLandmarker.createFromOptions(fileset, options('CPU'));
  }
}
