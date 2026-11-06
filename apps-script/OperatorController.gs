/**
 * OperatorController.gs
 * ขั้นที่ 5 : ผู้รับผิดชอบงาน (Operator หรือ Admin ที่มอบหมายให้ตัวเอง)
 *
 *  สถานะ  2 มอบหมายแล้ว -> [รับงาน] -> 3 รับงานแล้ว -> [นัดหมาย] -> 4 นัดหมายแล้ว -> [ปิดงาน] -> 5 รอประเมิน
 *         2, 3, 4      -> [ส่งคืน Admin + เหตุผล] -> 1 รอตรวจสอบ
 *         2, 3, 4      -> [ยกเลิก + เหตุผล]       -> 7 ยกเลิก
 *  ข้อความถึง User ส่งได้ทางเดียว (User ติดต่อกลับทางโทรศัพท์)
 *  แจ้ง User ทางอีเมลเฉพาะ "นัดหมาย" และ "ปิดงาน" เพื่อประหยัดโควตา
 */
class OperatorController {

  // flg = staff_accept
  static accept(data, req) {
    const { me, job } = OperatorController._mine(data, req, ['2']);
    new JobRepository().update(job.job_id, { status_number: '3' });
    new JobLogRepository().log(job.job_id, 'accept', 'staff', me.staff_id, '');
    return { result: 'ok' };
  }

  // flg = staff_return { job_id, reason }
  static returnToAdmin(data, req) {
    const { me, job } = OperatorController._mine(data, req, ['2', '3', '4']);
    const reason = Util.text(data.reason, 'เหตุผลที่ส่งคืน', 500, true);

    new JobRepository().update(job.job_id, { status_number: '1', assigned_staff_id: '', appointment_at: '' });
    new JobLogRepository().log(job.job_id, 'return', 'staff', me.staff_id, reason);

    const admins = new StaffRepository().findAdmins()
      .filter(a => String(a.staff_id) !== String(me.staff_id)).map(a => a.email);
    Notifier.send(admins, 'ส่งคืนงาน ' + job.job_number,
      Util.esc(me.full_name) + ' ส่งคืนใบงาน <b>' + job.job_number + '</b><br>เหตุผล: ' + Util.esc(reason) +
      Notifier.link('jobs', 'เปิดรายการงาน'));
    return { result: 'ok' };
  }

  // flg = staff_appoint { job_id, appointment_at: 'yyyy-MM-ddTHH:mm', note }
  static appoint(data, req) {
    const { me, job } = OperatorController._mine(data, req, ['3', '4']);
    const m = String(data.appointment_at || '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})$/);
    if (!m) throw new AppError('กรุณาเลือกวันและเวลานัดหมาย', 'REQUIRED');
    const at   = m[1] + ' ' + m[2] + ':00';
    const note = Util.text(data.note, 'ข้อความถึงผู้แจ้ง', 500, false);

    new JobRepository().update(job.job_id, { status_number: '4', appointment_at: at });
    new JobLogRepository().log(job.job_id, 'appoint', 'staff', me.staff_id, at + (note ? ' | ' + note : ''));

    const u = new UserRepository().findById(job.user_id);
    if (u) {
      Notifier.send(u.email, 'นัดหมายดำเนินการ ใบงาน ' + job.job_number,
        'เจ้าหน้าที่ <b>' + Util.esc(me.full_name) + '</b> นัดหมายเข้าดำเนินการใบงาน <b>' + job.job_number + '</b><br>' +
        'วันเวลา: <b>' + Util.esc(OperatorController.thaiDate(at)) + '</b><br>' +
        'สถานที่: ' + Util.esc(job.location) + (note ? '<br>ข้อความ: ' + Util.esc(note) : '') +
        '<br>ติดต่อเจ้าหน้าที่ โทร ' + Util.esc(me.phone_desk) + Notifier.link('my', 'ดูสถานะงาน'));
    }
    return { result: 'ok' };
  }

  // flg = staff_message { job_id, message }
  static message(data, req) {
    const { me, job } = OperatorController._mine(data, req, ['2', '3', '4']);
    const msg = Util.text(data.message, 'ข้อความ', 500, true);
    new JobLogRepository().log(job.job_id, 'message', 'staff', me.staff_id, msg);
    return { result: 'ok' };
  }

  // flg = staff_close { job_id, routine, cause, action_taken }
  static close(data, req) {
    const { me, job } = OperatorController._mine(data, req, ['3', '4']);
    const sub = new SubTypeRepository().findById(job.sub_id);
    const routine = !!data.routine && sub && String(sub.is_routine) === '1';

    const cause  = routine ? '' : Util.text(data.cause, 'สาเหตุ', 1000, true);
    const action = routine ? 'ดำเนินการแล้ว' : Util.text(data.action_taken, 'สิ่งที่ดำเนินการ', 1000, true);

    new JobRepository().update(job.job_id, {
      status_number: '5', cause: cause, action_taken: action, eval_status: 'pending'
    });
    new JobLogRepository().log(job.job_id, 'close', 'staff', me.staff_id, action);

    const u = new UserRepository().findById(job.user_id);
    if (u) {
      Notifier.send(u.email, 'ดำเนินการเสร็จแล้ว ใบงาน ' + job.job_number,
        'ใบงาน <b>' + job.job_number + '</b> ดำเนินการเสร็จแล้วโดย ' + Util.esc(me.full_name) + '<br>' +
        'สิ่งที่ดำเนินการ: ' + Util.esc(action) +
        '<br><br>รบกวนประเมินการให้บริการ เพื่อนำไปปรับปรุงงาน' + Notifier.link('my', 'ประเมินการให้บริการ'));
    }
    return { result: 'ok' };
  }

  // flg = staff_cancel { job_id, reason }
  static cancel(data, req) {
    const { me, job } = OperatorController._mine(data, req, ['2', '3', '4']);
    const reason = Util.text(data.reason, 'เหตุผลการยกเลิก', 500, true);
    new JobRepository().update(job.job_id, { status_number: '7', cancel_by: 'operator', cancel_reason: reason });
    new JobLogRepository().log(job.job_id, 'cancel', 'staff', me.staff_id, 'ยกเลิกโดยผู้ปฏิบัติงาน เนื่องจาก ' + reason);
    return { result: 'ok' };
  }

  /* ---------- ตัวช่วย ---------- */

  // ต้องเป็นผู้รับผิดชอบงานนี้ และสถานะต้องอยู่ในช่วงที่ทำรายการได้
  static _mine(data, req, allowed) {
    const me  = Auth.requireStaff(req);
    const job = new JobRepository().findById(data.job_id);
    if (!job) throw new AppError('ไม่พบใบงาน', 'NOT_FOUND');
    if (String(job.assigned_staff_id) !== String(me.staff_id)) {
      throw new AppError('ทำรายการได้เฉพาะผู้รับผิดชอบงานนี้', 'FORBIDDEN');
    }
    if (allowed.indexOf(String(job.status_number)) === -1) {
      throw new AppError('สถานะงานตอนนี้ทำรายการนี้ไม่ได้ กรุณาโหลดหน้าใหม่', 'BAD_STATUS');
    }
    return { me: me, job: job };
  }

  // "2026-11-06 14:30:00" -> "6 พ.ย. 2569 เวลา 14:30 น."
  static thaiDate(text) {
    const m = String(text).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
    if (!m) return text;
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return Number(m[3]) + ' ' + months[Number(m[2]) - 1] + ' ' + (Number(m[1]) + 543) + ' เวลา ' + m[4] + ':' + m[5] + ' น.';
  }
}
