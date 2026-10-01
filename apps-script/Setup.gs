/**
 * Setup.gs
 * รันด้วยมือ 1 ครั้ง (เลือกฟังก์ชัน setupSheets แล้วกด Run)
 * - สร้างชีตที่ยังไม่มี + หัวคอลัมน์
 * - ตั้งทุกคอลัมน์เป็น "ข้อความ" กันเบอร์ 4 หลักที่ขึ้นต้นด้วย 0 หาย และกันวันที่ถูกแปลงเอง
 * - ใส่ข้อมูลตั้งต้น (สถานะ / หมวด / ประเภทย่อย) เฉพาะชีตที่ยังว่าง
 * รันซ้ำได้ ไม่ทับข้อมูลเดิม
 */
function setupSheets() {
  const ss = Util.ss();

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

  seedIfEmpty_(new CategoryRepository(), [
    { cat_id: '1', cat_name: 'คอมพิวเตอร์และอุปกรณ์', cat_desc: 'เครื่อง โปรแกรม และเครื่องพิมพ์',      icon: 'fas fa-laptop',        color: '#2f6fb5', sort: '1', active: '1' },
    { cat_id: '2', cat_name: 'Internet และเครือข่าย', cat_desc: 'เน็ตใช้ไม่ได้ หรือเครือข่ายขัดข้อง',     icon: 'fas fa-network-wired', color: '#1f8a70', sort: '2', active: '1' },
    { cat_id: '3', cat_name: 'ระบบงานต่างๆ',         cat_desc: 'ระบบภายในองค์กร มีผู้ดูแลแต่ละระบบ',   icon: 'fas fa-th-large',      color: '#6b4fbb', sort: '3', active: '1' },
    { cat_id: '4', cat_name: 'VDO Conference',       cat_desc: 'ติดตั้งกล้อง ห้องประชุมออนไลน์',       icon: 'fas fa-video',         color: '#c0582b', sort: '4', active: '1' },
    { cat_id: '5', cat_name: 'ปัญหาการใช้งาน E-mail', cat_desc: 'รับส่งเมลไม่ได้ ลืมรหัส ตั้งค่าเมล',   icon: 'fas fa-envelope',      color: '#b23a62', sort: '5', active: '1' }
  ]);

  seedIfEmpty_(new SubTypeRepository(), [
    { sub_id: '101', cat_id: '1', sub_name: 'Notebook เช่าตามโครงการ', sub_desc: 'มีสติกเกอร์รับประกัน SVOA ใต้เครื่อง', image_url: '', default_staff_id: '', is_routine: '0', sort: '1', active: '1' },
    { sub_id: '102', cat_id: '1', sub_name: 'คอมพิวเตอร์ / Notebook ทั่วไป', sub_desc: 'ไม่มีสติกเกอร์ SVOA ใต้เครื่อง', image_url: '', default_staff_id: '', is_routine: '0', sort: '2', active: '1' },
    { sub_id: '103', cat_id: '1', sub_name: 'เครื่องพิมพ์', sub_desc: '', image_url: '', default_staff_id: '', is_routine: '0', sort: '3', active: '1' },
    { sub_id: '104', cat_id: '1', sub_name: 'ติดตั้ง / ปัญหาโปรแกรม', sub_desc: '', image_url: '', default_staff_id: '', is_routine: '0', sort: '4', active: '1' },
    { sub_id: '301', cat_id: '3', sub_name: 'ระบบตัวอย่าง (แก้ชื่อในชีต sub_types)', sub_desc: '', image_url: '', default_staff_id: '', is_routine: '0', sort: '1', active: '1' }
  ]);

  console.log('ตั้งค่าชีตเรียบร้อย');
}

function seedIfEmpty_(repo, rows) {
  if (repo.count() > 0) return;
  rows.forEach(r => repo.insert(r));
}
