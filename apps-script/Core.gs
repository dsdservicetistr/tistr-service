/**
 * Core.gs
 * ของใช้ร่วมกันทั้งระบบ : AppError, AppResponse, Util
 */

// Error ที่ตั้งใจโยนเอง เพื่อส่งข้อความภาษาไทยกลับไปให้หน้าเว็บ
class AppError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code || 'ERROR';
  }
}

// รูปแบบผลลัพธ์ที่ส่งกลับหน้าเว็บ { status, code, message, data }
class AppResponse {
  static ok(data, message) {
    return AppResponse._json({
      status: 'ok',
      message: message || '',
      data: (data === undefined) ? null : data
    });
  }

  static error(message, code) {
    return AppResponse._json({
      status: 'error',
      code: code || 'ERROR',
      message: message || 'เกิดข้อผิดพลาด'
    });
  }

  static _json(obj) {
    return ContentService
      .createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

const Util = {
  // เปิด Google Sheet ที่ใช้เป็นฐานข้อมูล
  // อ่าน ID จาก Script Properties ชื่อ SHEET_ID (ใช้ได้ทั้งสคริปต์แบบแยกและแบบผูกกับชีต)
  ss: function () {
    const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (id) return SpreadsheetApp.openById(id);

    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;

    throw new AppError('ยังไม่ได้ตั้งค่า SHEET_ID ใน Script Properties', 'NO_SHEET_ID');
  },

  // วันเวลาปัจจุบัน (ค.ศ.) เก็บลงชีตเป็นข้อความ
  now: function () {
    return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  },

  // วันเวลาอีก n วันข้างหน้า (ใช้กำหนดวันหมดอายุ session)
  addDays: function (n) {
    const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
    return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  },

  // วันเวลาอีก n นาทีข้างหน้า
  addMinutes: function (n) {
    const d = new Date(Date.now() + n * 60 * 1000);
    return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  },

  // SHA-256 เป็นเลขฐาน 16
  sha256: function (text) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
    return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  },

  // เลขสุ่ม n หลัก (ขึ้นต้นด้วย 0 ได้) ใช้ค่าสุ่มจาก UUID แทน Math.random
  randomDigits: function (n) {
    let out = '';
    while (out.length < n) {
      const hex = Utilities.getUuid().replace(/-/g, '');
      for (let i = 0; i < hex.length && out.length < n; i++) {
        const v = parseInt(hex[i], 16);
        if (v < 10) out += v;          // รับเฉพาะ 0-9 เพื่อไม่ให้เลขบางตัวออกบ่อยกว่า
      }
    }
    return out;
  },

  // แปลงข้อความ "yyyy-MM-dd HH:mm:ss" (เวลาไทย) กลับเป็น Date
  parse: function (text) {
    return new Date(String(text).replace(' ', 'T') + '+07:00');
  },

  uuid: function () {
    return Utilities.getUuid();
  },

  // ปีงบประมาณ (พ.ศ.) เริ่มเดือนตุลาคม เช่น ต.ค. 2569 = ปีงบ 2570
  fiscalYearBE: function (date) {
    const d = date || new Date();
    const y = Number(Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy'));
    const m = Number(Utilities.formatDate(d, CONFIG.TIMEZONE, 'M'));
    return (m >= 10 ? y + 1 : y) + 543;
  },

  // 2 หลักท้ายของปีงบ ใช้ต่อท้ายเลขใบงาน เช่น 0001/70
  fiscalYearShort: function (date) {
    return String(Util.fiscalYearBE(date)).slice(-2);
  },

  // ตรวจข้อความจากฟอร์ม : ตัดช่องว่าง, บังคับกรอก, จำกัดความยาว
  text: function (value, label, maxLen, required) {
    const v = String(value === undefined || value === null ? '' : value).trim();
    if (required && v === '') throw new AppError('กรุณากรอก' + label, 'REQUIRED');
    if (v.length > maxLen) throw new AppError(label + ' ยาวเกิน ' + maxLen + ' ตัวอักษร', 'TOO_LONG');
    return v;
  },

  // โฟลเดอร์เก็บไฟล์แนบใน Google Drive (สร้างให้อัตโนมัติครั้งแรก แล้วจำ ID ไว้)
  uploadFolder: function () {
    const props = PropertiesService.getScriptProperties();
    const id = props.getProperty('UPLOAD_FOLDER_ID');
    if (id) return DriveApp.getFolderById(id);
    const folder = DriveApp.createFolder('tistr-service-uploads');
    props.setProperty('UPLOAD_FOLDER_ID', folder.getId());
    return folder;
  },

  // กันข้อความจากผู้ใช้กลายเป็น HTML ในอีเมล
  esc: function (text) {
    return String(text === undefined || text === null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  // hash รหัสผ่านเจ้าหน้าที่ (ทำซ้ำหลายรอบให้เดายากขึ้น)
  hashPassword: function (salt, password) {
    let h = String(salt) + '|' + String(password);
    for (let i = 0; i < CONFIG.STAFF_LOGIN.HASH_ROUNDS; i++) h = Util.sha256(salt + h);
    return 'v1$' + CONFIG.STAFF_LOGIN.HASH_ROUNDS + '$' + h;
  },

  // somchai@tistr.or.th -> so****@tistr.or.th
  maskEmail: function (email) {
    const e = String(email || '');
    const at = e.indexOf('@');
    if (at < 1) return e;
    return e.slice(0, Math.min(2, at)) + '****' + e.slice(at);
  },

  // ลิงก์แชร์ Google Drive -> ลิงก์รูปที่แสดงบนเว็บได้
  photoUrl: function (url) {
    const u = String(url || '').trim();
    if (!u) return '';
    const m = u.match(/\/d\/([\w-]{20,})/) || u.match(/[?&]id=([\w-]{20,})/);
    return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w400' : u;
  },

  // ตัดฟิลด์ภายใน (_row) ออกก่อนส่งให้หน้าเว็บ
  clean: function (obj) {
    if (!obj) return obj;
    const copy = Object.assign({}, obj);
    delete copy._row;
    return copy;
  }
};
