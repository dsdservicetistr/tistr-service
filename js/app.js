/**
 * app.js
 * ทำหน้าที่เหมือน index.php เดิม : อ่าน ?MM= แล้วโหลดหน้าย่อยจาก pages/ มาแสดง
 * เพิ่มหน้าใหม่ = เพิ่มบรรทัดใน ROUTES + สร้างไฟล์ใน pages/
 *
 * auth : false   = เปิดได้เลย
 *        'user'  = ต้องล็อกอินแบบ User
 *        'staff' = ต้องล็อกอินเจ้าหน้าที่ (Admin / Operator)
 *        'admin' = เฉพาะ Admin
 * bare : true    = ซ่อนเมนูซ้าย (หน้าเข้าสู่ระบบ)
 */
const api = new ApiClient(APP_CONFIG.API_URL);

class App {
  static get ROUTES() {
    return {
      'login':       { page: 'pages/user_login.html',  title: 'เข้าสู่ระบบ',          auth: false,   bare: true },
      'staff_login': { page: 'pages/staff_login.html', title: 'เข้าสู่ระบบเจ้าหน้าที่', auth: false,   bare: true },
      '1':           { page: 'pages/user_home.html',   title: 'ขอรับบริการ',          auth: 'user' },
      'jobs':        { page: 'pages/staff_jobs.html',  title: 'รายการงาน',            auth: 'staff' },
      '99':          { page: 'pages/system_test.html', title: 'ทดสอบระบบ',            auth: 'admin' }
    };
  }

  static get DEFAULT_MM() { return '1'; }

  static init() {
    document.title = APP_CONFIG.APP_NAME;
    $('.js-app-name').text(APP_CONFIG.APP_NAME);
    $('.js-org-name').text(APP_CONFIG.ORG_NAME);
    $('.js-year').text(new Date().getFullYear());

    const params = new URLSearchParams(window.location.search);
    App.loadPage(params.get('MM') || App.DEFAULT_MM);
  }

  static loadPage(MM) {
    const routes = App.ROUTES;
    const key    = routes[MM] ? MM : App.DEFAULT_MM;
    const route  = routes[key];

    if (route.auth === 'user' && !Session.isLoggedIn()) { App.goLogin(); return; }
    if ((route.auth === 'staff' || route.auth === 'admin') && !StaffSession.isLoggedIn()) { App.goStaffLogin(); return; }
    if (route.auth === 'admin' && !StaffSession.isAdmin()) { App.go('jobs'); return; }

    // ล็อกอินอยู่แล้วแต่เปิดหน้า login -> พาไปหน้าหลักของตัวเอง
    if (key === 'login' && Session.isLoggedIn()) { App.go('1'); return; }
    if (key === 'staff_login' && StaffSession.isLoggedIn()) { App.go('jobs'); return; }

    $('body').toggleClass('app-bare', !!route.bare);
    App.renderUserBox();

    $('.nav-sidebar .nav-link').removeClass('active');
    $('.nav-sidebar .nav-link[data-mm="' + key + '"]').addClass('active');
    $('#page-title').text(route.bare ? '' : route.title);

    // ?v= กันเบราว์เซอร์ใช้หน้าเก่าในแคชหลังอัปเดต
    $('#page-content').load(route.page + '?v=' + Date.now(), function (response, status) {
      if (status === 'error') {
        $('#page-content').html(
          '<div class="alert alert-danger">โหลดหน้า ' + route.page + ' ไม่สำเร็จ ' +
          '(ถ้าเปิดไฟล์ตรงจากเครื่อง ต้องเปิดผ่าน Live Server หรือ GitHub Pages)</div>'
        );
      }
    });
  }

  static go(MM) {
    window.location.href = 'index.html?MM=' + encodeURIComponent(MM);
  }

  static goLogin() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('MM') !== 'login') App.go('login');
  }

  static goStaffLogin() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('MM') !== 'staff_login') App.go('staff_login');
  }

  static renderUserBox() {
    const user = Session.user();
    if (Session.isLoggedIn() && user) {
      $('.js-user-email').text(user.full_name || user.email);
      $('.js-user-box').removeClass('d-none');
      $('.js-user-menu').removeClass('d-none');
    } else {
      $('.js-user-box').addClass('d-none');
      $('.js-user-menu').toggleClass('d-none', StaffSession.isLoggedIn());
    }

    const staff = StaffSession.user();
    const staffIn = StaffSession.isLoggedIn() && staff;
    $('.js-staff-menu').toggleClass('d-none', !staffIn);
    $('.js-admin-menu').toggleClass('d-none', !(staffIn && staff.role === 'admin'));
    $('.js-staff-login-link').toggleClass('d-none', !!staffIn);
    if (staffIn) {
      $('.js-staff-name').text(staff.full_name);
      $('.js-staff-role').text(staff.role === 'admin' ? 'Admin' : 'Operator');
    }
  }

  static async logout() {
    try { await api.call('logout'); } catch (e) { /* ออกจากระบบฝั่งเครื่องต่อได้เลย */ }
    Session.clear();
    App.go('login');
  }

  static async staffLogout() {
    try {
      // logout ใช้ token ของเจ้าหน้าที่
      await fetch(APP_CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ flg: 'logout', data: {}, token: StaffSession.token() })
      });
    } catch (e) { /* ไม่เป็นไร */ }
    StaffSession.clear();
    App.go('staff_login');
  }
}

$(function () {
  App.init();
});
