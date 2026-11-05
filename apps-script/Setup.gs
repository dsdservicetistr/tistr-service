/**
 * Setup.gs
 * รันด้วยมือ 1 ครั้ง (เลือกฟังก์ชัน setupSheets แล้วกด Run)
 * - สร้างชีตที่ยังไม่มี + หัวคอลัมน์
 * - ตั้งทุกคอลัมน์เป็น "ข้อความ" กันเบอร์ 4 หลักที่ขึ้นต้นด้วย 0 หาย และกันวันที่ถูกแปลงเอง
 * - ใส่ข้อมูลตั้งต้น (สถานะ / หมวด / ประเภทย่อย) เฉพาะชีตที่ยังว่าง
 * รันซ้ำได้ ไม่ทับข้อมูลเดิม
 */
function setupSheets() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  console.log('SHEET_ID = ' + id);
  const ss = SpreadsheetApp.openById(id);
  console.log('เปิดชีตได้: ' + ss.getName());

  Object.keys(CONFIG.SHEETS).forEach(key => {
    const def = CONFIG.SHEETS[key];
    let sh = ss.getSheetByName(def.name);
    if (!sh) sh = ss.insertSheet(def.name);

    sh.getRange(1, 1, sh.getMaxRows(), def.headers.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, def.headers.length)
      .setValues([def.headers])
      .setFontWeight('bold')
      .setBackground('#d9e7f7');
    sh.setFrozenRows(1);
  });

  seedIfEmpty_(new StatusRepository(), [
    { status_number: '1', status_admin_thai: 'งานใหม่ รอตรวจสอบ',    status_user_thai: 'รอเจ้าหน้าที่ตรวจสอบ',               status_color: 'secondary' },
    { status_number: '2', status_admin_thai: 'มอบหมายแล้ว รอรับงาน', status_user_thai: 'ส่งต่อให้เจ้าหน้าที่แล้ว',             status_color: 'info' },
    { status_number: '3', status_admin_thai: 'รับงานแล้ว',           status_user_thai: 'เจ้าหน้าที่รับงานแล้ว',                status_color: 'primary' },
    { status_number: '4', status_admin_thai: 'นัดหมายแล้ว',          status_user_thai: 'นัดหมายแล้ว',                         status_color: 'warning' },
    { status_number: '5', status_admin_thai: 'ปิดงาน รอประเมิน',      status_user_thai: 'ดำเนินการเสร็จแล้ว กรุณาประเมิน',      status_color: 'success' },
    { status_number: '6', status_admin_thai: 'ประเมินแล้ว',          status_user_thai: 'เสร็จสมบูรณ์',                        status_color: 'dark' },
    { status_number: '7', status_admin_thai: 'ยกเลิก',               status_user_thai: 'ยกเลิก',                              status_color: 'danger' }
  ]);

  seedIfEmpty_(new DivisionRepository(), MASTER_DIVISIONS_());
  seedIfEmpty_(new CategoryRepository(), MASTER_CATEGORIES_());
  seedIfEmpty_(new SubTypeRepository(), MASTER_SUB_TYPES_());

  console.log('ตั้งค่าชีตเรียบร้อย');
}

function seedIfEmpty_(repo, rows) {
  if (repo.count() > 0) return;
  rows.forEach(r => repo.insert(r));
}

// รันด้วยมือ 1 ครั้งหลังเพิ่มขั้นที่ 2 เพื่อให้สิทธิ์ส่งอีเมล (MailApp)
function authorizeMail() {
  console.log('ส่งเมลได้อีกวันนี้: ' + MailApp.getRemainingDailyQuota() + ' ฉบับ');
}

// รันด้วยมือ 1 ครั้งหลังเพิ่มขั้นที่ 3 เพื่อให้สิทธิ์ Google Drive (เก็บรูปแนบ)
function authorizeDrive() {
  console.log('โฟลเดอร์เก็บไฟล์แนบ: ' + Util.uploadFolder().getName());
}

/* ============================================================
 * ข้อมูลตั้งต้น : หมวดบริการ / ประเภทย่อย
 * แก้ไขเพิ่มลดภายหลังได้ที่ชีตโดยตรง
 *  - ปิดรายการ = เปลี่ยน active เป็น 0 (อย่าลบแถว เพราะใบงานเก่าอ้างถึงอยู่)
 *  - เพิ่มระบบงานใหม่ = เพิ่มแถวใน sub_types โดยใส่ cat_id = 3
 *  - หมวดที่มี link_url จะเปิดลิงก์นั้นแทนการแจ้งงาน
 * ============================================================ */
function MASTER_CATEGORIES_() {
  return [
    { cat_id: '1', cat_name: 'คอมพิวเตอร์และโปรแกรม', cat_desc: 'ตัวเครื่อง และโปรแกรมทั่วไป',          icon: 'fas fa-laptop',        color: '#2f6fb5', sort: '1', active: '1', link_url: '' },
    { cat_id: '6', cat_name: 'อุปกรณ์ต่อพ่วง',         cat_desc: 'Printer Scanner อุปกรณ์ประชุม',     icon: 'fas fa-print',         color: '#1f7a8c', sort: '2', active: '1', link_url: '' },
    { cat_id: '2', cat_name: 'Internet และเครือข่าย',  cat_desc: 'เน็ตใช้ไม่ได้ หรือเครือข่ายขัดข้อง',  icon: 'fas fa-network-wired', color: '#1f8a70', sort: '3', active: '1', link_url: '' },
    { cat_id: '3', cat_name: 'ระบบงานต่างๆ',          cat_desc: 'ระบบภายในองค์กร',                  icon: 'fas fa-th-large',      color: '#6b4fbb', sort: '4', active: '1', link_url: '' },
    { cat_id: '5', cat_name: 'ปัญหาการใช้งาน E-mail',  cat_desc: 'เข้าใช้งาน รับส่งเมล',                icon: 'fas fa-envelope',      color: '#b23a62', sort: '5', active: '1', link_url: '' },
    { cat_id: '7', cat_name: 'VDO Conference',       cat_desc: 'ขอบริการทางอีเมล DSD@tistr.or.th',   icon: 'fas fa-video',         color: '#8a5a12', sort: '6', active: '1', link_url: 'mailto:DSD@tistr.or.th' },
    { cat_id: '4', cat_name: 'ขอยืม Notebook',         cat_desc: 'ไปที่ระบบยืมเครื่องบน Intranet',      icon: 'fas fa-laptop-house',  color: '#c0582b', sort: '7', active: '1', link_url: 'https://intranet.tistr.or.th/borrow_service/' }
  ];
}

// หน่วยงานชุดทดลอง (เพิ่มชุดจริงในชีต divisions ได้เลย ใส่ div_id ไม่ซ้ำ และ active = 1)
function MASTER_DIVISIONS_() {
  return [
    { div_id: '1', div_code: '', div_short: 'สทส.', div_name: 'สำนักดิจิทัลและสารสนเทศ', sort: '1', active: '1' },
    { div_id: '2', div_code: '', div_short: 'กพท.', div_name: 'กองพัฒนาระบบดิจิทัล',      sort: '2', active: '1' }
  ];
}

function MASTER_SUB_TYPES_() {
  const row = (id, cat, name, desc, sort) => ({
    sub_id: id, cat_id: cat, sub_name: name, sub_desc: desc,
    image_url: '', default_staff_id: '', is_routine: '0', sort: sort, active: '1'
  });
  return [
    row('101', '1', 'เครื่องคอมพิวเตอร์ / Notebook ทั่วไป', 'ไม่มีสติกเกอร์ SVOA ใต้เครื่อง', '1'),
    row('102', '1', 'Notebook เช่าตามโครงการ',            'มีสติกเกอร์รับประกัน SVOA ใต้เครื่อง', '2'),
    row('104', '1', 'โปรแกรมทั่วไป',                       'Word Excel PowerPoint PDF', '3'),

    row('601', '6', 'Printer / Scanner',                  '', '1'),
    row('602', '6', 'อุปกรณ์ประกอบการประชุม',               'กล้อง Webcam หูฟัง ลำโพง ไมโครโฟน', '2'),
    row('603', '6', 'อุปกรณ์ต่อพ่วงอื่นๆ',                   'ระบุอุปกรณ์ในรายละเอียด', '3'),

    row('301', '3', 'Odoo', '', '1'),
    row('302', '3', 'TSC',  '', '2'),
    row('303', '3', 'HRIS', '', '3'),
    row('399', '3', 'ระบบอื่น', 'ระบุชื่อระบบในรายละเอียด', '99'),

    row('501', '5', 'ปัญหาการเข้าใช้งาน',        'ลืมรหัสผ่าน / 2-Factor ใช้ไม่ได้', '1'),
    row('502', '5', 'ปัญหาการส่งหรือรับ E-mail', '', '2'),
    row('503', '5', 'ปัญหาอื่นๆ',                 'ระบุในรายละเอียด', '3')
  ];
}

// รันด้วยมือ 1 ครั้ง : ปรับหมวด/ประเภทย่อยเดิมให้เป็นชุดของขั้นที่ 3
// เก็บค่าที่ตั้งเองไว้ (link_url, รูป, ผู้ดูแลประจำ) ไม่เขียนทับ
// รันซ้ำได้ทุกครั้งที่มีการปรับข้อมูลตั้งต้น
function migrateStep3() {
  setupSheets();                                   // สร้างชีต/คอลัมน์ที่เพิ่มใหม่ (link_url, divisions, division_id)

  const cats = new CategoryRepository();
  MASTER_CATEGORIES_().forEach(c => {
    const old = cats.findById(c.cat_id);
    if (!old) { cats.insert(c); return; }
    const changes = Object.assign({}, c);
    // เก็บลิงก์ที่ตั้งเองไว้ ถ้าเป็นลิงก์จริงแล้ว (http / mailto)
    if (/^(https?:|mailto:)/i.test(String(old.link_url || ''))) delete changes.link_url;
    cats.update(c.cat_id, changes);
  });

  const subs = new SubTypeRepository();
  const keep = MASTER_SUB_TYPES_().map(s => s.sub_id);
  MASTER_SUB_TYPES_().forEach(s => {
    const old = subs.findById(s.sub_id);
    if (!old) { subs.insert(s); return; }
    const changes = Object.assign({}, s);
    delete changes.image_url;
    delete changes.default_staff_id;
    subs.update(s.sub_id, changes);
  });
  // รายการเดิมที่ไม่อยู่ในชุดใหม่ (เช่น 103 เครื่องพิมพ์ ย้ายไปอุปกรณ์ต่อพ่วง) -> ปิดไว้
  subs.findAll().forEach(s => {
    if (keep.indexOf(String(s.sub_id)) === -1 && String(s.active) === '1') {
      subs.update(s.sub_id, { active: '0' });
    }
  });

  console.log('ปรับข้อมูลหมวดบริการเรียบร้อย');
}
