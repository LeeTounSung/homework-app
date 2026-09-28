// transformers.js v3 로컬 latex_finetuned ONNX 생성 검증
// 사용: node gen-test-v3.mjs <model_root> <image> <preproc> [mean] [std] [max_new_tokens] [beams]
//   preproc: squash | aspect-black | aspect-white
import fs from 'fs';
import path from 'path';

const modelRoot = process.argv[2] ?? 'C:/ai/math-ink/model_work';
const imgPath = process.argv[3];
const PREPROC = process.argv[4] ?? 'squash';
const MEAN = Number(process.argv[5] ?? 0.5);
const STD = Number(process.argv[6] ?? 0.5);
const MAX_NEW_TOKENS = Number(process.argv[7] ?? 512);
const BEAMS = Number(process.argv[8] ?? 1);
const localId = 'latex_staging_v3';

// v3 설치 경로로 dynamic import (file:// URL)
const { env, AutoModelForVision2Seq, AutoTokenizer, RawImage, Tensor, cat } = await import('file:///C:/Users/kupid/AppData/Local/Temp/xf3/node_modules/@huggingface/transformers/src/transformers.js');

env.allowLocalModels = true;
env.localModelPath = modelRoot;
env.allowRemoteModels = false;
env.useBrowserCache = false;

const TARGET = 384;

function preprocessToTensor(img) {
  const w = img.width, h = img.height, n = w * h;
  const grey = new Uint8Array(n);
  if (img.channels >= 3) {
    const step = img.channels === 4 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const j = i * step;
      grey[i] = Math.round(0.299 * img.data[j] + 0.587 * img.data[j + 1] + 0.114 * img.data[j + 2]);
    }
  } else { grey.set(img.data); }

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

  let newW, newH, padX = 0, padY = 0, padValue = null;
  if (PREPROC === 'squash') { newW = TARGET; newH = TARGET; }
  else {
    const scale = Math.min(TARGET / cropW, TARGET / cropH);
    newW = Math.round(cropW * scale); newH = Math.round(cropH * scale);
    padX = Math.floor((TARGET - newW) / 2); padY = Math.floor((TARGET - newH) / 2);
    padValue = PREPROC === 'aspect-black' ? -MEAN / STD : (1 - MEAN) / STD;
  }
  const out = new Float32Array(TARGET * TARGET);
  if (padValue !== null) out.fill(padValue);
  for (let y = 0; y < newH; y++) {
    const sy = Math.min(cropH - 1, Math.floor(((y + 0.5) / newH) * cropH));
    for (let x = 0; x < newW; x++) {
      const sx = Math.min(cropW - 1, Math.floor(((x + 0.5) / newW) * cropW));
      const v = grey[(sy + minY) * w + (sx + minX)];
      out[(y + padY) * TARGET + (x + padX)] = (v / 255 - MEAN) / STD;
    }
  }
  return new Tensor('float32', out, [1, 1, TARGET, TARGET]);
}

console.log(`[v3] Load ${localId} from ${modelRoot} ...`);
const t0 = Date.now();
const [model, tokenizer] = await Promise.all([
  AutoModelForVision2Seq.from_pretrained(localId, { dtype: 'fp32' }),
  AutoTokenizer.from_pretrained(localId),
]);
console.log(`[v3] Model ready ${((Date.now()-t0)/1000).toFixed(1)}s  model_type=${model.config?.model_type}`);

const img = await RawImage.read(imgPath);
const pixelValues = cat([preprocessToTensor(img), preprocessToTensor(img), preprocessToTensor(img)], 1);

const genOpts = { max_new_tokens: MAX_NEW_TOKENS };
if (BEAMS > 1) { genOpts.num_beams = BEAMS; genOpts.early_stopping = true; }
const t1 = Date.now();
const outputs = await model.generate({ ...genOpts, pixel_values: pixelValues });
const raw = tokenizer.batch_decode(outputs, { skip_special_tokens: true })[0].replace(/\\!/g, '');
console.log(`[v3] Infer ${((Date.now()-t1)/1000).toFixed(1)}s | PREPROC=${PREPROC} mean=${MEAN} std=${STD} beams=${BEAMS}`);
console.log('=== RESULT LaTeX ===');
console.log(raw);
console.log('====================');
process.exit(0);
