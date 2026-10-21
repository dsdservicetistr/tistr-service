/**
 * Session.js
 * เก็บ token และข้อมูล User ที่ล็อกอินอยู่ไว้ในเบราว์เซอร์
 * (ตัวจริงที่ใช้ตัดสินสิทธิ์อยู่ฝั่ง Apps Script เสมอ ข้อมูลตรงนี้ใช้แสดงผลเท่านั้น)
 */
class Session {
  static TOKEN_KEY = 'tistr_service_token';
  static USER_KEY  = 'tistr_service_user';

  static save(token, user) {
    localStorage.setItem(Session.TOKEN_KEY, token);
    localStorage.setItem(Session.USER_KEY, JSON.stringify(user || {}));
  }

  static setUser(user) {
    localStorage.setItem(Session.USER_KEY, JSON.stringify(user || {}));
  }

  static token() {
    return localStorage.getItem(Session.TOKEN_KEY) || '';
  }

  static user() {
    try {
      return JSON.parse(localStorage.getItem(Session.USER_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  static isLoggedIn() {
    return Session.token() !== '';
  }

  static clear() {
    localStorage.removeItem(Session.TOKEN_KEY);
    localStorage.removeItem(Session.USER_KEY);
  }
}
