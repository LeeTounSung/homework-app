// MathInk 통합 브라우저 E2E 테스트 (새 오버레이 UI 기준)
// GAS 요청을 중단 → fallback 데이터 로드 → /upload/1/1/1 진입 → 수식 직접 입력 토글
// → 모델 준비 대기 → 테스트 이미지를 드래그드롭 → 수식 인식 → PNG 미리보기 → 삽입 → 미리보기 확인
// 실행: node smoke-browser.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const TEST_IMG = path.join(__dirname, '..', 'math-ink', '.smoke', 'test_formula.png');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error') logs.push(`[console.error] ${m.text()}`);
  else if (m.type() === 'warning') logs.push(`[console.warn] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

// GAS 요청을 mock으로 대체 → 유효한 숙제 데이터 1개 제공
const MOCK_DATA = JSON.stringify([{
  date: "테스트",
  homeworks: [{
    id: 1,
    teacherName: "테스트선생",
    studentName: "테스트학생",
    title: "테스트 숙제",
    problemGroups: [{ groupId: 1, label: "1단원" }],
    submittedProblems: [],
    evaluation: null,
  }],
}]);
await page.route(/script\.google(usercontent)?\.com/, (route) => {
  route.fulfill({ status: 200, contentType: 'application/json', body: MOCK_DATA });
});

console.log('→ goto /upload/1/1/1');
await page.goto(`${BASE}/upload/1/1/1`, { waitUntil: 'load', timeout: 60000 });

// UploadPage 렌더 대기 (토글 버튼 "✍️ 수식 직접 입력" 등장)
await page.waitForSelector('text=✍️ 수식 직접 입력', { timeout: 30000 });
console.log('✓ UploadPage 로드됨');

// MathInk 오버레이 진입
await page.click('text=✍️ 수식 직접 입력');
await page.waitForSelector('.mathink-container', { timeout: 10000 });
console.log('✓ MathInk 컴포넌트 표시됨');

// 모델 준비 대기 (브라우저에서 80MB 최초 다운로드, 최대 240s)
await page.waitForFunction(() => {
  const el = document.querySelector('.mathink-badge');
  return el && (el.textContent.includes('준비 완료') || el.textContent.includes('실패'));
}, undefined, { timeout: 240000 });
const badge = await page.textContent('.mathink-badge');
console.log('✓ 모델 상태:', badge.trim());
if (badge.includes('실패')) {
  console.error('FAIL: 모델 로드 실패');
  console.error('--- console 로그/에러 ---');
  for (const l of logs) console.error(l);
  const msgEl = await page.textContent('.mathink-msg').catch(() => '(msg 요소 없음)');
  console.error('msg:', msgEl);
  await page.screenshot({ path: path.join(__dirname, 'smoke-fail.png'), fullPage: true }).catch(() => {});
  await browser.close(); process.exit(1);
}

// 테스트 수식 이미지를 드래그드롭으로 로드 (새 UI는 file input 없이 drop만 지원)
const b64 = fs.readFileSync(TEST_IMG).toString('base64');
await page.evaluate(async ({ b64, name }) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const file = new File([bytes], name, { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);
  const wrap = document.querySelector('.mathink-canvas-wrap');
  wrap.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
}, { b64, name: path.basename(TEST_IMG) });
await page.waitForTimeout(800);

// 수식 인식
await page.click('text=🔍 수식 인식하기');
await page.waitForFunction(() => {
  const t = document.querySelector('.mathink-latex-out');
  return t && t.value && t.value.trim().length > 0;
}, undefined, { timeout: 120000 });
const latex = await page.inputValue('.mathink-latex-out');
console.log('LATEX =', latex.trim());

// PNG 미리보기 대기
await page.waitForFunction(() => {
  const img = document.querySelector('.mathink-preview-img');
  return img && img.src.startsWith('data:image/jpeg');
}, undefined, { timeout: 30000 });
const previewSrc = await page.getAttribute('.mathink-preview-img', 'src');

// 삽입 버튼 → 모달 닫히고 미리보기 박스에 이미지 표시
await page.click('.mathink-insert-btn');
await page.waitForSelector('.image-preview', { timeout: 10000 });
const insertedSrc = await page.getAttribute('.image-preview', 'src');

await page.screenshot({ path: path.join(__dirname, 'smoke-mathink.png'), fullPage: true });

const latexOk = latex.includes('frac');
const pngOk = !!previewSrc && previewSrc.length > 100;
const insertOk = !!insertedSrc && insertedSrc === previewSrc;
console.log('ASSERT latex에 frac 포함:', latexOk);
console.log('ASSERT JPEG PNG 생성:', pngOk, pngOk ? `(${previewSrc.length} chars)` : '');
console.log('ASSERT 삽입 미리보기 연결:', insertOk);
console.log('콘솔 에러:', logs.length ? logs : '없음');

await browser.close();
if (!latexOk || !pngOk || !insertOk) { console.error('SMOKE FAILED'); process.exit(1); }
console.log('SMOKE PASSED ✓ — MathInk (검정 패딩) 동작 확인');
