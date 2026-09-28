import fs from 'fs';
import path from 'path';
const { env } = await import('@huggingface/transformers');

env.allowLocalModels = true;
env.localModelPath = 'C:/ai/math-ink/model_work';
env.allowRemoteModels = false;   // local-only: will show local errors

const localId = 'latex_staging2';
const expected = path.join(env.localModelPath, localId, 'encoder_model.onnx');
console.log('expected local encoder path:', expected);
console.log('exists?', fs.existsSync(expected));

// Also confirm the decoder file exists
const dec = path.join(env.localModelPath, localId, 'decoder_model_merged.onnx');
console.log('decoder exists?', fs.existsSync(dec));

// Now try a real load (local-only). If env.allowLocalModels is respected, this
// should read the local files, not fall through to remote.
const { VisionEncoderDecoderModel } = await import('@huggingface/transformers');
const t0 = Date.now();
try {
  const m = await VisionEncoderDecoderModel.from_pretrained(localId, { dtype: 'fp32' });
  console.log('LOADED in', ((Date.now()-t0)/1000).toFixed(1)+'s', 'model_type:', m.config?.model_type);
  process.exit(0);
} catch (e) {
  console.error('LOAD FAIL:', e.message?.slice(0, 300));
  process.exit(1);
}
