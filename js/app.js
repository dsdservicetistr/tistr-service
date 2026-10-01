/**
 * app.js
 * ทำหน้าที่เหมือน index.php เดิม : อ่าน ?MM= แล้วโหลดหน้าย่อยจาก pages/ มาแสดง
 * เพิ่มหน้าใหม่ = เพิ่มบรรทัดใน ROUTES + สร้างไฟล์ใน pages/
 */
const api = new ApiClient(APP_CONFIG.API_URL);

class App {
  static ROUTES = {
    '99': { page: 'pages/system_test.html', title: 'ทดสอบระบบ' }
  };

  static DEFAULT_MM = '99';

  static init() {
    document.title = APP_CONFIG.APP_NAME;
    $('.js-app-name').text(APP_CONFIG.APP_NAME);
    $('.js-org-name').text(APP_CONFIG.ORG_NAME);
    $('.js-year').text(new Date().getFullYear());

    const params = new URLSearchParams(window.location.search);
    const MM = params.get('MM') || App.DEFAULT_MM;
    App.loadPage(MM);
  }

  static loadPage(MM) {
    const route = App.ROUTES[MM] || App.ROUTES[App.DEFAULT_MM];

    $('.nav-sidebar .nav-link').removeClass('active');
    $('.nav-sidebar .nav-link[data-mm="' + MM + '"]').addClass('active');
    $('#page-title').text(route.title);

    $('#page-content').load(route.page, function (response, status) {
      if (status === 'error') {
        $('#page-content').html(
          '<div class="alert alert-danger">โหลดหน้า ' + route.page + ' ไม่สำเร็จ ' +
          '(ถ้าเปิดไฟล์ตรงจากเครื่อง ต้องเปิดผ่าน Live Server หรือ GitHub Pages)</div>'
        );
      }
    });
  }
}

$(function () {
  App.init();
});
