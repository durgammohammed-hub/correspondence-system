import React, { useState, useEffect } from 'react';
import { 
  Send, Inbox, Archive, Search, Bell, Menu, X, FileText, Clock, 
  CheckCircle, XCircle, Eye, Download, Upload, Filter, ChevronDown, 
  Users, Building2, School, Briefcase, Plus, Edit, Trash2, 
  AlertCircle, TrendingUp, Calendar, Hash, User, Lock,
  Settings, LogOut, Home, BarChart3, FolderOpen, ClipboardList,
  CheckSquare, RefreshCw, Mail, Phone, MapPin, Shield
} from 'lucide-react';

const CorrespondenceSystem = () => {
  // ============= الحالات الرئيسية =============
  const [currentUser, setCurrentUser] = useState({
    id: 1,
    name: 'أحمد محمد',
    role: 'general_manager',
    roleAr: 'المدير العام',
    department: 'الإدارة العليا',
    email: 'admin@gov.iq',
    phone: '+964 770 123 4567',
    signature: null
  });

  const [currentPage, setCurrentPage] = useState('dashboard'); // dashboard, inbox, sent, archive, new, reports, settings
  const [currentView, setCurrentView] = useState('inbox');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newMessageModal, setNewMessageModal] = useState(false);
  const [signatureModal, setSignatureModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'مراسلة جديدة', message: 'كتاب رسمي من قسم المالية', time: 'منذ 5 دقائق', read: false, type: 'new' },
    { id: 2, title: 'تحتاج موافقة', message: 'طلب ميزانية قسم تقنية المعلومات', time: 'منذ ساعة', read: false, type: 'approval' },
    { id: 3, title: 'تم الاعتماد', message: 'تم اعتماد طلب الصيانة', time: 'منذ 3 ساعات', read: true, type: 'approved' }
  ]);

  // ============= بيانات تجريبية =============
  const [messages, setMessages] = useState([
    {
      id: 1,
      number: '2026/00123',
      type: 'official_letter',
      typeAr: 'كتاب رسمي',
      subject: 'طلب موافقة على ميزانية القسم للربع الأول',
      content: 'نتقدم بطلب الموافقة على الميزانية المقترحة للربع الأول من العام 2026...',
      from: 'قسم المالية',
      fromUser: 'علي حسن',
      to: 'الإدارة العليا',
      toUser: 'المدير العام',
      department: 'finance',
      departmentColor: '#10b981',
      date: '2026-01-08',
      time: '10:30',
      status: 'pending',
      statusAr: 'قيد المراجعة',
      priority: 'urgent',
      priorityAr: 'عاجل',
      currentStage: 3,
      totalStages: 4,
      workflow: [
        { stage: 1, name: 'مدير الشعبة', status: 'approved', signedBy: 'علي حسن', date: '2026-01-08 09:00', type: 'approved' },
        { stage: 2, name: 'مدير القسم', status: 'approved', signedBy: 'محمد أحمد', date: '2026-01-08 09:45', type: 'approved_formally' },
        { stage: 3, name: 'المعاون', status: 'pending', signedBy: null, date: null, type: null },
        { stage: 4, name: 'المدير العام', status: 'waiting', signedBy: null, date: null, type: null }
      ],
      attachments: [
        { id: 1, name: 'الميزانية_المقترحة_Q1_2026.docx', type: 'word', size: '245 KB' },
        { id: 2, name: 'جدول_التفصيلي.xlsx', type: 'excel', size: '89 KB' }
      ],
      comments: [
        { id: 1, user: 'علي حسن', text: 'تم إرفاق كافة المستندات المطلوبة', date: '2026-01-08 09:00' },
        { id: 2, user: 'محمد أحمد', text: 'الميزانية متوافقة مع الخطة السنوية', date: '2026-01-08 09:45' }
      ],
      read: false,
      dueDate: '2026-01-15'
    },
    {
      id: 2,
      number: '2026/00122',
      type: 'review',
      typeAr: 'مطالعة',
      subject: 'تقرير الحضور والغياب للمدارس - ديسمبر 2025',
      content: 'نقدم لكم التقرير الشهري لحضور وغياب الطلاب في جميع المدارس...',
      from: 'مدرسة الأمل الابتدائية',
      fromUser: 'سارة عبدالله',
      to: 'قسم التعليم',
      toUser: 'مدير قسم التعليم',
      department: 'school',
      departmentColor: '#f59e0b',
      date: '2026-01-07',
      time: '14:15',
      status: 'approved',
      statusAr: 'معتمد',
      priority: 'normal',
      priorityAr: 'عادي',
      currentStage: 2,
      totalStages: 2,
      workflow: [
        { stage: 1, name: 'مدير المدرسة', status: 'approved', signedBy: 'سارة عبدالله', date: '2026-01-07 14:00', type: 'approved' },
        { stage: 2, name: 'مدير القسم', status: 'approved', signedBy: 'خالد يوسف', date: '2026-01-07 16:30', type: 'approved_formally' }
      ],
      attachments: [
        { id: 3, name: 'تقرير_الحضور_ديسمبر.pdf', type: 'pdf', size: '456 KB' },
        { id: 4, name: 'إحصائيات_تفصيلية.xlsx', type: 'excel', size: '123 KB' }
      ],
      comments: [
        { id: 3, user: 'سارة عبدالله', text: 'تحسن ملحوظ في نسبة الحضور', date: '2026-01-07 14:00' }
      ],
      read: true,
      dueDate: null
    },
    {
      id: 3,
      number: '2026/00121',
      type: 'request',
      typeAr: 'طلب',
      subject: 'طلب صيانة عاجلة لأجهزة الحاسوب في المختبر',
      content: 'نحتاج إلى صيانة عاجلة لـ 15 جهاز حاسوب في مختبر تقنية المعلومات...',
      from: 'شعبة تقنية المعلومات',
      fromUser: 'أحمد علي',
      to: 'قسم الخدمات',
      toUser: 'مدير قسم الخدمات',
      department: 'it',
      departmentColor: '#8b5cf6',
      date: '2026-01-07',
      time: '09:00',
      status: 'rejected',
      statusAr: 'مرفوض',
      priority: 'urgent',
      priorityAr: 'عاجل',
      currentStage: 2,
      totalStages: 3,
      workflow: [
        { stage: 1, name: 'مدير الشعبة', status: 'approved', signedBy: 'أحمد علي', date: '2026-01-07 09:00', type: 'action_required' },
        { stage: 2, name: 'مدير القسم', status: 'rejected', signedBy: 'فاطمة حسين', date: '2026-01-07 11:00', type: 'rejected', notes: 'الميزانية غير كافية حالياً' }
      ],
      attachments: [
        { id: 5, name: 'قائمة_الأجهزة_المعطلة.docx', type: 'word', size: '67 KB' }
      ],
      comments: [
        { id: 4, user: 'فاطمة حسين', text: 'يرجى إعادة تقديم الطلب في الربع القادم مع تحديد الأولويات', date: '2026-01-07 11:00' }
      ],
      read: true,
      dueDate: '2026-01-10'
    }
  ]);

  const departments = [
    { id: 'finance', name: 'المالية', icon: Briefcase, color: '#10b981', count: 23 },
    { id: 'hr', name: 'الموارد البشرية', icon: Users, color: '#3b82f6', count: 15 },
    { id: 'it', name: 'تقنية المعلومات', icon: Building2, color: '#8b5cf6', count: 8 },
    { id: 'education', name: 'التعليم', icon: School, color: '#f59e0b', count: 45 },
    { id: 'admin', name: 'الإدارة العليا', icon: Shield, color: '#ef4444', count: 12 }
  ];

  const [formData, setFormData] = useState({
    to: '',
    type: 'official_letter',
    subject: '',
    content: '',
    priority: 'normal',
    attachments: [],
    dueDate: ''
  });

  // ============= الدوال المساعدة =============
  
  const getStatusColor = (status) => {
    const colors = {
      pending: { bg: '#fef3c7', text: '#92400e', icon: Clock },
      approved: { bg: '#d1fae5', text: '#065f46', icon: CheckCircle },
      rejected: { bg: '#fee2e2', text: '#991b1b', icon: XCircle },
      in_progress: { bg: '#dbeafe', text: '#1e40af', icon: RefreshCw },
      archived: { bg: '#f3f4f6', text: '#4b5563', icon: Archive }
    };
    return colors[status] || colors.pending;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: { bg: '#fee2e2', text: '#991b1b', label: 'عاجل' },
      important: { bg: '#fed7aa', text: '#9a3412', label: 'مهم' },
      normal: { bg: '#e0e7ff', text: '#3730a3', label: 'عادي' }
    };
    return colors[priority] || colors.normal;
  };

  const getTypeIcon = (type) => {
    const types = {
      official_letter: { icon: FileText, color: '#2563eb', label: 'كتاب رسمي' },
      review: { icon: Eye, color: '#059669', label: 'مطالعة' },
      request: { icon: ClipboardList, color: '#d97706', label: 'طلب' }
    };
    return types[type] || types.official_letter;
  };

  const filteredMessages = messages.filter(msg => {
    const matchesSearch = msg.subject.includes(searchQuery) || msg.number.includes(searchQuery) || msg.from.includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || msg.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || msg.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const unreadCount = messages.filter(m => !m.read).length;
  const pendingCount = messages.filter(m => m.status === 'pending').length;
  const urgentCount = messages.filter(m => m.priority === 'urgent' && m.status === 'pending').length;

  // ============= المكونات الفرعية =============

  // بطاقة الرسالة
  const MessageCard = ({ message }) => {
    const typeInfo = getTypeIcon(message.type);
    const TypeIcon = typeInfo.icon;
    const statusInfo = getStatusColor(message.status);
    const StatusIcon = statusInfo.icon;
    const priorityInfo = getPriorityColor(message.priority);

    return (
      <div 
        onClick={() => {
          setSelectedMessage(message);
          if (!message.read) {
            const updated = messages.map(m => m.id === message.id ? {...m, read: true} : m);
            setMessages(updated);
          }
        }}
        style={{
          background: message.read ? '#ffffff' : '#fffbeb',
          borderRight: `5px solid ${message.departmentColor}`,
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '16px',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{
                background: typeInfo.color,
                color: 'white',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                <TypeIcon size={12} />
                {typeInfo.label}
              </span>
              <span style={{
                color: '#6b7280',
                fontSize: '13px',
                fontWeight: '600',
                fontFamily: 'monospace'
              }}>
                #{message.number}
              </span>
            </div>
            <h3 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '18px', 
              fontWeight: message.read ? '600' : '800',
              color: '#111827',
              lineHeight: '1.4'
            }}>
              {message.subject}
            </h3>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} />
                من: <strong style={{ color: '#374151' }}>{message.from}</strong>
              </span>
              <span style={{ fontSize: '14px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} />
                {message.date} • {message.time}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            <span style={{
              padding: '6px 14px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '700',
              background: priorityInfo.bg,
              color: priorityInfo.text,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertCircle size={14} />
              {priorityInfo.label}
            </span>
            <span style={{
              padding: '6px 14px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '700',
              background: statusInfo.bg,
              color: statusInfo.text,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <StatusIcon size={14} />
              {message.statusAr}
            </span>
          </div>
        </div>

        {/* Content Preview */}
        <p style={{ 
          margin: '0 0 16px 0', 
          fontSize: '14px', 
          color: '#6b7280',
          lineHeight: '1.6',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }}>
          {message.content}
        </p>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {message.attachments.length > 0 && (
              <span style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} />
                {message.attachments.length} مرفق
              </span>
            )}
            {message.comments.length > 0 && (
              <span style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} />
                {message.comments.length} تعليق
              </span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>
            المرحلة {message.currentStage} من {message.totalStages}
          </div>
        </div>
      </div>
    );
  };

  // تفاصيل الرسالة
  const MessageDetail = ({ message }) => {
    if (!message) return null;

    const typeInfo = getTypeIcon(message.type);
    const TypeIcon = typeInfo.icon;

    return (
      <div style={{ 
        background: 'white',
        borderRadius: '20px',
        padding: '32px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        maxWidth: '1000px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{
                background: typeInfo.color,
                color: 'white',
                padding: '6px 16px',
                borderRadius: '24px',
                fontSize: '12px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <TypeIcon size={16} />
                {typeInfo.label}
              </span>
              <span style={{
                color: '#6b7280',
                fontSize: '15px',
                fontWeight: '700',
                fontFamily: 'monospace',
                background: '#f3f4f6',
                padding: '6px 16px',
                borderRadius: '24px'
              }}>
                #{message.number}
              </span>
            </div>
            <h1 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '28px', 
              fontWeight: '800',
              color: '#111827',
              lineHeight: '1.3'
            }}>
              {message.subject}
            </h1>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>من</div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#374151' }}>{message.from}</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>{message.fromUser}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>إلى</div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#374151' }}>{message.to}</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>{message.toUser}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>التاريخ</div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#374151' }}>{message.date}</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>{message.time}</div>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setSelectedMessage(null)}
            style={{
              background: '#f3f4f6',
              border: 'none',
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
          >
            <X size={20} color="#374151" />
          </button>
        </div>

        {/* Workflow Progress */}
        <div style={{ 
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '32px'
        }}>
          <h3 style={{ 
            margin: '0 0 20px 0', 
            fontSize: '16px', 
            fontWeight: '700',
            color: '#0c4a6e',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <TrendingUp size={18} />
            مراحل الموافقة
          </h3>
          <div style={{ display: 'flex', gap: '16px', position: 'relative' }}>
            {message.workflow.map((stage, index) => {
              const isActive = stage.status === 'pending';
              const isCompleted = stage.status === 'approved';
              const isRejected = stage.status === 'rejected';
              const isWaiting = stage.status === 'waiting';

              return (
                <React.Fragment key={index}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <div style={{
                      background: isCompleted ? '#10b981' : isActive ? '#3b82f6' : isRejected ? '#ef4444' : '#e5e7eb',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center',
                      transition: 'all 0.3s',
                      border: isActive ? '3px solid #3b82f6' : 'none'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'white',
                        margin: '0 auto 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: '800',
                        color: isCompleted ? '#10b981' : isActive ? '#3b82f6' : isRejected ? '#ef4444' : '#9ca3af'
                      }}>
                        {isCompleted ? <CheckCircle size={24} /> : 
                         isRejected ? <XCircle size={24} /> :
                         isActive ? <RefreshCw size={24} /> : stage.stage}
                      </div>
                      <div style={{ 
                        fontSize: '13px', 
                        fontWeight: '700',
                        color: (isCompleted || isActive || isRejected) ? 'white' : '#6b7280',
                        marginBottom: '4px'
                      }}>
                        {stage.name}
                      </div>
                      {stage.signedBy && (
                        <>
                          <div style={{ fontSize: '11px', color: (isCompleted || isRejected) ? '#f0fdf4' : '#9ca3af' }}>
                            {stage.signedBy}
                          </div>
                          <div style={{ fontSize: '10px', color: (isCompleted || isRejected) ? '#dcfce7' : '#9ca3af' }}>
                            {stage.date}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {index < message.workflow.length - 1 && (
                    <div style={{
                      position: 'absolute',
                      top: '36px',
                      right: `${100 / message.workflow.length * (index + 0.5)}%`,
                      width: `${100 / message.workflow.length}%`,
                      height: '4px',
                      background: isCompleted ? '#10b981' : '#e5e7eb',
                      zIndex: 0
                    }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ 
            margin: '0 0 16px 0', 
            fontSize: '16px', 
            fontWeight: '700',
            color: '#111827'
          }}>
            محتوى المراسلة
          </h3>
          <div style={{
            background: '#f9fafb',
            borderRadius: '12px',
            padding: '24px',
            fontSize: '15px',
            lineHeight: '1.8',
            color: '#374151',
            border: '1px solid #e5e7eb'
          }}>
            {message.content}
          </div>
        </div>

        {/* Attachments */}
        {message.attachments.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '16px', 
              fontWeight: '700',
              color: '#111827',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FileText size={18} />
              المرفقات ({message.attachments.length})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
              {message.attachments.map(att => (
                <div key={att.id} style={{
                  background: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.background = '#eff6ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.background = 'white';
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: '#dbeafe',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <FileText size={24} color="#3b82f6" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: '13px', 
                      fontWeight: '600',
                      color: '#111827',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {att.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {att.size}
                    </div>
                  </div>
                  <Download size={18} color="#6b7280" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        {message.comments.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '16px', 
              fontWeight: '700',
              color: '#111827',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Mail size={18} />
              التعليقات ({message.comments.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {message.comments.map(comment => (
                <div key={comment.id} style={{
                  background: '#f9fafb',
                  borderRadius: '12px',
                  padding: '16px',
                  borderRight: '4px solid #3b82f6'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                      {comment.user}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {comment.date}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                    {comment.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {message.status === 'pending' && (
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            paddingTop: '24px',
            borderTop: '2px solid #e5e7eb',
            flexWrap: 'wrap'
          }}>
            <button 
              onClick={() => setSignatureModal(true)}
              className="btn-primary"
              style={{
                flex: '1 1 200px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                padding: '14px 24px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.3s'
              }}
            >
              <CheckCircle size={20} />
              موافق أصولياً
            </button>
            <button 
              className="btn-primary"
              style={{
                flex: '1 1 200px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                padding: '14px 24px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.3s'
              }}
            >
              <CheckSquare size={20} />
              موافق
            </button>
            <button 
              className="btn-primary"
              style={{
                flex: '1 1 200px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                border: 'none',
                padding: '14px 24px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.3s'
              }}
            >
              <Send size={20} />
              للإجراء اللازم
            </button>
            <button 
              className="btn-primary"
              style={{
                flex: '0 1 auto',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                border: 'none',
                padding: '14px 24px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.3s'
              }}
            >
              <XCircle size={20} />
              رفض
            </button>
          </div>
        )}
      </div>
    );
  };

  // لوحة التحكم
  const Dashboard = () => {
    const stats = [
      { 
        label: 'إجمالي المراسلات',
        value: messages.length,
        icon: FileText,
        color: '#3b82f6',
        bg: '#eff6ff'
      },
      { 
        label: 'قيد المراجعة',
        value: pendingCount,
        icon: Clock,
        color: '#f59e0b',
        bg: '#fef3c7'
      },
      { 
        label: 'غير مقروءة',
        value: unreadCount,
        icon: Mail,
        color: '#ef4444',
        bg: '#fee2e2'
      },
      { 
        label: 'عاجلة',
        value: urgentCount,
        icon: AlertCircle,
        color: '#dc2626',
        bg: '#fecaca'
      }
    ];

    return (
      <div style={{ padding: '24px' }}>
        {/* Welcome Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
          borderRadius: '20px',
          padding: '32px',
          marginBottom: '24px',
          color: 'white',
          boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)'
        }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '800' }}>
            مرحباً، {currentUser.name}
          </h2>
          <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>
            {currentUser.roleAr} - {currentUser.department}
          </p>
          <div style={{ display: 'flex', gap: '24px', marginTop: '16px', fontSize: '14px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={16} />
              {currentUser.email}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Phone size={16} />
              {currentUser.phone}
            </span>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '20px',
          marginBottom: '32px'
        }}>
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} style={{
                background: 'white',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                transition: 'all 0.3s',
                cursor: 'pointer',
                border: '2px solid transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                e.currentTarget.style.borderColor = stat.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
                e.currentTarget.style.borderColor = 'transparent';
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#6b7280', 
                      marginBottom: '8px',
                      fontWeight: '600'
                    }}>
                      {stat.label}
                    </div>
                    <div style={{ 
                      fontSize: '36px', 
                      fontWeight: '800',
                      color: stat.color
                    }}>
                      {stat.value}
                    </div>
                  </div>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    background: stat.bg,
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon size={28} color={stat.color} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Messages */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
        }}>
          <h3 style={{
            margin: '0 0 20px 0',
            fontSize: '20px',
            fontWeight: '800',
            color: '#111827'
          }}>
            آخر المراسلات
          </h3>
          {filteredMessages.slice(0, 5).map(msg => (
            <MessageCard key={msg.id} message={msg} />
          ))}
        </div>
      </div>
    );
  };

  // ============= الواجهة الرئيسية =============

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f8fafc',
      fontFamily: "'Tajawal', 'Cairo', sans-serif",
      direction: 'rtl'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800;900&family=Cairo:wght@400;600;700;800;900&display=swap');
        
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 0;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.15);
        }

        .btn-primary:active {
          transform: translateY(0);
        }

        input, textarea, select {
          font-family: 'Tajawal', sans-serif;
        }

        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }

        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed !important;
            right: 0 !important;
            left: auto !important;
            top: 0;
            height: 100vh;
            z-index: 1000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            box-shadow: -4px 0 24px rgba(0,0,0,0.1);
          }
          
          .sidebar.open {
            transform: translateX(0);
          }

          .overlay {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            background: rgba(0,0,0,0.5);
            z-index: 999;
            display: none;
          }

          .overlay.show {
            display: block;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ 
              background: '#f3f4f6', 
              border: 'none', 
              padding: '10px', 
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: '#111827',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Shield size={28} color="white" />
            </div>
            <div>
              <h1 style={{ 
                margin: 0, 
                fontSize: '20px', 
                fontWeight: '900', 
                color: '#111827',
                letterSpacing: '-0.5px'
              }}>
                نظام المراسلات الحكومي
              </h1>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                الجمهورية العراقية
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button style={{
              background: '#f3f4f6',
              border: 'none',
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative'
            }}>
              <Bell size={22} color="#111827" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  left: '6px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: '800',
                  border: '2px solid white'
                }}>
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
          </div>
          <div style={{
            background: '#f3f4f6',
            borderRadius: '12px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                {currentUser.name}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {currentUser.roleAr}
              </div>
            </div>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '16px',
              fontWeight: '800'
            }}>
              {currentUser.name.charAt(0)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 81px)' }}>
        {/* Sidebar */}
        <div 
          className={`sidebar ${sidebarOpen ? 'open' : ''}`}
          style={{
            width: '280px',
            background: 'white',
            borderLeft: '1px solid #e5e7eb',
            padding: '24px',
            flexShrink: 0,
            overflowY: 'auto',
            height: 'calc(100vh - 81px)',
            position: 'sticky',
            top: '81px'
          }}
        >
          <button 
            onClick={() => {
              setNewMessageModal(true);
              setSidebarOpen(false);
            }}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
              color: 'white',
              border: 'none',
              padding: '14px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '24px',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
              transition: 'all 0.3s'
            }}
            className="btn-primary"
          >
            <Plus size={22} />
            مراسلة جديدة
          </button>

          <nav>
            {[
              { id: 'dashboard', label: 'لوحة التحكم', icon: Home, count: null },
              { id: 'inbox', label: 'صندوق الوارد', icon: Inbox, count: unreadCount },
              { id: 'sent', label: 'الصادر', icon: Send, count: null },
              { id: 'pending', label: 'قيد المراجعة', icon: Clock, count: pendingCount },
              { id: 'archive', label: 'الأرشيف', icon: Archive, count: null },
              { id: 'reports', label: 'التقارير', icon: BarChart3, count: null },
              { id: 'settings', label: 'الإعدادات', icon: Settings, count: null }
            ].map(item => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <div 
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    setSelectedMessage(null);
                    setSidebarOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '15px',
                    fontWeight: '700',
                    marginBottom: '6px',
                    background: isActive ? '#eff6ff' : 'transparent',
                    color: isActive ? '#1e40af' : '#6b7280',
                    border: isActive ? '2px solid #3b82f6' : '2px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.transform = 'translateX(-4px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Icon size={20} />
                    {item.label}
                  </div>
                  {item.count !== null && item.count > 0 && (
                    <span style={{
                      background: isActive ? '#3b82f6' : '#ef4444',
                      color: 'white',
                      borderRadius: '12px',
                      padding: '2px 10px',
                      fontSize: '12px',
                      fontWeight: '800'
                    }}>
                      {item.count}
                    </span>
                  )}
                </div>
              );
            })}
          </nav>

          <div style={{ 
            marginTop: '32px', 
            paddingTop: '24px', 
            borderTop: '2px solid #e5e7eb' 
          }}>
            <h3 style={{ 
              fontSize: '12px', 
              fontWeight: '800', 
              color: '#9ca3af', 
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              الأقسام
            </h3>
            {departments.map(dept => {
              const Icon = dept.icon;
              return (
                <div 
                  key={dept.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    marginBottom: '6px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: dept.color
                    }} />
                    <Icon size={16} color={dept.color} />
                    <span style={{ fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                      {dept.name}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    fontWeight: '700'
                  }}>
                    {dept.count}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: '32px',
            padding: '16px',
            background: '#fef3c7',
            borderRadius: '12px',
            border: '2px solid #fbbf24'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertCircle size={18} color="#d97706" />
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>
                تذكير
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#78350f', lineHeight: '1.5' }}>
              لديك {urgentCount} مراسلة عاجلة تحتاج إلى موافقة
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          background: '#f8fafc'
        }}>
          {currentPage === 'dashboard' && !selectedMessage && <Dashboard />}
          
          {currentPage !== 'dashboard' && !selectedMessage && (
            <div style={{ padding: '24px' }}>
              {/* Search and Filter Bar */}
              <div style={{ 
                background: 'white', 
                borderRadius: '16px', 
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}>
                  <div style={{ flex: '1 1 300px', position: 'relative' }}>
                    <Search 
                      size={20} 
                      style={{ 
                        position: 'absolute', 
                        right: '16px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        color: '#9ca3af',
                        pointerEvents: 'none'
                      }} 
                    />
                    <input
                      type="text"
                      placeholder="ابحث برقم الكتاب، الموضوع، أو المرسل..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '14px 14px 14px 48px',
                        borderRadius: '12px',
                        border: '2px solid #e5e7eb',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{
                      minWidth: '180px',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="all">جميع الحالات</option>
                    <option value="pending">قيد المراجعة</option>
                    <option value="in_progress">قيد التنفيذ</option>
                    <option value="approved">معتمد</option>
                    <option value="rejected">مرفوض</option>
                  </select>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    style={{
                      minWidth: '150px',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="all">جميع الأولويات</option>
                    <option value="urgent">عاجل</option>
                    <option value="important">مهم</option>
                    <option value="normal">عادي</option>
                  </select>
                </div>
              </div>

              {/* Messages List */}
              <div style={{
                background: 'white',
                borderRadius: '20px',
                padding: '28px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                minHeight: '600px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ 
                    margin: 0, 
                    fontSize: '24px', 
                    fontWeight: '900',
                    color: '#111827'
                  }}>
                    {currentPage === 'inbox' ? 'صندوق الوارد' : 
                     currentPage === 'sent' ? 'الصادر' : 
                     currentPage === 'pending' ? 'قيد المراجعة' :
                     currentPage === 'archive' ? 'الأرشيف' : 'المراسلات'}
                  </h2>
                  <span style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    fontWeight: '600'
                  }}>
                    {filteredMessages.length} مراسلة
                  </span>
                </div>
                
                {filteredMessages.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '80px 20px',
                    color: '#9ca3af'
                  }}>
                    <Inbox size={64} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                    <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                      لا توجد مراسلات
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      جرب تغيير خيارات البحث والفلترة
                    </div>
                  </div>
                ) : (
                  filteredMessages.map(msg => (
                    <MessageCard key={msg.id} message={msg} />
                  ))
                )}
              </div>
            </div>
          )}

          {selectedMessage && <MessageDetail message={selectedMessage} />}
        </div>
      </div>

      {/* Overlay for mobile */}
      <div 
        className={`overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
    </div>
  );
};

export default CorrespondenceSystem;