// ═══════════════════════════════════════════════════════════════
// HAN TAEKWONDO KOREA — Google Apps Script Backend
// Spreadsheet-as-database API
// Deploy as: Web App → Execute as Me → Anyone can access
// ═══════════════════════════════════════════════════════════════

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // ← replace after creating sheet
const API_KEY        = 'YOUR_API_KEY_HERE';          // ← set a strong secret key, e.g. 'htk-2026-rw-x9f2'

const SHEETS = {
  students:    'Students',
  instructors: 'Instructors',
  sessions:    'Sessions',
  attendance:  'Attendance',
  instrAtt:    'InstructorAttendance',
  payments:    'Payments',
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
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      // Parse JSON arrays/objects stored as strings
      if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
        try { val = JSON.parse(val); } catch (_) {}
      }
      obj[h] = val === '' ? null : val;
    });
    return obj;
  }).filter(row => row.id); // skip blank rows
}

// ── WRITE FULL SHEET (replaces all data) ─────────────────────
function writeSheet(sheetName, rows) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet   = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  if (!rows || rows.length === 0) {
    // Keep headers, clear data
    const lr = sheet.getLastRow();
    if (lr > 1) sheet.getRange(2, 1, lr - 1, sheet.getLastColumn()).clearContent();
    return { ok: true, rows: 0 };
  }

  // Build headers from first object keys
  const headers = Object.keys(rows[0]);

  // Serialize values
  const dataRows = rows.map(row =>
    headers.map(h => {
      const v = row[h];
      if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
        return JSON.stringify(v);
      }
      return v === null || v === undefined ? '' : v;
    })
  );

  // Clear and rewrite
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
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet   = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  const values  = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const idCol   = headers.indexOf('id');

  if (idCol === -1) {
    // No headers yet — write them
    const newHeaders = Object.keys(rowData);
    sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
    const newRow = newHeaders.map(h => {
      const v = rowData[h];
      return Array.isArray(v) || (typeof v === 'object' && v !== null) ? JSON.stringify(v) : (v ?? '');
    });
    sheet.appendRow(newRow);
    return { ok: true, action: 'inserted' };
  }

  // Search for existing row
  const existingRowIdx = values.findIndex((row, i) => i > 0 && String(row[idCol]) === String(rowData.id));

  const newRow = headers.map(h => {
    const v = rowData[h];
    return Array.isArray(v) || (typeof v === 'object' && v !== null) ? JSON.stringify(v) : (v ?? '');
  });

  if (existingRowIdx !== -1) {
    sheet.getRange(existingRowIdx + 1, 1, 1, newRow.length).setValues([newRow]);
    return { ok: true, action: 'updated' };
  } else {
    sheet.appendRow(newRow);
    return { ok: true, action: 'inserted' };
  }
}

// ── DELETE ROW BY ID ─────────────────────────────────────────
function deleteRow(sheetName, id) {
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

  const schema = {
    Students:             ['id','name','age','belt','plan'],
    Instructors:          ['id','name','role','belt','phone','email','sessions'],
    Sessions:             ['id','type','day','start','end','instructors','students','notes'],
    Attendance:           ['studentId','sessionId','date','ts'],
    InstructorAttendance: ['iid','date','ts'],
    Payments:             ['id','studentId','amount','method','period','date','status'],
  };

  for (const [name, headers] of Object.entries(schema)) {
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
