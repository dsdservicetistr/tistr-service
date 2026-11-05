/**
 * Fmt.js
 * จัดรูปแบบข้อมูลสำหรับแสดงผล (วันที่ไทย พ.ศ.)
 * ข้อมูลในชีตเก็บเป็น "yyyy-MM-dd HH:mm:ss" (ค.ศ. เวลาไทย)
 */
class Fmt {
  static get MONTHS() {
    return ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  }

  // "2026-11-05 14:30:00" -> "5 พ.ย. 69 14:30"
  static dateTime(text) {
    const m = String(text || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return text || '';
    const be = String(Number(m[1]) + 543).slice(-2);
    return Number(m[3]) + ' ' + Fmt.MONTHS[Number(m[2]) - 1] + ' ' + be + ' ' + m[4] + ':' + m[5];
  }

  // ผ่านมานานเท่าไหร่ เช่น "5 นาทีที่แล้ว"
  static ago(text) {
    const d = new Date(String(text || '').replace(' ', 'T') + '+07:00');
    if (isNaN(d)) return '';
    const min = Math.floor((Date.now() - d.getTime()) / 60000);
    if (min < 1) return 'เมื่อสักครู่';
    if (min < 60) return min + ' นาทีที่แล้ว';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' ชั่วโมงที่แล้ว';
    return Math.floor(hr / 24) + ' วันที่แล้ว';
  }
}
