/**
 * Code.gs
 * ประตูทางเข้าของ API (Web App)
 * หน้าเว็บส่ง POST มาเป็น JSON : { flg: "ชื่องาน", data: {...}, token: "..." }
 * แล้ว Router จะส่งต่อไปยัง Controller ตาม flg
 */

// เปิด URL Web App ตรงๆ ใน browser เพื่อเช็คว่า deploy สำเร็จ
function doGet(e) {
  return AppResponse.ok({ app: CONFIG.APP_NAME, server_time: Util.now() }, 'API พร้อมใช้งาน');
}

function doPost(e) {
  try {
    const req  = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const flg  = String(req.flg || '');
    const data = req.data || {};

    const result = Router.dispatch(flg, data, req);
    return AppResponse.ok(result);
  } catch (err) {
    if (err instanceof AppError) {
      return AppResponse.error(err.message, err.code);
    }
    console.error(err && err.stack ? err.stack : err);
    const detail = Util.isDebug() ? ' : ' + (err && err.message ? err.message : err) : '';
    return AppResponse.error('เกิดข้อผิดพลาดภายในระบบ' + detail, 'SERVER_ERROR');
  }
}

class Router {
  static dispatch(flg, data, req) {
    switch (flg) {

      // ===== ขั้นที่ 1 : ทดสอบระบบ =====
      case 'ping':
        return SystemController.ping();

      case 'get_master':
        return MasterController.getMaster();

      // ===== ขั้นที่ 2 : User soft login =====
      case 'user_login':
        return AuthController.userLogin(data);

      // เปลี่ยนเบอร์ต้องยืนยันด้วย OTP ทางอีเมล
      case 'user_verify_email':
        return AuthController.userVerifyEmail(data);

      case 'user_request_otp':
        return AuthController.userRequestOtp(data);

      case 'user_verify_otp':
        return AuthController.userVerifyOtp(data);

      // ===== ขั้นที่ 3 : แจ้งขอรับบริการ =====
      case 'create_job':
        return JobController.create(data, req);

      // ===== ขั้นที่ 4 : เจ้าหน้าที่ =====
      case 'staff_login':
        return StaffAuthController.login(data);

      case 'staff_verify_login':
        return StaffAuthController.verifyLogin(data);

      case 'staff_request_otp':
        return StaffAuthController.requestOtp(data);

      case 'staff_set_password':
        return StaffAuthController.setPassword(data);

      case 'staff_me':
        return StaffAuthController.me(req);

      case 'staff_list_jobs':
        return AdminController.listJobs(data, req);

      case 'staff_job_detail':
        return AdminController.jobDetail(data, req);

      case 'staff_get_file':
        return AdminController.getFile(data, req);

      case 'admin_change_category':
        return AdminController.changeCategory(data, req);

      case 'admin_assign':
        return AdminController.assign(data, req);

      case 'admin_cancel':
        return AdminController.cancel(data, req);

      // ===== ขั้นที่ 5 : ผู้รับผิดชอบงาน / ติดตามสถานะ =====
      case 'staff_accept':
        return OperatorController.accept(data, req);

      case 'staff_return':
        return OperatorController.returnToAdmin(data, req);

      case 'staff_appoint':
        return OperatorController.appoint(data, req);

      case 'staff_message':
        return OperatorController.message(data, req);

      case 'staff_close':
        return OperatorController.close(data, req);

      case 'staff_cancel':
        return OperatorController.cancel(data, req);

      case 'user_my_jobs':
        return JobController.myJobs(data, req);

      case 'user_me':
        return AuthController.userMe(req);

      case 'logout':
        return AuthController.logout(req);

      default:
        throw new AppError('ไม่รู้จักคำสั่ง flg = "' + flg + '"', 'UNKNOWN_FLG');
    }
  }
}
