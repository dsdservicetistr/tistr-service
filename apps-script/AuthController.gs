/**
 * AuthController.gs
 * ขั้นที่ 2 : Soft login ของ User (อีเมล @tistr.or.th + เบอร์ภายใน 4 หลัก)
 *
 * กติกา
 *  - อีเมลยังไม่มีในระบบ        -> สร้าง User ใหม่ แล้วเข้าระบบเลย
 *  - อีเมลมีแล้ว และเบอร์ตรง     -> เข้าระบบ
 *  - อีเมลมีแล้ว แต่เบอร์ไม่ตรง  -> ยังไม่เข้าระบบ ให้หน้าเว็บถามว่าจะอัปเดตเบอร์ หรือใช้อีเมลอื่น
 *  - เลือกอัปเดตเบอร์           -> แก้เบอร์ + ส่งอีเมลแจ้งเจ้าของอีเมล + เข้าระบบ
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

class AuthController {

  // flg = user_login
  static userLogin(data) {
    const email = AuthController.normalizeEmail(data.email);
    const phone = AuthController.normalizePhone(data.phone4);
    const users = new UserRepository();

    // กันกดซ้ำพร้อมกันแล้วได้ User ซ้ำ 2 แถว
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      let user  = users.findByEmail(email);
      let isNew = false;

      if (!user) {
        user  = users.insert({ email: email, phone4: phone });
        isNew = true;
      } else if (String(user.phone4) !== phone) {
        return { result: 'phone_mismatch', email: email };
      }

      return AuthController._issueUserSession(user, isNew);
    } finally {
      lock.releaseLock();
    }
  }

  // flg = user_update_phone (หลังจาก User กดยืนยันว่าจะอัปเดตเบอร์)
  static userUpdatePhone(data) {
    const email = AuthController.normalizeEmail(data.email);
    const phone = AuthController.normalizePhone(data.phone4);
    const users = new UserRepository();

    const user = users.findByEmail(email);
    if (!user) throw new AppError('ไม่พบอีเมลนี้ในระบบ', 'NOT_FOUND');

    const oldPhone = String(user.phone4);
    const updated  = users.update(user.user_id, { phone4: phone });
    AuthController._notifyPhoneChanged(updated, oldPhone, phone);

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

  // ส่งเมลแจ้งเจ้าของอีเมล เผื่อมีคนอื่นมาเปลี่ยนเบอร์แทน (ส่งไม่ผ่านก็ไม่ทำให้ล็อกอินล้ม)
  static _notifyPhoneChanged(user, oldPhone, newPhone) {
    try {
      MailApp.sendEmail({
        to: user.email,
        subject: '[' + CONFIG.APP_NAME + '] มีการเปลี่ยนเบอร์โทรภายในของบัญชีคุณ',
        htmlBody:
          'เบอร์โทรภายในที่ใช้เข้าระบบของอีเมล ' + user.email +
          ' ถูกเปลี่ยนจาก <b>' + oldPhone + '</b> เป็น <b>' + newPhone + '</b>' +
          ' เมื่อ ' + Util.now() + '<br><br>' +
          'ถ้าคุณไม่ได้เป็นผู้เปลี่ยน กรุณาแจ้งเจ้าหน้าที่ สทส.<br><br>' +
          '<em>อีเมลฉบับนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ</em>'
      });
    } catch (e) {
      console.error('ส่งเมลแจ้งเปลี่ยนเบอร์ไม่สำเร็จ: ' + e);
    }
  }
}
