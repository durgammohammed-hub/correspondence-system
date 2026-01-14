-- ================================================
-- نظام المراسلات الإدارية - قاعدة البيانات
-- Database: correspondence_system
-- ================================================

-- إنشاء قاعدة البيانات
CREATE DATABASE IF NOT EXISTS correspondence_system 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE correspondence_system;

-- ================================================
-- جدول المستخدمين
-- ================================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(150) UNIQUE,
    phone VARCHAR(20),
    role_id INT NOT NULL,
    department_id INT,
    division_id INT,
    school_id INT,
    signature_image TEXT,  -- صورة التوقيع الإلكتروني (base64)
    is_active BOOLEAN DEFAULT TRUE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(100),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (division_id) REFERENCES divisions(id),
    FOREIGN KEY (school_id) REFERENCES schools(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_username (username),
    INDEX idx_role (role_id),
    INDEX idx_department (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- جدول الأدوار والصلاحيات
-- ================================================
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(100) UNIQUE NOT NULL,
    role_name_ar VARCHAR(100) NOT NULL,
    description TEXT,
    level INT NOT NULL, -- مستوى الصلاحية (1=مدير عام، 2=معاون، 3=مدير قسم، 4=مدير شعبة/مدرسة، 5=موظف)
    permissions JSON, -- صلاحيات مفصلة
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- إدراج الأدوار الأساسية
INSERT INTO roles (role_name, role_name_ar, description, level, permissions) VALUES
('general_manager', 'المدير العام', 'صلاحيات كاملة على النظام', 1, '{"all": true}'),
('deputy_manager', 'معاون المدير', 'صلاحيات عالية', 2, '{"view_all": true, "approve": true, "reports": true}'),
('department_manager', 'مدير قسم', 'إدارة القسم', 3, '{"view_department": true, "approve_division": true}'),
('division_manager', 'مدير شعبة', 'إدارة الشعبة', 4, '{"view_division": true, "create": true, "edit_own": true}'),
('school_manager', 'مدير مدرسة', 'إدارة المدرسة', 4, '{"view_school": true, "create": true, "edit_own": true}'),
('employee', 'موظف', 'مستخدم عادي', 5, '{"view_own": true}');

-- ================================================
-- جدول الأقسام
-- ================================================
CREATE TABLE departments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dept_code VARCHAR(20) UNIQUE NOT NULL,
    dept_name VARCHAR(200) NOT NULL,
    description TEXT,
    manager_id INT,
    color_code VARCHAR(7) DEFAULT '#2563eb', -- لون القسم
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    FOREIGN KEY (manager_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_code (dept_code),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- جدول الشعب
-- ================================================
CREATE TABLE divisions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    div_code VARCHAR(20) UNIQUE NOT NULL,
    div_name VARCHAR(200) NOT NULL,
    department_id INT NOT NULL,
    description TEXT,
    manager_id INT,
    color_code VARCHAR(7) DEFAULT '#10b981',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (manager_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_code (div_code),
    INDEX idx_department (department_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- جدول المدارس
-- ================================================
CREATE TABLE schools (
    id INT PRIMARY KEY AUTO_INCREMENT,
    school_code VARCHAR(20) UNIQUE NOT NULL,
    school_name VARCHAR(200) NOT NULL,
    school_type ENUM('primary', 'middle', 'high', 'mixed') NOT NULL,
    address TEXT,
    manager_id INT,
    color_code VARCHAR(7) DEFAULT '#f59e0b',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    FOREIGN KEY (manager_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_code (school_code),
    INDEX idx_type (school_type),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- جدول المراسلات (الكتب الرسمية)
-- ================================================
CREATE TABLE correspondences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    corr_number VARCHAR(50) UNIQUE NOT NULL, -- رقم الكتاب
    corr_type ENUM('official_letter', 'review', 'request') NOT NULL, -- نوع المراسلة
    subject VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    priority ENUM('normal', 'important', 'urgent') DEFAULT 'normal',
    status ENUM('draft', 'pending', 'in_progress', 'approved', 'rejected', 'archived') DEFAULT 'draft',
    
    -- معلومات المرسل
    sender_id INT NOT NULL,
    sender_type ENUM('division', 'department', 'school', 'management') NOT NULL,
    sender_division_id INT,
    sender_department_id INT,
    sender_school_id INT,
    
    -- معلومات المستقبل
    receiver_id INT,
    receiver_type ENUM('division', 'department', 'school', 'management') NOT NULL,
    receiver_division_id INT,
    receiver_department_id INT,
    receiver_school_id INT,
    
    -- التتبع
    current_stage INT DEFAULT 1, -- المرحلة الحالية في workflow
    is_urgent BOOLEAN DEFAULT FALSE,
    due_date DATE,
    completed_at TIMESTAMP,
    
    -- الأرشفة
    archived BOOLEAN DEFAULT FALSE,
    archive_date TIMESTAMP,
    archived_by INT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id),
    FOREIGN KEY (sender_division_id) REFERENCES divisions(id),
    FOREIGN KEY (sender_department_id) REFERENCES departments(id),
    FOREIGN KEY (sender_school_id) REFERENCES schools(id),
    FOREIGN KEY (receiver_division_id) REFERENCES divisions(id),
    FOREIGN KEY (receiver_department_id) REFERENCES departments(id),
    FOREIGN KEY (receiver_school_id) REFERENCES schools(id),
    FOREIGN KEY (archived_by) REFERENCES users(id),
    
    INDEX idx_number (corr_number),
    INDEX idx_status (status),
    INDEX idx_sender (sender_id),
    INDEX idx_receiver (receiver_id),
    INDEX idx_type (corr_type),
    INDEX idx_priority (priority),
    INDEX idx_created (created_at),
    FULLTEXT idx_search (corr_number, subject, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- جدول سير العمل (Workflow)
-- ================================================
CREATE TABLE workflow_stages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    correspondence_id INT NOT NULL,
    stage_number INT NOT NULL,
    stage_name VARCHAR(100),
    
    -- معلومات المرحلة
    assigned_to INT NOT NULL, -- الشخص المسؤول عن هذه المرحلة
    assigned_role VARCHAR(50), -- الدور (مدير شعبة، مدير قسم، معاون، مدير عام)
    status ENUM('pending', 'in_review', 'approved', 'rejected', 'forwarded') DEFAULT 'pending',
    
    -- التوقيع
    signature_type ENUM('approved_formally', 'approved', 'action_required', 'rejected') NULL,
    signature_notes TEXT,
    signature_image TEXT, -- التوقيع الإلكتروني
    signed_at TIMESTAMP NULL,
    signed_by INT,
    
    -- التواريخ
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deadline TIMESTAMP,
    completed_at TIMESTAMP,
    
    FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (signed_by) REFERENCES users(id),
    
    INDEX idx_correspondence (correspondence_id),
    INDEX idx_assigned (assigned_to),
    INDEX idx_status (status),
    INDEX idx_stage (stage_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- جدول المرفقات
-- ================================================
CREATE TABLE attachments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    correspondence_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- word, image, pdf, scan
    file_size INT NOT NULL, -- بالبايت
    file_path TEXT NOT NULL, -- المسار أو base64
    is_encrypted BOOLEAN DEFAULT TRUE,
    uploaded_by INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    
    INDEX idx_correspondence (correspondence_id),
    INDEX idx_type (file_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- جدول الإشعارات
-- ================================================
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('new_correspondence', 'approval_needed', 'approved', 'rejected', 'comment', 'urgent', 'reminder') NOT NULL,
    correspondence_id INT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
    
    INDEX idx_user (user_id),
    INDEX idx_read (is_read),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- جدول التعليقات
-- ================================================
CREATE TABLE comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    correspondence_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    is_private BOOLEAN DEFAULT FALSE, -- تعليق خاص أو عام
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    
    INDEX idx_correspondence (correspondence_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- جدول سجل العمليات (Audit Log)
-- ================================================
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- correspondence, user, department, etc.
    entity_id INT NOT NULL,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    
    INDEX idx_user (user_id),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- جدول الجلسات (Sessions) - للمصادقة الثنائية
-- ================================================
CREATE TABLE user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_info TEXT,
    ip_address VARCHAR(45),
    is_active BOOLEAN DEFAULT TRUE,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user (user_id),
    INDEX idx_token (session_token),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- جدول القوالب (Templates)
-- ================================================
CREATE TABLE templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_name VARCHAR(200) NOT NULL,
    template_type ENUM('official_letter', 'review', 'request') NOT NULL,
    content TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id),
    
    INDEX idx_type (template_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- Views - طرق عرض للتقارير
-- ================================================

-- عرض إحصائيات المراسلات حسب القسم
CREATE VIEW v_department_statistics AS
SELECT 
    d.id AS department_id,
    d.dept_name,
    COUNT(DISTINCT c.id) AS total_correspondences,
    SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
    SUM(CASE WHEN c.status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
    SUM(CASE WHEN c.status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
    SUM(CASE WHEN c.is_urgent = TRUE AND c.status != 'archived' THEN 1 ELSE 0 END) AS urgent_count,
    SUM(CASE WHEN c.due_date < NOW() AND c.status NOT IN ('approved', 'rejected', 'archived') THEN 1 ELSE 0 END) AS overdue_count
FROM departments d
LEFT JOIN correspondences c ON (c.sender_department_id = d.id OR c.receiver_department_id = d.id)
WHERE d.is_active = TRUE
GROUP BY d.id, d.dept_name;

-- عرض المراسلات المتأخرة
CREATE VIEW v_overdue_correspondences AS
SELECT 
    c.id,
    c.corr_number,
    c.subject,
    c.priority,
    c.due_date,
    DATEDIFF(NOW(), c.due_date) AS days_overdue,
    u.full_name AS current_handler,
    d.dept_name AS department
FROM correspondences c
LEFT JOIN workflow_stages ws ON c.id = ws.correspondence_id AND ws.status = 'pending'
LEFT JOIN users u ON ws.assigned_to = u.id
LEFT JOIN departments d ON u.department_id = d.id
WHERE c.due_date < NOW() 
  AND c.status NOT IN ('approved', 'rejected', 'archived')
ORDER BY c.due_date ASC;

-- ================================================
-- Stored Procedures - إجراءات مخزنة
-- ================================================

DELIMITER //

-- إجراء لإنشاء مراسلة جديدة مع workflow تلقائي
CREATE PROCEDURE sp_create_correspondence(
    IN p_sender_id INT,
    IN p_corr_type VARCHAR(50),
    IN p_subject VARCHAR(500),
    IN p_content TEXT,
    IN p_priority VARCHAR(20),
    IN p_receiver_type VARCHAR(50),
    IN p_receiver_id INT,
    OUT p_corr_id INT
)
BEGIN
    DECLARE v_corr_number VARCHAR(50);
    DECLARE v_year INT;
    DECLARE v_counter INT;
    
    -- توليد رقم كتاب تلقائي
    SET v_year = YEAR(NOW());
    SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(corr_number, '/', -1) AS UNSIGNED)), 0) + 1 
    INTO v_counter
    FROM correspondences 
    WHERE YEAR(created_at) = v_year;
    
    SET v_corr_number = CONCAT(v_year, '/', LPAD(v_counter, 5, '0'));
    
    -- إدراج المراسلة
    INSERT INTO correspondences (
        corr_number, corr_type, subject, content, priority,
        sender_id, sender_type, receiver_type, status
    ) VALUES (
        v_corr_number, p_corr_type, p_subject, p_content, p_priority,
        p_sender_id, p_receiver_type, p_receiver_type, 'pending'
    );
    
    SET p_corr_id = LAST_INSERT_ID();
    
    -- إنشاء أول مرحلة في workflow
    INSERT INTO workflow_stages (
        correspondence_id, stage_number, stage_name, assigned_to, assigned_role, status
    ) VALUES (
        p_corr_id, 1, 'مدير الشعبة', p_receiver_id, 'division_manager', 'pending'
    );
    
    -- إنشاء إشعار
    INSERT INTO notifications (
        user_id, title, message, type, correspondence_id
    ) VALUES (
        p_receiver_id, 
        'مراسلة جديدة', 
        CONCAT('تم استلام مراسلة جديدة برقم: ', v_corr_number),
        'new_correspondence',
        p_corr_id
    );
END//

DELIMITER ;

-- ================================================
-- بيانات تجريبية
-- ================================================

-- إضافة قسم تجريبي
INSERT INTO departments (dept_code, dept_name, description, color_code) VALUES
('FIN', 'قسم المالية', 'إدارة الشؤون المالية والميزانيات', '#10b981'),
('HR', 'قسم الموارد البشرية', 'إدارة شؤون الموظفين', '#3b82f6'),
('IT', 'قسم تقنية المعلومات', 'الدعم التقني والبنية التحتية', '#8b5cf6'),
('EDU', 'قسم التعليم', 'الإشراف على المدارس والمناهج', '#f59e0b');

-- إضافة شعب تجريبية
INSERT INTO divisions (div_code, div_name, department_id, description, color_code) VALUES
('FIN-ACC', 'شعبة الحسابات', 1, 'المحاسبة والمراجعة المالية', '#059669'),
('HR-REC', 'شعبة التوظيف', 2, 'التوظيف والتعيينات', '#2563eb'),
('IT-SUP', 'شعبة الدعم الفني', 3, 'دعم المستخدمين', '#7c3aed');

-- إضافة مدارس تجريبية
INSERT INTO schools (school_code, school_name, school_type, color_code) VALUES
('SCH001', 'مدرسة الأمل الابتدائية', 'primary', '#f59e0b'),
('SCH002', 'مدرسة النجاح المتوسطة', 'middle', '#ef4444'),
('SCH003', 'ثانوية التميز', 'high', '#8b5cf6');

-- إضافة مستخدم مدير عام تجريبي
-- كلمة المرور: Admin@123 (مشفرة بـ bcrypt)
INSERT INTO users (username, password_hash, full_name, email, role_id, is_active) VALUES
('admin', '$2b$10$YourHashedPasswordHere', 'المدير العام', 'admin@example.com', 1, TRUE);

-- ================================================
-- الفهارس الإضافية للأداء
-- ================================================

-- فهرس مركب للبحث السريع
CREATE INDEX idx_corr_search ON correspondences(status, priority, created_at);
CREATE INDEX idx_workflow_active ON workflow_stages(correspondence_id, status, assigned_to);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read, created_at);
