// server.js (FIXED)
// Node.js + Express + MySQL2 + JWT + Multer

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fss = require('fs');
const fs = require('fs').promises;

const app = express();
app.set('trust proxy', 1); // مهم للـ IP الحقيقي خلف Render/Proxy

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION';

// ================================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ================================================

// Ensure upload directories exist
const uploadDirs = ['uploads', 'uploads/correspondences', 'uploads/templates'];
for (const dir of uploadDirs) {
  if (!fss.existsSync(dir)) fss.mkdirSync(dir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/correspondences/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter (تحقق امتداد + mimetype بشكل صحيح)
const fileFilter = (req, file, cb) => {
  const allowedExt = new Set(['.doc', '.docx', '.pdf', '.jpg', '.jpeg', '.png']);
  const ext = path.extname(file.originalname).toLowerCase();

  // بعض الـ mimetypes تكون طويلة، نخليها لوجيك بسيط
  const allowedMime = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ];

  const okExt = allowedExt.has(ext);
  const okMime = allowedMime.includes(file.mimetype);

  if (okExt && okMime) return cb(null, true);
  return cb(new Error('نوع الملف غير مدعوم. الأنواع المسموحة: DOC, DOCX, PDF, JPG, PNG'));
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter
});

// ================================================
// Middleware
// ================================================
app.use(cors({
  origin: '*',
  credentials: false
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/uploads', express.static('uploads'));

// ================================================
// Rate Limiting (Simple)
// ================================================
const rateLimitMap = new Map();

function rateLimit(maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();

    const list = rateLimitMap.get(ip) || [];
    const recent = list.filter((t) => now - t < windowMs);

    if (recent.length >= maxRequests) {
      return res.status(429).json({
        error: 'تم تجاوز الحد المسموح من الطلبات. حاول مرة أخرى لاحقاً',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    recent.push(now);
    rateLimitMap.set(ip, recent);

    // تنظيف عشوائي
    if (Math.random() < 0.01) {
      for (const [key, value] of rateLimitMap.entries()) {
        const keep = value.filter((t) => now - t < windowMs);
        if (keep.length === 0) rateLimitMap.delete(key);
        else rateLimitMap.set(key, keep);
      }
    }

    next();
  };
}

app.use('/api/', rateLimit(200, 60000));

// ================================================
// Database connection pool
// ================================================
console.log('✅ MYSQL_URL exists?', !!process.env.MYSQL_URL);

const pool = mysql.createPool({
  uri: process.env.MYSQL_URL,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 10000,
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT 1')
  .then(() => console.log('✅ DB Connected'))
  .catch((e) => console.error('❌ DB connect error:', e?.code, e?.message));

// ================================================
// HELPERS
// ================================================
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

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
  cache.set(key, { data, timestamp: Date.now() });
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

function clearCache(pattern) {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}

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

function toRelativeUploadPath(absOrMulterPath) {
  // multer يعطيك: uploads/correspondences/xxx.ext
  // نخزن: correspondences/xxx.ext
  return String(absOrMulterPath).replace(/^uploads[\/\\]/, '');
}

function toFullUploadPath(relativePath) {
  // relative: correspondences/xxx.ext
  // full: <project>/uploads/correspondences/xxx.ext
  if (!relativePath) return null;
  const rel = String(relativePath).replace(/^uploads[\/\\]/, '');
  return path.join(__dirname, 'uploads', rel);
}

// ================================================
// AUTH MIDDLEWARE
// ================================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const parts = authHeader.split(' ');
  const token = (parts.length === 2 && /^Bearer$/i.test(parts[0])) ? parts[1] : null;

  if (!token) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'رمز غير صالح' });
    req.user = user;
    next();
  });
}

function checkPermission(requiredLevel) {
  return (req, res, next) => {
    if (req.user.level > requiredLevel) return res.status(403).json({ error: 'غير مصرح لك' });
    next();
  };
}

// ================================================
// AUTH ROUTES
// ================================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const [users] = await pool.query(
      `SELECT id, username, password_hash, full_name, role_id, is_active
       FROM users
       WHERE username = ? AND is_active = 1
       LIMIT 1`,
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'خطأ في اسم المستخدم أو كلمة المرور' });
    }

    const user = users[0];

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'خطأ في اسم المستخدم أو كلمة المرور' });
    }

    // سجل آخر دخول (اختياري)
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, role_id: user.role_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    delete user.password_hash;
    return res.json({ success: true, token, user });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Login failed',
      code: error.code || null,
      details: error.message || String(error)
    });
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

    users.forEach((u) => delete u.password_hash);
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

    if (users.length === 0) return res.status(404).json({ error: 'غير موجود' });

    delete users[0].password_hash;
    res.json({ success: true, data: users[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.post('/api/users', authenticateToken, checkPermission(2), async (req, res) => {
  try {
    const { username, password, full_name, email, phone, role_id, department_id, division_id, school_id } = req.body;

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users
       (username, password_hash, full_name, email, phone, role_id, department_id, division_id, school_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, password_hash, full_name, email, phone, role_id, department_id, division_id, school_id, req.user.id]
    );

    await logAudit(req.user.id, 'CREATE', 'users', result.insertId, { username, full_name });

    clearCache('users');
    clearCache('roles');
    clearCache('departments');
    clearCache('divisions');

    res.json({ success: true, message: 'تم إنشاء المستخدم بنجاح', data: { id: result.insertId } });
  } catch (error) {
    console.error(error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' });
    res.status(500).json({ error: 'فشل الإنشاء' });
  }
});

app.put('/api/users/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { full_name, email, phone, role_id, department_id, division_id, school_id } = req.body;

  if (req.user.id != userId && req.user.level > 2) return res.status(403).json({ error: 'غير مصرح لك' });

  try {
    if (req.user.level <= 2 && (role_id !== undefined || department_id !== undefined || division_id !== undefined || school_id !== undefined)) {
      await pool.query(
        `UPDATE users
         SET full_name = ?, email = ?, phone = ?, role_id = ?, department_id = ?, division_id = ?, school_id = ?
         WHERE id = ?`,
        [full_name, email, phone, role_id, department_id, division_id, school_id, userId]
      );
    } else {
      await pool.query('UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?', [full_name, email, phone, userId]);
    }

    const [updatedUser] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);

    await logAudit(req.user.id, 'UPDATE', 'users', userId, { full_name, email });

    res.json({ success: true, message: 'تم تحديث البيانات بنجاح', data: updatedUser[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل التحديث: ' + error.message });
  }
});

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
app.get('/api/users/:id/signature', authenticateToken, async (req, res) => {
  try {
    const [signatures] = await pool.query(
      'SELECT * FROM user_signatures WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.params.id]
    );

    res.json({ success: true, data: signatures.length ? signatures[0] : null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.post('/api/users/:id/signature', authenticateToken, async (req, res) => {
  try {
    const { signature_data } = req.body;

    const [existing] = await pool.query('SELECT id FROM user_signatures WHERE user_id = ?', [req.params.id]);

    if (existing.length > 0) {
      await pool.query(
        'UPDATE user_signatures SET signature_data = ?, updated_at = NOW() WHERE user_id = ?',
        [signature_data, req.params.id]
      );
    } else {
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

  if (req.user.id != userId) return res.status(403).json({ error: 'غير مصرح لك' });

  try {
    const [users] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ error: 'المستخدم غير موجود' });

    const match = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!match) return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, userId]);

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
    const cached = getCache('departments');
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const [departments] = await pool.query(
      `SELECT d.*, u.full_name as manager_name,
              (SELECT COUNT(*) FROM divisions WHERE department_id = d.id) as divisions_count,
              (SELECT COUNT(*) FROM users WHERE department_id = d.id) as users_count
       FROM departments d
       LEFT JOIN users u ON d.manager_id = u.id
       WHERE d.is_active = 1`
    );

    setCache('departments', departments);
    res.json({ success: true, data: departments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.post('/api/departments', authenticateToken, checkPermission(2), async (req, res) => {
  try {
    const { dept_code, dept_name, description, manager_id, color_code } = req.body;

    const [result] = await pool.query(
      `INSERT INTO departments (dept_code, dept_name, description, manager_id, color_code, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dept_code, dept_name, description, manager_id, color_code || '#2563eb', req.user.id]
    );

    await logAudit(req.user.id, 'CREATE', 'departments', result.insertId, { dept_name });
    clearCache('departments');

    res.json({ success: true, message: 'تم إنشاء القسم بنجاح', data: { id: result.insertId } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل الإنشاء' });
  }
});

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
    clearCache('departments');

    res.json({ success: true, message: 'تم تحديث القسم بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل التحديث' });
  }
});

app.delete('/api/departments/:id', authenticateToken, checkPermission(1), async (req, res) => {
  try {
    await pool.query('UPDATE departments SET is_active = 0 WHERE id = ?', [req.params.id]);
    await logAudit(req.user.id, 'DELETE', 'departments', req.params.id);
    clearCache('departments');
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
    const cached = getCache('divisions');
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const [divisions] = await pool.query(
      `SELECT dvs.*, d.dept_name, u.full_name as manager_name,
              (SELECT COUNT(*) FROM users WHERE division_id = dvs.id) as users_count
       FROM divisions dvs
       LEFT JOIN departments d ON dvs.department_id = d.id
       LEFT JOIN users u ON dvs.manager_id = u.id
       WHERE dvs.is_active = 1`
    );

    setCache('divisions', divisions);
    res.json({ success: true, data: divisions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.post('/api/divisions', authenticateToken, checkPermission(2), async (req, res) => {
  try {
    const { div_code, div_name, department_id, description, manager_id, color_code } = req.body;

    const [result] = await pool.query(
      `INSERT INTO divisions (div_code, div_name, department_id, description, manager_id, color_code, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [div_code, div_name, department_id, description, manager_id, color_code || '#10b981', req.user.id]
    );

    await logAudit(req.user.id, 'CREATE', 'divisions', result.insertId, { div_name });
    clearCache('divisions');

    res.json({ success: true, message: 'تم إنشاء الشعبة بنجاح', data: { id: result.insertId } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل الإنشاء' });
  }
});

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
    clearCache('divisions');

    res.json({ success: true, message: 'تم تحديث الشعبة بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل التحديث' });
  }
});

app.delete('/api/divisions/:id', authenticateToken, checkPermission(1), async (req, res) => {
  try {
    await pool.query('UPDATE divisions SET is_active = 0 WHERE id = ?', [req.params.id]);
    await logAudit(req.user.id, 'DELETE', 'divisions', req.params.id);
    clearCache('divisions');
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
    const cached = getCache('roles');
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const [roles] = await pool.query(
      `SELECT r.*, (SELECT COUNT(*) FROM users WHERE role_id = r.id) as users_count
       FROM roles r
       ORDER BY r.level`
    );

    setCache('roles', roles);
    res.json({ success: true, data: roles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.put('/api/roles/:id', authenticateToken, checkPermission(1), async (req, res) => {
  try {
    const { permissions } = req.body;

    await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(permissions), req.params.id]);
    await logAudit(req.user.id, 'UPDATE', 'roles', req.params.id, { permissions });

    clearCache('roles');
    res.json({ success: true, message: 'تم تحديث الصلاحيات بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل التحديث' });
  }
});

// ================================================
// WORKFLOW HELPER
// ================================================
async function createWorkflowStages(correspondenceId, senderId, divisionId, departmentId, finalRecipientId) {
  try {
    const stages = [];
    let order = 1;

    if (divisionId) {
      const [divManager] = await pool.query('SELECT manager_id FROM divisions WHERE id = ?', [divisionId]);
      if (divManager.length > 0 && divManager[0].manager_id && divManager[0].manager_id !== senderId) {
        stages.push({
          correspondence_id: correspondenceId,
          stage_name: 'اعتماد الشعبة',
          stage_order: order++,
          assigned_to: divManager[0].manager_id,
          status: 'pending',
          requires_signature: false
        });
      }
    }

    if (departmentId) {
      const [deptManager] = await pool.query('SELECT manager_id FROM departments WHERE id = ?', [departmentId]);
      if (deptManager.length > 0 && deptManager[0].manager_id && deptManager[0].manager_id !== senderId) {
        stages.push({
          correspondence_id: correspondenceId,
          stage_name: 'اعتماد القسم',
          stage_order: order++,
          assigned_to: deptManager[0].manager_id,
          status: stages.length === 0 ? 'pending' : 'waiting',
          requires_signature: false
        });
      }
    }

    if (finalRecipientId && finalRecipientId !== senderId) {
      stages.push({
        correspondence_id: correspondenceId,
        stage_name: 'التوقيع النهائي',
        stage_order: order++,
        assigned_to: finalRecipientId,
        status: stages.length === 0 ? 'pending' : 'waiting',
        requires_signature: true
      });
    }

    for (const stage of stages) {
      await pool.query(
        `INSERT INTO workflow_stages
         (correspondence_id, stage_name, stage_order, assigned_to, status, requires_signature)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [stage.correspondence_id, stage.stage_name, stage.stage_order, stage.assigned_to, stage.status, !!stage.requires_signature]
      );
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

// جلب جميع المراسلات + pagination + count صحيح
app.get('/api/correspondences', authenticateToken, async (req, res) => {
  try {
    const { status, priority, sender_id, receiver_id, search } = req.query;
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');
    const offset = (page - 1) * limit;

    const where = ['1=1'];
    const params = [];

    if (status) { where.push('c.status = ?'); params.push(status); }
    if (priority) { where.push('c.priority = ?'); params.push(priority); }
    if (sender_id) { where.push('c.sender_id = ?'); params.push(sender_id); }
    if (receiver_id) { where.push('c.receiver_id = ?'); params.push(receiver_id); }

    if (search) {
      where.push('(c.corr_number LIKE ? OR c.subject LIKE ? OR c.content LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    // صلاحيات المستخدم
    if (req.user.level > 2) {
      where.push('(c.sender_id = ? OR c.receiver_id = ? OR c.current_handler_id = ?)');
      params.push(req.user.id, req.user.id, req.user.id);
    }

    const baseWhereSql = where.join(' AND ');

    const dataSql = `
      SELECT c.*,
             sender.full_name as sender_name,
             receiver.full_name as receiver_name,
             handler.full_name as handler_name,
             (SELECT COUNT(*) FROM correspondence_attachments WHERE correspondence_id = c.id) as attachments_count
      FROM correspondences c
      LEFT JOIN users sender ON c.sender_id = sender.id
      LEFT JOIN users receiver ON c.receiver_id = receiver.id
      LEFT JOIN users handler ON c.current_handler_id = handler.id
      WHERE ${baseWhereSql}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [correspondences] = await pool.query(dataSql, [...params, limit, offset]);

    const countSql = `SELECT COUNT(*) as total FROM correspondences c WHERE ${baseWhereSql}`;
    const [countRows] = await pool.query(countSql, params);

    res.json({
      success: true,
      data: correspondences,
      pagination: {
        page,
        limit,
        total: countRows[0]?.total || 0,
        pages: Math.ceil((countRows[0]?.total || 0) / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// ✅ Route واحد فقط لتفاصيل المراسلة (حل مشكلة التكرار)
app.get('/api/correspondences/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;

    const [rows] = await pool.query(
      `SELECT c.*,
              sender.full_name as sender_name,
              receiver.full_name as receiver_name,
              handler.full_name as handler_name
       FROM correspondences c
       LEFT JOIN users sender ON c.sender_id = sender.id
       LEFT JOIN users receiver ON c.receiver_id = receiver.id
       LEFT JOIN users handler ON c.current_handler_id = handler.id
       WHERE c.id = ?`,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'المراسلة غير موجودة' });

    const [attachments] = await pool.query(
      'SELECT * FROM correspondence_attachments WHERE correspondence_id = ?',
      [id]
    );

    const [signatures] = await pool.query(
      `SELECT cs.*, u.full_name as signer_name, r.role_name_ar
       FROM correspondence_signatures cs
       LEFT JOIN users u ON cs.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE cs.correspondence_id = ?
       ORDER BY cs.signed_at ASC`,
      [id]
    );

    const [comments] = await pool.query(
      `SELECT com.*, u.full_name as commenter_name
       FROM comments com
       LEFT JOIN users u ON com.user_id = u.id
       WHERE com.correspondence_id = ?
       ORDER BY com.created_at DESC`,
      [id]
    );

    const [ccList] = await pool.query(
      'SELECT * FROM correspondence_cc WHERE correspondence_id = ?',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...rows[0],
        attachments,
        signatures,
        comments,
        cc_list: ccList
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// إنشاء مراسلة جديدة (رفع ملف اختياري)
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
      const [lastCorr] = await pool.query('SELECT corr_number FROM correspondences ORDER BY id DESC LIMIT 1');

      let nextNumber = 1;
      if (lastCorr.length > 0 && lastCorr[0].corr_number) {
        const parts = String(lastCorr[0].corr_number).split('/');
        if (parts.length > 0 && !isNaN(parseInt(parts[0]))) nextNumber = parseInt(parts[0]) + 1;
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
      const relativePath = toRelativeUploadPath(req.file.path);

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
    if (cc && (Array.isArray(cc) ? cc.length : true)) {
      const ccArray = Array.isArray(cc) ? cc : [cc];
      for (const recipient of ccArray) {
        await pool.query(
          `INSERT INTO correspondence_cc (correspondence_id, recipient_type, recipient_id, recipient_name)
           VALUES (?, ?, ?, ?)`,
          [correspondenceId, 'custom', null, recipient]
        );
      }
    }

    await createWorkflowStages(correspondenceId, req.user.id, sender_division_id, sender_department_id, recipient_id);

    await logAudit(req.user.id, 'CREATE', 'correspondences', correspondenceId, { subject });
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

    const [corr] = await pool.query('SELECT sender_id, status FROM correspondences WHERE id = ?', [id]);
    if (corr.length === 0) return res.status(404).json({ error: 'المراسلة غير موجودة' });

    if (corr[0].sender_id !== req.user.id && req.user.level > 2) return res.status(403).json({ error: 'غير مصرح لك' });
    if (corr[0].status !== 'draft') return res.status(400).json({ error: 'لا يمكن تعديل مراسلة تم إرسالها' });

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

    const [corr] = await pool.query('SELECT sender_id, corr_number FROM correspondences WHERE id = ?', [id]);
    if (corr.length === 0) return res.status(404).json({ error: 'المراسلة غير موجودة' });

    // حذف المرفقات من القرص
    const [attachments] = await pool.query(
      'SELECT file_path FROM correspondence_attachments WHERE correspondence_id = ?',
      [id]
    );

    for (const att of attachments) {
      try {
        const fullPath = toFullUploadPath(att.file_path);
        if (fullPath) await fs.unlink(fullPath);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }

    // حذف من قاعدة البيانات (إذا عندك ON DELETE CASCADE تقدر تشيل هذني)
    await pool.query('DELETE FROM correspondence_attachments WHERE correspondence_id = ?', [id]);
    await pool.query('DELETE FROM correspondence_cc WHERE correspondence_id = ?', [id]);
    await pool.query('DELETE FROM comments WHERE correspondence_id = ?', [id]);
    await pool.query('DELETE FROM workflow_stages WHERE correspondence_id = ?', [id]);

    await pool.query('DELETE FROM correspondences WHERE id = ?', [id]);

    await logAudit(req.user.id, 'DELETE', 'correspondences', id, { corr_number: corr[0].corr_number });
    cache.clear();

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
    cache.clear();

    res.json({ success: true, message: 'تم أرشفة المراسلة بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل الأرشفة' });
  }
});

// ================================================
// ATTACHMENTS ROUTES (موحّدة على correspondence_attachments)
// ================================================

// رفع مرفق
app.post('/api/correspondences/:id/attachments', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع أي ملف' });

    const { id } = req.params;
    const relativePath = toRelativeUploadPath(req.file.path);

    const [result] = await pool.query(
      `INSERT INTO correspondence_attachments
       (correspondence_id, file_name, file_type, file_size, file_path, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.file.originalname, req.file.mimetype, req.file.size, relativePath, req.user.id]
    );

    await logAudit(req.user.id, 'UPLOAD', 'correspondence_attachments', result.insertId, {
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
      'SELECT file_path, correspondence_id FROM correspondence_attachments WHERE id = ?',
      [id]
    );

    if (attachments.length === 0) return res.status(404).json({ error: 'المرفق غير موجود' });

    try {
      const fullPath = toFullUploadPath(attachments[0].file_path);
      if (fullPath) await fs.unlink(fullPath);
    } catch (err) {
      console.error('Error deleting file:', err);
    }

    await pool.query('DELETE FROM correspondence_attachments WHERE id = ?', [id]);

    await logAudit(req.user.id, 'DELETE', 'correspondence_attachments', id, {
      correspondence_id: attachments[0].correspondence_id
    });

    cache.clear();
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
      'SELECT file_path, file_name FROM correspondence_attachments WHERE id = ?',
      [id]
    );

    if (attachments.length === 0) return res.status(404).json({ error: 'المرفق غير موجود' });

    const fullPath = toFullUploadPath(attachments[0].file_path);
    return res.download(fullPath, attachments[0].file_name);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل التحميل' });
  }
});

// جلب مرفقات مراسلة
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

// ================================================
// SIGNATURES ROUTES
// ================================================
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

    res.json({ success: true, message: 'تم إضافة التعليق بنجاح', data: { id: result.insertId } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل إضافة التعليق' });
  }
});

app.get('/api/correspondences/:id/comments', authenticateToken, async (req, res) => {
  try {
    const [comments] = await pool.query(
      `SELECT c.*, u.full_name as commenter_name, r.role_name_ar
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
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

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'تم التحديث' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, message: 'تم تحديث جميع الإشعارات' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// ================================================
// TEMPLATES ROUTES
// ================================================
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

app.get('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    const [templates] = await pool.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (templates.length === 0) return res.status(404).json({ error: 'القالب غير موجود' });
    res.json({ success: true, data: templates[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// ================================================
// STATISTICS ROUTES
// ================================================
app.get('/api/statistics', authenticateToken, async (req, res) => {
  try {
    const [totalCorr] = await pool.query('SELECT COUNT(*) as total FROM correspondences');
    const [statusCounts] = await pool.query('SELECT status, COUNT(*) as count FROM correspondences GROUP BY status');
    const [priorityCounts] = await pool.query('SELECT priority, COUNT(*) as count FROM correspondences GROUP BY priority');
    const [todayCorr] = await pool.query('SELECT COUNT(*) as count FROM correspondences WHERE DATE(created_at) = CURDATE()');
    const [monthCorr] = await pool.query(
      `SELECT COUNT(*) as count FROM correspondences
       WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())`
    );
    const [overdueCorr] = await pool.query(
      `SELECT COUNT(*) as count FROM correspondences
       WHERE due_date < CURDATE() AND status NOT IN ('approved', 'rejected', 'archived')`
    );
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

app.get('/api/statistics/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.id != userId && req.user.level > 2) return res.status(403).json({ error: 'غير مصرح لك' });

    const [sent] = await pool.query('SELECT COUNT(*) as count FROM correspondences WHERE sender_id = ?', [userId]);
    const [received] = await pool.query('SELECT COUNT(*) as count FROM correspondences WHERE receiver_id = ?', [userId]);
    const [signatures] = await pool.query('SELECT COUNT(*) as count FROM correspondence_signatures WHERE user_id = ?', [userId]);

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
app.get('/api/audit-logs', authenticateToken, checkPermission(2), async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '50');
    const offset = (page - 1) * limit;

    const [logs] = await pool.query(
      `SELECT al.*, u.full_name as user_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM audit_logs');

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
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
// CORRESPONDENCE WORKFLOW & SIGNATURE APIS
// ================================================

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

// ✅ توقيع (approve / reject) - مصحّح
app.post('/api/correspondences/:id/sign', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { decision, notes } = req.body;

  try {
    const [stages] = await pool.query(
      `SELECT * FROM workflow_stages
       WHERE correspondence_id = ? AND assigned_to = ? AND status = 'pending'
       ORDER BY stage_order ASC LIMIT 1`,
      [id, req.user.id]
    );

    if (stages.length === 0) return res.status(403).json({ error: 'ليس لديك صلاحية التوقيع على هذه المراسلة' });

    const currentStage = stages[0];
    const stageStatus = (decision === 'مرفوض') ? 'rejected' : 'approved';

    await pool.query(
      `UPDATE workflow_stages
       SET status = ?, completed_at = NOW(), notes = ?, decision = ?
       WHERE id = ?`,
      [stageStatus, notes, decision, currentStage.id]
    );

    // إذا مرفوض: ننهي مباشرة
    if (decision === 'مرفوض') {
      await pool.query('UPDATE correspondences SET status = ?, updated_at = NOW() WHERE id = ?', ['rejected', id]);
      await logAudit(req.user.id, 'SIGN', 'correspondences', id, { decision, notes });
      cache.clear();
      return res.json({ success: true, message: 'تم رفض المراسلة', decision });
    }

    // Get next stage
    const [nextStages] = await pool.query(
      `SELECT * FROM workflow_stages
       WHERE correspondence_id = ? AND stage_order > ?
       ORDER BY stage_order ASC LIMIT 1`,
      [id, currentStage.stage_order]
    );

    if (nextStages.length > 0) {
      await pool.query('UPDATE workflow_stages SET status = ? WHERE id = ?', ['pending', nextStages[0].id]);
      await pool.query('UPDATE correspondences SET current_handler_id = ?, updated_at = NOW() WHERE id = ?', [nextStages[0].assigned_to, id]);

      await createNotification(
        nextStages[0].assigned_to,
        'approval_needed',
        'مراسلة تنتظر اعتمادك',
        'لديك مراسلة جديدة تنتظر الاعتماد',
        id,
        'correspondence'
      );
    } else {
      // last stage
      await pool.query('UPDATE correspondences SET status = ?, updated_at = NOW() WHERE id = ?', ['approved', id]);

      // notify CC users (لو عندك recipient_type = user)
      const [ccList] = await pool.query('SELECT * FROM correspondence_cc WHERE correspondence_id = ?', [id]);
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

    await logAudit(req.user.id, 'SIGN', 'correspondences', id, { decision, notes });
    cache.clear();

    res.json({ success: true, message: 'تم التوقيع والاعتماد بنجاح', decision });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل التوقيع: ' + error.message });
  }
});

// ================================================
// STATIC FILES & HTML ROUTES
// ================================================
app.use(express.static('public'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/correspondences', (req, res) => res.sendFile(path.join(__dirname, 'public', 'inbox.html')));
app.get('/new-correspondence', (req, res) => res.sendFile(path.join(__dirname, 'public', 'new-correspondence.html')));
app.get('/correspondence/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'correspondence-details.html')));
app.get('/archive', (req, res) => res.sendFile(path.join(__dirname, 'public', 'archive.html')));
app.get('/reports', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reports.html')));
app.get('/signatures', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signatures-log.html')));
app.get('/account-settings', (req, res) => res.sendFile(path.join(__dirname, 'public', 'account-settings.html')));

// ================================================
// ERROR HANDLING (لازم يكون آخر شي)
// ================================================
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'حدث خطأ في الخادم' });
});

// ================================================
// START SERVER
// ================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log('🚀 Server running on', PORT));

module.exports = app;
