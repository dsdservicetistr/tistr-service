# ระบบขอรับบริการ สทส.

หน้าเว็บ (GitHub Pages) + API (Google Apps Script) + ฐานข้อมูล (Google Sheet)

## โครงสร้าง
```
index.html            layout หลัก + router (?MM=)
css/app.css
js/config.js          URL ของ API (ห้ามใส่ค่าลับ)
js/core/ApiClient.js  คุยกับ API ด้วย api.call(flg, data)
js/app.js             ตาราง ROUTES ของแต่ละหน้า
pages/                หน้าย่อยที่ถูกโหลดเข้า #page-content
apps-script/          สำเนาโค้ดฝั่ง Apps Script (ของจริงรันในโปรเจค Apps Script)
```

## เพิ่มฟังก์ชันใหม่
1. Apps Script: เพิ่ม `case 'ชื่อ_flg':` ใน `Router` (Code.gs) แล้วเขียน method ใน Controller
2. Deploy > Manage deployments > แก้ไข > New version (URL เดิม)
3. หน้าเว็บ: เรียก `await api.call('ชื่อ_flg', {...})`

## ความปลอดภัย
- repo นี้เป็นสาธารณะ ห้าม commit รหัสผ่าน / key ใดๆ
- ค่าลับเก็บใน Apps Script > Project Settings > Script Properties
