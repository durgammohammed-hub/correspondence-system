-- ================================================
-- تحديثات قاعدة البيانات - Database Updates
-- نظام المراسلات الإدارية
-- ================================================

USE correspondence_system;

-- ================================================
-- 1. التحقق من الأعمدة الناقصة في جدول users
-- ================================================

-- التحقق من وجود العمود password بدلاً من password_hash
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'correspondence_system' 
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'password';

-- إذا كان العمود password موجوداً، قم بتغييره إلى password_hash
SET @query = IF(@col_exists > 0, 
  'ALTER TABLE users CHANGE COLUMN password password_hash VARCHAR(255) NOT NULL', 
  'SELECT "Column password_hash already exists" as message');

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================
-- 2. إضافة الفهارس المفقودة
-- ================================================

-- فهرس للبحث في المراسلات
ALTER TABLE correspondences 
ADD INDEX IF NOT EXISTS idx_search (subject, content(100), corr_number);

-- فهرس للحالة والأولوية
ALTER TABLE correspondences 
ADD INDEX IF NOT EXISTS idx_status_priority (status, priority);

-- فهرس للتواريخ
ALTER TABLE correspondences 
ADD INDEX IF NOT EXISTS idx_dates (created_at, due_date);

-- ================================================
-- 3. إضافة جدول الإشعارات إذا لم يكن موجوداً
-- ================================================

CREATE TABLE IF NOT EXISTS notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  related_id INT,
  related_type VARCHAR(50),
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_read (user_id, is_read),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 4. إضافة جدول التعليقات إذا لم يكن موجوداً
-- ================================================

CREATE TABLE IF NOT EXISTS comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  correspondence_id INT NOT NULL,
  user_id INT NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_correspondence (correspondence_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 5. إضافة جدول سجل العمليات إذا لم يكن موجوداً
-- ================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id INT,
  details JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 6. إضافة جدول الجلسات إذا لم يكن موجوداً
-- ================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token VARCHAR(500),
  ip_address VARCHAR(45),
  user_agent TEXT,
  is_active TINYINT(1) DEFAULT 1,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_active (user_id, is_active),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 7. إضافة جدول مراحل سير العمل إذا لم يكن موجوداً
-- ================================================

CREATE TABLE IF NOT EXISTS workflow_stages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stage_name VARCHAR(100) NOT NULL,
  stage_order INT NOT NULL,
  role_id INT,
  description TEXT,
  is_required TINYINT(1) DEFAULT 1,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id),
  INDEX idx_order (stage_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 8. إضافة جدول القوالب إذا لم يكن موجوداً
-- ================================================

CREATE TABLE IF NOT EXISTS templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  template_name VARCHAR(200) NOT NULL,
  template_type VARCHAR(50),
  content TEXT NOT NULL,
  variables JSON,
  is_active TINYINT(1) DEFAULT 1,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_type_active (template_type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 9. إضافة جدول المدارس إذا لم يكن موجوداً
-- ================================================

CREATE TABLE IF NOT EXISTS schools (
  id INT PRIMARY KEY AUTO_INCREMENT,
  school_code VARCHAR(20) UNIQUE NOT NULL,
  school_name VARCHAR(200) NOT NULL,
  school_type VARCHAR(50),
  address TEXT,
  phone VARCHAR(20),
  principal_id INT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  FOREIGN KEY (principal_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 10. إدراج بيانات تجريبية للقوالب
-- ================================================

INSERT IGNORE INTO templates (template_name, template_type, content, created_by) VALUES
('كتاب رسمي', 'official_letter', 'الموضوع: {{subject}}

السادة/ {{receiver_name}}
المحترمون

تحية طيبة...

{{content}}

مع فائق الاحترام والتقدير', 1),

('مطالعة', 'review', 'المطالعة رقم: {{corr_number}}
التاريخ: {{date}}

الموضوع: {{subject}}

بعد الاطلاع على {{reference}}

نرى ما يلي:
{{content}}

للنظر والتفضل بالموافقة', 1),

('طلب', 'request', 'الطلب رقم: {{corr_number}}

السادة/ {{receiver_name}}

نتقدم إليكم بطلب:
{{content}}

آملين الموافقة والمعاونة

شاكرين تعاونكم', 1);

-- ================================================
-- 11. إدراج بيانات تجريبية للمراحل
-- ================================================

INSERT IGNORE INTO workflow_stages (stage_name, stage_order, description) VALUES
('معد الكتاب', 1, 'إعداد المراسلة من قبل الموظف'),
('مدير الشعبة', 2, 'مراجعة وتوقيع مدير الشعبة'),
('مدير القسم', 3, 'مراجعة وتوقيع مدير القسم'),
('المدير العام', 4, 'الاعتماد النهائي من المدير العام');

-- ================================================
-- 12. تحديث الأذونات في جدول الأدوار
-- ================================================

-- إضافة أذونات افتراضية
UPDATE roles 
SET permissions = JSON_OBJECT(
  'create_correspondence', 1,
  'edit_correspondence', 1,
  'delete_correspondence', 0,
  'view_all', 0,
  'sign', 1,
  'archive', 0
)
WHERE level >= 3 AND (permissions IS NULL OR permissions = '{}');

UPDATE roles 
SET permissions = JSON_OBJECT(
  'create_correspondence', 1,
  'edit_correspondence', 1,
  'delete_correspondence', 1,
  'view_all', 1,
  'sign', 1,
  'archive', 1,
  'manage_users', 1
)
WHERE level <= 2;

-- ================================================
-- 13. عرض النتائج النهائية
-- ================================================

SELECT '✅ تم تحديث قاعدة البيانات بنجاح!' as message;

SELECT 
  'الجداول الموجودة:' as info,
  COUNT(*) as count 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'correspondence_system';

SELECT 
  TABLE_NAME,
  TABLE_ROWS
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'correspondence_system'
ORDER BY TABLE_NAME;

-- ================================================
-- 14. التحقق من وجود البيانات الأساسية
-- ================================================

SELECT 'المستخدمين:' as info, COUNT(*) as count FROM users;
SELECT 'الأقسام:' as info, COUNT(*) as count FROM departments;
SELECT 'الشعب:' as info, COUNT(*) as count FROM divisions;
SELECT 'الأدوار:' as info, COUNT(*) as count FROM roles;
SELECT 'المراسلات:' as info, COUNT(*) as count FROM correspondences;
SELECT 'القوالب:' as info, COUNT(*) as count FROM templates;

SELECT '✅ انتهى التحديث!' as final_message;
