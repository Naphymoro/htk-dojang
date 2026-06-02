// ═══════════════════════════════════════════════════════════════
// HAN TAEKWONDO KOREA — Google Apps Script Backend
// Spreadsheet-as-database API
// Deploy as: Web App → Execute as Me → Anyone can access
// ═══════════════════════════════════════════════════════════════

const SPREADSHEET_ID = '1fqJnYBRdNw7HXPkJJcJSg9JXFdQuTkxtBA3CTe-VsdU'; // ← replace after creating sheet
const API_KEY        = 'HanTKD2026Secure';          // ← set a strong secret key, e.g. 'htk-2026-rw-x9f2'

const SHEETS = {
  students:    'Students',
  instructors: 'Instructors',
  sessions:    'Sessions',
  attendance:  'Attendance',
  instrAtt:    'InstructorAttendance',
  payments:    'Payments',
  parents:     'Parents',
  wallet:      'Wallet',
  products:    'Products',
  orders:      'Orders',
  events:      'Events',
  absences:    'Absences',
};

const SCHEMAS = {
  Students:             ['id','name','age','belt','plan','parentPin','parentName','parentPhone','parentEmail','sessions','avatar','subscriptionPackage','promotionDate','ugandaNotice','parentId'],
  Instructors:          ['id','name','role','belt','phone','email','sessions'],
  Sessions:             ['id','type','day','start','end','instructors','students','notes'],
  Attendance:           ['id','studentId','studentName','sessionId','sessionName','date','status','scheduledMatch','recordedBy','ts'],
  InstructorAttendance: ['id','iid','date','ts'],
  Payments:             ['id','studentId','amount','method','period','date','status','phone','purpose','parentId','confirmedBy','confirmedAt','momoId'],
  Parents:              ['id','name','phone','email','children','emergencyContact','createdAt'],
  Wallet:               ['id','ownerId','parentId','studentId','amount','type','purpose','date','ts','staff','notes'],
  Products:             ['id','name','category','price','stock','desc','sizes','image'],
  Orders:               ['id','productId','item','studentId','parentId','amount','status','date','paymentStatus'],
  Events:               ['id','title','date','time','location','fee','deadline','desc','students','status'],
  Absences:             ['id','studentId','sessionId','date','reason','status','ts'],
};

// ── CORS helper ──────────────────────────────────────────────
function setCORSHeaders(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON);
}

function response(data) {
  return setCORSHeaders(
    ContentService.createTextOutput(JSON.stringify(data))
  );
}

// ── ROUTER ───────────────────────────────────────────────────
function doGet(e) {
  try {
    // ── API KEY AUTH ──
    if (e.parameter.key !== API_KEY) {
      return response({ error: 'Unauthorized', code: 401 });
    }

    const action = e.parameter.action;
    const sheet  = e.parameter.sheet;

    if (action === 'read')    return response(readSheet(sheet));
    if (action === 'readAll') return response(readAll());

    return response({ error: 'Unknown action' });
  } catch (err) {
    return response({ error: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    // ── API KEY AUTH ──
    if (payload.key !== API_KEY) {
      return response({ error: 'Unauthorized', code: 401 });
    }

    const { action, sheet, data, id } = payload;

    if (action === 'write')    return response(writeSheet(sheet, data));
    if (action === 'upsert')   return response(upsertRow(sheet, data));
    if (action === 'delete')   return response(deleteRow(sheet, id));
    if (action === 'writeAll') return response(writeAll(data));

    return response({ error: 'Unknown action' });
  } catch (err) {
    return response({ error: err.message });
  }
}

// ── READ ALL SHEETS AT ONCE (initial load) ───────────────────
function readAll() {
  const result = {};
  for (const [key, sheetName] of Object.entries(SHEETS)) {
    result[key] = readSheet(sheetName);
  }
  return { ok: true, data: result };
}

// ── WRITE ALL SHEETS AT ONCE (full sync) ─────────────────────
function writeAll(data) {
  for (const [key, sheetName] of Object.entries(SHEETS)) {
    if (data[key] !== undefined) {
      writeSheet(sheetName, data[key]);
    }
  }
  return { ok: true };
}

// ── READ SHEET → array of objects ────────────────────────────
function readSheet(sheetName) {
  sheetName = resolveSheetName(sheetName);
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = normalizeCellValue(h, row[i]);
    });
    return obj;
  }).filter(row => Object.values(row).some(v => v !== null && v !== ''));
}

// ── WRITE FULL SHEET (replaces all data) ─────────────────────
function writeSheet(sheetName, rows) {
  sheetName = resolveSheetName(sheetName);
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet   = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  if (!rows || rows.length === 0) {
    const headers = orderedHeaders(sheetName, []);
    if (headers.length && sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    // Keep headers, clear data
    const lr = sheet.getLastRow();
    if (lr > 1) sheet.getRange(2, 1, lr - 1, sheet.getLastColumn()).clearContent();
    return { ok: true, rows: 0 };
  }

  const headers = orderedHeaders(sheetName, rows);

  const dataRows = rows.map(row =>
    headers.map(h => serializeCellValue(row[h]))
  );

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (dataRows.length > 0) {
    sheet.getRange(2, 1, dataRows.length, headers.length).setValues(dataRows);
  }

  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);

  return { ok: true, rows: dataRows.length };
}

// ── UPSERT SINGLE ROW (insert or update by id) ───────────────
function upsertRow(sheetName, rowData) {
  sheetName = resolveSheetName(sheetName);
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet   = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  const values  = sheet.getDataRange().getValues();
  const existingHeaders = values.length ? values[0].map(h => String(h).trim()).filter(Boolean) : [];
  const headers = orderedHeaders(sheetName, [rowData], existingHeaders);
  if (!existingHeaders.length || headers.length !== existingHeaders.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  const idCol   = headers.indexOf('id');

  if (idCol === -1) {
    return { ok: false, error: 'No id column' };
  }

  // Search for existing row
  const existingRowIdx = values.findIndex((row, i) => i > 0 && String(row[idCol]) === String(rowData.id));

  const newRow = headers.map(h => serializeCellValue(rowData[h]));

  if (existingRowIdx !== -1) {
    sheet.getRange(existingRowIdx + 1, 1, 1, newRow.length).setValues([newRow]);
    return { ok: true, action: 'updated' };
  } else {
    sheet.appendRow(newRow);
    return { ok: true, action: 'inserted' };
  }
}

function schemaForSheetName(sheetName) {
  return SCHEMAS[resolveSheetName(sheetName)] || [];
}

function resolveSheetName(sheetName) {
  return SHEETS[sheetName] || sheetName;
}

function orderedHeaders(sheetName, rows, existingHeaders) {
  const out = [];
  function add(header) {
    const h = String(header || '').trim();
    if (h && out.indexOf(h) === -1) out.push(h);
  }
  schemaForSheetName(sheetName).forEach(add);
  (existingHeaders || []).forEach(add);
  (rows || []).forEach(row => Object.keys(row || {}).forEach(add));
  return out;
}

function normalizeCellValue(header, val) {
  if (val === '') return null;
  if (val instanceof Date) {
    const key = String(header || '').toLowerCase();
    const tz = Session.getScriptTimeZone();
    if (key === 'start' || key === 'end' || key === 'time') {
      return Utilities.formatDate(val, tz, 'HH:mm');
    }
    if (key === 'date' || key === 'deadline' || key === 'promotiondate' || key === 'confirmedat') {
      return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
    }
    return val.toISOString();
  }
  if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
    try { return JSON.parse(val); } catch (_) {}
  }
  return val === undefined ? null : val;
}

function serializeCellValue(v) {
  if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
    return JSON.stringify(v);
  }
  return v === null || v === undefined ? '' : v;
}

// ── DELETE ROW BY ID ─────────────────────────────────────────
function deleteRow(sheetName, id) {
  sheetName = resolveSheetName(sheetName);
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { ok: false, error: 'Sheet not found' };

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const idCol  = headers.indexOf('id');
  if (idCol === -1) return { ok: false, error: 'No id column' };

  const rowIdx = values.findIndex((row, i) => i > 0 && String(row[idCol]) === String(id));
  if (rowIdx === -1) return { ok: false, error: 'Row not found' };

  sheet.deleteRow(rowIdx + 1);
  return { ok: true };
}

// ── SETUP: Create all sheets with headers ────────────────────
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  for (const [name, headers] of Object.entries(SCHEMAS)) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      Logger.log('Created sheet: ' + name);
    }
    // Only write headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      // Style header row
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#0C1940')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }

  Logger.log('Setup complete!');
  return 'Setup complete!';
}
