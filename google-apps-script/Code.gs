/**
 * Code.gs - Google Apps Script Backend API
 * ระบบบริหารจัดการทรัพย์สินและแจ้งซ่อมบำรุง
 * พัฒนาสำหรับ: บริษัท ไอที โซลูชั่น แอนด์ เซอร์วิส จำกัด
 */

// ชื่อแท็บใน Google Sheets
const SHEET_NAMES = {
  ASSETS: 'Assets',
  REPAIRS: 'Repairs',
  USERS: 'Users',
  DEPARTMENTS: 'Departments',
  SETTINGS: 'Settings'
};

/**
 * Handle GET Requests - ดึงข้อมูลทั้งหมดจาก Google Sheets ส่งกลับไปให้หน้าเว็บ
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    checkAndInitSheets(ss);

    const assets = getSheetData(ss.getSheetByName(SHEET_NAMES.ASSETS));
    const repairs = getSheetData(ss.getSheetByName(SHEET_NAMES.REPAIRS));
    const users = getSheetData(ss.getSheetByName(SHEET_NAMES.USERS));
    const departments = getSheetData(ss.getSheetByName(SHEET_NAMES.DEPARTMENTS));
    const settingsRaw = getSheetData(ss.getSheetByName(SHEET_NAMES.SETTINGS));

    const settings = {};
    settingsRaw.forEach(row => {
      if (row.Key) settings[row.Key] = row.Value;
    });

    const result = {
      status: 'success',
      data: {
        assets: assets,
        repairs: repairs,
        users: users,
        departments: departments,
        settings: settings
      },
      timestamp: new Date().toISOString()
    };

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST Requests - บันทึก, เพิ่ม, แก้ไข, ลบ ข้อมูลจากหน้าเว็บ
 */
function doPost(e) {
  try {
    const contents = e.postData ? JSON.parse(e.postData.contents) : {};
    const action = contents.action;
    const payload = contents.payload;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    checkAndInitSheets(ss);

    let responseData = { status: 'success' };

    switch (action) {
      // 1. ทรัพย์สิน (Assets)
      case 'saveAsset':
        saveRowItem(ss.getSheetByName(SHEET_NAMES.ASSETS), payload, 'id');
        break;

      case 'deleteAsset':
        deleteRowItem(ss.getSheetByName(SHEET_NAMES.ASSETS), payload.id, 'id');
        break;

      // 2. แจ้งซ่อม (Repairs)
      case 'saveRepair':
        saveRowItem(ss.getSheetByName(SHEET_NAMES.REPAIRS), payload, 'id');
        // อัปเดตสถานะทรัพย์สินให้ตรงกัน
        if (payload.assetId || payload.assetCode) {
          updateAssetStatusFromRepair(ss, payload);
        }
        break;

      // 3. ผู้ใช้งาน (Users)
      case 'saveUser':
        saveRowItem(ss.getSheetByName(SHEET_NAMES.USERS), payload, 'id');
        break;

      // 4. แผนก (Departments)
      case 'saveDepartment':
        saveRowItem(ss.getSheetByName(SHEET_NAMES.DEPARTMENTS), payload, 'id');
        break;

      // 5. บันทึกทั้งหมดรวดเดียว (Bulk Sync)
      case 'syncAll':
        if (payload.assets) replaceSheetData(ss.getSheetByName(SHEET_NAMES.ASSETS), payload.assets);
        if (payload.repairs) replaceSheetData(ss.getSheetByName(SHEET_NAMES.REPAIRS), payload.repairs);
        if (payload.users) replaceSheetData(ss.getSheetByName(SHEET_NAMES.USERS), payload.users);
        if (payload.departments) replaceSheetData(ss.getSheetByName(SHEET_NAMES.DEPARTMENTS), payload.departments);
        break;

      // 6. ติดตั้งฐานข้อมูลเริ่มต้นตามไฟล์ Excel
      case 'seedDatabase':
        seedInitialData(ss, payload);
        break;

      default:
        throw new Error('Unknown action: ' + action);
    }

    return ContentService
      .createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS FOR GOOGLE SHEETS
// ---------------------------------------------------------------------------

function getSheetData(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      let val = row[index];
      // แปลงค่า Date เป็น ISO String
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
      }
      obj[header] = val;
    });
    return obj;
  });
}

function saveRowItem(sheet, item, keyField) {
  const data = sheet.getDataRange().getValues();
  let headers = data[0];
  
  if (!headers || headers.length === 0) {
    headers = Object.keys(item);
    sheet.appendRow(headers);
  }

  // หา key column index
  const keyIndex = headers.indexOf(keyField);
  let targetRowIndex = -1;

  if (keyIndex !== -1 && data.length > 1) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][keyIndex]) === String(item[keyField])) {
        targetRowIndex = i + 1; // 1-based index
        break;
      }
    }
  }

  // สร้างแถวข้อมูลตามลำดับ headers
  const rowValues = headers.map(header => (item[header] !== undefined ? item[header] : ''));

  if (targetRowIndex !== -1) {
    sheet.getRange(targetRowIndex, 1, 1, headers.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function deleteRowItem(sheet, keyValue, keyField) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const headers = data[0];
  const keyIndex = headers.indexOf(keyField);
  if (keyIndex === -1) return;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]) === String(keyValue)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function replaceSheetData(sheet, items) {
  if (!items || items.length === 0) return;
  const headers = Object.keys(items[0]);
  sheet.clearContents();
  sheet.appendRow(headers);

  const rows = items.map(item => headers.map(h => (item[h] !== undefined ? item[h] : '')));
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function updateAssetStatusFromRepair(ss, repairPayload) {
  const assetSheet = ss.getSheetByName(SHEET_NAMES.ASSETS);
  if (!assetSheet) return;

  const data = assetSheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const headers = data[0];
  const idIndex = headers.indexOf('id');
  const codeIndex = headers.indexOf('assetCode');
  const statusIndex = headers.indexOf('status');

  if (statusIndex === -1) return;

  let newAssetStatus = null;
  if (repairPayload.status === 'ซ่อมเสร็จสิ้น') {
    newAssetStatus = 'ใช้งานได้ปกติ';
  } else if (repairPayload.status === 'รอดำเนินการ' || repairPayload.status === 'กำลังดำเนินการ') {
    newAssetStatus = 'ส่งซ่อม';
  }

  if (!newAssetStatus) return;

  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][idIndex]);
    const rowCode = String(data[i][codeIndex]);

    if (rowId === String(repairPayload.assetId) || rowCode === String(repairPayload.assetCode)) {
      assetSheet.getRange(i + 1, statusIndex + 1).setValue(newAssetStatus);
      break;
    }
  }
}

function checkAndInitSheets(ss) {
  Object.values(SHEET_NAMES).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      // ใส่ Header เริ่มต้น
      if (name === SHEET_NAMES.ASSETS) {
        sheet.appendRow(['id', 'assetCode', 'name', 'category', 'brand', 'model', 'serialNumber', 'department', 'location', 'assignedUser', 'purchaseDate', 'price', 'status', 'imageUrl', 'notes', 'createdAt', 'updatedAt']);
      } else if (name === SHEET_NAMES.REPAIRS) {
        sheet.appendRow(['id', 'repairCode', 'assetId', 'assetCode', 'assetName', 'reporterName', 'department', 'problemTitle', 'problemDesc', 'beforeImageUrl', 'afterImageUrl', 'status', 'technicianName', 'repairDetails', 'cost', 'requestDate', 'repairDate', 'completedDate', 'updatedAt']);
      } else if (name === SHEET_NAMES.USERS) {
        sheet.appendRow(['id', 'username', 'password', 'fullName', 'role', 'department', 'status', 'createdAt']);
      } else if (name === SHEET_NAMES.DEPARTMENTS) {
        sheet.appendRow(['id', 'name', 'createdAt']);
      } else if (name === SHEET_NAMES.SETTINGS) {
        sheet.appendRow(['Key', 'Value']);
      }
    }
  });

  // ลบ Sheet1 เริ่มต้นถ้ามี
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
}

function seedInitialData(ss, payload) {
  checkAndInitSheets(ss);
  if (payload.assets) replaceSheetData(ss.getSheetByName(SHEET_NAMES.ASSETS), payload.assets);
  if (payload.repairs) replaceSheetData(ss.getSheetByName(SHEET_NAMES.REPAIRS), payload.repairs);
  if (payload.users) replaceSheetData(ss.getSheetByName(SHEET_NAMES.USERS), payload.users);
  if (payload.departments) replaceSheetData(ss.getSheetByName(SHEET_NAMES.DEPARTMENTS), payload.departments);
  if (payload.settings) {
    const settingsRows = Object.entries(payload.settings).map(([k, v]) => ({ Key: k, Value: v }));
    replaceSheetData(ss.getSheetByName(SHEET_NAMES.SETTINGS), settingsRows);
  }
}

