const express = require('express');
console.log("🟦 BOOT: server.js loaded");
console.log("🟦 ENV MYSQL_URL exists?", !!process.env.MYSQL_URL);
console.log("🟦 ENV MYSQL_URL preview:", (process.env.MYSQL_URL || "").slice(0, 35) + "...");

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ================================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ================================================

// Ensure upload directories exist
const uploadDirs = ['uploads', 'uploads/correspondences', 'uploads/templates'];
uploadDirs.forEach(dir => {
  if (!require('fs').existsSync(dir)) {
    require('fs').mkdirSync(dir, { recursive: true });
  }
});

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/correspondences/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /doc|docx|pdf|jpg|jpeg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مدعوم. الأنواع المسموحة: DOC, DOCX, PDF, JPG, PNG'));
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: fileFilter
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Rate Limiting للحماية من الهجمات
const rateLimitMap = new Map();

function rateLimit(maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, []);
    }
    
    const requests = rateLimitMap.get(ip);
    const recentRequests = requests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({ 
        error: 'تم تجاوز الحد المسموح من الطلبات. حاول مرة أخرى لاحقاً',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    recentRequests.push(now);
    rateLimitMap.set(ip, recentRequests);
    
    // تنظيف الذاكرة كل 5 دقائق
    if (Math.random() < 0.01) {
      for (const [key, value] of rateLimitMap.entries()) {
        const recent = value.filter(time => now - time < windowMs);
        if (recent.length === 0) {
          rateLimitMap.delete(key);
        } else {
          rateLimitMap.set(key, recent);
        }
      }
    }
    
    next();
  };
}

// تطبيق Rate Limiting على جميع الـ APIs
app.use('/api/', rateLimit(200, 60000)); // 200 طلب في الدقيقة
// app.use('/api/auth/login', rateLimit(20, 60000)); // معطّل للتطوير

// ================================================
// Database connection pool (Render + Railway Public URL)
// ================================================
console.log("✅ MYSQL_URL exists?", !!process.env.MYSQL_URL);

const pool = mysql.createPool({
  uri: process.env.MYSQL_URL,          // ✅ Render ENV: MYSQL_URL (Railway MYSQL_PUBLIC_URL)
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 10000,
  ssl: { rejectUnauthorized: false }
});

// Test database connection (prints real reason if fails)
pool.query("SELECT 1")
  .then(() => console.log("✅ DB Connected"))
  .catch((e) => {
  console.error("❌ DB connect error:", {
    code: e?.code,
    errno: e?.errno,
    sqlState: e?.sqlState,
    message: e?.message,
    host: e?.hostname,
    address: e?.address,
    port: e?.port
  });
});



// ================================================
// HELPER FUNCTIONS
// ================================================

// Simple Cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 دقائق

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() - item.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return item.data;
}

function setCache(key, data) {
  cache.set(key, {
    data: data,
    timestamp: Date.now()
  });
  
  // تنظيف الذاكرة
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

function clearCache(pattern) {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

// تسجيل العمليات في Audit Log
async function logAudit(userId, action, tableName, recordId, details = null) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, action, tableName, recordId, details ? JSON.stringify(details) : null, null]
    );
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

// إنشاء إشعار
async function createNotification(userId, type, title, message, relatedId = null, relatedType = null) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, type, title, message, relatedId, relatedType]
    );
  } catch (error) {
    console.error('Notification error:', error);
  }
}

// ================================================
// AUTH MIDDLEWARE
// ================================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'رمز غير صالح' });
    }
    req.user = user;
    next();
  });
}

// التحقق من الصلاحيات
function checkPermission(requiredLevel) {
  return (req, res, next) => {
    if (req.user.level > requiredLevel) {
      return res.status(403).json({ error: 'غير مصرح لك' });
    }
    next();
  };
}

// ================================================
// AUTH ROUTES
// ================================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, twoFactorCode } = req.body;
    
    const [users] = await pool.query(
      `SELECT u.*, r.role_name_ar, r.level, r.permissions, 
              d.dept_name, dvs.div_name, s.school_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN divisions dvs ON u.division_id = dvs.id
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE u.username = ? AND u.is_active = 1`,
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'خطأ في اسم المستخدم أو كلمة المرور' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    
    if (!match) {
      return res.status(401).json({ error: 'خطأ في اسم المستخدم أو كلمة المرور' });
    }

    // التحقق من المصادقة الثنائية إذا كانت مفعلة
    if (user.two_factor_enabled) {
      if (!twoFactorCode) {
        return res.json({ requiresTwoFactor: true });
      }
      // هنا يمكن إضافة التحقق من رمز 2FA باستخدام speakeasy
    }

    // تحديث آخر تسجيل دخول
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        level: user.level,
        permissions: user.permissions 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    delete user.password_hash;
    delete user.two_factor_secret;
    
    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE user_sessions SET is_active = 0 WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ success: true, message: 'تم تسجيل الخروج' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// ================================================
// USERS ROUTES
// ================================================

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.*, r.role_name_ar, r.level, d.dept_name, dvs.div_name, s.school_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN divisions dvs ON u.division_id = dvs.id
       LEFT JOIN schools s ON u.school_id = s.id
       ORDER BY u.created_at DESC`
    );
    
    users.forEach(u => delete u.password_hash);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.*, r.role_name_ar, r.level, d.dept_name, dvs.div_name, s.school_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN divisions dvs ON u.division_id = dvs.id
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE u.id = ?`,
      [req.params.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'غير موجود' });
    }
    
    delete users[0].password_hash;
    res.json({ success: true, data: users[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// إنشاء مستخدم جديد
app.post('/api/users', authenticateToken, checkPermission(2), async (req, res) => {
  try {
    const { username, password, full_name, email, phone, role_id, department_id, division_id, school_id } = req.body;
    
    // تشفير كلمة المرور
    const password_hash = await bcrypt.hash(password, 10);
    
    const [result] = await pool.query(
      `INSERT INTO users 
       (username, password_hash, full_name, email, phone, role_id, department_id, division_id, school_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, password_hash, full_name, email, phone, role_id, department_id, division_id, school_id, req.user.id]
    );
    
    await logAudit(req.user.id, 'CREATE', 'users', result.insertId, { username, full_name });
    
    // مسح الـ cache
    clearCache('users');
    clearCache('roles');
    clearCache('departments');
    clearCache('divisions');
    
    res.json({ success: true, message: 'تم إنشاء المستخدم بنجاح', data: { id: result.insertId } });
  } catch (error) {
    console.error(error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' });
    }
    res.status(500).json({ error: 'فشل الإنشاء' });
  }
});

app.put('/api/users/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { full_name, email, phone, role_id, department_id, division_id, school_id } = req.body;

  // التحقق من الصلاحية
  if (req.user.id != userId && req.user.level > 2) {
    return res.status(403).json({ error: 'غير مصرح لك' });
  }

  try {
    // إذا كان مدير، يقدر يعدل كل شي
    if (req.user.level <= 2 && (role_id !== undefined || department_id !== undefined)) {
      // المدير يعدل كل الحقول
      await pool.query(
        `UPDATE users 
         SET full_name = ?, email = ?, phone = ?, role_id = ?, department_id = ?, division_id = ?, school_id = ?
         WHERE id = ?`,
        [full_name, email, phone, role_id, department_id, division_id, school_id, userId]
      );
    } else {
      // المستخدم العادي يعدل معلوماته الشخصية فقط
      await pool.query(
        'UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?',
        [full_name, email, phone, userId]
      );
    }

    // تحديث localStorage للمستخدم
    const [updatedUser] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    
    await logAudit(req.user.id, 'UPDATE', 'users', userId, { full_name, email });
    res.json({ 
      success: true, 
      message: 'تم تحديث البيانات بنجاح',
      data: updatedUser[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل التحديث: ' + error.message });
  }
});

// حذف مستخدم (تعطيل)
app.delete('/api/users/:id', authenticateToken, checkPermission(1), async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    await logAudit(req.user.id, 'DELETE', 'users', req.params.id);
    res.json({ success: true, message: 'تم تعطيل المستخدم بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل الحذف' });
  }
});

// ================================================
// USER SIGNATURE ROUTES
// ================================================

// Get user signature
app.get('/api/users/:id/signature', authenticateToken, async (req, res) => {
  try {
    const [signatures] = await pool.query(
      'SELECT * FROM user_signatures WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.params.id]
    );
    
    if (signatures.length > 0) {
      res.json({ success: true, data: signatures[0] });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Save/Update user signature
app.post('/api/users/:id/signature', authenticateToken, async (req, res) => {
  try {
    const { signature_data } = req.body;
    
    // Check if signature exists
    const [existing] = await pool.query(
      'SELECT id FROM user_signatures WHERE user_id = ?',
      [req.params.id]
    );
    
    if (existing.length > 0) {
      // Update existing
      await pool.query(
        'UPDATE user_signatures SET signature_data = ?, updated_at = NOW() WHERE user_id = ?',
        [signature_data, req.params.id]
      );
    } else {
      // Insert new
      await pool.query(
        'INSERT INTO user_signatures (user_id, signature_data) VALUES (?, ?)',
        [req.params.id, signature_data]
      );
    }
    
    await logAudit(req.user.id, 'UPDATE', 'user_signatures', req.params.id, { action: 'save_signature' });
    
    res.json({ success: true, message: 'تم حفظ التوقيع بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل حفظ التوقيع' });
  }
});

// Get user's correspondence signatures (log)
app.get('/api/users/:id/signatures', authenticateToken, async (req, res) => {
  try {
    const [signatures] = await pool.query(
      `SELECT cs.*, 
              c.subject as corr_subject, 
              c.corr_number as corr_number,
              u.full_name as signer_name
       FROM correspondence_signatures cs
       LEFT JOIN correspondences c ON cs.correspondence_id = c.id
       LEFT JOIN users u ON cs.user_id = u.id
       WHERE cs.user_id = ?
       ORDER BY cs.signed_at DESC`,
      [req.params.id]
    );
    
    res.json({ success: true, data: signatures });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.post('/api/users/:userId/change-password', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;

  if (req.user.id != userId) {
    return res.status(403).json({ error: 'غير مصرح لك' });
  }

  try {
    const [users] = await pool.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const match = await bcrypt.compare(currentPassword, users[0].password_hash);

    if (!match) {
      return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    await logAudit(req.user.id, 'CHANGE_PASSWORD', 'users', userId);
    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل تغيير كلمة المرور' });
  }
});

// ================================================
// DEPARTMENTS ROUTES
// ================================================

app.get('/api/departments', authenticateToken, async (req, res) => {
  try {
    // محاولة جلب من الـ cache
    const cached = getCache('departments');
    if (cached) {
      return res.json({ success: true, data: cached, cached: true });
    }
    
    const [departments] = await pool.query(
      `SELECT d.*, u.full_name as manager_name,
              (SELECT COUNT(*) FROM divisions WHERE department_id = d.id) as divisions_count,
              (SELECT COUNT(*) FROM users WHERE department_id = d.id) as users_count
       FROM departments d
       LEFT JOIN users u ON d.manager_id = u.id
       WHERE d.is_active = 1`
    );
    
    // حفظ في الـ cache
    setCache('departments', departments);
    
    res.json({ success: true, data: departments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// إنشاء قسم جديد
app.post('/api/departments', authenticateToken, checkPermission(2), async (req, res) => {
  try {
    const { dept_code, dept_name, description, manager_id, color_code } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO departments (dept_code, dept_name, description, manager_id, color_code, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dept_code, dept_name, description, manager_id, color_code || '#2563eb', req.user.id]
    );
    
    await logAudit(req.user.id, 'CREATE', 'departments', result.insertId, { dept_name });
    
    // مسح الـ cache
    clearCache('departments');
    
    res.json({ success: true, message: 'تم إنشاء القسم بنجاح', data: { id: result.insertId } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل الإنشاء' });
  }
});

// تعديل قسم
app.put('/api/departments/:id', authenticateToken, checkPermission(2), async (req, res) => {
  try {
    const { dept_name, description, manager_id, color_code } = req.body;
    
    await pool.query(
      `UPDATE departments 
       SET dept_name = ?, description = ?, manager_id = ?, color_code = ?
       WHERE id = ?`,
      [dept_name, description, manager_id, color_code, req.params.id]
    );
    
    await logAudit(req.user.id, 'UPDATE', 'departments', req.params.id, { dept_name });
    
    res.json({ success: true, message: 'تم تحديث القسم بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل التحديث' });
  }
});

// حذف قسم
app.delete('/api/departments/:id', authenticateToken, checkPermission(1), async (req, res) => {
  try {
    await pool.query('UPDATE departments SET is_active = 0 WHERE id = ?', [req.params.id]);
    await logAudit(req.user.id, 'DELETE', 'departments', req.params.id);
    res.json({ success: true, message: 'تم حذف القسم بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل الحذف' });
  }
});

// ================================================
// DIVISIONS ROUTES
// ================================================

app.get('/api/divisions', authenticateToken, async (req, res) => {
  try {
    // محاولة جلب من الـ cache
    const cached = getCache('divisions');
    if (cached) {
      return res.json({ success: true, data: cached, cached: true });
    }
    
    const [divisions] = await pool.query(
      `SELECT dvs.*, d.dept_name, u.full_name as manager_name,
              (SELECT COUNT(*) FROM users WHERE division_id = dvs.id) as users_count
       FROM divisions dvs
       LEFT JOIN departments d ON dvs.department_id = d.id
       LEFT JOIN users u ON dvs.manager_id = u.id
       WHERE dvs.is_active = 1`
    );
    
    // حفظ في الـ cache
    setCache('divisions', divisions);
    
    res.json({ success: true, data: divisions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// إنشاء شعبة جديدة
app.post('/api/divisions', authenticateToken, checkPermission(2), async (req, res) => {
  try {
    const { div_code, div_name, department_id, description, manager_id, color_code } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO divisions (div_code, div_name, department_id, description, manager_id, color_code, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [div_code, div_name, department_id, description, manager_id, color_code || '#10b981', req.user.id]
    );
    
    await logAudit(req.user.id, 'CREATE', 'divisions', result.insertId, { div_name });
    
    // مسح الـ cache
    clearCache('divisions');
    
    res.json({ success: true, message: 'تم إنشاء الشعبة بنجاح', data: { id: result.insertId } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل الإنشاء' });
  }
});

// تعديل شعبة
app.put('/api/divisions/:id', authenticateToken, checkPermission(2), async (req, res) => {
  try {
    const { div_name, department_id, description, manager_id, color_code } = req.body;
    
    await pool.query(
      `UPDATE divisions 
       SET div_name = ?, department_id = ?, description = ?, manager_id = ?, color_code = ?
       WHERE id = ?`,
      [div_name, department_id, description, manager_id, color_code, req.params.id]
    );
    
    await logAudit(req.user.id, 'UPDATE', 'divisions', req.params.id, { div_name });
    
    res.json({ success: true, message: 'تم تحديث الشعبة بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل التحديث' });
  }
});

// حذف شعبة
app.delete('/api/divisions/:id', authenticateToken, checkPermission(1), async (req, res) => {
  try {
    await pool.query('UPDATE divisions SET is_active = 0 WHERE id = ?', [req.params.id]);
    await logAudit(req.user.id, 'DELETE', 'divisions', req.params.id);
    res.json({ success: true, message: 'تم حذف الشعبة بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل الحذف' });
  }
});

// ================================================
// SCHOOLS ROUTES
// ================================================

app.get('/api/schools', authenticateToken, async (req, res) => {
  try {
    const [schools] = await pool.query(
      `SELECT s.*, u.full_name as manager_name,
              (SELECT COUNT(*) FROM users WHERE school_id = s.id) as users_count
       FROM schools s
       LEFT JOIN users u ON s.manager_id = u.id
       WHERE s.is_active = 1`
    );
    res.json({ success: true, data: schools });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// إنشاء مدرسة جديدة
app.post('/api/schools', authenticateToken, checkPermission(2), async (req, res) => {
  try {
    const { school_code, school_name, address, manager_id } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO schools (school_code, school_name, address, manager_id, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [school_code, school_name, address, manager_id, req.user.id]
    );
    
    await logAudit(req.user.id, 'CREATE', 'schools', result.insertId, { school_name });
    
    res.json({ success: true, message: 'تم إنشاء المدرسة بنجاح', data: { id: result.insertId } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل الإنشاء' });
  }
});

// تعديل مدرسة
app.put('/api/schools/:id', authenticateToken, checkPermission(2), async (req, res) => {
  try {
    const { school_name, address, manager_id } = req.body;
    
    await pool.query(
      `UPDATE schools 
       SET school_name = ?, address = ?, manager_id = ?
       WHERE id = ?`,
      [school_name, address, manager_id, req.params.id]
    );
    
    await logAudit(req.user.id, 'UPDATE', 'schools', req.params.id, { school_name });
    
    res.json({ success: true, message: 'تم تحديث المدرسة بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل التحديث' });
  }
});

// حذف مدرسة
app.delete('/api/schools/:id', authenticateToken, checkPermission(1), async (req, res) => {
  try {
    await pool.query('UPDATE schools SET is_active = 0 WHERE id = ?', [req.params.id]);
    await logAudit(req.user.id, 'DELETE', 'schools', req.params.id);
    res.json({ success: true, message: 'تم حذف المدرسة بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل الحذف' });
  }
});

// ================================================
// ROLES ROUTES
// ================================================

app.get('/api/roles', authenticateToken, async (req, res) => {
  try {
    // محاولة جلب من الـ cache
    const cached = getCache('roles');
    if (cached) {
      return res.json({ success: true, data: cached, cached: true });
    }
    
    const [roles] = await pool.query(
      `SELECT r.*, (SELECT COUNT(*) FROM users WHERE role_id = r.id) as users_count
       FROM roles r ORDER BY r.level`
    );
    
    // حفظ في الـ cache
    setCache('roles', roles);
    
    res.json({ success: true, data: roles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// تحديث صلاحيات الدور
app.put('/api/roles/:id', authenticateToken, checkPermission(1), async (req, res) => {
  try {
    const { permissions } = req.body;
    
    await pool.query(
      `UPDATE roles SET permissions = ? WHERE id = ?`,
      [JSON.stringify(permissions), req.params.id]
    );
    
    await logAudit(req.user.id, 'UPDATE', 'roles', req.params.id, { permissions });
    
    // مسح الـ cache
    clearCache('roles');
    
    res.json({ success: true, message: 'تم تحديث الصلاحيات بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل التحديث' });
  }
});

// ================================================
// WORKFLOW HELPER FUNCTIONS
// ================================================

async function createWorkflowStages(correspondenceId, senderId, divisionId, departmentId, finalRecipientId) {
  try {
    const stages = [];
    let order = 1;
    
    // المرحلة 1: الشعبة (إذا كان المرسل ينتمي لشعبة) - توقيع إلكتروني فقط
    if (divisionId) {
      const [divManager] = await pool.query(
        'SELECT manager_id FROM divisions WHERE id = ?',
        [divisionId]
      );
      
      if (divManager.length > 0 && divManager[0].manager_id && divManager[0].manager_id !== senderId) {
        stages.push({
          correspondence_id: correspondenceId,
          stage_name: 'اعتماد الشعبة',
          stage_order: order++,
          assigned_to: divManager[0].manager_id,
          status: 'pending',
          requires_signature: false // توقيع إلكتروني فقط
        });
      }
    }
    
    // المرحلة 2: القسم (إذا كان المرسل ينتمي لقسم) - توقيع إلكتروني فقط
    if (departmentId) {
      const [deptManager] = await pool.query(
        'SELECT manager_id FROM departments WHERE id = ?',
        [departmentId]
      );
      
      if (deptManager.length > 0 && deptManager[0].manager_id && deptManager[0].manager_id !== senderId) {
        stages.push({
          correspondence_id: correspondenceId,
          stage_name: 'اعتماد القسم',
          stage_order: order++,
          assigned_to: deptManager[0].manager_id,
          status: order === 1 ? 'pending' : 'waiting',
          requires_signature: false // توقيع إلكتروني فقط
        });
      }
    }
    
    // المرحلة 3: المستلم النهائي (التوقيع المباشر على الكتاب)
    if (finalRecipientId && finalRecipientId !== senderId) {
      stages.push({
        correspondence_id: correspondenceId,
        stage_name: 'التوقيع النهائي',
        stage_order: order++,
        assigned_to: finalRecipientId,
        status: order === 1 ? 'pending' : 'waiting',
        requires_signature: true // توقيع مباشر يُطبع على الكتاب
      });
    }
    
    // إدراج المراحل
    if (stages.length > 0) {
      for (const stage of stages) {
        await pool.query(
          `INSERT INTO workflow_stages 
           (correspondence_id, stage_name, stage_order, assigned_to, status, requires_signature)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            stage.correspondence_id,
            stage.stage_name,
            stage.stage_order,
            stage.assigned_to,
            stage.status,
            stage.requires_signature || false
          ]
        );
      }
    }
    
    return stages.length;
  } catch (error) {
    console.error('Error creating workflow stages:', error);
    return 0;
  }
}

// ================================================
// CORRESPONDENCES ROUTES
// ================================================

// جلب جميع المراسلات
app.get('/api/correspondences', authenticateToken, async (req, res) => {
  try {
    const { status, priority, sender_id, receiver_id, search, page = 1, limit = 20 } = req.query;
    
    let query = `
      SELECT c.*, 
             sender.full_name as sender_name,
             receiver.full_name as receiver_name,
             handler.full_name as handler_name,
             (SELECT COUNT(*) FROM correspondence_attachments WHERE correspondence_id = c.id) as attachments_count
      FROM correspondences c
      LEFT JOIN users sender ON c.sender_id = sender.id
      LEFT JOIN users receiver ON c.receiver_id = receiver.id
      LEFT JOIN users handler ON c.current_handler_id = handler.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // الفلترة
    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }
    
    if (priority) {
      query += ' AND c.priority = ?';
      params.push(priority);
    }
    
    if (sender_id) {
      query += ' AND c.sender_id = ?';
      params.push(sender_id);
    }
    
    if (receiver_id) {
      query += ' AND c.receiver_id = ?';
      params.push(receiver_id);
    }
    
    if (search) {
      query += ' AND (c.corr_number LIKE ? OR c.subject LIKE ? OR c.content LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    // البحث حسب صلاحيات المستخدم
    if (req.user.level > 2) {
      query += ' AND (c.sender_id = ? OR c.receiver_id = ? OR c.current_handler_id = ?)';
      params.push(req.user.id, req.user.id, req.user.id);
    }
    
    query += ' ORDER BY c.created_at DESC';
    
    // Pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const [correspondences] = await pool.query(query, params);
    
    // عدد الصفحات
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM correspondences WHERE 1=1' + 
      (req.user.level > 2 ? ' AND (sender_id = ? OR receiver_id = ? OR current_handler_id = ?)' : ''),
      req.user.level > 2 ? [req.user.id, req.user.id, req.user.id] : []
    );
    
    res.json({ 
      success: true, 
      data: correspondences,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// جلب مراسلة واحدة
app.get('/api/correspondences/:id', authenticateToken, async (req, res) => {
  try {
    const [correspondences] = await pool.query(
      `SELECT c.*,
              sender.full_name as sender_name,
              receiver.full_name as receiver_name,
              handler.full_name as handler_name
       FROM correspondences c
       LEFT JOIN users sender ON c.sender_id = sender.id
       LEFT JOIN users receiver ON c.receiver_id = receiver.id
       LEFT JOIN users handler ON c.current_handler_id = handler.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    
    if (correspondences.length === 0) {
      return res.status(404).json({ error: 'غير موجودة' });
    }

    // جلب المرفقات
    const [attachments] = await pool.query(
      'SELECT * FROM attachments WHERE correspondence_id = ?',
      [req.params.id]
    );

    // جلب التوقيعات
    const [signatures] = await pool.query(
      `SELECT cs.*, u.full_name as signer_name, r.role_name_ar
       FROM correspondence_signatures cs
       LEFT JOIN users u ON cs.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE cs.correspondence_id = ?
       ORDER BY cs.signed_at ASC`,
      [req.params.id]
    );
    
    // جلب التعليقات
    const [comments] = await pool.query(
      `SELECT com.*, u.full_name as commenter_name
       FROM comments com
       LEFT JOIN users u ON com.user_id = u.id
       WHERE com.correspondence_id = ?
       ORDER BY com.created_at DESC`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: { 
        ...correspondences[0], 
        attachments, 
        signatures,
        comments 
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// إنشاء مراسلة جديدة (مع رفع ملف اختياري)
app.post('/api/correspondences', authenticateToken, upload.single('template_file'), async (req, res) => {
  try {
    const {
      corr_type,
      subject,
      content,
      priority,
      recipient_id,
      corr_number: manualCorrNumber,
      corr_date,
      numberType,
      dateType,
      cc = []
    } = req.body;

    // توليد رقم المراسلة
    let corr_number;
    if (numberType === 'manual' && manualCorrNumber) {
      corr_number = manualCorrNumber;
    } else {
      const year = new Date().getFullYear();
      const [lastCorr] = await pool.query(
        'SELECT corr_number FROM correspondences ORDER BY id DESC LIMIT 1'
      );
      
      let nextNumber = 1;
      if (lastCorr.length > 0 && lastCorr[0].corr_number) {
        const parts = lastCorr[0].corr_number.split('/');
        if (parts.length > 0) {
          nextNumber = parseInt(parts[0]) + 1;
        }
      }
      
      corr_number = `${nextNumber}/${year}`;
    }

    // التاريخ
    const finalDate = (dateType === 'manual' && corr_date) ? corr_date : new Date();

    // تحديد نوع وجهة المرسل
    let sender_type = 'management';
    let sender_division_id = null;
    let sender_department_id = null;
    let sender_school_id = null;
    
    const [senderInfo] = await pool.query(
      'SELECT division_id, department_id, school_id FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (senderInfo.length > 0) {
      if (senderInfo[0].division_id) {
        sender_type = 'division';
        sender_division_id = senderInfo[0].division_id;
      } else if (senderInfo[0].department_id) {
        sender_type = 'department';
        sender_department_id = senderInfo[0].department_id;
      } else if (senderInfo[0].school_id) {
        sender_type = 'school';
        sender_school_id = senderInfo[0].school_id;
      }
    }

    // إدراج المراسلة
    const [result] = await pool.query(
      `INSERT INTO correspondences 
       (corr_number, corr_type, subject, content, priority, status,
        sender_id, sender_type, sender_division_id, sender_department_id, sender_school_id,
        receiver_id, current_handler_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        corr_number, corr_type || 'صادر', subject, content, priority || 'normal',
        req.user.id, sender_type, sender_division_id, sender_department_id, sender_school_id,
        recipient_id, recipient_id, finalDate
      ]
    );

    const correspondenceId = result.insertId;

    // حفظ الملف المرفق
    if (req.file) {
      // حفظ المسار النسبي فقط (بدون uploads/)
      const relativePath = req.file.path.replace(/^uploads[\/\\]/, '');
      
      await pool.query(
        `INSERT INTO correspondence_attachments 
         (correspondence_id, file_name, file_path, file_size, file_type, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          correspondenceId,
          req.file.originalname,
          relativePath,
          req.file.size,
          req.file.mimetype,
          req.user.id
        ]
      );
    }

    // حفظ نسخة إلى (CC)
    if (cc && cc.length > 0) {
      const ccArray = Array.isArray(cc) ? cc : [cc];
      
      for (const recipient of ccArray) {
        await pool.query(
          `INSERT INTO correspondence_cc (correspondence_id, recipient_type, recipient_id, recipient_name)
           VALUES (?, ?, ?, ?)`,
          [correspondenceId, 'custom', null, recipient]
        );
      }
    }

    // إنشاء مراحل سير العمل التلقائي
    await createWorkflowStages(correspondenceId, req.user.id, sender_division_id, sender_department_id, recipient_id);

    await logAudit(req.user.id, 'CREATE', 'correspondences', correspondenceId, { subject });
    
    // Clear cache
    cache.clear();

    res.json({ 
      success: true, 
      message: 'تم إنشاء المراسلة وإرسالها للاعتماد بنجاح',
      data: { id: correspondenceId, corr_number }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل إنشاء المراسلة: ' + error.message });
  }
});

// تعديل مراسلة
app.put('/api/correspondences/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, content, priority, status } = req.body;
    
    // التحقق من الصلاحية
    const [corr] = await pool.query(
      'SELECT sender_id, status FROM correspondences WHERE id = ?',
      [id]
    );
    
    if (corr.length === 0) {
      return res.status(404).json({ error: 'المراسلة غير موجودة' });
    }
    
    if (corr[0].sender_id !== req.user.id && req.user.level > 2) {
      return res.status(403).json({ error: 'غير مصرح لك' });
    }
    
    if (corr[0].status !== 'draft') {
      return res.status(400).json({ error: 'لا يمكن تعديل مراسلة تم إرسالها' });
    }

    await pool.query(
      `UPDATE correspondences 
       SET subject = ?, content = ?, priority = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [subject, content, priority, status || 'draft', id]
    );

    await logAudit(req.user.id, 'UPDATE', 'correspondences', id, { subject, priority, status });

    res.json({ success: true, message: 'تم تحديث المراسلة بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل التحديث' });
  }
});

// حذف مراسلة
app.delete('/api/correspondences/:id', authenticateToken, checkPermission(2), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [corr] = await pool.query(
      'SELECT sender_id, corr_number FROM correspondences WHERE id = ?',
      [id]
    );
    
    if (corr.length === 0) {
      return res.status(404).json({ error: 'المراسلة غير موجودة' });
    }

    // حذف المرفقات من القرص
    const [attachments] = await pool.query(
      'SELECT file_path FROM attachments WHERE correspondence_id = ?',
      [id]
    );
    
    for (const att of attachments) {
      try {
        await fs.unlink(att.file_path);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }

    // حذف من قاعدة البيانات
    await pool.query('DELETE FROM correspondences WHERE id = ?', [id]);
    
    await logAudit(req.user.id, 'DELETE', 'correspondences', id, { corr_number: corr[0].corr_number });

    res.json({ success: true, message: 'تم حذف المراسلة بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل الحذف' });
  }
});

// أرشفة مراسلة
app.post('/api/correspondences/:id/archive', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      `UPDATE correspondences 
       SET archived = 1, archive_date = NOW(), archived_by = ?
       WHERE id = ?`,
      [req.user.id, id]
    );
    
    await logAudit(req.user.id, 'ARCHIVE', 'correspondences', id);

    res.json({ success: true, message: 'تم أرشفة المراسلة بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل الأرشفة' });
  }
});

// ================================================
// ATTACHMENTS ROUTES
// ================================================

// رفع مرفق
app.post('/api/correspondences/:id/attachments', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم رفع أي ملف' });
    }

    const { id } = req.params;
    
    const [result] = await pool.query(
      `INSERT INTO attachments 
       (correspondence_id, file_name, file_type, file_size, file_path, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.path,
        req.user.id
      ]
    );

    await logAudit(req.user.id, 'UPLOAD', 'attachments', result.insertId, { 
      correspondence_id: id,
      file_name: req.file.originalname 
    });

    res.json({ 
      success: true, 
      message: 'تم رفع الملف بنجاح',
      data: {
        id: result.insertId,
        file_name: req.file.originalname,
        file_size: req.file.size
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل رفع الملف' });
  }
});

// حذف مرفق
app.delete('/api/attachments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [attachments] = await pool.query(
      'SELECT file_path, correspondence_id FROM attachments WHERE id = ?',
      [id]
    );
    
    if (attachments.length === 0) {
      return res.status(404).json({ error: 'المرفق غير موجود' });
    }
    
    // حذف الملف من القرص
    try {
      await fs.unlink(attachments[0].file_path);
    } catch (err) {
      console.error('Error deleting file:', err);
    }
    
    await pool.query('DELETE FROM attachments WHERE id = ?', [id]);
    
    await logAudit(req.user.id, 'DELETE', 'attachments', id, {
      correspondence_id: attachments[0].correspondence_id
    });

    res.json({ success: true, message: 'تم حذف المرفق بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل الحذف' });
  }
});

// تحميل مرفق
app.get('/api/attachments/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [attachments] = await pool.query(
      'SELECT file_path, file_name FROM attachments WHERE id = ?',
      [id]
    );
    
    if (attachments.length === 0) {
      return res.status(404).json({ error: 'المرفق غير موجود' });
    }
    
    res.download(attachments[0].file_path, attachments[0].file_name);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل التحميل' });
  }
});

// ================================================
// SIGNATURES ROUTES
// ================================================

// التوقيع على مراسلة
// جلب توقيعات مراسلة
app.get('/api/correspondences/:id/signatures', authenticateToken, async (req, res) => {
  try {
    const [signatures] = await pool.query(
      `SELECT cs.*, u.full_name as signer_name, r.role_name_ar
       FROM correspondence_signatures cs
       LEFT JOIN users u ON cs.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE cs.correspondence_id = ?
       ORDER BY cs.signed_at ASC`,
      [req.params.id]
    );

    res.json({ success: true, data: signatures });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل جلب التوقيعات' });
  }
});

// ================================================
// COMMENTS ROUTES
// ================================================

// إضافة تعليق
app.post('/api/correspondences/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment_text } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO comments (correspondence_id, user_id, comment_text)
       VALUES (?, ?, ?)`,
      [id, req.user.id, comment_text]
    );
    
    await logAudit(req.user.id, 'COMMENT', 'comments', result.insertId, { correspondence_id: id });
    
    res.json({ 
      success: true, 
      message: 'تم إضافة التعليق بنجاح',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل إضافة التعليق' });
  }
});

// جلب تعليقات مراسلة
app.get('/api/correspondences/:id/comments', authenticateToken, async (req, res) => {
  try {
    const [comments] = await pool.query(
      `SELECT c.*, u.full_name as commenter_name, u.role_name_ar
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.correspondence_id = ?
       ORDER BY c.created_at DESC`,
      [req.params.id]
    );
    
    res.json({ success: true, data: comments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل جلب التعليقات' });
  }
});

// ================================================
// NOTIFICATIONS ROUTES
// ================================================

// جلب إشعارات المستخدم
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const [notifications] = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.user.id]
    );
    
    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// تعليم إشعار كمقروء
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    res.json({ success: true, message: 'تم التحديث' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// تعليم جميع الإشعارات كمقروءة
app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [req.user.id]
    );
    
    res.json({ success: true, message: 'تم تحديث جميع الإشعارات' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// ================================================
// TEMPLATES ROUTES
// ================================================

// جلب جميع القوالب
app.get('/api/templates', authenticateToken, async (req, res) => {
  try {
    const [templates] = await pool.query(
      `SELECT t.*, u.full_name as created_by_name
       FROM templates t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.is_active = 1
       ORDER BY t.created_at DESC`
    );
    
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// جلب قالب واحد
app.get('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    const [templates] = await pool.query(
      'SELECT * FROM templates WHERE id = ?',
      [req.params.id]
    );
    
    if (templates.length === 0) {
      return res.status(404).json({ error: 'القالب غير موجود' });
    }
    
    res.json({ success: true, data: templates[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// ================================================
// STATISTICS ROUTES
// ================================================

// إحصائيات عامة
app.get('/api/statistics', authenticateToken, async (req, res) => {
  try {
    // عدد المراسلات
    const [totalCorr] = await pool.query(
      'SELECT COUNT(*) as total FROM correspondences'
    );
    
    // عدد المراسلات حسب الحالة
    const [statusCounts] = await pool.query(
      `SELECT status, COUNT(*) as count 
       FROM correspondences 
       GROUP BY status`
    );
    
    // عدد المراسلات حسب الأولوية
    const [priorityCounts] = await pool.query(
      `SELECT priority, COUNT(*) as count 
       FROM correspondences 
       GROUP BY priority`
    );
    
    // المراسلات اليوم
    const [todayCorr] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM correspondences 
       WHERE DATE(created_at) = CURDATE()`
    );
    
    // المراسلات هذا الشهر
    const [monthCorr] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM correspondences 
       WHERE MONTH(created_at) = MONTH(CURDATE()) 
       AND YEAR(created_at) = YEAR(CURDATE())`
    );
    
    // المراسلات المتأخرة
    const [overdueCorr] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM correspondences 
       WHERE due_date < CURDATE() 
       AND status NOT IN ('approved', 'rejected', 'archived')`
    );
    
    // أكثر المستخدمين نشاطاً
    const [activeUsers] = await pool.query(
      `SELECT u.full_name, COUNT(c.id) as count
       FROM users u
       LEFT JOIN correspondences c ON u.id = c.sender_id
       GROUP BY u.id
       ORDER BY count DESC
       LIMIT 10`
    );
    
    res.json({
      success: true,
      data: {
        total: totalCorr[0].total,
        by_status: statusCounts,
        by_priority: priorityCounts,
        today: todayCorr[0].count,
        this_month: monthCorr[0].count,
        overdue: overdueCorr[0].count,
        active_users: activeUsers
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// إحصائيات المستخدم
app.get('/api/statistics/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // التحقق من الصلاحية
    if (req.user.id != userId && req.user.level > 2) {
      return res.status(403).json({ error: 'غير مصرح لك' });
    }
    
    const [sent] = await pool.query(
      'SELECT COUNT(*) as count FROM correspondences WHERE sender_id = ?',
      [userId]
    );
    
    const [received] = await pool.query(
      'SELECT COUNT(*) as count FROM correspondences WHERE receiver_id = ?',
      [userId]
    );
    
    const [signatures] = await pool.query(
      'SELECT COUNT(*) as count FROM correspondence_signatures WHERE user_id = ?',
      [userId]
    );
    
    res.json({
      success: true,
      data: {
        sent: sent[0].count,
        received: received[0].count,
        signatures: signatures[0].count
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// ================================================
// AUDIT LOGS ROUTES
// ================================================

// جلب سجل العمليات
app.get('/api/audit-logs', authenticateToken, checkPermission(2), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const [logs] = await pool.query(
      `SELECT al.*, u.full_name as user_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );
    
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM audit_logs'
    );
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// ================================================
// ERROR HANDLING
// ================================================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'حدث خطأ في الخادم' });
});

// ================================================
// STATIC FILES & HTML ROUTES
// ================================================

// تقديم الملفات الثابتة (HTML, CSS, JS)
app.use(express.static('public'));

// Route للصفحة الرئيسية
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route لصفحة تسجيل الدخول
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route للوحة التحكم
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Route لإدارة النظام
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Route للمراسلات
app.get('/correspondences', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'inbox.html'));
});

// Route لإنشاء مراسلة جديدة
app.get('/new-correspondence', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'new-correspondence.html'));
});

// Route لتفاصيل المراسلة
app.get('/correspondence/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'correspondence-details.html'));
});

// Route للأرشيف
app.get('/archive', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'archive.html'));
});

// Route للتقارير
app.get('/reports', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reports.html'));
});

// Route لسجل التوقيعات
app.get('/signatures', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signatures-log.html'));
});

// Route لإعدادات الحساب
app.get('/account-settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account-settings.html'));
});

// ================================================
// CORRESPONDENCE WORKFLOW & SIGNATURE APIS
// ================================================

// Get correspondence workflow stages
app.get('/api/correspondences/:id/workflow', authenticateToken, async (req, res) => {
  try {
    const [stages] = await pool.query(
      `SELECT ws.*, u.full_name as user_name, us.signature_data
       FROM workflow_stages ws
       LEFT JOIN users u ON ws.assigned_to = u.id
       LEFT JOIN user_signatures us ON ws.assigned_to = us.user_id
       WHERE ws.correspondence_id = ?
       ORDER BY ws.stage_order ASC`,
      [req.params.id]
    );
    
    res.json({ success: true, data: stages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل تحميل مراحل العمل' });
  }
});

// Get correspondence attachments
app.get('/api/correspondences/:id/attachments', authenticateToken, async (req, res) => {
  try {
    const [attachments] = await pool.query(
      'SELECT * FROM correspondence_attachments WHERE correspondence_id = ?',
      [req.params.id]
    );
    
    res.json({ success: true, data: attachments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل تحميل المرفقات' });
  }
});

// Sign correspondence (approve/reject current stage)
app.post('/api/correspondences/:id/sign', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { decision, notes, signature_data } = req.body;
  
  try {
    // Get current workflow stage for this user
    const [stages] = await pool.query(
      `SELECT * FROM workflow_stages 
       WHERE correspondence_id = ? AND assigned_to = ? AND status = 'pending'
       ORDER BY stage_order ASC LIMIT 1`,
      [id, req.user.id]
    );
    
    if (stages.length === 0) {
      return res.status(403).json({ error: 'ليس لديك صلاحية التوقيع على هذه المراسلة' });
    }
    
    const currentStage = stages[0];
    
    // Update current stage (only status, notes, decision - no signature_data in workflow_stages)
    await pool.query(
      `UPDATE workflow_stages 
       SET status = 'approved', completed_at = NOW(), 
           notes = ?, decision = ?
       WHERE id = ?`,
      [notes, decision, currentStage.id]
    );
    
    // Get next stage
    const [nextStages] = await pool.query(
      `SELECT * FROM workflow_stages 
       WHERE correspondence_id = ? AND stage_order > ?
       ORDER BY stage_order ASC LIMIT 1`,
      [id, currentStage.stage_order]
    );
    
    if (nextStages.length > 0) {
      // Activate next stage
      await pool.query(
        'UPDATE workflow_stages SET status = ? WHERE id = ?',
        ['pending', nextStages[0].id]
      );
      
      // Update correspondence handler
      await pool.query(
        'UPDATE correspondences SET current_handler_id = ? WHERE id = ?',
        [nextStages[0].assigned_to, id]
      );
      
      // Create notification for next handler
      await createNotification(
        nextStages[0].assigned_to,
        'approval_needed',
        'مراسلة تنتظر اعتمادك',
        `لديك مراسلة جديدة تنتظر الاعتماد`,
        id,
        'correspondence'
      );
    } else {
      // This was the last stage - mark correspondence as completed
      const finalStatus = decision === 'مرفوض' ? 'rejected' : 'approved';
      await pool.query(
        'UPDATE correspondences SET status = ?, updated_at = NOW() WHERE id = ?',
        [finalStatus, id]
      );
      
      // If approved and has CC recipients, send notifications
      if (finalStatus === 'approved') {
        const [ccList] = await pool.query(
          'SELECT * FROM correspondence_cc WHERE correspondence_id = ?',
          [id]
        );
        
        for (const cc of ccList) {
          if (cc.recipient_type === 'user' && cc.recipient_id) {
            await createNotification(
              cc.recipient_id,
              'new_correspondence',
              'نسخة من مراسلة',
              'تم إرسال نسخة من مراسلة إليك',
              id,
              'correspondence'
            );
          }
        }
      }
    }
    
    await logAudit(req.user.id, 'SIGN', 'correspondences', id, { decision, notes });
    
    // Clear cache
    cache.clear();
    
    res.json({ 
      success: true, 
      message: 'تم التوقيع والاعتماد بنجاح',
      decision 
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل التوقيع: ' + error.message });
  }
});

// Get single correspondence with full details
app.get('/api/correspondences/:id', authenticateToken, async (req, res) => {
  try {
    const [correspondences] = await pool.query(
      `SELECT c.*, 
              sender.full_name as sender_name,
              receiver.full_name as receiver_name,
              handler.full_name as handler_name
       FROM correspondences c
       LEFT JOIN users sender ON c.sender_id = sender.id
       LEFT JOIN users receiver ON c.receiver_id = receiver.id
       LEFT JOIN users handler ON c.current_handler_id = handler.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    
    if (correspondences.length === 0) {
      return res.status(404).json({ error: 'المراسلة غير موجودة' });
    }
    
    // Get CC list
    const [ccList] = await pool.query(
      'SELECT * FROM correspondence_cc WHERE correspondence_id = ?',
      [req.params.id]
    );
    
    correspondences[0].cc_list = ccList;
    
    res.json({ success: true, data: correspondences[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل تحميل المراسلة' });
  }
});

// ================================================
// START SERVER
// ================================================

module.exports = app;

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log("🚀 Server running on", PORT));
