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
    const detail = CONFIG.DEBUG ? ' : ' + (err && err.message ? err.message : err) : '';
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
      case 'user_request_otp':
        return AuthController.userRequestOtp(data);

      case 'user_verify_otp':
        return AuthController.userVerifyOtp(data);

      // ===== ขั้นที่ 3 : แจ้งขอรับบริการ =====
      case 'create_job':
        return JobController.create(data, req);

      case 'user_me':
        return AuthController.userMe(req);

      case 'logout':
        return AuthController.logout(req);

      default:
        throw new AppError('ไม่รู้จักคำสั่ง flg = "' + flg + '"', 'UNKNOWN_FLG');
    }
  }
}
