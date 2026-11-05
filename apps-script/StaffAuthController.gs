/**
 * StaffAuthController.gs
 * ขั้นที่ 4 : เจ้าหน้าที่ (Admin / Operator) เข้าสู่ระบบ
 *
 *  - Admin เพิ่มเจ้าหน้าที่ในชีต staff ด้วยมือ (เว้นช่องรหัสผ่านไว้)
 *  - เข้าระบบครั้งแรก / ลืมรหัส -> ส่ง OTP ไปที่อีเมลในคอลัมน์ email -> ตั้งรหัสผ่านเอง
 *  - รหัสผ่านเก็บเป็น hash + salt เท่านั้น
 *  - ใส่รหัสผิดเกินกำหนด ล็อกบัญชีชั่วคราว
 */
class StaffAuthController {

  // flg = staff_login
  static login(data) {
    const staff = StaffAuthController._findActive(data.ad_name);
    if (!staff.pass_hash) {
      return { result: 'need_setup', email_masked: Util.maskEmail(staff.email) };
    }

    StaffAuthController._checkLock(staff.staff_id);
    const password = String(data.password || '');
    if (Util.hashPassword(staff.pass_salt, password) !== String(staff.pass_hash)) {
      const left = StaffAuthController._recordFail(staff.staff_id);
      throw new AppError(left > 0
        ? 'รหัสผ่านไม่ถูกต้อง เหลือโอกาสอีก ' + left + ' ครั้ง'
        : 'ใส่รหัสผิดเกินกำหนด ล็อกไว้ ' + CONFIG.STAFF_LOGIN.LOCK_MINUTES + ' นาที', 'LOGIN_FAILED');
    }
    StaffAuthController._clearFails(staff.staff_id);
    return StaffAuthController._issue(staff);
  }

  // flg = staff_request_otp : ตั้งรหัสครั้งแรก / ลืมรหัส
  static requestOtp(data) {
    const staff = StaffAuthController._findActive(data.ad_name);
    if (!staff.email) throw new AppError('ยังไม่ได้ตั้งอีเมลของบัญชีนี้ กรุณาติดต่อ Admin', 'NO_EMAIL');

    OtpService.issue('staff:' + staff.staff_id, 'staff_password', staff.email, code => ({
      subject: '[' + CONFIG.APP_NAME + '] รหัส OTP สำหรับตั้งรหัสผ่านเจ้าหน้าที่',
      htmlBody: OtpService.mailBody('มีการขอตั้งรหัสผ่านสำหรับบัญชีเจ้าหน้าที่ <b>' + staff.ad_name + '</b>', code)
    }));

    return {
      result: 'otp_sent',
      email_masked: Util.maskEmail(staff.email),
      expire_minutes: CONFIG.OTP.EXPIRE_MINUTES,
      resend_seconds: CONFIG.OTP.RESEND_SECONDS,
      password_min: CONFIG.STAFF_LOGIN.PASSWORD_MIN
    };
  }

  // flg = staff_set_password
  static setPassword(data) {
    const staff = StaffAuthController._findActive(data.ad_name);
    const password = StaffAuthController._checkPassword(data.password);

    OtpService.verify('staff:' + staff.staff_id, 'staff_password', data.otp);

    const salt = Util.uuid();
    const updated = new StaffRepository().update(staff.staff_id, {
      pass_salt: salt,
      pass_hash: Util.hashPassword(salt, password)
    });
    StaffAuthController._clearFails(staff.staff_id);
    return StaffAuthController._issue(updated);
  }

  // flg = staff_me
  static me(req) {
    return { staff: StaffAuthController.publicStaff(Auth.requireStaff(req)) };
  }

  static publicStaff(s) {
    return {
      staff_id: s.staff_id,
      ad_name: s.ad_name,
      full_name: s.full_name,
      role: s.role,
      phone_desk: s.phone_desk,
      photo: Util.photoUrl(s.photo_url)
    };
  }

  /* ---------- ตัวช่วย ---------- */

  static _findActive(adName) {
    const name = String(adName || '').trim();
    if (!name) throw new AppError('กรุณากรอกชื่อผู้ใช้', 'REQUIRED');
    const staff = new StaffRepository().findByAdName(name);
    if (!staff || String(staff.active) !== '1') {
      throw new AppError('ไม่พบบัญชีเจ้าหน้าที่ หรือบัญชีถูกปิดใช้งาน', 'LOGIN_FAILED');
    }
    return staff;
  }

  static _checkPassword(raw) {
    const p = String(raw || '');
    if (p.length < CONFIG.STAFF_LOGIN.PASSWORD_MIN || !/[A-Za-z]/.test(p) || !/\d/.test(p)) {
      throw new AppError('รหัสผ่านต้องยาวอย่างน้อย ' + CONFIG.STAFF_LOGIN.PASSWORD_MIN +
        ' ตัว และมีทั้งตัวอักษรและตัวเลข', 'WEAK_PASSWORD');
    }
    return p;
  }

  static _issue(staff) {
    const s = new SessionRepository().create('staff', staff.staff_id, CONFIG.SESSION_DAYS_STAFF);
    return { result: 'ok', token: s.token, expires_at: s.expires_at, staff: StaffAuthController.publicStaff(staff) };
  }

  // นับครั้งที่ใส่ผิดไว้ใน Cache (หายเองเมื่อครบเวลา)
  static _checkLock(id) {
    const fails = Number(CacheService.getScriptCache().get('staff_fail_' + id) || 0);
    if (fails >= CONFIG.STAFF_LOGIN.MAX_FAILS) {
      throw new AppError('บัญชีถูกล็อกชั่วคราว ลองใหม่ใน ' + CONFIG.STAFF_LOGIN.LOCK_MINUTES +
        ' นาที หรือกด "ลืมรหัสผ่าน"', 'LOCKED');
    }
  }

  static _recordFail(id) {
    const cache = CacheService.getScriptCache();
    const fails = Number(cache.get('staff_fail_' + id) || 0) + 1;
    cache.put('staff_fail_' + id, String(fails), CONFIG.STAFF_LOGIN.LOCK_MINUTES * 60);
    return CONFIG.STAFF_LOGIN.MAX_FAILS - fails;
  }

  static _clearFails(id) {
    CacheService.getScriptCache().remove('staff_fail_' + id);
  }
}
