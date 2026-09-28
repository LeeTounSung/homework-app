// transformers.js v3 — HF 원격 repo에서 모델 로드 + 생성 검증 (브라우저와 동일 경로)
// 사용: node gen-test-hf.mjs <image> [max_new_tokens]
import { RawImage, Tensor, cat, env, VisionEncoderDecoderModel, PreTrainedTokenizer } from 'file:///C:/Users/kupid/AppData/Local/Temp/xf3/node_modules/@huggingface/transformers/src/transformers.js';

const MODEL_ID = 'Youn-Sung/latex-finetuned-onnx';
const imgPath = process.argv[2];
const MAX_NEW_TOKENS = Number(process.argv[3] ?? 512);

env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = false;

const TARGET = 384, MEAN = 0.5, STD = 0.5;

// 앱의 buildPixelValues와 동일: 잉크 크롭 → 384 squash → NORM 0.5/0.5
function preprocessToTensor(img) {
  const w = img.width, h = img.height, n = w * h;
  const grey = new Uint8Array(n);
  const step = img.channels === 4 ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const j = i * step;
    grey[i] = Math.round(0.299 * img.data[j] + 0.587 * img.data[j + 1] + 0.114 * img.data[j + 2]);
  }

  let dark = 0, light = 0;
  for (const v of grey) (v < 200) ? dark++ : light++;
  if (dark >= light) for (let i = 0; i < n; i++) grey[i] = 255 - grey[i];

  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (grey[y * w + x] < 200) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX === 0 && maxY === 0) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }
  const cropW = maxX - minX + 1, cropH = maxY - minY + 1;

  const out = new Float32Array(TARGET * TARGET);
  for (let y = 0; y < TARGET; y++) {
    const sy = Math.min(cropH - 1, Math.floor(((y + 0.5) / TARGET) * cropH));
    for (let x = 0; x < TARGET; x++) {
      const sx = Math.min(cropW - 1, Math.floor(((x + 0.5) / TARGET) * cropW));
      const v = grey[(sy + minY) * w + (sx + minX)];
      out[y * TARGET + x] = (v / 255 - MEAN) / STD;
    }
  }
  return new Tensor('float32', out, [1, 1, TARGET, TARGET]);
}

function balanceBraces(s) {
  let open = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === '{') open++;
    else if (s[i] === '}') open--;
  }
  while (open < 0 && s.endsWith('}')) { s = s.slice(0, -1); open++; }
  while (open > 0) { s += '}'; open--; }
  return s;
}

console.log(`[HF] Load ${MODEL_ID} (브라우저와 동일 repo) ...`);
const t0 = Date.now();
const [model, tokenizer] = await Promise.all([
  VisionEncoderDecoderModel.from_pretrained(MODEL_ID, { dtype: 'fp32' }),
  PreTrainedTokenizer.from_pretrained(MODEL_ID),
]);
console.log(`[HF] Model ready ${((Date.now() - t0) / 1000).toFixed(1)}s  model_type=${model.config?.model_type}`);

const img = await RawImage.read(imgPath);
const t1 = Date.now();
const pixelValues = cat([preprocessToTensor(img), preprocessToTensor(img), preprocessToTensor(img)], 1);
const outputs = await model.generate({ pixel_values: pixelValues, max_new_tokens: MAX_NEW_TOKENS });
const raw = balanceBraces(tokenizer.batch_decode(outputs, { skip_special_tokens: true })[0].replace(/\\!/g, '').trim());
console.log(`[HF] Infer ${((Date.now() - t1) / 1000).toFixed(1)}s`);
console.log('=== RESULT LaTeX ===');
console.log(raw);
console.log('====================');
process.exit(0);
