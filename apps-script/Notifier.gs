/**
 * Notifier.gs
 * จุดเดียวที่ส่งการแจ้งเตือนออกจากระบบ
 *
 * ลำดับความสำคัญ
 *  - 'high'   : OTP และเรื่องความปลอดภัย -> ส่งเสมอ (ถ้าโควตายังมี)
 *  - 'normal' : แจ้งสถานะงาน -> ถ้าโควตาเหลือน้อยกว่า CONFIG.MAIL_RESERVE จะงดส่ง
 *               (เก็บโควตาที่เหลือไว้ให้ OTP) และบันทึก mail_skipped ใน security_log
 *
 * แนวทางสำรองเมื่อโควตาไม่พอ : แก้แค่ method _deliver() ในไฟล์นี้ไฟล์เดียว
 *  เช่น เปลี่ยนไปส่งผ่านบัญชี Google Workspace, mail relay ขององค์กร หรือ LINE Messaging API
 */
class Notifier {

  static send(to, subject, htmlBody, priority) {
    const list = [].concat(to || []).map(String).filter(Boolean);
    if (!list.length) return false;

    const p = priority || 'normal';
    if (p !== 'high' && MailApp.getRemainingDailyQuota() < CONFIG.MAIL_RESERVE + list.length) {
      SecurityLogRepository.write('mail_skipped', 'mail', list.join(','), subject);
      return false;
    }

    try {
      Notifier._deliver(list, '[' + CONFIG.APP_NAME + '] ' + subject, htmlBody);
      return true;
    } catch (e) {
      console.error('ส่งอีเมลไม่สำเร็จ: ' + e);
      if (p === 'high') throw e;
      return false;
    }
  }

  static _deliver(list, subject, htmlBody) {
    MailApp.sendEmail({
      to: list.join(','),
      subject: subject,
      htmlBody: htmlBody + '<br><br><em style="color:#888">อีเมลฉบับนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ ' +
        'ติดต่อ สทส. โทร ' + CONFIG.SUPPORT_PHONE + '</em>'
    });
  }

  // ลิงก์เปิดหน้าเว็บ (ตั้ง Script Property ชื่อ APP_URL เช่น https://dsdservicetistr.github.io/tistr-service/)
  static link(MM, label) {
    const base = PropertiesService.getScriptProperties().getProperty('APP_URL');
    if (!base) return '';
    return '<br><br><a href="' + Util.esc(base.replace(/\/?$/, '/') + 'index.html?MM=' + MM) + '">' + Util.esc(label) + '</a>';
  }
}
