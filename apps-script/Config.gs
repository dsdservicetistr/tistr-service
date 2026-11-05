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
  DEBUG: true,                    // ช่วงพัฒนา = true / ก่อนเปิดใช้จริงเปลี่ยนเป็น false
  SUPPORT_PHONE: '9356',          // เบอร์ติดต่อ สทส. ที่แสดงให้ User เห็น
  SESSION_DAYS_USER: 30,          // Soft login ของ User อยู่ได้กี่วัน

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
    RESEND_SECONDS: 60            // ขอรหัสใหม่ได้ทุกกี่วินาที
  },

  SHEETS: {
    USERS: {
      name: 'users',
      // คอลัมน์ใหม่ต่อท้ายเสมอ (ห้ามแทรกกลาง ไม่งั้นข้อมูลเดิมจะเลื่อนคอลัมน์)
      headers: ['user_id', 'email', 'phone4', 'full_name', 'position', 'division', 'room',
                'created_at', 'updated_at', 'division_id']
    },
    STAFF: {
      name: 'staff',
      headers: ['staff_id', 'ad_name', 'full_name', 'role', 'phone_desk', 'photo_url',
                'pass_hash', 'pass_salt', 'active', 'created_at', 'updated_at']
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
                'created_at', 'updated_at', 'division_id']
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
    SESSIONS: {
      name: 'sessions',
      headers: ['token', 'owner_type', 'owner_id', 'expires_at', 'created_at']
    }
  }
};
