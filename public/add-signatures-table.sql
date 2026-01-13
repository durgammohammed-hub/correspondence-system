-- ================================================
-- إضافة جدول التوقيعات الإلكترونية
-- ================================================

-- جدول التوقيعات
CREATE TABLE IF NOT EXISTS correspondence_signatures (
  id INT PRIMARY KEY AUTO_INCREMENT,
  correspondence_id INT NOT NULL,
  user_id INT NOT NULL,
  decision VARCHAR(100) NOT NULL COMMENT 'القرار: الإجراء اللازم، موافق، موافق أصولياً، مرفوض',
  notes TEXT COMMENT 'ملاحظات التوقيع',
  signed_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  INDEX idx_correspondence (correspondence_id),
  INDEX idx_user (user_id),
  INDEX idx_signed_at (signed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- إضافة عمود للمعالج الحالي في جدول المراسلات
ALTER TABLE correspondences 
ADD COLUMN IF NOT EXISTS current_handler_id INT COMMENT 'المعالج الحالي',
ADD FOREIGN KEY (current_handler_id) REFERENCES users(id);

-- إضافة فهرس
ALTER TABLE correspondences 
ADD INDEX IF NOT EXISTS idx_current_handler (current_handler_id);

-- تحديث المراسلات الموجودة
UPDATE correspondences 
SET current_handler_id = recipient_id 
WHERE current_handler_id IS NULL AND recipient_id IS NOT NULL;

-- عرض البيانات
SELECT 'تم إنشاء جدول التوقيعات الإلكترونية بنجاح!' as message;

DESCRIBE correspondence_signatures;
