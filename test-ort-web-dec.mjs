// int8 merged decoder를 onnxruntime-web(WASM)에서 단일 forward로 검증 — MatMulInteger+If 호환성 확인
import * as ort from 'file:///C:/Users/kupid/AppData/Local/Temp/xf3/node_modules/onnxruntime-web/dist/ort.wasm.mjs';
import fs from 'fs';

const modelPath = process.argv[2] ?? 'C:/ai/math-ink/model_work/latex_onnx_int8/decoder_model_merged.onnx';
const wasmDir = 'C:/Users/kupid/AppData/Local/Temp/xf3/node_modules/onnxruntime-web/dist/';
ort.env.wasm.wasmBinary = fs.readFileSync(wasmDir + 'ort-wasm-simd-threaded.wasm');
ort.env.wasm.numThreads = 1;

const t0 = Date.now();
const sess = await ort.InferenceSession.create(fs.readFileSync(modelPath), { executionProviders: ['wasm'] });
console.log(`Session loaded in ${((Date.now()-t0)/1000).toFixed(1)}s`);

const feeds = {};
const B=1, H=16, D=64, E=577; // encoder_seq=577, decoder_past=0 (first step)
const encoder_hidden = new Float32Array(B*E*768).fill(0.0);
feeds['input_ids'] = new ort.Tensor('int64', BigInt64Array.from([2n]), [B,1]);
feeds['encoder_hidden_states'] = new ort.Tensor('float32', encoder_hidden, [B,E,768]);
feeds['use_cache_branch'] = new ort.Tensor('bool', Uint8Array.from([0]), [1]);
for (let i=0;i<12;i++){
  feeds[`past_key_values.${i}.decoder.key`] = new ort.Tensor('float32', new Float32Array(0), [B,H,0,D]);
  feeds[`past_key_values.${i}.decoder.value`] = new ort.Tensor('float32', new Float32Array(0), [B,H,0,D]);
  feeds[`past_key_values.${i}.encoder.key`] = new ort.Tensor('float32', new Float32Array(B*H*E*D).fill(0), [B,H,E,D]);
  feeds[`past_key_values.${i}.encoder.value`] = new ort.Tensor('float32', new Float32Array(B*H*E*D).fill(0), [B,H,E,D]);
}
console.log('feed keys:', Object.keys(feeds).length);
const t1 = Date.now();
const out = await sess.run(feeds);
console.log(`Infer in ${((Date.now()-t1)/1000).toFixed(1)}s`);
console.log('outputs:', Object.keys(out).join(', '));
const logits = out['logits'];
console.log('logits dims:', logits.dims, 'sample:', Array.from(logits.data.slice(0,5)).map(x=>x.toFixed(2)));
process.exit(0);
