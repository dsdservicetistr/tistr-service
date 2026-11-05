/**
 * app.js
 * ทำหน้าที่เหมือน index.php เดิม : อ่าน ?MM= แล้วโหลดหน้าย่อยจาก pages/ มาแสดง
 * เพิ่มหน้าใหม่ = เพิ่มบรรทัดใน ROUTES + สร้างไฟล์ใน pages/
 *
 * auth : 'user' = ต้องล็อกอินแบบ User ก่อน / false = เปิดได้เลย
 * bare : true   = ซ่อนเมนูซ้าย (ใช้กับหน้าเข้าสู่ระบบ)
 */
const api = new ApiClient(APP_CONFIG.API_URL);

class App {
  static ROUTES = {
    'login': { page: 'pages/user_login.html', title: 'เข้าสู่ระบบ', auth: false,  bare: true },
    '1':     { page: 'pages/user_home.html',  title: 'ขอรับบริการ', auth: 'user' },
    '99':    { page: 'pages/system_test.html', title: 'ทดสอบระบบ',  auth: false }
  };

  static DEFAULT_MM = '1';

  static init() {
    document.title = APP_CONFIG.APP_NAME;
    $('.js-app-name').text(APP_CONFIG.APP_NAME);
    $('.js-org-name').text(APP_CONFIG.ORG_NAME);
    $('.js-year').text(new Date().getFullYear());

    const params = new URLSearchParams(window.location.search);
    App.loadPage(params.get('MM') || App.DEFAULT_MM);
  }

  static loadPage(MM) {
    const key   = App.ROUTES[MM] ? MM : App.DEFAULT_MM;
    const route = App.ROUTES[key];

    if (route.auth === 'user' && !Session.isLoggedIn()) {
      App.goLogin();
      return;
    }
    // ล็อกอินแล้วแต่เปิดหน้า login -> พากลับหน้าหลัก
    if (key === 'login' && Session.isLoggedIn()) {
      App.go('1');
      return;
    }

    $('body').toggleClass('app-bare', !!route.bare);
    App.renderUserBox();

    $('.nav-sidebar .nav-link').removeClass('active');
    $('.nav-sidebar .nav-link[data-mm="' + key + '"]').addClass('active');
    $('#page-title').text(route.bare ? '' : route.title);

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

  static renderUserBox() {
    const user = Session.user();
    if (Session.isLoggedIn() && user) {
      $('.js-user-email').text(user.email);
      $('.js-user-box').removeClass('d-none');
    } else {
      $('.js-user-box').addClass('d-none');
    }
  }

  static async logout() {
    try { await api.call('logout'); } catch (e) { /* ออกจากระบบฝั่งเครื่องต่อได้เลย */ }
    Session.clear();
    App.go('login');
  }
}

$(function () {
  App.init();
});
