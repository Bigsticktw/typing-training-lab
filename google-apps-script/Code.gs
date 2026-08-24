const HEADERS = [
  'schema_version',
  'received_at',
  'session_id',
  'started_at',
  'completed_at',
  'client_timezone_offset_minutes',
  'mode',
  'score',
  'errors',
  'total_keystrokes',
  'accuracy_percent',
  'ppm',
  'avg_latency_ms',
  'duration_seconds',
  'key_errors_json',
  'key_latency_average_ms_json',
];

function doGet() {
  return jsonResponse_({ ok: true, service: 'typing-training-lab', schemaVersion: 1 });
}

function doPost(event) {
  try {
    const payload = JSON.parse(event && event.postData ? event.postData.contents : '{}');
    validatePayload_(payload);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = getTargetSheet_();
      ensureHeader_(sheet);

      if (hasSession_(sheet, payload.sessionId)) {
        return jsonResponse_({ ok: true, duplicate: true, sessionId: payload.sessionId });
      }

      sheet.appendRow([
        payload.schemaVersion,
        new Date(),
        payload.sessionId,
        new Date(payload.startedAt),
        new Date(payload.completedAt),
        payload.clientTimezoneOffsetMinutes,
        payload.mode,
        payload.score,
        payload.errors,
        payload.totalKeystrokes,
        payload.accuracy,
        payload.ppm,
        payload.avgLatencyMs,
        payload.durationSeconds,
        JSON.stringify(payload.keyErrors || {}),
        JSON.stringify(payload.keyLatencyAverageMs || {}),
      ]);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse_({ ok: true, duplicate: false, sessionId: payload.sessionId });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

/** Run once from the Apps Script editor after setting Script Properties. */
function setupSheet() {
  const sheet = getTargetSheet_();
  ensureHeader_(sheet);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
}

function getTargetSheet_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  const sheetName = properties.getProperty('SHEET_NAME') || 'typing_sessions';
  if (!spreadsheetId) {
    throw new Error('Missing Script Property: SPREADSHEET_ID');
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  const actual = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  if (actual.join('|') !== HEADERS.join('|')) {
    throw new Error('Sheet header does not match schema v1; use an empty dedicated sheet.');
  }
}

function hasSession_(sheet, sessionId) {
  if (sheet.getLastRow() < 2) return false;
  return sheet
    .getRange(2, 3, sheet.getLastRow() - 1, 1)
    .createTextFinder(sessionId)
    .matchEntireCell(true)
    .findNext() !== null;
}

function validatePayload_(payload) {
  if (payload.schemaVersion !== 1) throw new Error('Unsupported schemaVersion');
  if (!/^[A-Za-z0-9-]{1,128}$/.test(payload.sessionId || '')) throw new Error('Invalid sessionId');
  if (!['English', 'Zhuyin'].includes(payload.mode)) throw new Error('Invalid mode');
  if (!isValidDate_(payload.startedAt) || !isValidDate_(payload.completedAt)) throw new Error('Invalid timestamp');

  const limits = {
    clientTimezoneOffsetMinutes: [-840, 840],
    score: [0, 100000],
    errors: [0, 100000],
    totalKeystrokes: [0, 200000],
    accuracy: [0, 100],
    ppm: [0, 10000],
    avgLatencyMs: [0, 600000],
    durationSeconds: [0, 86400],
  };
  Object.keys(limits).forEach(function (key) {
    const value = payload[key];
    const range = limits[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < range[0] || value > range[1]) {
      throw new Error('Invalid numeric field: ' + key);
    }
  });

  if (JSON.stringify(payload.keyErrors || {}).length > 20000) throw new Error('keyErrors is too large');
  if (JSON.stringify(payload.keyLatencyAverageMs || {}).length > 20000) throw new Error('keyLatencyAverageMs is too large');
}

function isValidDate_(value) {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
