/**
 * AuthController.gs
 * ขั้นที่ 2 : Soft login ของ User (อีเมล @tistr.or.th + เบอร์ภายใน 4 หลัก)
 *
 * กติกา
 *  - อีเมลยังไม่มีในระบบ        -> สร้าง User ใหม่ แล้วเข้าระบบเลย
 *  - อีเมลมีแล้ว และเบอร์ตรง     -> เข้าระบบ
 *  - อีเมลมีแล้ว แต่เบอร์ไม่ตรง  -> ยังไม่เข้าระบบ ให้เลือก "เปลี่ยนเบอร์" หรือ "ใช้อีเมลอื่น"
 *  - เลือกเปลี่ยนเบอร์           -> ส่ง OTP ไปที่อีเมลนั้น ต้องกรอก OTP ถูกก่อนถึงจะเปลี่ยนเบอร์และเข้าระบบ
 *                                 (ไม่ได้รับเมล -> ติดต่อ สทส. ตาม CONFIG.SUPPORT_PHONE)
 */

// ตัวช่วยตรวจ token ใช้ใน Controller อื่นๆ ต่อไป เช่น Auth.requireUser(req)
class Auth {
  static requireUser(req) {
    const s = new SessionRepository().findValid(String((req && req.token) || ''));
    if (!s || s.owner_type !== 'user') {
      throw new AppError('กรุณาเข้าสู่ระบบ', 'AUTH_REQUIRED');
    }
    const user = new UserRepository().findById(s.owner_id);
    if (!user) throw new AppError('ไม่พบบัญชีผู้ใช้ กรุณาเข้าสู่ระบบใหม่', 'AUTH_REQUIRED');
    return user;
  }
}

// ตรวจ token ของเจ้าหน้าที่ : Auth.requireStaff(req) หรือ Auth.requireStaff(req, 'admin')
Auth.requireStaff = function (req, role) {
  const s = new SessionRepository().findValid(String((req && req.token) || ''));
  if (!s || s.owner_type !== 'staff') throw new AppError('กรุณาเข้าสู่ระบบเจ้าหน้าที่', 'STAFF_AUTH_REQUIRED');
  const staff = new StaffRepository().findById(s.owner_id);
  if (!staff || String(staff.active) !== '1') throw new AppError('บัญชีเจ้าหน้าที่ถูกปิดใช้งาน', 'STAFF_AUTH_REQUIRED');
  if (role && String(staff.role) !== role) throw new AppError('ไม่มีสิทธิ์ทำรายการนี้', 'FORBIDDEN');
  return staff;
};

class AuthController {

  // flg = user_login
  static userLogin(data) {
    const email = AuthController.normalizeEmail(data.email);
    const phone = AuthController.normalizePhone(data.phone4);
    const lockKey = 'user_fail_' + email;

    // กันการไล่เดาเบอร์ 4 หลัก
    if (Util.counter.get(lockKey) >= CONFIG.USER_LOGIN.MAX_FAILS) {
      SecurityLogRepository.write('user_locked', 'user', email, '');
      throw new AppError('ใส่เบอร์ไม่ตรงหลายครั้งเกินไป กรุณารอ ' + CONFIG.USER_LOGIN.LOCK_MINUTES +
        ' นาที หรือติดต่อ สทส. โทร ' + CONFIG.SUPPORT_PHONE, 'LOCKED');
    }

    const user = new UserRepository().findByEmail(email);

    // ผู้ใช้ใหม่ / ยังไม่ยืนยันอีเมล -> ส่ง OTP ยืนยันว่าเป็นเจ้าของอีเมลจริงก่อน
    if (!user || String(user.email_verified) !== '1') {
      if (user && String(user.phone4) !== phone) return AuthController._mismatch(email, lockKey);
      return AuthController._sendVerifyEmail(email, phone);
    }

    if (String(user.phone4) !== phone) return AuthController._mismatch(email, lockKey);

    Util.counter.clear(lockKey);
    SecurityLogRepository.write('user_login', 'user', email, '');
    return AuthController._issueUserSession(user, false);
  }

  // flg = user_verify_email : กรอก OTP ยืนยันอีเมลครั้งแรก -> สร้าง/ยืนยันบัญชี + เข้าระบบ
  static userVerifyEmail(data) {
    const email = AuthController.normalizeEmail(data.email);
    const otp   = OtpService.verify(email, 'verify_email', data.otp);
    const users = new UserRepository();

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      let user  = users.findByEmail(email);
      let isNew = false;
      if (!user) {
        user  = users.insert({ email: email, phone4: String(otp.new_phone4), email_verified: '1' });
        isNew = true;
      } else {
        user = users.update(user.user_id, { email_verified: '1' });
      }
      Util.counter.clear('user_fail_' + email);
      SecurityLogRepository.write('user_email_verified', 'user', email, isNew ? 'new' : 'existing');
      return AuthController._issueUserSession(user, isNew);
    } finally {
      lock.releaseLock();
    }
  }

  static _mismatch(email, lockKey) {
    const n = Util.counter.add(lockKey, CONFIG.USER_LOGIN.LOCK_MINUTES * 60);
    SecurityLogRepository.write('user_phone_mismatch', 'user', email, 'ครั้งที่ ' + n);
    return { result: 'phone_mismatch', email: email, support_phone: CONFIG.SUPPORT_PHONE };
  }

  static _sendVerifyEmail(email, phone) {
    OtpService.issue(email, 'verify_email', email, code => ({
      subject: '[' + CONFIG.APP_NAME + '] รหัส OTP ยืนยันอีเมล',
      htmlBody: OtpService.mailBody('ยืนยันอีเมลเพื่อเริ่มใช้งาน' + Util.esc(CONFIG.APP_NAME) +
        ' (ยืนยันครั้งเดียว ครั้งต่อไปใช้อีเมลและเบอร์ภายในเข้าระบบได้ทันที)', code)
    }), { new_phone4: phone });
    return {
      result: 'verify_email',
      email: email,
      expire_minutes: CONFIG.OTP.EXPIRE_MINUTES,
      resend_seconds: CONFIG.OTP.RESEND_SECONDS,
      support_phone: CONFIG.SUPPORT_PHONE
    };
  }

  // flg = user_request_otp : ขอรหัส OTP สำหรับเปลี่ยนเบอร์ (ส่งไปที่อีเมลของบัญชี)
  static userRequestOtp(data) {
    const email = AuthController.normalizeEmail(data.email);
    const phone = AuthController.normalizePhone(data.phone4);

    const user = new UserRepository().findByEmail(email);
    if (!user) throw new AppError('ไม่พบอีเมลนี้ในระบบ', 'NOT_FOUND');
    if (String(user.phone4) === phone) {
      throw new AppError('เบอร์นี้ตรงกับที่บันทึกไว้แล้ว กรุณาเข้าสู่ระบบตามปกติ', 'PHONE_SAME');
    }

    OtpService.issue(email, 'change_phone', email, code => ({
      subject: '[' + CONFIG.APP_NAME + '] รหัส OTP สำหรับเปลี่ยนเบอร์โทรภายใน',
      htmlBody: OtpService.mailBody(
        'มีการขอเปลี่ยนเบอร์โทรภายในของอีเมล ' + email + ' เป็น <b>' + phone + '</b> ' +
        '(ถ้าไม่ได้ขอ เบอร์ของคุณจะไม่ถูกเปลี่ยน)', code)
    }), { new_phone4: phone });

    return {
      result: 'otp_sent',
      email: email,
      expire_minutes: CONFIG.OTP.EXPIRE_MINUTES,
      resend_seconds: CONFIG.OTP.RESEND_SECONDS,
      support_phone: CONFIG.SUPPORT_PHONE
    };
  }

  // flg = user_verify_otp : กรอก OTP ถูก -> เปลี่ยนเบอร์ + เข้าระบบ
  static userVerifyOtp(data) {
    const email = AuthController.normalizeEmail(data.email);
    const otp   = OtpService.verify(email, 'change_phone', data.otp);
    const users = new UserRepository();

    const user = users.findByEmail(email);
    if (!user) throw new AppError('ไม่พบอีเมลนี้ในระบบ', 'NOT_FOUND');

    // OTP ส่งถึงอีเมลนี้แล้ว จึงถือว่ายืนยันอีเมลไปในตัว
    const oldPhone = String(user.phone4);
    const updated  = users.update(user.user_id, { phone4: String(otp.new_phone4), email_verified: '1' });
    Util.counter.clear('user_fail_' + email);
    SecurityLogRepository.write('user_phone_changed', 'user', email, oldPhone + ' -> ' + otp.new_phone4);
    AuthController._notifyPhoneChanged(updated, oldPhone, String(otp.new_phone4));

    return AuthController._issueUserSession(updated, false);
  }

  // flg = user_me : ใช้เช็คว่า token ยังใช้ได้ + ดึงข้อมูลล่าสุด
  static userMe(req) {
    return { user: AuthController.publicUser(Auth.requireUser(req)) };
  }

  // flg = logout
  static logout(req) {
    const token = String((req && req.token) || '');
    if (token) new SessionRepository().revoke(token);
    return { result: 'ok' };
  }

  /* ---------- ตัวช่วย ---------- */

  // รับได้ทั้ง "somchai_s" และ "somchai_s@tistr.or.th"
  static normalizeEmail(raw) {
    let email = String(raw || '').trim().toLowerCase();
    if (email === '') throw new AppError('กรุณากรอกอีเมล', 'INVALID_EMAIL');
    if (email.indexOf('@') === -1) email += CONFIG.EMAIL_DOMAIN;

    const domain = CONFIG.EMAIL_DOMAIN.toLowerCase();
    const local  = email.slice(0, -domain.length);
    if (!email.endsWith(domain) || !/^[a-z0-9._-]+$/.test(local)) {
      throw new AppError('ระบบให้บริการเฉพาะอีเมล ' + CONFIG.EMAIL_DOMAIN + ' เท่านั้น', 'INVALID_EMAIL');
    }
    return email;
  }

  static normalizePhone(raw) {
    const phone = String(raw || '').trim();
    if (!/^\d{4}$/.test(phone)) {
      throw new AppError('เบอร์โทรภายในต้องเป็นตัวเลข 4 หลัก', 'INVALID_PHONE');
    }
    return phone;
  }

  static publicUser(u) {
    return {
      user_id:   u.user_id,
      email:     u.email,
      phone4:    u.phone4,
      full_name: u.full_name,
      position:  u.position,
      division:  u.division,
      division_id: u.division_id,
      room:      u.room
    };
  }

  static _issueUserSession(user, isNew) {
    const s = new SessionRepository().create('user', user.user_id, CONFIG.SESSION_DAYS_USER);
    return {
      result: 'ok',
      is_new: isNew,
      token: s.token,
      expires_at: s.expires_at,
      user: AuthController.publicUser(user)
    };
  }

  // แจ้งยืนยันหลังเปลี่ยนเบอร์สำเร็จ (ส่งไม่ผ่านก็ไม่ทำให้ล็อกอินล้ม)
  static _notifyPhoneChanged(user, oldPhone, newPhone) {
    try {
      Notifier.send(user.email, 'เปลี่ยนเบอร์โทรภายในเรียบร้อย',
        'เบอร์โทรภายในที่ใช้เข้าระบบของอีเมล ' + Util.esc(user.email) +
        ' ถูกเปลี่ยนจาก <b>' + Util.esc(oldPhone) + '</b> เป็น <b>' + Util.esc(newPhone) + '</b>' +
        ' เมื่อ ' + Util.now() + ' (ยืนยันด้วยรหัส OTP แล้ว)<br><br>' +
        'ถ้าคุณไม่ได้เป็นผู้เปลี่ยน กรุณาแจ้งเจ้าหน้าที่ สทส. ทันที', 'high');
    } catch (e) {
      console.error('ส่งเมลแจ้งเปลี่ยนเบอร์ไม่สำเร็จ: ' + e);
    }
  }
}
