/**
 * ApiClient.js
 * ตัวกลางคุยกับ Apps Script ทุก request ผ่าน call(flg, data)
 *
 * ใช้ Content-Type text/plain โดยตั้งใจ
 * ถ้าใช้ application/json browser จะยิง preflight (OPTIONS) ซึ่ง Apps Script ไม่รองรับ แล้วจะติด CORS
 */
class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async call(flg, data = {}) {
    if (!this.baseUrl || this.baseUrl.indexOf('วาง_') > -1) {
      throw new Error('ยังไม่ได้ตั้งค่า API_URL ใน js/config.js');
    }

    const body = JSON.stringify({
      flg: flg,
      data: data,
      token: localStorage.getItem('session_token') || ''
    });

    let res;
    try {
      res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
        redirect: 'follow'
      });
    } catch (e) {
      throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต หรือ URL ของ API');
    }

    if (!res.ok) {
      throw new Error('เซิร์ฟเวอร์ตอบกลับผิดปกติ (HTTP ' + res.status + ')');
    }

    const json = await res.json();
    if (json.status !== 'ok') {
      const err = new Error(json.message || 'เกิดข้อผิดพลาด');
      err.code = json.code;
      throw err;
    }
    return json.data;
  }
}
