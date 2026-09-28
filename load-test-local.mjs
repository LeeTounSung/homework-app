// 로컬 ONNX 모델이 transformers.js 로더로 로드되는지 검증
// 사용: node load-test-local.mjs <model_root_dir>
//   (allowLocalModels=true + env.localModelPath=<root> + bare id로 from_pretrained)
const modelRoot = process.argv[2] ?? '.';
const localId = 'latex_staging';   // env.localModelPath 아래 하위 폴더

const { env, VisionEncoderDecoderModel, PreTrainedTokenizer } = await import('@huggingface/transformers');
env.allowLocalModels = true;
env.localModelPath = modelRoot;
env.useBrowserCache = false;

console.log(`localModelPath: ${env.localModelPath}  id: ${localId}`);
console.log('allowLocalModels:', env.allowLocalModels, '| allowRemoteModels:', env.allowRemoteModels);
const t0 = Date.now();
const [model, tokenizer] = await Promise.all([
  VisionEncoderDecoderModel.from_pretrained(localId, { dtype: 'fp32' }),
  PreTrainedTokenizer.from_pretrained(localId),
]);
console.log(`\nLOADED in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log('model_type:', model.config?.model_type ?? '(n/a)');
console.log('tokenizer vocab size:', tokenizer.get_vocab_size?.() ?? '(n/a)');
process.exit(0);
