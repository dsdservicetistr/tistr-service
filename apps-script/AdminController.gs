/**
 * AdminController.gs
 * ขั้นที่ 4 : หน้ารายการงานของเจ้าหน้าที่
 *  - Admin    : เห็นทุกงาน เปลี่ยนหมวด มอบหมาย (รวมมอบให้ตัวเอง) และยกเลิกงาน
 *  - Operator : เห็นเฉพาะงานที่ถูกมอบหมายให้ตัวเอง (การรับงาน/ปิดงาน ทำในขั้นที่ 5)
 */

// รวมข้อมูลอ้างอิงที่ต้องใช้แสดงผล (โหลดครั้งเดียวต่อ request)
class Lookup {
  constructor() {
    const map = (rows, key) => rows.reduce((m, r) => { m[String(r[key])] = r; return m; }, {});
    this.users     = map(new UserRepository().findAll(), 'user_id');
    this.staff     = map(new StaffRepository().findAll(), 'staff_id');
    this.cats      = map(new CategoryRepository().findAll(), 'cat_id');
    this.subs      = map(new SubTypeRepository().findAll(), 'sub_id');
    this.statuses  = map(new StatusRepository().findAll(), 'status_number');
    this.divisions = map(new DivisionRepository().findAll(), 'div_id');
  }

  catName(catId, subId) {
    const c = this.cats[String(catId)];
    const s = this.subs[String(subId)];
    return (c ? c.cat_name : '-') + (s ? ' > ' + s.sub_name : '');
  }

  staffName(id) {
    const s = this.staff[String(id)];
    return s ? s.full_name : '';
  }
}

class AdminController {

  // (ใช้ getter แทน static field เพื่อให้ทำงานได้แน่นอนบน Apps Script)
  static get OPEN()   { return ['1', '2', '3', '4']; }
  static get CLOSED() { return ['5', '6', '7']; }

  // flg = staff_list_jobs  { filter: 'new' | 'open' | 'closed' | 'all' }
  static listJobs(data, req) {
    const me  = Auth.requireStaff(req);
    const lk  = new Lookup();
    let jobs  = new JobRepository().findAll();

    if (String(me.role) !== 'admin') {
      jobs = jobs.filter(j => String(j.assigned_staff_id) === String(me.staff_id));
    }

    const counts = { new: 0, mine: 0, open: 0, closed: 0, all: jobs.length };
    jobs.forEach(j => {
      const st = String(j.status_number);
      if (String(j.assigned_staff_id) === String(me.staff_id) && AdminController.OPEN.indexOf(st) > -1) counts.mine++;
      if (st === '1') counts.new++;
      if (AdminController.OPEN.indexOf(st) > -1) counts.open++;
      if (AdminController.CLOSED.indexOf(st) > -1) counts.closed++;
    });

    const filter = String(data.filter || 'open');
    jobs = jobs.filter(j => {
      const st = String(j.status_number);
      if (filter === 'new') return st === '1';
      if (filter === 'mine') return String(j.assigned_staff_id) === String(me.staff_id) && AdminController.OPEN.indexOf(st) > -1;
      if (filter === 'open') return AdminController.OPEN.indexOf(st) > -1;
      if (filter === 'closed') return AdminController.CLOSED.indexOf(st) > -1;
      return true;
    });

    jobs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const rows = jobs.map(j => {
      const u  = lk.users[String(j.user_id)] || {};
      const st = lk.statuses[String(j.status_number)] || {};
      const d  = lk.divisions[String(j.division_id)];
      return {
        job_id: j.job_id,
        job_number: j.job_number,
        created_at: j.created_at,
        user_name: u.full_name || u.email || '-',
        user_phone: u.phone4 || '',
        division: d ? DivisionRepository.label(d) : (u.division || ''),
        category: lk.catName(j.cat_id, j.sub_id),
        cat_changed: String(j.cat_id) !== String(j.original_cat_id) || String(j.sub_id) !== String(j.original_sub_id),
        detail_short: String(j.detail || '').slice(0, 120),
        location: j.location,
        status_number: j.status_number,
        status_text: st.status_admin_thai || '',
        status_color: st.status_color || 'secondary',
        assigned_name: lk.staffName(j.assigned_staff_id),
        has_files: String(j.attachments || '') !== ''
      };
    });

    return { me: StaffAuthController.publicStaff(me), counts: counts, rows: rows };
  }

  // flg = staff_job_detail { job_id }
  static jobDetail(data, req) {
    const me  = Auth.requireStaff(req);
    const job = AdminController._getJob(data.job_id, me);
    const lk  = new Lookup();
    const u   = lk.users[String(job.user_id)] || {};
    const st  = lk.statuses[String(job.status_number)] || {};
    const d   = lk.divisions[String(job.division_id)];
    const isAdmin = String(me.role) === 'admin';

    const logs = new JobLogRepository().findBy('job_id', job.job_id)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map(l => ({
        action: l.action,
        note: l.note,
        created_at: l.created_at,
        actor: l.actor_type === 'user'
          ? ((lk.users[String(l.actor_id)] || {}).full_name || 'ผู้แจ้ง')
          : (lk.staffName(l.actor_id) || 'เจ้าหน้าที่')
      }));

    let files = [];
    try { files = JSON.parse(job.attachments || '[]'); } catch (e) { files = []; }

    const result = {
      job: {
        job_id: job.job_id,
        job_number: job.job_number,
        created_at: job.created_at,
        cat_id: job.cat_id,
        sub_id: job.sub_id,
        category: lk.catName(job.cat_id, job.sub_id),
        original_category: lk.catName(job.original_cat_id, job.original_sub_id),
        detail: job.detail,
        location: job.location,
        asset_no: job.asset_no,
        status_number: job.status_number,
        status_text: st.status_admin_thai || '',
        status_color: st.status_color || 'secondary',
        assigned_staff_id: job.assigned_staff_id,
        assigned_name: lk.staffName(job.assigned_staff_id),
        cancel_reason: job.cancel_reason,
        appointment_at: job.appointment_at,
        cause: job.cause,
        action_taken: job.action_taken,
        is_routine: !!(lk.subs[String(job.sub_id)] && String(lk.subs[String(job.sub_id)].is_routine) === '1'),
        files: files.map(f => ({ id: f.id, name: f.name }))
      },
      is_mine: String(job.assigned_staff_id) === String(me.staff_id),
      user: {
        full_name: u.full_name, position: u.position, email: u.email, phone4: u.phone4,
        division: d ? DivisionRepository.label(d) : (u.division || ''), room: u.room
      },
      logs: logs,
      can_manage: isAdmin && AdminController.CLOSED.indexOf(String(job.status_number)) === -1
    };

    if (isAdmin) {
      const sub = lk.subs[String(job.sub_id)];
      result.suggest_staff_id = sub ? String(sub.default_staff_id || '') : '';
      result.staff = new StaffRepository().findActive().map(s => ({
        staff_id: s.staff_id, full_name: s.full_name, role: s.role, phone_desk: s.phone_desk
      }));
      result.categories = new CategoryRepository().findActive()
        .filter(c => !c.link_url)
        .map(c => ({ cat_id: c.cat_id, cat_name: c.cat_name }));
      result.sub_types = new SubTypeRepository().findActive()
        .map(s => ({ sub_id: s.sub_id, cat_id: s.cat_id, sub_name: s.sub_name }));
    }
    return result;
  }

  // flg = staff_get_file { job_id, file_id } : ส่งรูปแนบกลับเป็น base64 (ไฟล์ใน Drive ยังเป็นส่วนตัว)
  static getFile(data, req) {
    const me  = Auth.requireStaff(req);
    const job = AdminController._getJob(data.job_id, me);
    let files = [];
    try { files = JSON.parse(job.attachments || '[]'); } catch (e) { files = []; }
    const f = files.find(x => String(x.id) === String(data.file_id));
    if (!f) throw new AppError('ไม่พบไฟล์', 'NOT_FOUND');

    const blob = DriveApp.getFileById(f.id).getBlob();
    return { name: f.name, type: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
  }

  // flg = admin_change_category { job_id, cat_id, sub_id, note }
  static changeCategory(data, req) {
    const me  = Auth.requireStaff(req, 'admin');
    const job = AdminController._getOpenJob(data.job_id, me);

    const cat = new CategoryRepository().findById(data.cat_id);
    if (!cat || String(cat.active) !== '1' || cat.link_url) throw new AppError('หมวดที่เลือกไม่ถูกต้อง', 'BAD_CATEGORY');
    const subs = new SubTypeRepository().findByCategory(cat.cat_id);
    let subId = '';
    if (subs.length) {
      const sub = subs.find(s => String(s.sub_id) === String(data.sub_id));
      if (!sub) throw new AppError('กรุณาเลือกประเภทย่อย', 'BAD_SUBTYPE');
      subId = sub.sub_id;
    }
    if (String(job.cat_id) === String(cat.cat_id) && String(job.sub_id) === String(subId)) {
      throw new AppError('หมวดไม่ได้เปลี่ยน', 'NO_CHANGE');
    }

    const lk = new Lookup();
    const before = lk.catName(job.cat_id, job.sub_id);
    new JobRepository().update(job.job_id, { cat_id: cat.cat_id, sub_id: subId });
    const note = Util.text(data.note, 'หมายเหตุ', 500, false);
    new JobLogRepository().log(job.job_id, 'change_category', 'staff', me.staff_id,
      before + ' → ' + lk.catName(cat.cat_id, subId) + (note ? ' : ' + note : ''));
    return { result: 'ok' };
  }

  // flg = admin_assign { job_id, staff_id, note }
  static assign(data, req) {
    const me  = Auth.requireStaff(req, 'admin');
    const job = AdminController._getOpenJob(data.job_id, me);
    if (['1', '2'].indexOf(String(job.status_number)) === -1) {
      throw new AppError('งานนี้เจ้าหน้าที่รับงานไปแล้ว', 'BAD_STATUS');
    }

    const staff = new StaffRepository().findById(data.staff_id);
    if (!staff || String(staff.active) !== '1') throw new AppError('กรุณาเลือกผู้รับผิดชอบ', 'REQUIRED');
    const note = Util.text(data.note, 'หมายเหตุ', 500, false);

    new JobRepository().update(job.job_id, { assigned_staff_id: staff.staff_id, status_number: '2' });
    new JobLogRepository().log(job.job_id, 'assign', 'staff', me.staff_id,
      'มอบหมายให้ ' + staff.full_name + (note ? ' : ' + note : ''));

    AdminController._notifyAssigned(job, staff, me, note);
    return { result: 'ok' };
  }

  // flg = admin_cancel { job_id, reason }
  static cancel(data, req) {
    const me     = Auth.requireStaff(req, 'admin');
    const job    = AdminController._getOpenJob(data.job_id, me);
    const reason = Util.text(data.reason, 'เหตุผลการยกเลิก', 500, true);

    new JobRepository().update(job.job_id, { status_number: '7', cancel_by: 'admin', cancel_reason: reason });
    new JobLogRepository().log(job.job_id, 'cancel', 'staff', me.staff_id, 'ยกเลิกโดย Admin เนื่องจาก ' + reason);
    return { result: 'ok' };
  }

  /* ---------- ตัวช่วย ---------- */

  static _getJob(jobId, me) {
    const job = new JobRepository().findById(jobId);
    if (!job) throw new AppError('ไม่พบใบงาน', 'NOT_FOUND');
    if (String(me.role) !== 'admin' && String(job.assigned_staff_id) !== String(me.staff_id)) {
      throw new AppError('ไม่มีสิทธิ์ดูใบงานนี้', 'FORBIDDEN');
    }
    return job;
  }

  static _getOpenJob(jobId, me) {
    const job = AdminController._getJob(jobId, me);
    if (AdminController.CLOSED.indexOf(String(job.status_number)) > -1) {
      throw new AppError('ใบงานนี้ปิดหรือยกเลิกไปแล้ว', 'BAD_STATUS');
    }
    return job;
  }

  // แจ้ง Operator ทางอีเมลเมื่อได้รับมอบหมาย (ไม่ส่งถ้ามอบให้ตัวเอง)
  static _notifyAssigned(job, staff, me, note) {
    if (!staff.email || String(staff.staff_id) === String(me.staff_id)) return;
    Notifier.send(staff.email, 'มอบหมายงาน ' + job.job_number,
      'คุณได้รับมอบหมายใบงาน <b>' + job.job_number + '</b> จาก ' + Util.esc(me.full_name) + '<br>' +
      'สถานที่: ' + Util.esc(job.location) + '<br>รายละเอียด: ' + Util.esc(String(job.detail).slice(0, 300)) +
      (note ? '<br>หมายเหตุ: ' + Util.esc(note) : '') +
      '<br><br>กรุณาเข้าระบบเพื่อกดรับงาน' + Notifier.link('jobs', 'เปิดรายการงาน'));
  }
}
