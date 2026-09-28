// onnxruntime-web(WASM) 백엔드로 int8 encoder 실행 검증 — 브라우저 호환성 확인
import * as ort from 'file:///C:/Users/kupid/AppData/Local/Temp/xf3/node_modules/onnxruntime-web/dist/ort.wasm.mjs';
import fs from 'fs';

const modelPath = process.argv[2] ?? 'C:/ai/math-ink/model_work/latex_onnx_int8/encoder_model.onnx';
const wasmDir = 'C:/Users/kupid/AppData/Local/Temp/xf3/node_modules/onnxruntime-web/dist/';

// Node에서는 fetch 대신 wasm 바이너리를 직접 메모리로 주입
ort.env.wasm.wasmBinary = fs.readFileSync(wasmDir + 'ort-wasm-simd-threaded.wasm');
ort.env.wasm.numThreads = 1;

console.log('ORT version:', ort.env?.versions?.web ?? '?');
const t0 = Date.now();
const modelBuf = fs.readFileSync(modelPath);
const sess = await ort.InferenceSession.create(modelBuf, { executionProviders: ['wasm'] });
console.log(`Session loaded in ${((Date.now()-t0)/1000).toFixed(1)}s`);
console.log('inputs:', sess.inputNames);
console.log('outputs:', sess.outputNames);

const len = 1*3*384*384;
const data = new Float32Array(len).fill(0.5);
const feeds = {};
for (const name of sess.inputNames) {
  if (name === 'pixel_values') feeds[name] = new ort.Tensor('float32', data, [1,3,384,384]);
  else feeds[name] = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
}
const t1 = Date.now();
const out = await sess.run(feeds);
console.log(`Infer in ${((Date.now()-t1)/1000).toFixed(1)}s`);
for (const k of Object.keys(out)) {
  console.log(k, 'shape', out[k].dims, 'first3', Array.from(out[k].data.slice(0,3)).map(x=>x.toFixed(3)));
}
process.exit(0);
