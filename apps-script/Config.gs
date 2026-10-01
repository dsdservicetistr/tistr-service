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

  SHEETS: {
    USERS: {
      name: 'users',
      headers: ['user_id', 'email', 'phone4', 'full_name', 'position', 'division', 'room',
                'created_at', 'updated_at']
    },
    STAFF: {
      name: 'staff',
      headers: ['staff_id', 'ad_name', 'full_name', 'role', 'phone_desk', 'photo_url',
                'pass_hash', 'pass_salt', 'active', 'created_at', 'updated_at']
    },
    CATEGORIES: {
      name: 'categories',
      headers: ['cat_id', 'cat_name', 'cat_desc', 'icon', 'color', 'sort', 'active']
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
                'created_at', 'updated_at']
    },
    JOB_LOG: {
      name: 'job_log',
      headers: ['log_id', 'job_id', 'action', 'actor_type', 'actor_id', 'note', 'created_at']
    },
    SESSIONS: {
      name: 'sessions',
      headers: ['token', 'owner_type', 'owner_id', 'expires_at', 'created_at']
    }
  }
};
