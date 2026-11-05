/**
 * OtpService.gs
 * ออก / ตรวจรหัส OTP ทางอีเมล ใช้ร่วมกันทั้งระบบ
 *  - user  : ยืนยันการเปลี่ยนเบอร์โทร      (key = อีเมล User,  purpose = change_phone)
 *  - staff : ตั้ง / รีเซ็ตรหัสผ่านเจ้าหน้าที่ (key = staff:<id>, purpose = staff_password)
 *
 * สถานะในคอลัมน์ used : 0 = รอใช้, 1 = ใช้สำเร็จ, 2 = ถูกแทนที่, 3 = หมดอายุ, 4 = ผิดเกินกำหนด
 */
class OtpService {

  // ออกรหัสใหม่แล้วส่งอีเมล : buildMail(code) ต้องคืน { subject, htmlBody }
  static issue(key, purpose, sendTo, buildMail, extra) {
    const otps = new OtpRepository();
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const last = otps.findLatestActive(key, purpose);
      if (last) {
        const passed = (Date.now() - Util.parse(last.created_at).getTime()) / 1000;
        const wait   = Math.ceil(CONFIG.OTP.RESEND_SECONDS - passed);
        if (wait > 0) throw new AppError('ขอรหัสใหม่ได้อีกครั้งใน ' + wait + ' วินาที', 'OTP_WAIT');
        otps.update(last.otp_id, { used: '2' });
      }

      const code = Util.randomDigits(CONFIG.OTP.LENGTH);
      const salt = Util.uuid();
      otps.insert(Object.assign({
        email: key,
        purpose: purpose,
        otp_hash: Util.sha256(salt + code),        // เก็บแค่ hash
        otp_salt: salt,
        expires_at: Util.addMinutes(CONFIG.OTP.EXPIRE_MINUTES),
        attempts: '0',
        used: '0'
      }, extra || {}));

      const mail = buildMail(code);
      try {
        MailApp.sendEmail({ to: sendTo, subject: mail.subject, htmlBody: mail.htmlBody });
      } catch (e) {
        console.error('ส่ง OTP ไม่สำเร็จ: ' + e);
        throw new AppError('ส่งอีเมลไม่สำเร็จ กรุณาติดต่อ สทส. โทร ' + CONFIG.SUPPORT_PHONE, 'MAIL_FAILED');
      }
    } finally {
      lock.releaseLock();
    }
  }

  // ตรวจรหัส ถูก -> คืนแถว OTP (มี new_phone4 ฯลฯ) / ผิด -> โยน AppError
  static verify(key, purpose, code) {
    const c = String(code || '').trim();
    if (!new RegExp('^\\d{' + CONFIG.OTP.LENGTH + '}$').test(c)) {
      throw new AppError('รหัส OTP ต้องเป็นตัวเลข ' + CONFIG.OTP.LENGTH + ' หลัก', 'OTP_FORMAT');
    }

    const otps = new OtpRepository();
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const otp = otps.findLatestActive(key, purpose);
      if (!otp) throw new AppError('ไม่พบรหัสที่ใช้ได้ กรุณากดขอรหัสใหม่', 'OTP_INVALID');

      if (String(otp.expires_at) <= Util.now()) {
        otps.update(otp.otp_id, { used: '3' });
        throw new AppError('รหัสหมดอายุแล้ว กรุณากดขอรหัสใหม่', 'OTP_EXPIRED');
      }

      const attempts = Number(otp.attempts) || 0;
      if (Util.sha256(otp.otp_salt + c) !== String(otp.otp_hash)) {
        const used = attempts + 1;
        const left = CONFIG.OTP.MAX_ATTEMPTS - used;
        otps.update(otp.otp_id, { attempts: String(used), used: left <= 0 ? '4' : '0' });
        if (left <= 0) throw new AppError('กรอกรหัสผิดเกินกำหนด กรุณากดขอรหัสใหม่', 'OTP_LOCKED');
        throw new AppError('รหัสไม่ถูกต้อง เหลือโอกาสอีก ' + left + ' ครั้ง', 'OTP_WRONG');
      }

      otps.update(otp.otp_id, { used: '1', attempts: String(attempts + 1) });
      return otp;
    } finally {
      lock.releaseLock();
    }
  }

  // ท้ายอีเมล OTP ที่ใช้ร่วมกัน
  static mailBody(intro, code) {
    return intro + '<br><br>' +
      'รหัส OTP ของคุณคือ<br>' +
      '<div style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:8px 0 12px">' + code + '</div>' +
      'รหัสนี้ใช้ได้ภายใน ' + CONFIG.OTP.EXPIRE_MINUTES + ' นาที ห้ามบอกรหัสนี้กับผู้อื่น<br><br>' +
      'ถ้าคุณไม่ได้เป็นผู้ขอ ไม่ต้องทำอะไร และสามารถแจ้งเจ้าหน้าที่ สทส. ได้ที่เบอร์ ' + CONFIG.SUPPORT_PHONE + '<br><br>' +
      '<em>อีเมลฉบับนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ</em>';
  }
}
