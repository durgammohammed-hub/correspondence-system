-- ============================================
-- إضافة جداول التوقيعات الإلكترونية
-- ============================================

USE correspondence_system;

-- جدول التوقيعات
CREATE TABLE IF NOT EXISTS correspondence_signatures (
  id INT PRIMARY KEY AUTO_INCREMENT,
  correspondence_id INT NOT NULL,
  user_id INT NOT NULL,
  decision VARCHAR(100) NOT NULL COMMENT 'موافق / الإجراء اللازم / مرفوض',
  notes TEXT COMMENT 'ملاحظات التوقيع',
  signed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- إضافة عمود current_handler_id إذا مو موجود
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'correspondence_system' 
  AND TABLE_NAME = 'correspondences' 
  AND COLUMN_NAME = 'current_handler_id';

SET @query = IF(@col_exists = 0, 
  'ALTER TABLE correspondences ADD COLUMN current_handler_id INT, ADD FOREIGN KEY (current_handler_id) REFERENCES users(id)', 
  'SELECT "Column already exists"');

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- عرض النتيجة
SELECT 'تم إضافة جداول التوقيعات بنجاح!' as message;
SHOW TABLES;
