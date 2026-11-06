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
      SecurityLogRepository.write('staff_login_fail', 'staff', staff.ad_name, 'เหลือ ' + left + ' ครั้ง');
      throw new AppError(left > 0
        ? 'รหัสผ่านไม่ถูกต้อง เหลือโอกาสอีก ' + left + ' ครั้ง'
        : 'ใส่รหัสผิดเกินกำหนด ล็อกไว้ ' + CONFIG.STAFF_LOGIN.LOCK_MINUTES + ' นาที', 'LOGIN_FAILED');
    }
    StaffAuthController._clearFails(staff.staff_id);

    // Admin ต้องยืนยัน OTP (2FA) วันละครั้งต่อเครื่อง
    // เครื่องที่ยืนยันแล้ววันนี้จะส่ง trust_token มาด้วย -> ข้าม OTP ได้ถึงเที่ยงคืน
    const needs2fa = CONFIG.STAFF_2FA_ROLES.indexOf(String(staff.role)) > -1;
    if (needs2fa && StaffAuthController._trusted(staff, data.trust_token)) {
      SecurityLogRepository.write('staff_login', 'staff', staff.ad_name, '2FA (เครื่องที่ยืนยันแล้ววันนี้)');
      return StaffAuthController._issue(staff);
    }
    if (needs2fa) {
      if (!staff.email) throw new AppError('ยังไม่ได้ตั้งอีเมลของบัญชีนี้ กรุณาติดต่อ Admin', 'NO_EMAIL');
      const nonce = Util.uuid();
      CacheService.getScriptCache().put('staff_2fa_' + staff.staff_id, nonce, CONFIG.OTP.EXPIRE_MINUTES * 60);
      OtpService.issue('staff:' + staff.staff_id, 'staff_login', staff.email, code => ({
        subject: '[' + CONFIG.APP_NAME + '] รหัส OTP เข้าสู่ระบบเจ้าหน้าที่',
        htmlBody: OtpService.mailBody('มีการเข้าสู่ระบบด้วยบัญชี <b>' + Util.esc(staff.ad_name) +
          '</b> และใส่รหัสผ่านถูกต้องแล้ว ถ้าไม่ใช่คุณ กรุณาเปลี่ยนรหัสผ่านทันที', code)
      }));
      return {
        result: 'otp_required',
        nonce: nonce,
        email_masked: Util.maskEmail(staff.email),
        resend_seconds: CONFIG.OTP.RESEND_SECONDS
      };
    }

    SecurityLogRepository.write('staff_login', 'staff', staff.ad_name, '');
    return StaffAuthController._issue(staff);
  }

  // flg = staff_verify_login : ขั้นที่ 2 ของ Admin (OTP) ต้องมาคู่กับ nonce จากขั้นรหัสผ่าน
  static verifyLogin(data) {
    const staff = StaffAuthController._findActive(data.ad_name);
    const key   = 'staff_2fa_' + staff.staff_id;
    const nonce = CacheService.getScriptCache().get(key);
    if (!nonce || nonce !== String(data.nonce || '')) {
      throw new AppError('หมดเวลายืนยัน กรุณาเข้าสู่ระบบใหม่อีกครั้ง', 'LOGIN_EXPIRED');
    }
    OtpService.verify('staff:' + staff.staff_id, 'staff_login', data.otp);
    CacheService.getScriptCache().remove(key);
    SecurityLogRepository.write('staff_login', 'staff', staff.ad_name, '2FA');

    // จำเครื่องนี้ไว้ถึงเที่ยงคืน
    const trust = new SessionRepository().create('trust', staff.staff_id, Util.endOfToday());
    const result = StaffAuthController._issue(staff);
    result.trust_token = trust.token;
    return result;
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
    SecurityLogRepository.write('staff_password_set', 'staff', staff.ad_name, '');
    // ตั้งรหัสผ่านผ่าน OTP แล้ว นับเป็นการยืนยัน 2FA ของวันนี้ในเครื่องนี้ด้วย
    const result = StaffAuthController._issue(updated);
    result.trust_token = new SessionRepository().create('trust', staff.staff_id, Util.endOfToday()).token;
    return result;
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
    const result = { result: 'ok', token: s.token, expires_at: s.expires_at, staff: StaffAuthController.publicStaff(staff) };

    // ถ้าอีเมลและเบอร์โต๊ะตรงกับบัญชี User ที่ลงทะเบียนไว้ -> เข้าฝั่ง User ให้ด้วยเลย
    const u = staff.email ? new UserRepository().findByEmail(staff.email) : null;
    if (u && String(u.phone4) === String(staff.phone_desk)) {
      // เจ้าหน้าที่ยืนยันอีเมลนี้ผ่าน OTP มาแล้วตอนตั้งรหัส จึงถือว่ายืนยันอีเมลแล้ว
      const user = String(u.email_verified) === '1' ? u : new UserRepository().update(u.user_id, { email_verified: '1' });
      const us = new SessionRepository().create('user', user.user_id, CONFIG.SESSION_DAYS_STAFF);
      result.user_token = us.token;
      result.user = AuthController.publicUser(user);
    }
    return result;
  }

  static _trusted(staff, token) {
    const t = new SessionRepository().findValid(String(token || ''));
    return !!t && t.owner_type === 'trust' && String(t.owner_id) === String(staff.staff_id);
  }

  // นับครั้งที่ใส่ผิดไว้ใน Cache (หายเองเมื่อครบเวลา)
  static _checkLock(id) {
    const fails = Number(CacheService.getScriptCache().get('staff_fail_' + id) || 0);
    if (fails >= CONFIG.STAFF_LOGIN.MAX_FAILS) {
      SecurityLogRepository.write('staff_locked', 'staff', id, '');
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
