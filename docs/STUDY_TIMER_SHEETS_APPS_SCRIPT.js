/**
 * homework-app 스터디 타이머 ↔ Google Sheets 자동 동기화 Apps Script
 *
 * [설치 방법]
 * 1. 구글 드라이브에서 새 구글 시트 생성 (예: "스터디타이머_기록")
 * 2. 상단 메뉴 [확장 프로그램] -> [Apps Script] 클릭
 * 3. 기존 코드를 모두 지우고 아래 코드를 그대로 붙여넣기 -> 저장(Ctrl+S)
 * 4. 우측 상단 [배포] -> [새 배포] -> 유형: [웹 앱]
 *    - 다음 사용자 권한으로 실행: 나(본인 계정)
 *    - 액세스 권한이 있는 사용자: 모든 사용자
 *    -> [배포] 클릭 후 권한 승인 -> 생성된 "웹 앱 URL"을 복사해서 알려주세요!
 */

const SHEET_NAME = 'StudyLogs';
const HEADERS = ['id', 'date', 'student', 'subject', 'seconds', 'savedAt', 'createdAt'];

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const sheet = getOrCreateSheet_();
    const studentFilter = (e && e.parameter && e.parameter.student) ? String(e.parameter.student).trim() : '';
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return jsonResponse_({ ok: true, logs: [] });
    }
    const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    const logs = [];
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const student = String(row[2] || '').trim();
      if (studentFilter && student !== studentFilter) continue;
      logs.push({
        id: Number(row[0]) || row[0],
        date: String(row[1] || ''),
        student: student,
        subject: String(row[3] || ''),
        seconds: Number(row[4]) || 0,
        savedAt: String(row[5] || '')
      });
    }
    // 최신순 정렬
    logs.sort((a, b) => Number(b.id) - Number(a.id));
    return jsonResponse_({ ok: true, logs: logs });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const sheet = getOrCreateSheet_();
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const action = data.action || 'add';

    if (action === 'delete') {
      const targetId = String(data.id || '');
      const lastRow = sheet.getLastRow();
      if (lastRow > 1 && targetId) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (let i = ids.length - 1; i >= 0; i--) {
          if (String(ids[i][0]) === targetId) {
            sheet.deleteRow(i + 2);
            break;
          }
        }
      }
      return jsonResponse_({ ok: true, deleted: targetId });
    }

    // 기본: 기록 추가 (중복 id 방지)
    const id = data.id || Date.now();
    const date = String(data.date || '');
    const student = String(data.student || 'guest').trim();
    const subject = String(data.subject || '');
    const seconds = Number(data.seconds) || 0;
    const savedAt = String(data.savedAt || '');
    const createdAt = new Date().toISOString();

    sheet.appendRow([id, date, student, subject, seconds, savedAt, createdAt]);
    return jsonResponse_({ ok: true, id: id });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}
