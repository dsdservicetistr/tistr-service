/**
 * Controllers.gs
 * Logic ของแต่ละ flg (เทียบได้กับก้อน if ($flg == "...") ใน item_oparator.php เดิม)
 * ขั้นต่อไปจะเพิ่ม AuthController, JobController ฯลฯ ในไฟล์นี้หรือแยกไฟล์ก็ได้
 * (Controller ไม่มี extends จึงแยกไฟล์ได้ไม่มีปัญหาเรื่องลำดับโหลด)
 */
class SystemController {
  // flg = ping : เช็คว่า API กับชีตพร้อมใช้งาน
  static ping() {
    const jobs = new JobRepository();
    return {
      app: CONFIG.APP_NAME,
      server_time: Util.now(),
      fiscal_year: Util.fiscalYearBE(),
      next_job_number: jobs.nextJobNumber().job_number,
      sheets: {
        users:      new UserRepository().count(),
        staff:      new StaffRepository().count(),
        categories: new CategoryRepository().count(),
        sub_types:  new SubTypeRepository().count(),
        statuses:   new StatusRepository().count(),
        jobs:       jobs.count()
      }
    };
  }
}

class MasterController {
  // flg = get_master : ข้อมูลตั้งต้นที่หน้าเว็บต้องใช้ (หมวด, ระบบงาน, สถานะ)
  static getMaster() {
    const categories = new CategoryRepository().findActive().map(Util.clean);
    const subTypes   = new SubTypeRepository().findActive().map(s => {
      const c = Util.clean(s);
      delete c.default_staff_id;     // ไม่ส่งข้อมูลการมอบหมายภายในออกไปหน้า User
      return c;
    });
    const statuses   = new StatusRepository().findAll().map(Util.clean);

    return { categories: categories, sub_types: subTypes, statuses: statuses };
  }
}
