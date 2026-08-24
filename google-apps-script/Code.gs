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
  'country_code',
  'ip_hash',
];

const LEGACY_HEADERS = HEADERS.slice(0, 16);

function doGet() {
  return jsonResponse_({ ok: true, service: 'typing-training-lab', schemaVersion: 1 });
}

function doPost(event) {
  try {
    const request = JSON.parse(event && event.postData ? event.postData.contents : '{}');
    const payload = request.payload || request;
    validatePayload_(payload);
    const target = resolveTarget_(request.token || '');
    const visitor = normalizeVisitor_(request.visitor || {});

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = getTargetSheet_(target.spreadsheetId, target.sheetName);
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
        visitor.countryCode,
        hashIp_(visitor.ip),
      ]);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse_({ ok: true, duplicate: false, private: target.private, sessionId: payload.sessionId });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

/** Run once from the Apps Script editor after setting Script Properties. */
function setupSheet() {
  const properties = PropertiesService.getScriptProperties();
  const targets = [resolveTarget_('')];
  const personalId = properties.getProperty('PERSONAL_SPREADSHEET_ID');
  const personalToken = properties.getProperty('PERSONAL_API_TOKEN');
  if (personalId && personalToken) targets.push(resolveTarget_(personalToken));
  targets.forEach(function (target) {
    const sheet = getTargetSheet_(target.spreadsheetId, target.sheetName);
    ensureHeader_(sheet);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  });
}

function getTargetSheet_(spreadsheetId, sheetName) {
  if (!spreadsheetId) {
    throw new Error('Missing target spreadsheet id');
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  const legacy = sheet.getRange(1, 1, 1, LEGACY_HEADERS.length).getDisplayValues()[0];
  if (legacy.join('|') === LEGACY_HEADERS.join('|') && sheet.getLastColumn() < HEADERS.length) {
    sheet.getRange(1, LEGACY_HEADERS.length + 1, 1, HEADERS.length - LEGACY_HEADERS.length)
      .setValues([HEADERS.slice(LEGACY_HEADERS.length)]);
  }
  const actual = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  if (actual.join('|') !== HEADERS.join('|')) {
    throw new Error('Sheet header does not match schema v1; use an empty dedicated sheet.');
  }
}

function resolveTarget_(token) {
  const properties = PropertiesService.getScriptProperties();
  const normalizedToken = String(token || '');
  if (normalizedToken) {
    const expected = properties.getProperty('PERSONAL_API_TOKEN') || '';
    if (!expected || !timingSafeEqual_(normalizedToken, expected)) throw new Error('Unauthorized');
    return {
      private: true,
      spreadsheetId: properties.getProperty('PERSONAL_SPREADSHEET_ID'),
      sheetName: properties.getProperty('PERSONAL_SHEET_NAME') || 'typing_sessions',
    };
  }
  return {
    private: false,
    spreadsheetId: properties.getProperty('SPREADSHEET_ID'),
    sheetName: properties.getProperty('SHEET_NAME') || 'typing_sessions',
  };
}

function timingSafeEqual_(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function normalizeVisitor_(visitor) {
  const countryCode = /^[A-Z]{2}$/.test(visitor.countryCode || '') ? visitor.countryCode : '';
  const ip = /^[0-9a-fA-F:.]{3,64}$/.test(visitor.ip || '') ? visitor.ip : '';
  return { countryCode: countryCode, ip: ip };
}

function hashIp_(ip) {
  if (!ip) return '';
  const salt = PropertiesService.getScriptProperties().getProperty('IP_HASH_SALT');
  if (!salt) throw new Error('Missing Script Property: IP_HASH_SALT');
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + ip)
    .map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); })
    .join('');
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
