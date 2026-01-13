// ==============================================
// Admin Panel - Complete JavaScript
// ==============================================

const API_URL = 'http://localhost:5000/api';
const token = localStorage.getItem('token');

if (!token) {
    window.location.href = 'login.html';
}

// Global data
let allUsers = [];
let allDepts = [];
let allDivs = [];
let allSchools = [];
let allRoles = [];
let currentEditId = null;

// ==============================================
// INITIALIZATION
// ==============================================

window.addEventListener('load', async () => {
    await loadAllData();
});

async function loadAllData() {
    await Promise.all([
        loadUsers(),
        loadDepartments(),
        loadDivisions(),
        loadSchools(),
        loadRoles()
    ]);
}

// ==============================================
// USERS
// ==============================================

async function loadUsers() {
    try {
        const res = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            allUsers = data.data || [];
            document.getElementById('totalUsers').textContent = allUsers.length;
            displayUsers(allUsers);
            fillManagerSelects();
        } else {
            throw new Error('فشل تحميل المستخدمين');
        }
    } catch (e) {
        console.error(e);
        document.getElementById('usersTableBody').innerHTML = 
            '<tr><td colspan="8" class="empty-state" style="color: #ef4444;">فشل تحميل البيانات</td></tr>';
        showAlert('فشل تحميل المستخدمين', 'error');
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">لا يوجد مستخدمين</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(u => `
        <tr>
            <td>${u.id}</td>
            <td><strong>${u.full_name}</strong></td>
            <td>${u.username}</td>
            <td>${u.email || '-'}</td>
            <td><span class="badge badge-info">${u.role_name_ar || '-'}</span></td>
            <td>${u.dept_name || u.div_name || u.school_name || '-'}</td>
            <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">
                ${u.is_active ? 'نشط' : 'معطل'}
            </span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-warning btn-sm" onclick='editUser(${JSON.stringify(u).replace(/'/g, "&apos;")})'>
                        تعديل
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${u.full_name.replace(/'/g, "\\'")}')">
                        حذف
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openAddUserModal() {
    document.getElementById('userModalTitle').textContent = 'إضافة مستخدم جديد';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('passwordGroup').querySelector('input').required = true;
    document.getElementById('passwordGroup').querySelector('label').innerHTML = 'كلمة المرور *';
    currentEditId = null;
    openModal('userModal');
}

function editUser(user) {
    document.getElementById('userModalTitle').textContent = 'تعديل المستخدم';
    document.getElementById('userId').value = user.id;
    document.querySelector('[name="full_name"]').value = user.full_name;
    document.querySelector('[name="username"]').value = user.username;
    document.querySelector('[name="email"]').value = user.email || '';
    document.querySelector('[name="phone"]').value = user.phone || '';
    document.querySelector('[name="role_id"]').value = user.role_id || '';
    document.querySelector('[name="department_id"]').value = user.department_id || '';
    document.querySelector('[name="division_id"]').value = user.division_id || '';
    document.querySelector('[name="school_id"]').value = user.school_id || '';
    
    // كلمة المرور اختيارية عند التعديل
    document.getElementById('passwordGroup').querySelector('input').required = false;
    document.getElementById('passwordGroup').querySelector('label').innerHTML = 'كلمة المرور (اتركها فارغة إذا لم تُرد تغييرها)';
    
    currentEditId = user.id;
    openModal('userModal');
}

async function saveUser(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    formData.forEach((value, key) => {
        if (key !== 'id' && key !== 'password') {
            data[key] = value === '' ? null : value;
        } else if (key === 'password' && value) {
            data[key] = value;
        }
    });
    
    const id = document.getElementById('userId').value;
    const url = id ? `${API_URL}/users/${id}` : `${API_URL}/users`;
    const method = id ? 'PUT' : 'POST';
    
    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (res.ok) {
            showAlert(id ? 'تم تحديث المستخدم بنجاح' : 'تم إضافة المستخدم بنجاح', 'success');
            closeModal('userModal');
            await loadUsers();
        } else {
            showAlert(result.error || 'فشلت العملية', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('فشل الاتصال بالخادم', 'error');
    }
}

async function deleteUser(id, name) {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${name}"؟\nهذا الإجراء سيعطل المستخدم فقط.`)) return;
    
    try {
        const res = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await res.json();
        
        if (res.ok) {
            showAlert('تم حذف المستخدم بنجاح', 'success');
            await loadUsers();
        } else {
            showAlert(result.error || 'فشل الحذف', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('فشل الاتصال بالخادم', 'error');
    }
}

// ==============================================
// DEPARTMENTS
// ==============================================

async function loadDepartments() {
    try {
        const res = await fetch(`${API_URL}/departments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            allDepts = data.data || [];
            document.getElementById('totalDepts').textContent = allDepts.length;
            displayDepartments(allDepts);
            fillDeptSelects();
        }
    } catch (e) {
        console.error(e);
        showAlert('فشل تحميل الأقسام', 'error');
    }
}

function displayDepartments(depts) {
    const tbody = document.getElementById('deptsTableBody');
    
    if (!depts.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا يوجد أقسام</td></tr>';
        return;
    }
    
    tbody.innerHTML = depts.map(d => `
        <tr>
            <td>${d.id}</td>
            <td><strong>${d.dept_name}</strong></td>
            <td>${d.dept_code}</td>
            <td>${d.manager_name || '-'}</td>
            <td>${d.divisions_count || 0}</td>
            <td>${d.users_count || 0}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-warning btn-sm" onclick='editDept(${JSON.stringify(d).replace(/'/g, "&apos;")})'>
                        تعديل
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteDept(${d.id}, '${d.dept_name.replace(/'/g, "\\'")}')">
                        حذف
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openAddDeptModal() {
    document.getElementById('deptModalTitle').textContent = 'إضافة قسم جديد';
    document.getElementById('deptForm').reset();
    document.getElementById('deptId').value = '';
    openModal('deptModal');
}

function editDept(dept) {
    document.getElementById('deptModalTitle').textContent = 'تعديل القسم';
    document.getElementById('deptId').value = dept.id;
    document.querySelector('#deptForm [name="dept_name"]').value = dept.dept_name;
    document.querySelector('#deptForm [name="dept_code"]').value = dept.dept_code;
    document.querySelector('#deptForm [name="description"]').value = dept.description || '';
    document.querySelector('#deptForm [name="manager_id"]').value = dept.manager_id || '';
    openModal('deptModal');
}

async function saveDept(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    formData.forEach((value, key) => {
        if (key !== 'id') {
            data[key] = value === '' ? null : value;
        }
    });
    
    const id = document.getElementById('deptId').value;
    const url = id ? `${API_URL}/departments/${id}` : `${API_URL}/departments`;
    const method = id ? 'PUT' : 'POST';
    
    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (res.ok) {
            showAlert(id ? 'تم تحديث القسم بنجاح' : 'تم إضافة القسم بنجاح', 'success');
            closeModal('deptModal');
            await loadDepartments();
        } else {
            showAlert(result.error || 'فشلت العملية', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('فشل الاتصال بالخادم', 'error');
    }
}

async function deleteDept(id, name) {
    if (!confirm(`هل أنت متأكد من حذف القسم "${name}"؟`)) return;
    
    try {
        const res = await fetch(`${API_URL}/departments/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await res.json();
        
        if (res.ok) {
            showAlert('تم حذف القسم بنجاح', 'success');
            await loadDepartments();
        } else {
            showAlert(result.error || 'فشل الحذف', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('فشل الاتصال بالخادم', 'error');
    }
}

// ==============================================
// DIVISIONS
// ==============================================

async function loadDivisions() {
    try {
        const res = await fetch(`${API_URL}/divisions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            allDivs = data.data || [];
            document.getElementById('totalDivs').textContent = allDivs.length;
            displayDivisions(allDivs);
            fillDivSelects();
        }
    } catch (e) {
        console.error(e);
        showAlert('فشل تحميل الشعب', 'error');
    }
}

function displayDivisions(divs) {
    const tbody = document.getElementById('divsTableBody');
    
    if (!divs.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا يوجد شعب</td></tr>';
        return;
    }
    
    tbody.innerHTML = divs.map(d => `
        <tr>
            <td>${d.id}</td>
            <td><strong>${d.div_name}</strong></td>
            <td>${d.div_code}</td>
            <td>${d.dept_name || '-'}</td>
            <td>${d.manager_name || '-'}</td>
            <td>${d.users_count || 0}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-warning btn-sm" onclick='editDiv(${JSON.stringify(d).replace(/'/g, "&apos;")})'>
                        تعديل
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteDiv(${d.id}, '${d.div_name.replace(/'/g, "\\'")}')">
                        حذف
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openAddDivModal() {
    document.getElementById('divModalTitle').textContent = 'إضافة شعبة جديدة';
    document.getElementById('divForm').reset();
    document.getElementById('divId').value = '';
    openModal('divModal');
}

function editDiv(div) {
    document.getElementById('divModalTitle').textContent = 'تعديل الشعبة';
    document.getElementById('divId').value = div.id;
    document.querySelector('#divForm [name="div_name"]').value = div.div_name;
    document.querySelector('#divForm [name="div_code"]').value = div.div_code;
    document.querySelector('#divForm [name="department_id"]').value = div.department_id || '';
    document.querySelector('#divForm [name="description"]').value = div.description || '';
    document.querySelector('#divForm [name="manager_id"]').value = div.manager_id || '';
    openModal('divModal');
}

async function saveDiv(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    formData.forEach((value, key) => {
        if (key !== 'id') {
            data[key] = value === '' ? null : value;
        }
    });
    
    const id = document.getElementById('divId').value;
    const url = id ? `${API_URL}/divisions/${id}` : `${API_URL}/divisions`;
    const method = id ? 'PUT' : 'POST';
    
    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (res.ok) {
            showAlert(id ? 'تم تحديث الشعبة بنجاح' : 'تم إضافة الشعبة بنجاح', 'success');
            closeModal('divModal');
            await loadDivisions();
        } else {
            showAlert(result.error || 'فشلت العملية', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('فشل الاتصال بالخادم', 'error');
    }
}

async function deleteDiv(id, name) {
    if (!confirm(`هل أنت متأكد من حذف الشعبة "${name}"؟`)) return;
    
    try {
        const res = await fetch(`${API_URL}/divisions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await res.json();
        
        if (res.ok) {
            showAlert('تم حذف الشعبة بنجاح', 'success');
            await loadDivisions();
        } else {
            showAlert(result.error || 'فشل الحذف', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('فشل الاتصال بالخادم', 'error');
    }
}

// ==============================================
// SCHOOLS
// ==============================================

async function loadSchools() {
    try {
        const res = await fetch(`${API_URL}/schools`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            allSchools = data.data || [];
            document.getElementById('totalSchools').textContent = allSchools.length;
            displaySchools(allSchools);
            fillSchoolSelects();
        }
    } catch (e) {
        console.error(e);
        showAlert('فشل تحميل المدارس', 'error');
    }
}

function displaySchools(schools) {
    const tbody = document.getElementById('schoolsTableBody');
    
    if (!schools.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا يوجد مدارس</td></tr>';
        return;
    }
    
    tbody.innerHTML = schools.map(s => `
        <tr>
            <td>${s.id}</td>
            <td><strong>${s.school_name}</strong></td>
            <td>${s.school_code}</td>
            <td>${s.manager_name || '-'}</td>
            <td>${s.users_count || 0}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-warning btn-sm" onclick='editSchool(${JSON.stringify(s).replace(/'/g, "&apos;")})'>
                        تعديل
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSchool(${s.id}, '${s.school_name.replace(/'/g, "\\'")}')">
                        حذف
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openAddSchoolModal() {
    document.getElementById('schoolModalTitle').textContent = 'إضافة مدرسة جديدة';
    document.getElementById('schoolForm').reset();
    document.getElementById('schoolId').value = '';
    openModal('schoolModal');
}

function editSchool(school) {
    document.getElementById('schoolModalTitle').textContent = 'تعديل المدرسة';
    document.getElementById('schoolId').value = school.id;
    document.querySelector('#schoolForm [name="school_name"]').value = school.school_name;
    document.querySelector('#schoolForm [name="school_code"]').value = school.school_code;
    document.querySelector('#schoolForm [name="address"]').value = school.address || '';
    document.querySelector('#schoolForm [name="manager_id"]').value = school.manager_id || '';
    openModal('schoolModal');
}

async function saveSchool(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    formData.forEach((value, key) => {
        if (key !== 'id') {
            data[key] = value === '' ? null : value;
        }
    });
    
    const id = document.getElementById('schoolId').value;
    const url = id ? `${API_URL}/schools/${id}` : `${API_URL}/schools`;
    const method = id ? 'PUT' : 'POST';
    
    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (res.ok) {
            showAlert(id ? 'تم تحديث المدرسة بنجاح' : 'تم إضافة المدرسة بنجاح', 'success');
            closeModal('schoolModal');
            await loadSchools();
        } else {
            showAlert(result.error || 'فشلت العملية', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('فشل الاتصال بالخادم', 'error');
    }
}

async function deleteSchool(id, name) {
    if (!confirm(`هل أنت متأكد من حذف المدرسة "${name}"؟`)) return;
    
    try {
        const res = await fetch(`${API_URL}/schools/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await res.json();
        
        if (res.ok) {
            showAlert('تم حذف المدرسة بنجاح', 'success');
            await loadSchools();
        } else {
            showAlert(result.error || 'فشل الحذف', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('فشل الاتصال بالخادم', 'error');
    }
}

// ==============================================
// ROLES
// ==============================================

async function loadRoles() {
    try {
        const res = await fetch(`${API_URL}/roles`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            allRoles = data.data || [];
            document.getElementById('totalRoles').textContent = allRoles.length;
            displayRoles(allRoles);
            fillRoleSelects();
        }
    } catch (e) {
        console.error(e);
        showAlert('فشل تحميل الأدوار', 'error');
    }
}

function displayRoles(roles) {
    const tbody = document.getElementById('rolesTableBody');
    
    if (!roles.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا يوجد أدوار</td></tr>';
        return;
    }
    
    tbody.innerHTML = roles.map((r, index) => {
        // قائمة جميع الصلاحيات المتاحة
        const allPermissions = [
            { key: 'view_all', label: 'عرض الكل' },
            { key: 'view_department', label: 'عرض القسم' },
            { key: 'view_division', label: 'عرض الشعبة' },
            { key: 'view_own', label: 'عرض الخاص' },
            { key: 'create', label: 'إنشاء' },
            { key: 'create_books', label: 'إنشاء مراسلات' },
            { key: 'edit_own', label: 'تعديل الخاص' },
            { key: 'edit_all', label: 'تعديل الكل' },
            { key: 'delete', label: 'حذف' },
            { key: 'approve', label: 'اعتماد' },
            { key: 'approve_division', label: 'اعتماد الشعبة' },
            { key: 'approve_books', label: 'اعتماد المراسلات' },
            { key: 'reports', label: 'التقارير' },
            { key: 'manage_users', label: 'إدارة المستخدمين' },
            { key: 'manage_departments', label: 'إدارة الأقسام' },
            { key: 'manage_system', label: 'إدارة النظام' },
            { key: 'system_admin', label: 'مدير النظام' }
        ];
        
        // الصلاحيات الحالية
        let currentPerms = {};
        try {
            currentPerms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : (r.permissions || {});
        } catch (e) {
            currentPerms = {};
        }
        
        // HTML للصلاحيات
        const permsHTML = allPermissions.map(p => `
            <div class="permission-item">
                <input 
                    type="checkbox" 
                    id="perm_${r.id}_${p.key}"
                    ${currentPerms[p.key] ? 'checked' : ''}
                    onchange="updatePermission(${r.id}, '${p.key}', this.checked)"
                >
                <label for="perm_${r.id}_${p.key}">${p.label}</label>
            </div>
        `).join('');
        
        return `
            <tr>
                <td>${r.id}</td>
                <td><strong>${r.role_name_ar}</strong></td>
                <td><span class="badge ${r.level <= 2 ? 'badge-danger' : 'badge-info'}">${r.level}</span></td>
                <td>${r.users_count || 0}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-toggle" onclick="togglePermissions(${r.id})" id="toggle_${r.id}">
                            ◀
                        </button>
                        <span style="font-size: 12px; color: #6b7280;">الصلاحيات</span>
                    </div>
                </td>
            </tr>
            <tr class="permissions-row" id="perms_${r.id}">
                <td colspan="5">
                    <div class="permissions-editor">
                        <h4 style="margin-bottom: 16px; color: #374151; font-size: 15px;">
                            صلاحيات دور: ${r.role_name_ar}
                        </h4>
                        <div class="permissions-grid">
                            ${permsHTML}
                        </div>
                        <div style="text-align: center; padding-top: 12px; border-top: 2px solid #e5e7eb;">
                            <button class="btn btn-primary btn-sm" onclick="saveRolePermissions(${r.id})">
                                حفظ التعديلات
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Toggle permissions editor
function togglePermissions(roleId) {
    const row = document.getElementById(`perms_${roleId}`);
    const btn = document.getElementById(`toggle_${roleId}`);
    
    row.classList.toggle('show');
    btn.classList.toggle('active');
}

// Update permission in memory
const rolePermissionsCache = {};

function updatePermission(roleId, permKey, value) {
    if (!rolePermissionsCache[roleId]) {
        const role = allRoles.find(r => r.id === roleId);
        try {
            rolePermissionsCache[roleId] = typeof role.permissions === 'string' 
                ? JSON.parse(role.permissions) 
                : (role.permissions || {});
        } catch (e) {
            rolePermissionsCache[roleId] = {};
        }
    }
    
    if (value) {
        rolePermissionsCache[roleId][permKey] = true;
    } else {
        delete rolePermissionsCache[roleId][permKey];
    }
}

// Save role permissions
async function saveRolePermissions(roleId) {
    if (!rolePermissionsCache[roleId]) {
        showAlert('لم يتم إجراء أي تعديلات', 'error');
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/roles/${roleId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                permissions: rolePermissionsCache[roleId]
            })
        });
        
        const result = await res.json();
        
        if (res.ok) {
            showAlert('تم حفظ الصلاحيات بنجاح', 'success');
            delete rolePermissionsCache[roleId];
            await loadRoles();
        } else {
            showAlert(result.error || 'فشل الحفظ', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('فشل الاتصال بالخادم', 'error');
    }
}

// ==============================================
// FILL SELECTS
// ==============================================

function fillManagerSelects() {
    const managersHTML = '<option value="">اختر المدير</option>' +
        allUsers.map(u => `<option value="${u.id}">${u.full_name}</option>`).join('');
    
    document.getElementById('deptManagerSelect').innerHTML = managersHTML;
    document.getElementById('divManagerSelect').innerHTML = managersHTML;
    document.getElementById('schoolManagerSelect').innerHTML = managersHTML;
}

function fillDeptSelects() {
    const html = '<option value="">اختر القسم</option>' +
        allDepts.map(d => `<option value="${d.id}">${d.dept_name}</option>`).join('');
    
    document.getElementById('userDeptSelect').innerHTML = html;
    document.getElementById('divDeptSelect').innerHTML = html;
}

function fillDivSelects() {
    const html = '<option value="">اختر الشعبة</option>' +
        allDivs.map(d => `<option value="${d.id}">${d.div_name}</option>`).join('');
    
    document.getElementById('userDivSelect').innerHTML = html;
}

function fillSchoolSelects() {
    const html = '<option value="">اختر المدرسة</option>' +
        allSchools.map(s => `<option value="${s.id}">${s.school_name}</option>`).join('');
    
    document.getElementById('userSchoolSelect').innerHTML = html;
}

function fillRoleSelects() {
    const html = '<option value="">اختر الدور</option>' +
        allRoles.map(r => `<option value="${r.id}">${r.role_name_ar}</option>`).join('');
    
    document.getElementById('userRoleSelect').innerHTML = html;
}

// ==============================================
// MODAL FUNCTIONS
// ==============================================

function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
    const form = document.querySelector(`#${modalId} form`);
    if (form) form.reset();
}

// Close modal on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});

// ==============================================
// TAB SWITCHING
// ==============================================

function switchTab(tab) {
    // Update tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`${tab}-content`).classList.add('active');
}

// ==============================================
// ALERT FUNCTIONS
// ==============================================

function showAlert(message, type = 'success') {
    const alert = document.getElementById('globalAlert');
    const icon = type === 'success' ? '✓' : '✕';
    alert.innerHTML = `<span style="font-size: 18px;">${icon}</span> ${message}`;
    alert.className = `alert alert-${type} show`;
    
    setTimeout(() => {
        alert.classList.remove('show');
    }, 5000);
}
