/**
 * Repository.gs
 * ชั้นเดียวที่แตะ Google Sheet โดยตรง
 * วันหน้าถ้าย้ายไป MySQL ให้เขียน class ใหม่ที่มี method ชื่อเดิม (findAll, findBy, insert, update)
 * ส่วน Controller ไม่ต้องแก้
 *
 * หมายเหตุ: class ลูกต้องอยู่ไฟล์เดียวกับ SheetRepository
 * เพราะ Apps Script โหลดไฟล์ตามลำดับ ถ้าแยกไฟล์ extends อาจหา class แม่ไม่เจอ
 */
class SheetRepository {
  constructor(def) {
    this.sheetName = def.name;
    this.headers   = def.headers;
    this.idField   = def.headers[0];
  }

  sheet() {
    const sh = Util.ss().getSheetByName(this.sheetName);
    if (!sh) {
      throw new AppError('ไม่พบชีต "' + this.sheetName + '" กรุณารัน setupSheets() ก่อน', 'SHEET_NOT_FOUND');
    }
    return sh;
  }

  findAll() {
    const sh   = this.sheet();
    const last = sh.getLastRow();
    if (last < 2) return [];

    const values = sh.getRange(2, 1, last - 1, this.headers.length).getValues();
    return values
      .map((row, i) => this._toObject(row, i + 2))
      .filter(obj => String(obj[this.idField]) !== '');   // ข้ามแถวว่าง
  }

  findBy(field, value) {
    return this.findAll().filter(r => String(r[field]) === String(value));
  }

  findOne(field, value) {
    return this.findBy(field, value)[0] || null;
  }

  findById(id) {
    return this.findOne(this.idField, id);
  }

  insert(data) {
    const obj = Object.assign({}, data);
    if (!obj[this.idField]) obj[this.idField] = Util.uuid();
    if (this.headers.indexOf('created_at') > -1 && !obj.created_at) obj.created_at = Util.now();
    if (this.headers.indexOf('updated_at') > -1) obj.updated_at = Util.now();

    this.sheet().appendRow(this._toRow(obj));
    return obj;
  }

  update(id, changes) {
    const found = this.findById(id);
    if (!found) throw new AppError('ไม่พบข้อมูลที่ต้องการแก้ไข', 'NOT_FOUND');

    const merged = Object.assign({}, found, changes);
    if (this.headers.indexOf('updated_at') > -1) merged.updated_at = Util.now();

    this.sheet()
      .getRange(found._row, 1, 1, this.headers.length)
      .setValues([this._toRow(merged)]);
    return Util.clean(merged);
  }

  count() {
    return this.findAll().length;
  }

  _toObject(row, rowNumber) {
    const obj = { _row: rowNumber };
    this.headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  }

  // ใส่ ' นำหน้าทุกค่า ให้ชีตเก็บเป็นข้อความเสมอ
  //  - เบอร์ 0123 ไม่กลายเป็น 123 แม้แถวเกินช่วงที่ตั้ง format ไว้
  //  - ข้อความที่ขึ้นต้นด้วย = + - @ ไม่ถูกตีความเป็นสูตร (กัน formula injection)
  //  ชีตจะไม่เก็บ ' ไว้ในค่า อ่านกลับมาได้ข้อความเดิม
  _toRow(obj) {
    return this.headers.map(h => {
      const v = (obj[h] === undefined || obj[h] === null) ? '' : String(obj[h]);
      return v === '' ? '' : "'" + v;
    });
  }
}

/* ---------- ผู้ใช้ (User) ---------- */
class UserRepository extends SheetRepository {
  constructor() { super(CONFIG.SHEETS.USERS); }

  findByEmail(email) {
    return this.findOne('email', String(email).trim().toLowerCase());
  }
}

/* ---------- เจ้าหน้าที่ (Admin / Operator) ---------- */
class StaffRepository extends SheetRepository {
  constructor() { super(CONFIG.SHEETS.STAFF); }

  findByAdName(adName) {
    const key = String(adName).trim().toLowerCase();
    return this.findAll().find(s => String(s.ad_name).toLowerCase() === key) || null;
  }

  findActive() {
    return this.findBy('active', '1');
  }
}

/* ---------- หน่วยงาน (ใช้สรุปรายปี / Dashboard) ---------- */
class DivisionRepository extends SheetRepository {
  constructor() { super(CONFIG.SHEETS.DIVISIONS); }

  findActive() {
    return this.findBy('active', '1').sort((a, b) => Number(a.sort) - Number(b.sort));
  }

  // ชื่อที่ใช้แสดง เช่น "กพท. - กองพัฒนาระบบดิจิทัล"
  static label(d) {
    return d ? (d.div_short ? d.div_short + ' - ' : '') + d.div_name : '';
  }
}

/* ---------- หมวดบริการ ---------- */
class CategoryRepository extends SheetRepository {
  constructor() { super(CONFIG.SHEETS.CATEGORIES); }

  findActive() {
    return this.findBy('active', '1').sort((a, b) => Number(a.sort) - Number(b.sort));
  }
}

/* ---------- ประเภทย่อย / ระบบงาน ---------- */
class SubTypeRepository extends SheetRepository {
  constructor() { super(CONFIG.SHEETS.SUB_TYPES); }

  findActive() {
    return this.findBy('active', '1').sort((a, b) => Number(a.sort) - Number(b.sort));
  }

  findByCategory(catId) {
    return this.findActive().filter(s => String(s.cat_id) === String(catId));
  }
}

/* ---------- สถานะงาน (เหมือนตาราง form_status เดิม) ---------- */
class StatusRepository extends SheetRepository {
  constructor() { super(CONFIG.SHEETS.STATUSES); }
}

/* ---------- ใบงาน ---------- */
class JobRepository extends SheetRepository {
  constructor() { super(CONFIG.SHEETS.JOBS); }

  findByUser(userId) {
    return this.findBy('user_id', userId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  // เลขใบงานถัดไป นับใหม่ทุกปีงบ เช่น 0001/70
  // (ตอนบันทึกจริงต้องครอบด้วย LockService กันเลขซ้ำ - จะทำในขั้นแจ้งงาน)
  nextJobNumber() {
    const fy   = Util.fiscalYearShort();
    const nums = this.findBy('fiscal_year', fy)
      .map(j => parseInt(String(j.job_number).split('/')[0], 10) || 0);
    const next = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
    return { job_number: String(next).padStart(4, '0') + '/' + fy, fiscal_year: fy };
  }
}

/* ---------- Log ทุกการกระทำกับใบงาน ---------- */
class JobLogRepository extends SheetRepository {
  constructor() { super(CONFIG.SHEETS.JOB_LOG); }

  log(jobId, action, actorType, actorId, note) {
    return this.insert({
      job_id: jobId,
      action: action,
      actor_type: actorType,
      actor_id: actorId,
      note: note || ''
    });
  }
}

/* ---------- OTP (ยืนยันการเปลี่ยนเบอร์ ฯลฯ) ---------- */
class OtpRepository extends SheetRepository {
  constructor() { super(CONFIG.SHEETS.OTPS); }

  // รหัสล่าสุดที่ยังไม่ถูกใช้ ของอีเมล + วัตถุประสงค์นี้
  findLatestActive(email, purpose) {
    const rows = this.findAll().filter(o =>
      String(o.email) === String(email) &&
      String(o.purpose) === String(purpose) &&
      String(o.used) !== '1');
    if (!rows.length) return null;
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return rows[0];
  }
}

/* ---------- Session (ใช้ในขั้น Login) ---------- */
class SessionRepository extends SheetRepository {
  constructor() { super(CONFIG.SHEETS.SESSIONS); }

  create(ownerType, ownerId, days) {
    return this.insert({
      token: Util.uuid().replace(/-/g, '') + Util.uuid().replace(/-/g, ''),
      owner_type: ownerType,
      owner_id: ownerId,
      expires_at: Util.addDays(days)
    });
  }

  // คืน session ที่ยังไม่หมดอายุ (รูปแบบวันที่ yyyy-MM-dd HH:mm:ss เทียบแบบข้อความได้)
  findValid(token) {
    if (!token) return null;
    const s = this.findById(token);
    if (!s) return null;
    return (String(s.expires_at) > Util.now()) ? s : null;
  }

  revoke(token) {
    const s = this.findById(token);
    if (s) this.update(token, { expires_at: Util.now() });
  }
}
