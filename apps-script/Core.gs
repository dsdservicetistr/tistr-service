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

  // ตัดฟิลด์ภายใน (_row) ออกก่อนส่งให้หน้าเว็บ
  clean: function (obj) {
    if (!obj) return obj;
    const copy = Object.assign({}, obj);
    delete copy._row;
    return copy;
  }
};
