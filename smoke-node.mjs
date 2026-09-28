// Smoke test: verify the image-to-LaTeX model loads and runs in Node.
// Replicates the Obsidian "math-convert" approach: manual VisionEncoderDecoderModel
// + PreTrainedTokenizer + manual 384x384 preprocessing (no pipeline()).
//
// A/B 테스트용 매개변수 (환경변수):
//   MODEL=...              모델 ID (기본 alephpi/FormulaNet)
//   MEAN/STD=...           정규화 상수 (기본 0.5/0.5 = TrOCR)
//   PREPROC=...            squash | aspect-black | aspect-white
//                            squash      = 384×384로 비율 무시 스트레치 (pix2tex 공식 추론 방식)
//                            aspect-black= 비율 유지 + 검정 패딩 (FormulaNet/Texo 공식)
//                            aspect-white= 비율 유지 + 흰색 패딩 (MathWriting 학습분포)
//   MAX_NEW_TOKENS=...     생성 최대 토큰 수 (기본 512 — config에 max_length가 없어 truncation 방지)
//   BEAMS=...              빔 탐색 (기본 1 = 탐욕)
// Usage: node smoke-node.mjs [image.png]
import {
  VisionEncoderDecoderModel, PreTrainedTokenizer, RawImage, Tensor, cat, env,
} from '@huggingface/transformers';

env.allowLocalModels = false; // always fetch from HuggingFace Hub

const imgPath = process.argv[2] ?? './test_formula.png';
const modelId = process.env.MODEL ?? 'alephpi/FormulaNet';
const PREPROC = process.env.PREPROC ?? 'squash';   // squash | aspect-black | aspect-white
const MEAN = Number(process.env.MEAN ?? '0.5');
const STD = Number(process.env.STD ?? '0.5');
const MAX_NEW_TOKENS = Number(process.env.MAX_NEW_TOKENS ?? '512');
const BEAMS = Number(process.env.BEAMS ?? '1');   // 1=탐욕, N=빔탐색

const TARGET = 384;

function preprocessToTensor(img) {
  const w = img.width, h = img.height, n = w * h;
  const grey = new Uint8Array(n);
  if (img.channels === 3) {
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      grey[i] = Math.round(0.299 * img.data[j] + 0.587 * img.data[j + 1] + 0.114 * img.data[j + 2]);
    }
  } else if (img.channels === 4) {
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      grey[i] = Math.round(0.299 * img.data[j] + 0.587 * img.data[j + 1] + 0.114 * img.data[j + 2]);
    }
  } else {
    grey.set(img.data);
  }

  // invert to black-ink-on-white if the background is dark
  let dark = 0, light = 0;
  for (const v of grey) (v < 200) ? dark++ : light++;
  if (dark >= light) for (let i = 0; i < n; i++) grey[i] = 255 - grey[i];

  // ink bounding box
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

  let newW, newH, padX = 0, padY = 0;
  let padValue = null;
  if (PREPROC === 'squash') {
    newW = TARGET; newH = TARGET;                       // 비율 무시 스트레치
  } else {
    const scale = Math.min(TARGET / cropW, TARGET / cropH);
    newW = Math.round(cropW * scale), newH = Math.round(cropH * scale);
    padX = Math.floor((TARGET - newW) / 2), padY = Math.floor((TARGET - newH) / 2);
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

console.log(`Loading ${modelId}...`);
const t0 = Date.now();
const [model, tokenizer] = await Promise.all([
  VisionEncoderDecoderModel.from_pretrained(modelId, {
    dtype: 'fp32',
    progress_callback: (p) => {
      if (p.status === 'progress') process.stdout.write(`\rdownload ${(p.file ?? '')} ${(p.progress * 100).toFixed(0)}%`);
    },
  }),
  PreTrainedTokenizer.from_pretrained(modelId),
]);
console.log(`\nModel ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const img = await RawImage.read(imgPath);
const pixelValues = cat([preprocessToTensor(img), preprocessToTensor(img), preprocessToTensor(img)], 1);

const t1 = Date.now();
const genOpts = { inputs: pixelValues, max_new_tokens: MAX_NEW_TOKENS };
if (BEAMS > 1) { genOpts.num_beams = BEAMS; genOpts.early_stopping = true; }
const outputs = await model.generate(genOpts);
const raw = tokenizer.batch_decode(outputs, { skip_special_tokens: true })[0].replace(/\\!/g, '');
console.log(`Inference took ${((Date.now() - t1) / 1000).toFixed(1)}s`);
console.log('=== RESULT LaTeX ===');
console.log(raw);
console.log('====================');
if (!raw || raw.trim().length === 0) { console.error('FAIL: empty output'); process.exit(1); }
process.exit(0);
