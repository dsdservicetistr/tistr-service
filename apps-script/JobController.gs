/**
 * JobController.gs
 * ขั้นที่ 3 : User แจ้งขอรับบริการ (สร้างใบงาน)
 *
 *  - ตรวจหมวด / ประเภทย่อยว่ายังเปิดใช้และเข้าคู่กัน
 *  - ครั้งแรกที่แจ้ง ต้องกรอกชื่อ หน่วยงาน ห้อง (บันทึกเก็บไว้ใช้ครั้งต่อไป)
 *  - ไฟล์แนบ (รูป) เก็บใน Google Drive โฟลเดอร์ tistr-service-uploads
 *  - ออกเลขใบงานตามปีงบ เช่น 0001/70 (ครอบด้วย Lock กันเลขซ้ำ)
 */
class JobController {

  // flg = create_job
  static create(data, req) {
    const user = Auth.requireUser(req);

    // ---------- หมวด / ประเภทย่อย ----------
    const cat = new CategoryRepository().findById(data.cat_id);
    if (!cat || String(cat.active) !== '1') throw new AppError('ไม่พบหมวดบริการที่เลือก', 'BAD_CATEGORY');
    if (String(cat.link_url || '') !== '') throw new AppError('หมวดนี้ให้บริการผ่านระบบอื่น', 'BAD_CATEGORY');

    const subs = new SubTypeRepository().findByCategory(cat.cat_id);
    let sub = null;
    if (subs.length) {
      sub = subs.find(s => String(s.sub_id) === String(data.sub_id)) || null;
      if (!sub) throw new AppError('กรุณาเลือกประเภทย่อยของ ' + cat.cat_name, 'BAD_SUBTYPE');
    }

    // ---------- ข้อมูลผู้แจ้ง (บังคับครั้งแรก) ----------
    const divId = String(data.division_id || user.division_id || '');
    const div   = divId ? new DivisionRepository().findById(divId) : null;
    if (!div || String(div.active) !== '1') throw new AppError('กรุณาเลือกหน่วยงาน', 'REQUIRED');

    const profile = {
      full_name:   Util.text(data.full_name || user.full_name, 'ชื่อ-นามสกุล', 100, true),
      position:    Util.text(data.position  || user.position,  'ตำแหน่ง',     100, false),
      division_id: String(div.div_id),
      division:    DivisionRepository.label(div),           // เก็บชื่อไว้แสดงผล
      room:        Util.text(data.room      || user.room,      'ห้อง / อาคาร', 100, true)
    };

    // ---------- รายละเอียดงาน ----------
    const detail   = Util.text(data.detail,   'รายละเอียดปัญหา', 2000, true);
    const location = Util.text(data.location || profile.room, 'สถานที่', 200, true);
    const assetNo  = Util.text(data.asset_no, 'เลขครุภัณฑ์', 50, false);
    const files    = JobController._validateFiles(data.files);

    // ---------- บันทึก ----------
    const users = new UserRepository();
    const jobs  = new JobRepository();
    const logs  = new JobLogRepository();

    const changed = Object.keys(profile).some(k => String(user[k] || '') !== profile[k]);
    const updatedUser = changed ? users.update(user.user_id, profile) : Util.clean(user);

    let job;
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const no = jobs.nextJobNumber();
      job = jobs.insert({
        job_number: no.job_number,
        fiscal_year: no.fiscal_year,
        user_id: user.user_id,
        cat_id: cat.cat_id,
        sub_id: sub ? sub.sub_id : '',
        original_cat_id: cat.cat_id,
        original_sub_id: sub ? sub.sub_id : '',
        detail: detail,
        location: location,
        asset_no: assetNo,
        attachments: '',
        status_number: '1',
        division_id: profile.division_id                      // หน่วยงาน ณ วันที่แจ้ง (ใช้สรุปรายปี)
      });
    } finally {
      lock.releaseLock();
    }

    // อัปโหลดหลังได้เลขใบงาน (ทำนอก Lock เพราะใช้เวลานาน)
    if (files.length) {
      const saved = JobController._saveFiles(job.job_number, files);
      jobs.update(job.job_id, { attachments: JSON.stringify(saved) });
    }

    logs.log(job.job_id, 'create', 'user', user.user_id,
      cat.cat_name + (sub ? ' > ' + sub.sub_name : '') + (files.length ? ' (แนบรูป ' + files.length + ' ไฟล์)' : ''));

    JobController._notifyAdmins(job, cat, sub, updatedUser);

    const status = new StatusRepository().findById('1');
    return {
      job_number: job.job_number,
      created_at: job.created_at,
      category: cat.cat_name,
      sub_type: sub ? sub.sub_name : '',
      status_text: status ? status.status_user_thai : '',
      status_color: status ? status.status_color : 'secondary',
      user: AuthController.publicUser(Object.assign({}, user, updatedUser))
    };
  }

  // แจ้ง Admin ทุกคนว่ามีงานใหม่
  static _notifyAdmins(job, cat, sub, user) {
    if (!CONFIG.NOTIFY_ADMIN_NEW_JOB) return;
    const to = new StaffRepository().findAdmins().map(a => a.email).filter(Boolean);
    if (!to.length) return;
    try {
      MailApp.sendEmail({
        to: to.join(','),
        subject: '[' + CONFIG.APP_NAME + '] งานใหม่ ' + job.job_number + ' : ' + cat.cat_name,
        htmlBody: 'มีงานใหม่เลขที่ <b>' + job.job_number + '</b><br>' +
          'หมวด: ' + Util.esc(cat.cat_name + (sub ? ' > ' + sub.sub_name : '')) + '<br>' +
          'ผู้แจ้ง: ' + Util.esc(user.full_name) + ' (' + Util.esc(user.division) + ') โทร ' + Util.esc(user.phone4) + '<br>' +
          'สถานที่: ' + Util.esc(job.location) + '<br>รายละเอียด: ' + Util.esc(String(job.detail).slice(0, 300))
      });
    } catch (e) {
      console.error('ส่งเมลแจ้ง Admin ไม่สำเร็จ: ' + e);
    }
  }

  /* ---------- ไฟล์แนบ ---------- */

  // รับ [{ name, type, data(base64) }]
  static _validateFiles(list) {
    if (!list) return [];
    if (!Array.isArray(list)) throw new AppError('รูปแบบไฟล์แนบไม่ถูกต้อง', 'BAD_FILE');
    if (list.length > CONFIG.UPLOAD.MAX_FILES) {
      throw new AppError('แนบรูปได้ไม่เกิน ' + CONFIG.UPLOAD.MAX_FILES + ' รูป', 'BAD_FILE');
    }
    return list.map((f, i) => {
      const type = String(f && f.type || '');
      if (CONFIG.UPLOAD.TYPES.indexOf(type) === -1) {
        throw new AppError('ไฟล์ที่ ' + (i + 1) + ' ต้องเป็นรูป JPG, PNG หรือ WEBP', 'BAD_FILE');
      }
      let bytes;
      try {
        bytes = Utilities.base64Decode(String(f.data || ''));
      } catch (e) {
        throw new AppError('ไฟล์ที่ ' + (i + 1) + ' เสียหาย', 'BAD_FILE');
      }
      if (!bytes.length || bytes.length > CONFIG.UPLOAD.MAX_BYTES) {
        throw new AppError('ไฟล์ที่ ' + (i + 1) + ' ใหญ่เกินกำหนด', 'BAD_FILE');
      }
      return { type: type, bytes: bytes };
    });
  }

  static _saveFiles(jobNumber, files) {
    const folder = Util.uploadFolder();
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    return files.map((f, i) => {
      const name = jobNumber.replace('/', '-') + '_' + (i + 1) + '.' + ext[f.type];
      const file = folder.createFile(Utilities.newBlob(f.bytes, f.type, name));
      return { id: file.getId(), name: name };
    });
  }
}
