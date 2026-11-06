/**
 * Config.gs
 * ค่าคงที่ของระบบ + โครงสร้างชีตทั้งหมด
 * (ห้ามใส่รหัสผ่าน / key ใดๆ ในไฟล์นี้ เพราะโค้ดชุดนี้อยู่บน GitHub สาธารณะ
 *  ค่าลับให้เก็บใน Project Settings > Script Properties เท่านั้น)
 *
 * คอลัมน์แรกของทุกชีต = Primary Key
 */
const CONFIG = {
  APP_NAME: 'ระบบขอรับบริการ สทส.',
  EMAIL_DOMAIN: '@tistr.or.th',
  TIMEZONE: 'Asia/Bangkok',
  // DEBUG : แสดงรายละเอียด error บนหน้าเว็บ
  //  เปิด = ตั้ง Script Property ชื่อ DEBUG ค่า 1 / ใช้งานจริง = ลบ property นั้นทิ้ง (ไม่ต้องแก้โค้ด)
  SUPPORT_PHONE: '9356',          // เบอร์ติดต่อ สทส. ที่แสดงให้ User เห็น
  SESSION_DAYS_USER: 30,          // Soft login ของ User อยู่ได้กี่วัน
  SESSION_DAYS_STAFF: 1,          // เจ้าหน้าที่ต้องเข้าระบบใหม่ทุกวัน

  USER_LOGIN: {
    MAX_FAILS: 5,                 // ใส่เบอร์ผิดต่ออีเมลได้กี่ครั้ง
    LOCK_MINUTES: 15
  },

  JOB_LIMIT_PER_HOUR: 5,          // User หนึ่งคนแจ้งงานได้กี่เรื่องต่อชั่วโมง (กันสแปม)
  MAIL_RESERVE: 10,               // เหลือโควตาอีเมลต่ำกว่านี้ จะงดส่ง OTP (กันโควตาหมดทั้งระบบ)
  STAFF_2FA_ROLES: ['admin'],     // role ที่ต้องยืนยัน OTP ทุกครั้งที่เข้าระบบ

  STAFF_LOGIN: {
    MAX_FAILS: 5,                 // ใส่รหัสผิดติดกันได้กี่ครั้ง
    LOCK_MINUTES: 15,             // ล็อกกี่นาทีเมื่อผิดเกิน
    PASSWORD_MIN: 8,
    HASH_ROUNDS: 1000
  },

  NOTIFY_ADMIN_NEW_JOB: true,     // ส่งอีเมลแจ้ง Admin ทุกคนเมื่อมีงานใหม่

  // ไฟล์แนบของใบงาน
  UPLOAD: {
    MAX_FILES: 3,
    MAX_BYTES: 5 * 1024 * 1024,   // ต่อไฟล์ (หน้าเว็บย่อรูปก่อนส่งอยู่แล้ว)
    TYPES: ['image/jpeg', 'image/png', 'image/webp']
  },

  OTP: {
    LENGTH: 6,
    EXPIRE_MINUTES: 10,           // รหัสใช้ได้กี่นาที
    MAX_ATTEMPTS: 5,              // กรอกผิดได้กี่ครั้งต่อรหัส
    RESEND_SECONDS: 60,           // ขอรหัสใหม่ได้ทุกกี่วินาที
    MAX_PER_DAY: 8                // ขอรหัสได้กี่ครั้งต่อวัน ต่อบัญชี
  },

  BACKUP_KEEP_DAYS: 30,           // เก็บไฟล์สำรองชีตย้อนหลังกี่วัน

  SHEETS: {
    USERS: {
      name: 'users',
      // คอลัมน์ใหม่ต่อท้ายเสมอ (ห้ามแทรกกลาง ไม่งั้นข้อมูลเดิมจะเลื่อนคอลัมน์)
      headers: ['user_id', 'email', 'phone4', 'full_name', 'position', 'division', 'room',
                'created_at', 'updated_at', 'division_id', 'email_verified', 'office_id']
    },
    STAFF: {
      name: 'staff',
      headers: ['staff_id', 'ad_name', 'full_name', 'role', 'phone_desk', 'photo_url',
                'pass_hash', 'pass_salt', 'active', 'created_at', 'updated_at', 'email']
    },
    OFFICES: {
      name: 'offices',
      headers: ['office_id', 'office_name', 'sort', 'active']
    },
    DIVISIONS: {
      name: 'divisions',
      headers: ['div_id', 'div_code', 'div_short', 'div_name', 'sort', 'active']
    },
    CATEGORIES: {
      name: 'categories',
      headers: ['cat_id', 'cat_name', 'cat_desc', 'icon', 'color', 'sort', 'active', 'link_url']
    },
    SUB_TYPES: {
      name: 'sub_types',
      headers: ['sub_id', 'cat_id', 'sub_name', 'sub_desc', 'image_url', 'default_staff_id',
                'is_routine', 'sort', 'active']
    },
    STATUSES: {
      name: 'statuses',
      headers: ['status_number', 'status_admin_thai', 'status_user_thai', 'status_color']
    },
    JOBS: {
      name: 'jobs',
      headers: ['job_id', 'job_number', 'fiscal_year', 'user_id',
                'cat_id', 'sub_id', 'original_cat_id', 'original_sub_id',
                'detail', 'location', 'asset_no', 'attachments',
                'status_number', 'assigned_staff_id', 'appointment_at',
                'cause', 'action_taken', 'cancel_by', 'cancel_reason', 'eval_status',
                'created_at', 'updated_at', 'division_id', 'office_id']
    },
    JOB_LOG: {
      name: 'job_log',
      headers: ['log_id', 'job_id', 'action', 'actor_type', 'actor_id', 'note', 'created_at']
    },
    OTPS: {
      name: 'otps',
      headers: ['otp_id', 'email', 'purpose', 'new_phone4', 'otp_hash', 'otp_salt',
                'expires_at', 'attempts', 'used', 'created_at']
    },
    SECURITY_LOG: {
      name: 'security_log',
      headers: ['log_id', 'event', 'actor_type', 'actor_key', 'detail', 'created_at']
    },
    SESSIONS: {
      name: 'sessions',
      headers: ['token', 'owner_type', 'owner_id', 'expires_at', 'created_at']
    }
  }
};
