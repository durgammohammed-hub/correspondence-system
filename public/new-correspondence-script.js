// new-correspondence-script.js
const API_URL = `${window.location.origin}/api`;
const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

if (!token) {
    window.location.href = 'login.html';
}

let recipients = [];
let departments = [];
let divisions = [];
let users = [];
let signatures = [];
let currentSignatureIndex = -1;
let selectedDecision = '';

// تحميل البيانات عند فتح الصفحة
window.addEventListener('load', async () => {
    const today = new Date();
    document.getElementById('corrDate').value = today.toLocaleDateString('ar-IQ');
    
    await loadDepartments();
    await loadDivisions();
    await loadUsers();
    
    updateHeader();
    addRecipient();
    updateSignatures();
});

// تحميل الأقسام
async function loadDepartments() {
    try {
        const response = await fetch(`${API_URL}/departments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            departments = data.data || [];
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// تحميل الشعب
async function loadDivisions() {
    try {
        const response = await fetch(`${API_URL}/divisions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            divisions = data.data || [];
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// تحميل المستخدمين
async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            users = data.data || [];
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// تحديث الترويسة
function updateHeader() {
    if (currentUser.dept_name) {
        document.getElementById('headerDepartment').textContent = currentUser.dept_name;
    } else if (currentUser.div_name) {
        document.getElementById('headerDepartment').textContent = currentUser.div_name;
    }
}

// إضافة مستلم
function addRecipient() {
    const recipientId = Date.now();
    recipients.push(recipientId);
    
    const recipientHtml = `
        <div class="recipient-item" id="recipient-${recipientId}">
            <div class="recipient-number">${recipients.length}</div>
            <div class="recipient-select">
                <select onchange="updateSignatures()">
                    <option value="">اختر المستلم...</option>
                    <optgroup label="الأقسام">
                        ${departments.map(d => `<option value="dept-${d.id}">${d.dept_name}</option>`).join('')}
                    </optgroup>
                    <optgroup label="الشعب">
                        ${divisions.map(d => `<option value="div-${d.id}">${d.div_name}</option>`).join('')}
                    </optgroup>
                    <optgroup label="مستخدمين">
                        ${users.map(u => `<option value="user-${u.id}">${u.full_name} (${u.role_name_ar})</option>`).join('')}
                    </optgroup>
                </select>
            </div>
            ${recipients.length > 1 ? `<button style="background: #fee2e2; color: #dc2626; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-weight: 700;" onclick="removeRecipient(${recipientId})">×</button>` : ''}
        </div>
    `;
    
    document.getElementById('recipientsList').insertAdjacentHTML('beforeend', recipientHtml);
}

// حذف مستلم
function removeRecipient(id) {
    document.getElementById(`recipient-${id}`).remove();
    recipients = recipients.filter(r => r !== id);
    updateRecipientNumbers();
    updateSignatures();
}

// تحديث أرقام المستلمين
function updateRecipientNumbers() {
    document.querySelectorAll('.recipient-number').forEach((el, index) => {
        el.textContent = index + 1;
    });
}

// تحديث سلسلة التوقيعات
function updateSignatures() {
    signatures = [];
    
    // 1. المعد
    signatures.push({
        role: 'المعد',
        name: currentUser.full_name || 'المستخدم الحالي',
        status: 'approved',
        decision: 'معد الكتاب',
        date: new Date().toLocaleDateString('ar-IQ')
    });
    
    // 2. مدير الشعبة
    if (currentUser.division_id && currentUser.level > 4) {
        signatures.push({
            role: 'مدير الشعبة',
            name: 'في انتظار التوقيع',
            status: signatures.length === 1 ? 'current' : 'pending'
        });
    }
    
    // 3. مدير القسم
    if (currentUser.department_id) {
        signatures.push({
            role: 'مدير القسم',
            name: 'في انتظار التوقيع',
            status: signatures.length === 1 ? 'current' : 'pending'
        });
    }
    
    // 4. المعتمد النهائي
    const selectedRecipients = Array.from(document.querySelectorAll('.recipient-select select'))
        .map(s => s.value)
        .filter(v => v);
    
    if (selectedRecipients.length > 0) {
        signatures.push({
            role: 'المعتمد النهائي',
            name: 'في انتظار الاعتماد',
            status: 'pending'
        });
    }
    
    displaySignatures();
}

// عرض التوقيعات
function displaySignatures() {
    const container = document.getElementById('signaturesChain');
    
    container.innerHTML = signatures.map((sig, index) => `
        <div class="signature-box">
            <div class="signature-header">
                <div class="signature-role">${index + 1}. ${sig.role}</div>
                <div class="signature-status status-${sig.status}">
                    ${sig.status === 'approved' ? '✓ موقع' : sig.status === 'current' ? '⏳ الدور الحالي' : '⏸️ في الانتظار'}
                </div>
            </div>
            
            ${sig.status === 'approved' ? `
                <div class="signature-info">
                    <div class="signature-name">${sig.name}</div>
                    <div class="signature-decision">${sig.decision}</div>
                    ${sig.notes ? `<div class="signature-notes">📝 ${sig.notes}</div>` : ''}
                    <div class="signature-date">📅 ${sig.date}</div>
                </div>
            ` : sig.status === 'current' ? `
                <div class="signature-info">
                    <div class="signature-name">${sig.name}</div>
                </div>
                <button class="btn-sign" onclick="openSignatureModal(${index})">
                    ✍️ وقّع الآن
                </button>
            ` : `
                <div class="signature-info">
                    <div class="signature-name" style="color: #9ca3af;">${sig.name}</div>
                </div>
            `}
        </div>
    `).join('');
}

// فتح نافذة التوقيع
function openSignatureModal(index) {
    currentSignatureIndex = index;
    selectedDecision = '';
    document.getElementById('signatureNotes').value = '';
    document.getElementById('signerName').textContent = currentUser.full_name;
    document.getElementById('confirmSignBtn').disabled = true;
    
    document.querySelectorAll('.decision-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    document.getElementById('signatureModal').classList.add('show');
}

// إغلاق النافذة
function closeModal() {
    document.getElementById('signatureModal').classList.remove('show');
}

// اختيار القرار
function selectDecision(decision) {
    selectedDecision = decision;
    
    document.querySelectorAll('.decision-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.textContent.includes(decision)) {
            btn.classList.add('selected');
        }
    });
    
    document.getElementById('confirmSignBtn').disabled = false;
}

// حفظ التوقيع
function saveSignature() {
    if (!selectedDecision) {
        alert('⚠️ الرجاء اختيار القرار');
        return;
    }
    
    const notes = document.getElementById('signatureNotes').value;
    
    signatures[currentSignatureIndex].status = 'approved';
    signatures[currentSignatureIndex].name = currentUser.full_name;
    signatures[currentSignatureIndex].decision = selectedDecision;
    signatures[currentSignatureIndex].notes = notes;
    signatures[currentSignatureIndex].date = new Date().toLocaleDateString('ar-IQ');
    
    // تحديث الدور الحالي
    if (currentSignatureIndex + 1 < signatures.length) {
        signatures[currentSignatureIndex + 1].status = 'current';
    }
    
    displaySignatures();
    closeModal();
    
    alert('✅ تم التوقيع بنجاح');
}

// حفظ مسودة
async function saveDraft() {
    const data = collectData();
    data.status = 'draft';
    
    try {
        const response = await fetch(`${API_URL}/correspondences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            alert('✅ تم الحفظ');
            window.location.href = 'correspondences.html';
        } else {
            alert('❌ فشل الحفظ');
        }
    } catch (error) {
        alert('❌ خطأ في الاتصال');
    }
}

// إرسال المراسلة
async function submitCorrespondence() {
    if (!validateForm()) return;
    
    const data = collectData();
    data.status = 'pending';
    data.signatures = signatures;
    
    try {
        const response = await fetch(`${API_URL}/correspondences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            alert('✅ تم إرسال المراسلة');
            window.location.href = 'correspondences.html';
        } else {
            alert('❌ فشل الإرسال');
        }
    } catch (error) {
        alert('❌ خطأ في الاتصال');
    }
}

// جمع البيانات
function collectData() {
    const recipients = Array.from(document.querySelectorAll('.recipient-select select'))
        .map(s => s.value)
        .filter(v => v);
    
    return {
        subject: document.getElementById('corrSubject').value,
        content: document.getElementById('docContent').innerText,
        priority: document.getElementById('corrPriority').value,
        correspondence_type: 'official',
        recipients: recipients
    };
}

// التحقق من البيانات
function validateForm() {
    const subject = document.getElementById('corrSubject').value;
    const content = document.getElementById('docContent').innerText.trim();
    const recipients = Array.from(document.querySelectorAll('.recipient-select select'))
        .map(s => s.value)
        .filter(v => v);
    
    if (!subject) {
        alert('⚠️ الرجاء إدخال موضوع المراسلة');
        return false;
    }
    
    if (!content || content.length < 10) {
        alert('⚠️ الرجاء إدخال محتوى المراسلة');
        return false;
    }
    
    if (recipients.length === 0) {
        alert('⚠️ الرجاء تحديد مستلم واحد على الأقل');
        return false;
    }
    
    return true;
}
