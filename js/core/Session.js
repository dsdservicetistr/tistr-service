/**
 * Session.js
 * เก็บ token และข้อมูลผู้ที่ล็อกอินไว้ในเบราว์เซอร์
 *  - Session      : User ทั่วไป (soft login)
 *  - StaffSession : เจ้าหน้าที่ (Admin / Operator)
 * แยกกันเพื่อให้คนคนเดียวเป็นทั้ง User และเจ้าหน้าที่ในเครื่องเดียวกันได้
 * (ตัวจริงที่ใช้ตัดสินสิทธิ์อยู่ฝั่ง Apps Script เสมอ ข้อมูลตรงนี้ใช้แสดงผลเท่านั้น)
 */
class Session {
  static get TOKEN_KEY() { return 'tistr_service_token'; }
  static get USER_KEY()  { return 'tistr_service_user'; }

  static save(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user || {}));
  }

  static setUser(user) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user || {}));
  }

  static token() {
    return localStorage.getItem(this.TOKEN_KEY) || '';
  }

  static user() {
    try {
      return JSON.parse(localStorage.getItem(this.USER_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  static isLoggedIn() {
    return this.token() !== '';
  }

  static clear() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }
}

class StaffSession extends Session {
  static get TOKEN_KEY() { return 'tistr_service_staff_token'; }
  static get USER_KEY()  { return 'tistr_service_staff'; }

  static isAdmin() {
    const s = this.user();
    return !!s && s.role === 'admin';
  }
}
