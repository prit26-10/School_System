// ============================================
// REUSABLE UI COMPONENTS
// ============================================

const Components = {
    PageHeader: (title, subtitle) => '',

    StatusBadge: (status) => {
        const statusConfig = {
            pending: { class: 'pending', label: 'Pending' },
            approved: { class: 'approved', label: 'Approved' },
            rejected: { class: 'rejected', label: 'Rejected' }
        };
        const config = statusConfig[status] || statusConfig.pending;
        return `<span class="status-badge ${config.class}">${config.label}</span>`;
    },

    FilterBar: (config) => {
        const { searchPlaceholder = 'Search...', searchId = 'search-input', statusId = 'status-filter', statusOptions = [], onSearch = 'handleSearch()', onStatusChange = 'filterApplications()' } = config;
        return `
            <div class="filter-bar">
                <div class="filter-group search-group">
                    <i class="fas fa-search"></i>
                    <input type="text" id="${searchId}" placeholder="${searchPlaceholder}" onkeyup="${onSearch}">
                </div>
                <div class="filter-group">
                    <label>Filter by Status:</label>
                    <select id="${statusId}" onchange="${onStatusChange}">
                        ${statusOptions.map(opt => `<option value="${opt.value}" ${opt.selected ? 'selected' : ''}>${opt.label}</option>`).join('')}
                    </select>
                </div>
                <button class="btn btn-primary" onclick="handleRefresh()">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>
        `;
    },

    LoadingState: (message = 'Loading...') => `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>${message}</p>
        </div>
    `,

    EmptyState: (icon = 'inbox', title = 'No data found', message = 'There are no items to display.') => `
        <div class="empty-state">
            <i class="fas fa-${icon}"></i>
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `,

    ErrorState: (message = 'Something went wrong', onRetry = 'handleRefresh()') => `
        <div class="error-state">
            <i class="fas fa-exclamation-circle"></i>
            <h3>Error</h3>
            <p>${message}</p>
            <button class="btn btn-primary" onclick="${onRetry}">
                <i class="fas fa-redo"></i> Try Again
            </button>
        </div>
    `,

    ApplicationTable: (headers, bodyId, tableId = 'applications-table') => `
        <table id="${tableId}" class="data-table applications-table">
            <thead>
                <tr>
                    ${headers.map(h => `<th>${h}</th>`).join('')}
                </tr>
            </thead>
            <tbody id="${bodyId}"></tbody>
        </table>
    `,

    Modal: (id, title, contentId, size = 'large') => {
        const sizeClass = size === 'large' ? '' : 'small';
        return `
            <div id="${id}" class="modal">
                <div class="modal-content ${sizeClass}">
                    <div class="modal-header">
                        <button class="modal-close" onclick="closeModal('${id}')">&times;</button>
                        <h2 class="modal-title">${title}</h2>
                    </div>
                    <div id="${contentId}" class="modal-body"></div>
                </div>
            </div>
        `;
    },

    ActionButtons: (app, type = 'student') => {
        const viewFn = type === 'student' ? `viewApplication` : `viewTeacherApplication`;
        const approveFn = type === 'student' ? `approveStudent` : `approveTeacher`;
        const rejectFn = type === 'student' ? `openRejectModal` : `openTeacherRejectModal`;

        const viewBtn = `
            <button class="btn-action btn-view" onclick="${viewFn}('${app._id}')" title="View Details">
                <i class="fas fa-eye"></i>
            </button>
        `;

        if (app.status !== 'pending') return `<div class="action-buttons">${viewBtn}</div>`;

        return `
            <div class="action-buttons">
                ${viewBtn}
                <button class="btn-action btn-approve" onclick="${approveFn}('${app._id}')" title="Approve">
                    <i class="fas fa-check"></i>
                </button>
                <button class="btn-action btn-reject" onclick="${rejectFn}('${app._id}')" title="Reject">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }
};

// ============================================
// APPLICATION STATE MANAGEMENT
// ============================================

const AppState = {
    studentApplications: [],
    teacherApplications: [],
    studentFilter: 'all',
    teacherFilter: 'all',
    studentSearch: '',
    teacherSearch: '',
    allTeachers: [],
    allClasses: [],
    allSubjects: [],
    allClassesWithTeachers: [],
    currentTimetableData: [],
    isLoading: false
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function showModal(title, content, modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`Modal with id '${modalId}' not found`);
        return;
    }

    const modalTitle = modal.querySelector('.modal-title');
    let modalBody;

    // Find the correct modal body element based on modal type
    if (modalId === 'edit-teacher-modal') {
        modalBody = document.getElementById('edit-teacher-modal-body');
    } else if (modalId === 'edit-student-modal') {
        modalBody = document.getElementById('edit-student-modal-body');
    } else {
        modalBody = modal.querySelector('.modal-body');
    }

    if (modalTitle) modalTitle.textContent = title;
    if (modalBody) modalBody.innerHTML = content;

    modal.style.display = 'flex';
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getLocalDateString(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getUTCDateString(date) {
    if (!date) return '-';
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showToast(message, type = 'info') {
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };

    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${iconMap[type] || iconMap.info}"></i>
            <div class="notification-message">${message}</div>
        </div>
        <div class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </div>
    `;

    notificationContainer.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Safe DOM manipulation functions
function safeSetDisplay(elementId, display) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = display;
    }
}

function safeSetInnerHTML(elementId, html) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = html;
    }
}

function safeGetElement(elementId) {
    return document.getElementById(elementId);
}

function logDebug(message, data) {
    console.log(`[DEBUG] ${message}:`, data);
}

function logError(message, error) {
    console.error(`[ERROR] ${message}:`, error);
}

// ============================================
// MAIN INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    checkAuth();
    initializeDashboard();
    loadPage('dashboard');
});

function checkAuth() {
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role !== 'admin') {
            window.location.href = '/login.html';
            return;
        }

        const profileNameEl = document.querySelector('.profile-name');
        if (profileNameEl && payload.name) {
            profileNameEl.textContent = payload.name;
        }
    } catch (e) {
        window.location.href = '/login.html';
    }
}

function initializeDashboard() {
    setupNavGroups();
    setupNavItems();
    setupLogout();
    setupDropdown();
}

const mockData = {
    stats: {
        totalStudents: 0,
        totalTeachers: 0,
        pendingApplications: 0,
        todayAttendance: 0
    },
    students: [],
    teachers: [],
    classes: ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    subjects: ['Mathematics', 'Science', 'English', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology'],
    fees: [
        { id: 1, studentName: 'Rahul Sharma', class: 'Class 10', totalFees: 50000, paid: 50000, status: 'paid', dueDate: '2026-03-31' },
        { id: 2, studentName: 'Priya Patel', class: 'Class 9', totalFees: 45000, paid: 25000, status: 'pending', dueDate: '2026-02-28' },
        { id: 3, studentName: 'Amit Kumar', class: 'Class 11', totalFees: 55000, paid: 55000, status: 'paid', dueDate: '2026-03-15' },
        { id: 4, studentName: 'Sneha Gupta', class: 'Class 8', totalFees: 40000, paid: 0, status: 'pending', dueDate: '2026-02-28' },
        { id: 5, studentName: 'Raj Malhotra', class: 'Class 12', totalFees: 60000, paid: 30000, status: 'pending', dueDate: '2026-03-31' },
        { id: 6, studentName: 'Anjali Singh', class: 'Class 10', totalFees: 50000, paid: 50000, status: 'paid', dueDate: '2026-02-15' },
        { id: 7, studentName: 'Vikram Joshi', class: 'Class 7', totalFees: 35000, paid: 35000, status: 'paid', dueDate: '2026-01-31' },
        { id: 8, studentName: 'Meera Nair', class: 'Class 9', totalFees: 45000, paid: 10000, status: 'pending', dueDate: '2026-02-28' }
    ],
    studentApplications: [
        { id: 1, name: 'Arjun Reddy', email: 'arjun@example.com', class: 'Class 11', appliedDate: '2026-02-25', status: 'pending' },
        { id: 2, name: 'Kavya Menon', email: 'kavya@example.com', class: 'Class 9', appliedDate: '2026-02-24', status: 'pending' },
        { id: 3, name: 'Dev Kapoor', email: 'dev@example.com', class: 'Class 10', appliedDate: '2026-02-23', status: 'pending' }
    ],
    teacherApplications: [
        { id: 1, applicationId: 'TAPP-MM8PF5Q4', fullName: 'Pritkumar Patel', email: 'patelprit2609@gmail.com', position: 'teacher', department: 'computer', appliedDate: '3/2/2026', status: 'pending' },
        { id: 2, name: 'Dr. Sarah Johnson', email: 'sarah@example.com', subject: 'Mathematics', appliedDate: '2026-02-26', status: 'pending' },
        { id: 3, name: 'Mr. Ramesh Gupta', email: 'ramesh@example.com', subject: 'Physics', appliedDate: '2026-02-25', status: 'pending' }
    ],
    attendance: [
        { id: 1, date: '2026-02-27', totalStudents: 1200, present: 1140, absent: 60 },
        { id: 2, date: '2026-02-26', totalStudents: 1200, present: 1100, absent: 100 },
        { id: 3, date: '2026-02-25', totalStudents: 1200, present: 1150, absent: 50 }
    ],
    notices: [
        { id: 1, title: 'Mid-term Examination Schedule', type: 'Academic', sentTo: 'Students', date: '2026-02-25', status: 'sent' },
        { id: 2, title: 'Annual Sports Day', type: 'Event', sentTo: 'Teachers', date: '2026-02-20', status: 'sent' },
        { id: 3, title: 'Fee Payment Reminder', type: 'General', sentTo: 'Students', date: '2026-02-18', status: 'sent' }
    ]
};

function loadPage(page, titleOverride = null) {
    // Support both legacy #dashboard-content and new #admin-content containers
    const content = document.getElementById('admin-content') || document.getElementById('dashboard-content');
    const pageTitle = document.getElementById('page-title') || document.querySelector('.page-title');
    const pageSubtitle = document.getElementById('page-subtitle') || document.querySelector('.page-subtitle');
    const navbarPageTitle = document.getElementById('navbar-page-title');
    // Define page configuration
    const pageConfig = {
        'dashboard': {
            title: 'Dashboard',
            subtitle: "Welcome back! Here's an overview of your school",
            render: renderDashboard
        },
        'student-applications': {
            title: 'Student Applications',
            subtitle: 'Manage student admission applications',
            render: renderStudentApplications,
            init: () => {
                loadApplications();
                startAutoRefresh();
            }
        },
        'teacher-applications': {
            title: 'Teacher Applications',
            subtitle: 'Manage teacher job applications',
            render: renderTeacherApplications,
            init: () => {
                loadTeacherApplications();
            }
        },
        'student-management': {
            title: 'Student Management',
            subtitle: 'Manage all student records',
            render: renderStudentManagement,
            init: loadStudents
        },
        'manage-classes': {
            title: 'Manage Classes',
            subtitle: 'Add and manage all school classes',
            render: renderManageClasses,
            init: loadManageClasses
        },
        'manage-subjects': {
            title: 'Manage Subjects',
            subtitle: 'Add and manage all school subjects',
            render: renderManageSubjects,
            init: loadSubjects
        },
        'view-teachers': {
            title: 'View Teachers',
            subtitle: 'View all teacher information',
            render: renderViewTeachers,
            init: loadTeachers
        },
        'assign-class': {
            title: 'Assign Class',
            subtitle: 'Assign classes to teachers',
            render: renderAssignClass,
            init: loadClassesWithTeachers
        },
        'assign-subject': {
            title: 'Assign Subject',
            subtitle: 'Assign subjects to teachers',
            render: renderAssignSubject,
            init: loadSubjectsForAssignment
        },
        'academic-year': {
            title: 'Configure Academic Year',
            subtitle: 'Set up academic year settings',
            render: renderAcademicYear,
            init: initializeAcademicSetup
        },
        'timetable': {
            title: 'Generate Timetable',
            subtitle: 'Create class timetables',
            render: renderTimetable,
            init: initializeTimetable
        },
        'daily-attendance': {
            title: 'Daily Attendance',
            subtitle: 'Track daily attendance',
            render: renderDailyAttendance
        },
        'monthly-report': {
            title: 'Monthly Report',
            subtitle: 'View monthly attendance reports',
            render: renderMonthlyReport
        },
        'define-fees': {
            title: 'Define Class Fees',
            subtitle: 'Set fees for each class',
            render: renderDefineFees,
            init: initializeDefineFees
        },
        'payment-updates': {
            title: 'Payment Updates',
            subtitle: 'Manage student fee payments',
            render: renderPaymentUpdates,
            init: initializePaymentUpdates
        },
        'notice-management': {
            title: 'Notice Management',
            subtitle: 'Create and send notices',
            render: renderNoticeManagement,
            init: initializeNoticeManagement
        },
        'exam-timetable': {
            title: 'Create Exam Timetable',
            subtitle: 'Schedule exam timings',
            render: renderExamTimetable
        },
        'exam-notification': {
            title: 'Send Exam Notification',
            subtitle: 'Notify about exams',
            render: renderExamNotification
        },
        'publish-results': {
            title: 'Publish Results',
            subtitle: 'Publish examination results',
            render: renderPublishResults
        },
        'profile': {
            title: 'Profile',
            subtitle: 'Manage your admin profile',
            render: renderProfile
        }
    };

    if (pageConfig[page]) {
        // Stop auto-refresh when leaving student applications page
        if (page !== 'student-applications') {
            stopAutoRefresh();
        }

        // Render content first
        content.innerHTML = pageConfig[page].render();
        // Then update header if present
        const displayTitle = titleOverride || pageConfig[page].title;
        if (navbarPageTitle) navbarPageTitle.textContent = displayTitle;

        if (pageConfig[page].init) {
            pageConfig[page].init();
        }
    } else {
        if (content) content.innerHTML = '<p>Page not found</p>';
    }

    // If dashboard, populate quick stats with mock data
    if (page === 'dashboard') {
        const tStudents = mockData?.stats?.totalStudents ?? 0;
        const tTeachers = mockData?.stats?.totalTeachers ?? 0;
        const pApps = mockData?.stats?.pendingApplications ?? 0;
        const tAttendance = mockData?.stats?.todayAttendance ?? 0;
        const elTotalStudents = document.getElementById('total-students');
        const elTotalTeachers = document.getElementById('total-teachers');
        const elPendingApps = document.getElementById('pending-applications');
        const elTodayAttendance = document.getElementById('today-attendance');
        if (elTotalStudents) elTotalStudents.textContent = tStudents;
        if (elTotalTeachers) elTotalTeachers.textContent = tTeachers;
        if (elPendingApps) elPendingApps.textContent = pApps;
        if (elTodayAttendance) elTodayAttendance.textContent = tAttendance + '%';

        fetchDashboardStats();

        // Load dynamic fees collection overview
        loadFeesCollectionOverview();
    }

    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('active');
    }
}

// ============================================
// FEES COLLECTION OVERVIEW FUNCTIONS
// ============================================

// Load fees collection overview from API
async function loadFeesCollectionOverview() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/payments/collection-overview', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load fees collection data');

        const result = await response.json();
        if (result.success && result.data) {
            updateFeesOverviewUI(result.data);
        }
    } catch (error) {
        console.error('Error loading fees collection overview:', error);
        // Set default values on error
        updateFeesOverviewUI({
            totalExpected: 0,
            totalCollected: 0,
            totalPending: 0,
            collectionRate: 0,
            currentMonth: new Date().toLocaleString('default', { month: 'long' })
        });
    }
}

// Update fees overview UI with data
function updateFeesOverviewUI(data) {
    const elFeesExpected = document.getElementById('fees-expected');
    const elFeesCollected = document.getElementById('fees-collected');
    const elFeesPending = document.getElementById('fees-pending');
    const elFeesFill = document.getElementById('fees-progress-fill');
    const elFeesText = document.getElementById('fees-progress-text');
    const elFeesPeriod = document.querySelector('.fees-period');

    // Update values
    if (elFeesExpected) elFeesExpected.textContent = `₹${data.totalExpected.toLocaleString()}`;
    if (elFeesCollected) elFeesCollected.textContent = `₹${data.totalCollected.toLocaleString()}`;
    if (elFeesPending) elFeesPending.textContent = `₹${data.totalPending.toLocaleString()}`;
    if (elFeesFill) elFeesFill.style.width = `${data.collectionRate}%`;
    if (elFeesText) elFeesText.textContent = `${data.collectionRate}% Collection Rate`;
    if (elFeesPeriod) elFeesPeriod.textContent = data.currentMonth;

    // Store monthly data for potential chart usage
    if (data.monthlyData) {
        window.feesMonthlyData = data.monthlyData;
    }
}

// ============================================

function renderDashboard() {
    // Dashboard layout: top stats, then a Fees overview alongside Quick Actions
    return `
        <div class=\"stats-grid\"> 
            <div class=\"stat-card\"> 
                <div class=\"stat-icon students\"> 
                    <i class=\"fas fa-user-graduate\"></i> 
                </div> 
                <div class=\"stat-info\"> 
                    <span class=\"stat-label\">Total Students</span> 
                    <span class=\"stat-value\" id=\"total-students\">0</span> 
                </div> 
            </div> 

            <div class=\"stat-card\"> 
                <div class=\"stat-icon teachers\"> 
                    <i class=\"fas fa-chalkboard-teacher\"></i> 
                </div> 
                <div class=\"stat-info\"> 
                    <span class=\"stat-label\">Total Teachers</span> 
                    <span class=\"stat-value\" id=\"total-teachers\">0</span> 
                </div> 
            </div> 

            <div class=\"stat-card\"> 
                <div class=\"stat-icon applications\"> 
                    <i class=\"fas fa-file-alt\"></i> 
                </div> 
                <div class=\"stat-info\"> 
                    <span class=\"stat-label\">Pending Applications</span> 
                    <span class=\"stat-value\" id=\"pending-applications\">0</span> 
                </div> 
            </div> 

            <div class=\"stat-card\"> 
                <div class=\"stat-icon attendance\"> 
                    <i class=\"fas fa-calendar-check\"></i> 
                </div> 
                <div class=\"stat-info\"> 
                    <span class=\"stat-label\">Today's Attendance</span> 
                    <span class=\"stat-value\" id=\"today-attendance\">0%</span> 
                </div> 
            </div> 
        </div>

        <div class=\"dashboard-grid\"> 
            <div class=\"fees-section\"> 
                <div class=\"fees-card\"> 
                    <div class=\"fees-header\"> 
                        <h3><i class=\"fas fa-money-bill-wave\"></i> Fees Collection Overview</h3> 
                        <span class=\"fees-period\">This Month</span> 
                    </div> 
                    <div class=\"fees-stats\"> 
                        <div class=\"fees-stat\"> 
                            <span class=\"fees-label\">Total Expected</span> 
                            <span class=\"fees-value\" id=\"fees-expected\">$0</span> 
                        </div> 
                        <div class=\"fees-stat\"> 
                            <span class=\"fees-label\">Collected</span> 
                            <span class=\"fees-value collected\" id=\"fees-collected\">$0</span> 
                        </div> 
                        <div class=\"fees-stat\"> 
                            <span class=\"fees-label\">Pending</span> 
                            <span class=\"fees-value pending\" id=\"fees-pending\">$0</span> 
                        </div> 
                    </div> 
                    <div class=\"fees-progress\"> 
                        <div class=\"progress-bar\"> 
                            <div class=\"progress-fill\" id=\"fees-progress-fill\" style=\"width: 0%\"></div> 
                        </div> 
                        <span class=\"progress-text\" id=\"fees-progress-text\">0% Collection Rate</span> 
                    </div> 
                </div> 
            </div> 
            <div class=\"quick-actions-section\"> 
                <div class=\"content-card\"> 
                    <h3><i class=\"fas fa-bolt\"></i> Quick Actions</h3> 
                    <div class=\"quick-actions-grid\"> 
                        <div class=\"quick-action-tile\" onclick=\"void(0)\"> 
                            <i class=\"fas fa-user-plus\"></i> Add Student 
                        </div> 
                        <div class=\"quick-action-tile\" onclick=\"void(0)\"> 
                            <i class=\"fas fa-user-tie\"></i> Add Teacher 
                        </div> 
                        <div class=\"quick-action-tile\" onclick=\"void(0)\"> 
                            <i class=\"fas fa-bullhorn\"></i> Post Notice 
                        </div> 
                        <div class=\"quick-action-tile\" onclick=\"void(0)\"> 
                            <i class=\"fas fa-file-search\"></i> Check Applications 
                        </div> 
                    </div> 
                </div> 
            </div> 
        </div>

        <div class=\"activities-section\"> 
            <div class=\"section-header\"> 
                <h3><i class=\"fas fa-history\"></i> Recent Activities</h3> 
            </div> 
            <div class=\"activities-table\"> 
                <table> 
                    <thead> 
                        <tr> 
                            <th>Activity</th> 
                            <th>User</th> 
                            <th>Date & Time</th> 
                            <th>Status</th> 
                        </tr> 
                    </thead> 
                    <tbody> 
                        <tr> 
                            <td colspan=\"4\" style=\"text-align: center; padding: 30px; color: var(--gray);\"> 
                                No recent activities 
                            </td> 
                        </tr> 
                    </tbody> 
                </table> 
            </div> 
        </div> 
    `;
}

function renderStudentApplications() {
    const headers = ['APPLICATION ID', 'STUDENT NAME', 'CLASS', 'PARENT NAME', 'PHONE', 'SUBMISSION DATE', 'STATUS', 'ACTIONS'];
    return `
        <div class="applications-stats-grid">
            <div class="app-stat-card pending">
                <div class="app-stat-icon">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="app-stat-content">
                    <span class="app-stat-value" id="stats-pending">0</span>
                    <span class="app-stat-label">Pending</span>
                </div>
            </div>
            <div class="app-stat-card approved">
                <div class="app-stat-icon">
                    <i class="fas fa-check"></i>
                </div>
                <div class="app-stat-content">
                    <span class="app-stat-value" id="stats-approved">0</span>
                    <span class="app-stat-label">Approved</span>
                </div>
            </div>
            <div class="app-stat-card rejected">
                <div class="app-stat-icon">
                    <i class="fas fa-times"></i>
                </div>
                <div class="app-stat-content">
                    <span class="app-stat-value" id="stats-rejected">0</span>
                    <span class="app-stat-label">Rejected</span>
                </div>
            </div>
        </div>

        <div class="content-card applications-card">
            <div class="applications-header">
                <div class="applications-title">
                    <i class="fas fa-file-invoice"></i>
                    <h2>Student Admission Applications</h2>
                </div>
                
                <div class="applications-controls">
                    <div class="search-wrapper">
                        <i class="fas fa-search"></i>
                        <input type="text" id="student-search-input" placeholder="Search applications..." onkeyup="handleStudentSearch()">
                    </div>
                    
                    <select id="application-status-filter" onchange="filterApplications()">
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>

                    <button class="btn-refresh" onclick="handleRefresh()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div id="applications-loading" style="display: none;"></div>
            <div id="applications-error" style="display: none;"></div>
            <div class="table-wrapper">
                <table id="applications-table" class="data-table applications-table">
                    <thead>
                        <tr>
                            ${headers.map(h => `<th>${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody id="applications-tbody"></tbody>
                </table>
            </div>
            <div id="applications-empty" style="display: none;"></div>
        </div>
        
        ${Components.Modal('application-modal', 'Application Details', 'application-details', 'large')}
        
        <div id="reject-modal" class="reject-modal">
            <div class="modal-content small">
                <h3>Reject Application</h3>
                <p>Please provide a reason for rejecting this application:</p>
                <textarea id="reject-reason" rows="4" placeholder="Enter rejection reason (optional)"></textarea>
                <div class="reject-modal-buttons">
                    <button class="btn-cancel" onclick="closeRejectModal()">Cancel</button>
                    <button class="btn-reject-confirm" onclick="confirmReject()">Reject</button>
                </div>
            </div>
        </div>
    `;
}

let currentApplications = [];
let lastApplicationCount = 0;
let notificationInterval = null;

function showLoadingState(elementId, message = 'Loading applications...') {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = Components.LoadingState(message);
        el.style.display = 'block';
    }
}

function hideLoadingState(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = '';
        el.style.display = 'none';
    }
}

async function loadApplications(showNotification = false) {
    logDebug('loadApplications', 'Starting...');

    // Check if required DOM elements exist
    const loadingEl = safeGetElement('applications-loading');
    const tableEl = safeGetElement('applications-table');
    const emptyEl = safeGetElement('applications-empty');
    const errorEl = safeGetElement('applications-error');
    const searchInput = safeGetElement('student-search-input');
    const statusFilter = safeGetElement('application-status-filter');

    // Update stats even if we're loading
    updateApplicationCounts();

    // Show loading state if element exists
    if (loadingEl) {
        safeSetInnerHTML('applications-loading', Components.LoadingState('Loading student applications...'));
        safeSetDisplay('applications-loading', 'block');
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        let url = '/api/admission/applications';
        const params = [];

        if (statusFilter) {
            const statusValue = statusFilter.value;
            if (statusValue && statusValue !== 'all') params.push(`status=${statusValue}`);
        }

        if (searchInput) {
            const searchValue = searchInput.value;
            if (searchValue) params.push(`search=${encodeURIComponent(searchValue)}`);
        }

        if (params.length > 0) url += '?' + params.join('&');

        logDebug('API URL', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server returned non-JSON response');
        }

        const result = await response.json();
        logDebug('API Response', result);

        // Hide loading state
        safeSetDisplay('applications-loading', 'none');

        if (result.success && result.applications && result.applications.length > 0) {
            if (showNotification && result.applications.length > lastApplicationCount) {
                showNewApplicationNotification(result.applications.length - lastApplicationCount);
            }

            currentApplications = result.applications;
            renderApplications(result.applications);

            if (tableEl) safeSetDisplay('applications-table', 'table');
            if (emptyEl) safeSetDisplay('applications-empty', 'none');
            if (errorEl) safeSetDisplay('applications-error', 'none');

            lastApplicationCount = result.applications.length;
            logDebug('Student Applications Loaded', result.applications.length);
        } else {
            if (tableEl) safeSetDisplay('applications-table', 'none');
            if (emptyEl) {
                safeSetInnerHTML('applications-empty', Components.EmptyState('user-graduate', 'No Applications Found', 'There are no student applications matching your criteria.'));
                safeSetDisplay('applications-empty', 'block');
            }
            if (errorEl) safeSetDisplay('applications-error', 'none');

            if (showNotification) {
                lastApplicationCount = 0;
            }

            logDebug('No Student Applications', 'Empty result');
        }
    } catch (error) {
        logError('loadApplications failed', error);

        // Hide loading state
        safeSetDisplay('applications-loading', 'none');

        // Show error state
        if (tableEl) safeSetDisplay('applications-table', 'none');
        if (emptyEl) safeSetDisplay('applications-empty', 'none');
        if (errorEl) {
            safeSetInnerHTML('applications-error', Components.ErrorState('Failed to load applications. Please check your connection and try again.', 'loadApplications()'));
            safeSetDisplay('applications-error', 'block');
        }
    }
}

function handleStudentSearch() {
    const searchValue = document.getElementById('student-search-input').value;
    AppState.studentSearch = searchValue;
    loadApplications();
}

function handleRefresh() {
    const studentSearchInput = document.getElementById('student-search-input');
    const teacherSearchInput = document.getElementById('teacher-search-input');
    const studentStatusFilter = document.getElementById('application-status-filter');
    const teacherStatusFilter = document.getElementById('teacher-application-status-filter');

    if (studentSearchInput || studentStatusFilter) {
        if (studentSearchInput) studentSearchInput.value = '';
        if (studentStatusFilter) studentStatusFilter.value = 'all';
        loadApplications();
    }

    if (teacherSearchInput || teacherStatusFilter) {
        if (teacherSearchInput) teacherSearchInput.value = '';
        if (teacherStatusFilter) teacherStatusFilter.value = 'all';
        loadTeacherApplications();
    }
}

function showNewApplicationNotification(count) {
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
    }

    const notification = document.createElement('div');
    notification.className = 'notification';

    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-title">New Application${count > 1 ? 's' : ''} Received</div>
            <div class="notification-message">${count} new student application${count > 1 ? 's' : ''} submitted</div>
        </div>
        <div class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </div>
    `;

    notificationContainer.appendChild(notification);

    playNotificationSound();

    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi57Oue');
        audio.volume = 0.3;
        audio.play().catch(() => { });
    } catch (e) { }
}

function startAutoRefresh() {
    // Clear existing interval
    if (notificationInterval) {
        clearInterval(notificationInterval);
    }

    // Check for new applications every 10 seconds
    notificationInterval = setInterval(() => {
        const currentPage = document.querySelector('.nav-item.active')?.dataset.page;
        if (currentPage === 'student-applications') {
            loadApplications(true);
        }
    }, 10000);
}

function stopAutoRefresh() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
    }
}

function renderApplications(applications) {
    const tbody = safeGetElement('applications-tbody');
    if (!tbody) return;

    tbody.innerHTML = applications.map((app, index) => {
        const appliedDate = app.createdAt ? formatDate(app.createdAt) : '-';

        return `
            <tr data-application-id="${app._id}">
                <td><span class="id-badge">${app.applicationId || '-'}</span></td>
                <td>${app.studentName || '-'}</td>
                <td>${app.class || '-'}</td>
                <td>${app.parentName || '-'}</td>
                <td>${app.phone || '-'}</td>
                <td>${appliedDate}</td>
                <td>${Components.StatusBadge(app.status)}</td>
                <td>${Components.ActionButtons(app, 'student')}</td>
            </tr>
        `;
    }).join('');

    // Show table if it exists
    if (safeGetElement('applications-table')) {
        safeSetDisplay('applications-table', 'table');
    }
}

async function filterApplications() {
    await loadApplications();
}

function renderTeacherApplications() {
    const headers = ['APPLICATION ID', 'NAME', 'POSITION', 'EMAIL', 'PHONE', 'SUBMISSION DATE', 'STATUS', 'ACTIONS'];

    return `
        <div class="applications-stats-grid">
            <div class="app-stat-card pending">
                <div class="app-stat-icon">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="app-stat-content">
                    <span class="app-stat-value" id="teacher-stats-pending">0</span>
                    <span class="app-stat-label">Pending</span>
                </div>
            </div>
            <div class="app-stat-card approved">
                <div class="app-stat-icon">
                    <i class="fas fa-check"></i>
                </div>
                <div class="app-stat-content">
                    <span class="app-stat-value" id="teacher-stats-approved">0</span>
                    <span class="app-stat-label">Approved</span>
                </div>
            </div>
            <div class="app-stat-card rejected">
                <div class="app-stat-icon">
                    <i class="fas fa-times"></i>
                </div>
                <div class="app-stat-content">
                    <span class="app-stat-value" id="teacher-stats-rejected">0</span>
                    <span class="app-stat-label">Rejected</span>
                </div>
            </div>
        </div>

        <div class="content-card applications-card">
            <div class="applications-header">
                <div class="applications-title">
                    <i class="fas fa-briefcase"></i>
                    <h2>Teacher Applications</h2>
                </div>
                
                <div class="applications-controls">
                    <div class="search-wrapper">
                        <i class="fas fa-search"></i>
                        <input type="text" id="teacher-search-input" placeholder="Search applications..." onkeyup="handleTeacherSearch()">
                    </div>
                    
                    <select id="teacher-application-status-filter" onchange="filterTeacherApplications()">
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>

                    <button class="btn-refresh" onclick="handleRefresh()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div id="teacher-applications-loading" style="display: none;"></div>
            <div id="teacher-applications-error" style="display: none;"></div>
            <div class="table-wrapper">
                <table id="teacher-applications-table" class="data-table applications-table">
                    <thead>
                        <tr>
                            ${headers.map(h => `<th>${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody id="teacher-applications-tbody"></tbody>
                </table>
            </div>
            <div id="teacher-applications-empty" style="display: none;"></div>
        </div>
        
        ${Components.Modal('teacher-application-modal', 'Teacher Application Details', 'teacher-application-details', 'large')}
        
        <div id="teacher-reject-modal" class="reject-modal">
            <div class="modal-content small">
                <h3>Reject Teacher Application</h3>
                <p>Please provide a reason for rejecting this application:</p>
                <textarea id="teacher-reject-reason" rows="4" placeholder="Enter rejection reason (optional)"></textarea>
                <div class="reject-modal-buttons">
                    <button class="btn-cancel" onclick="closeTeacherRejectModal()">Cancel</button>
                    <button class="btn-reject-confirm" onclick="confirmTeacherReject()">Reject</button>
                </div>
            </div>
        </div>
    `;
}

function renderStudentManagement() {
    return `
        <div class="teachers-stats-grid">
            <div class="teacher-stat-card total">
                <div class="teacher-stat-icon">
                    <i class="fas fa-users"></i>
                </div>
                <div class="teacher-stat-info">
                    <span class="teacher-stat-value" id="stats-total-students">0</span>
                    <span class="teacher-stat-label">Total Students</span>
                </div>
            </div>
            <div class="teacher-stat-card active">
                <div class="teacher-stat-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="teacher-stat-info">
                    <span class="teacher-stat-value" id="stats-active-students">0</span>
                    <span class="teacher-stat-label">Active Students</span>
                </div>
            </div>
            <div class="teacher-stat-card avg-age student-stat-card">
                <div class="teacher-stat-icon">
                    <i class="fas fa-graduation-cap"></i>
                </div>
                <div class="teacher-stat-info">
                    <span class="teacher-stat-value" id="stats-avg-age">0</span>
                    <span class="teacher-stat-label">Avg. Age</span>
                </div>
            </div>
        </div>

        <div class="content-card" style="padding: 0; background: transparent; border: none; box-shadow: none;">
            <div class="teachers-header-controls">
                <div class="teachers-title-section">
                    <i class="fas fa-user-graduate"></i>
                    <h2>All Students</h2>
                </div>
                
                <div class="teachers-filter-group">
                    <div class="teacher-search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="student-list-search" placeholder="Search by name, email" onkeyup="handleStudentListSearch()">
                    </div>
                    
                    <button class="btn-teacher-refresh" onclick="loadStudents()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div id="students-list-loading" style="display: none;"></div>
            <div class="table-wrapper" style="background: var(--white); border-radius: 0 0 16px 16px;">
                <table class="data-table premium" id="students-list-table">
                    <thead>
                        <tr>
                            <th>STUDENT</th>
                            <th>EMAIL</th>
                            <th>MOBILE</th>
                            <th>CLASS</th>
                            <th>CITY</th>
                            <th>JOINED</th>
                            <th>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody id="students-list-tbody">
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 30px; color: var(--gray);">
                                Loading students...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderManageClasses() {
    return `
        <div class="content-card" style="padding: 0; background: transparent; border: none; box-shadow: none;">
            <div class="mgmt-header-controls">
                <div class="mgmt-title-section">
                    <i class="fas fa-chalkboard-teacher"></i>
                    <h2>Manage Classes</h2>
                </div>
                <div class="mgmt-filter-group">
                    <button class="btn-add-mgmt" onclick="openAddClassModal()">
                        <i class="fas fa-plus"></i> Add Class
                    </button>
                    <button class="btn-teacher-refresh" onclick="loadManageClasses()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div id="classes-list-loading" style="display: none;"></div>
            <div class="table-wrapper" style="background: var(--white); border-radius: 0 0 16px 16px;">
                <table class="data-table premium" id="classes-list-table">
                    <thead>
                        <tr>
                            <th>CLASS</th>
                            <th>CREATED</th>
                            <th>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody id="classes-list-tbody">
                        <tr>
                            <td colspan="3" style="text-align: center; padding: 30px; color: var(--gray);">
                                Loading classes...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        ${Components.Modal('class-modal', 'Class Details', 'class-form-container', 'medium')}
    `;
}

async function loadClassesData() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/class-subjects/classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Status: ${response.status}, Response: ${errorText.substring(0, 100)}`);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            AppState.allClasses = result.data;
            return result.data;
        } else {
            throw new Error(result.message || 'Failed to load classes');
        }
    } catch (error) {
        console.error('Error loading classes data:', error);
        throw error;
    }
}

async function loadManageClasses() {
    const tbody = safeGetElement('classes-list-tbody');
    const loadingIcon = safeGetElement('classes-list-loading');

    if (loadingIcon) loadingIcon.style.display = 'block';

    try {
        const classes = await loadClassesData();
        AppState.allClasses = classes;

        if (tbody) renderClassesTable(classes);

        // Update any class filters if they are currently showing
        const filters = ['subjects-class-filter', 'assign-subjects-class-filter'];
        filters.forEach(filterId => {
            const filter = safeGetElement(filterId);
            if (filter && (filter.innerHTML.trim() === '<option value="all">All Classes</option>' || filter.options.length <= 1)) {
                filter.innerHTML = '<option value="all">All Classes</option>' +
                    classes.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
            }
        });
    } catch (error) {
        console.error('Error loading classes:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger); padding: 20px;">${error.message || 'Network error. Please try again.'}</td></tr>`;
    } finally {
        if (loadingIcon) loadingIcon.style.display = 'none';
    }
}

function renderClassesTable(classes) {
    const tbody = safeGetElement('classes-list-tbody');
    if (!tbody) return;

    if (!classes || classes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 30px; color: var(--gray);">No classes found</td></tr>`;
        return;
    }

    tbody.innerHTML = classes.map(cls => `
        <tr>
            <td><span class="mgmt-row-text">${cls.class || '-'}</span></td>
            <td><span class="mgmt-row-subtext">${cls.createdAt ? formatDate(cls.createdAt) : '03/03/2026'}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="mgmt-action-btn edit" title="Edit Class" onclick="editClass('${cls._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="mgmt-action-btn delete" title="Delete Class" onclick="deleteClass('${cls._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderManageSubjects() {
    return `
        <div class="content-card" style="padding: 0; background: transparent; border: none; box-shadow: none;">
            <div class="mgmt-header-controls">
                <div class="mgmt-title-section">
                    <i class="fas fa-book"></i>
                    <h2>Manage Subjects</h2>
                </div>
                <div class="mgmt-filter-group">
                    <select id="subjects-class-filter" class="mgmt-class-filter" onchange="filterSubjectsByClass()">
                        <option value="all">All Classes</option>
                    </select>
                    <button class="btn-add-mgmt" onclick="openAddSubjectModal()">
                        <i class="fas fa-plus"></i> Add Subject
                    </button>
                    <button class="btn-teacher-refresh" onclick="loadSubjects()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div id="subjects-list-loading" style="display: none;"></div>
            <div class="table-wrapper" style="background: var(--white); border-radius: 0 0 16px 16px;">
                <table class="data-table premium" id="subjects-list-table">
                    <thead>
                        <tr>
                            <th>SUBJECT NAME</th>
                            <th>CODE</th>
                            <th>CLASS</th>
                            <th>CREDITS</th>
                            <th>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody id="subjects-list-tbody">
                        <tr>
                            <td colspan="5" style="text-align: center; padding: 30px; color: var(--gray);">
                                Loading subjects...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        ${Components.Modal('subject-modal', 'Subject Details', 'subject-form-container', 'medium')}
    `;
}

async function loadSubjects() {
    const tbody = safeGetElement('subjects-list-tbody');
    const loadingIcon = safeGetElement('subjects-list-loading');

    if (loadingIcon) loadingIcon.style.display = 'block';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/class-subjects/subjects', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Status: ${response.status}, Response: ${errorText.substring(0, 100)} `);
            throw new Error(`HTTP ${response.status}: ${response.statusText} `);
        }

        const result = await response.json();

        if (result.success) {
            const allSubjects = result.data;
            AppState.allSubjects = allSubjects;

            // Extract unique classes for filter with fallback handling
            const uniqueClasses = [...new Map(allSubjects
                .filter(s => s.classId && s.class) // Filter out invalid entries
                .map(s => [s.classId, {
                    _id: s.classId,
                    class: `Class-${s.class}` // Fallback to "Class N" if className is missing
                }])
            ).values()];

            // Update filters and tables if they exist
            const filter = safeGetElement('subjects-class-filter');
            if (filter) {
                const currentVal = filter.value;
                if (uniqueClasses.length > 0) {
                    filter.innerHTML = '<option value="all">All Classes</option>' +
                        uniqueClasses.map(c => `<option value="${c._id}">${c.class}</option>`).join('');
                } else {
                    filter.innerHTML = '<option value="all">All Classes</option><option disabled>No Classes Available</option>';
                }
                filter.value = currentVal;
            }

            if (tbody) renderSubjectsTable(allSubjects);

            // Also update the Assignment filter if it's currently showing
            const assignFilter = safeGetElement('assign-subjects-class-filter');
            if (assignFilter && (assignFilter.innerHTML.trim() === '<option value="all">All Classes</option>' || assignFilter.options.length <= 1)) {
                if (uniqueClasses.length > 0) {
                    assignFilter.innerHTML = '<option value="all">All Classes</option>' +
                        uniqueClasses.map(c => `<option value="${c._id}">${c.class}</option>`).join('');
                } else {
                    assignFilter.innerHTML = '<option value="all">All Classes</option><option disabled>No Classes Available</option>';
                }
            }
        } else {
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger); padding: 20px;">${result.message || 'Failed to load subjects'}</td></tr>`;
        }
    } catch (error) {
        console.error('Error loading subjects:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger); padding: 20px;">Network error. Please try again.</td></tr>`;
    } finally {
        if (loadingIcon) loadingIcon.style.display = 'none';
    }
}

function renderSubjectsTable(subjects) {
    const tbody = safeGetElement('subjects-list-tbody');
    if (!tbody) return;

    if (!subjects || subjects.length === 0) {
        tbody.innerHTML = `<tr> <td colspan="5" style="text-align: center; padding: 30px; color: var(--gray);">No subjects found</td></tr > `;
        return;
    }

    tbody.innerHTML = subjects.map(sub => `
        <tr>
            <td><span class="mgmt-row-text">${sub.name || '-'}</span></td>
            <td><span class="mgmt-code-text">${sub.code || '-'}</span></td>
            <td><span class="mgmt-row-subtext">${sub.class || '-'}</span></td>
            <td><span class="mgmt-row-text">${sub.credits || '-'}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="mgmt-action-btn edit" title="Edit Subject" onclick="editSubject('${sub._id}', '${sub.classId}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="mgmt-action-btn delete" title="Delete Subject" onclick="deleteSubject('${sub._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `).join('');
}

function filterSubjectsByClass() {
    const classId = safeGetElement('subjects-class-filter')?.value;
    if (!classId || !AppState.allSubjects) return;

    if (classId === 'all') {
        renderSubjectsTable(AppState.allSubjects);
    } else {
        const filtered = AppState.allSubjects.filter(s => s.classId === classId);
        renderSubjectsTable(filtered);
    }
}

/* ============================================
   CLASS CRUD OPERATIONS
   ============================================ */

function openAddClassModal() {
    const content = `
        <form class="form-horizontal" id="class-mgmt-form">
            <div class="form-group">
                <label>Class</label>
                <input type="text" id="cls-class" placeholder="e.g., 1, 2, 10" required>
            </div>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" onclick="closeModal('class-modal')">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Class</button>
            </div>
        </form>
        `;
    showModal('Add New Class', content, 'class-modal');

    document.getElementById('class-mgmt-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const classValue = document.getElementById('cls-class').value;
        await saveClassAction({ class: classValue, name: `Class ${classValue}` });
    });
}

async function saveClassAction(data) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/class-subjects/classes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        if (result.success) {
            showToast('Classes loaded/seeded successfully', 'success');
            closeModal('class-modal');
            loadManageClasses();
        } else {
            showToast(result.message || 'Error processing classes', 'error');
        }
    } catch (error) {
        console.error('Error processing classes:', error);
        showToast('Network error', 'error');
    }
}

function editClass(classId) {
    const cls = AppState.allClasses.find(c => c._id === classId);
    if (!cls) return;

    const content = `
        <form class="form-horizontal" id="class-edit-form">
            <div class="form-group">
                <label>Class</label>
                <input type="text" id="cls-edit-class" value="${cls.class}" required>
            </div>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" onclick="closeModal('class-modal')">Cancel</button>
                <button type="submit" class="btn btn-primary">Update Class</button>
            </div>
        </form>
        `;
    showModal('Edit Class', content, 'class-modal');

    document.getElementById('class-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const classValue = document.getElementById('cls-edit-class').value;
        const data = { class: classValue, name: `Class ${classValue}` };
        await updateClassAction(classId, data);
    });
}

async function updateClassAction(classId, data) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/class-subjects/classes/${classId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
            showToast('Class updated successfully', 'success');
            closeModal('class-modal');
            loadManageClasses();
        } else {
            showToast(result.message || 'Error updating class', 'error');
        }
    } catch (error) {
        console.error('Error updating class:', error);
        showToast('Network error', 'error');
    }
}

async function deleteClass(classId) {
    if (!confirm('Are you sure you want to delete this class? This will also remove all subjects assigned to it.')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/class-subjects/classes/${classId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            showToast('Class deleted successfully', 'success');
            loadManageClasses();
        } else {
            showToast(result.message || 'Error deleting class', 'error');
        }
    } catch (error) {
        console.error('Error deleting class:', error);
        showToast('Network error', 'error');
    }
}

/* ============================================
   SUBJECT CRUD OPERATIONS
   ============================================ */

function openAddSubjectModal() {
    // Ensure classes are loaded
    if (!AppState.allClasses || AppState.allClasses.length === 0) {
        // Load classes data first, then show modal
        loadClassesData().then(() => {
            showAddSubjectModal();
        }).catch(error => {
            console.error('Error loading classes:', error);
            showToast('Error loading classes', 'error');
        });
    } else {
        showAddSubjectModal();
    }
}

function showAddSubjectModal() {
    const content = `
        <form class="form-horizontal" id="subject-mgmt-form">
            <div class="form-group">
                <label>Target Class</label>
                <select id="sub-target-class" required>
                    ${AppState.allClasses && AppState.allClasses.length > 0
            ? AppState.allClasses.map(c => `<option value="${c._id}">${c.name}</option>`).join('')
            : '<option value="">No classes available</option>'}
                </select>
            </div>
            <div class="form-group">
                <label>Subject Name</label>
                <input type="text" id="sub-name" placeholder="e.g., Physics" required>
            </div>
            <div class="form-group">
                <label>Subject Code</label>
                <input type="text" id="sub-code" placeholder="e.g., PHY-101" required>
            </div>
            <div class="form-group">
                <label>Credits</label>
                <input type="number" id="sub-credits" value="3" min="1" required>
            </div>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" onclick="closeModal('subject-modal')">Cancel</button>
                <button type="submit" class="btn btn-primary">Add Subject</button>
            </div>
        </form>
        `;
    showModal('Add New Subject', content, 'subject-modal');

    document.getElementById('subject-mgmt-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const classId = document.getElementById('sub-target-class').value;
        const data = {
            name: document.getElementById('sub-name').value,
            code: document.getElementById('sub-code').value,
            credits: parseInt(document.getElementById('sub-credits').value)
        };
        await saveSubjectAction(classId, data);
    });
}

async function saveSubjectAction(classId, data) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/class-subjects/subjects/${classId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
            showToast('Subject added successfully', 'success');
            closeModal('subject-modal');
            loadSubjects();
        } else {
            showToast(result.message || 'Error adding subject', 'error');
        }
    } catch (error) {
        console.error('Error adding subject:', error);
        showToast('Network error', 'error');
    }
}

function editSubject(subId, classId) {
    const sub = AppState.allSubjects.find(s => s._id === subId);
    if (!sub) return;

    const content = `
        <form class="form-horizontal" id="subject-edit-form">
            <div class="form-group">
                <label>Subject Name</label>
                <input type="text" id="sub-edit-name" value="${sub.name}" required>
            </div>
            <div class="form-group">
                <label>Subject Code</label>
                <input type="text" id="sub-edit-code" value="${sub.code}" required>
            </div>
            <div class="form-group">
                <label>Credits</label>
                <input type="number" id="sub-edit-credits" value="${sub.credits || 3}" min="1" required>
            </div>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" onclick="closeModal('subject-modal')">Cancel</button>
                <button type="submit" class="btn btn-primary">Update Subject</button>
            </div>
        </form>
        `;
    showModal('Edit Subject', content, 'subject-modal');

    document.getElementById('subject-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('sub-edit-name').value,
            code: document.getElementById('sub-edit-code').value,
            credits: parseInt(document.getElementById('sub-edit-credits').value)
        };
        await updateSubjectAction(subId, data);
    });
}

async function updateSubjectAction(subId, data) {
    try {
        const token = localStorage.getItem('token');
        const subject = AppState.allSubjects.find(s => s._id === subId);
        if (!subject) {
            showToast('Subject not found', 'error');
            return;
        }

        const response = await fetch(`/api/class-subjects/subjects/${subject.classId}/${subId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
            showToast('Subject updated successfully', 'success');
            closeModal('subject-modal');
            loadSubjects();
        } else {
            showToast(result.message || 'Error updating subject', 'error');
        }
    } catch (error) {
        console.error('Error updating subject:', error);
        showToast('Network error', 'error');
    }
}

async function deleteSubject(subId) {
    if (!confirm('Are you sure you want to delete this subject?')) return;

    try {
        const token = localStorage.getItem('token');
        const subject = AppState.allSubjects.find(s => s._id === subId);
        if (!subject) {
            showToast('Subject not found', 'error');
            return;
        }

        const response = await fetch(`/api/class-subjects/subjects/${subject.classId}/${subId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            showToast('Subject deleted successfully', 'success');
            loadSubjects();
        } else {
            showToast(result.message || 'Error deleting subject', 'error');
        }
    } catch (error) {
        console.error('Error deleting subject:', error);
        showToast('Network error', 'error');
    }
}

function renderViewTeachers() {
    return `
        <div class="teachers-stats-grid">
            <div class="teacher-stat-card total">
                <div class="teacher-stat-icon">
                    <i class="fas fa-chalkboard-teacher"></i>
                </div>
                <div class="teacher-stat-info">
                    <span class="teacher-stat-value" id="stats-total-teachers">0</span>
                    <span class="teacher-stat-label">Total Teachers</span>
                </div>
            </div>
            <div class="teacher-stat-card active">
                <div class="teacher-stat-icon">
                    <i class="fas fa-user-check"></i>
                </div>
                <div class="teacher-stat-info">
                    <span class="teacher-stat-value" id="stats-active-teachers">0</span>
                    <span class="teacher-stat-label">Active</span>
                </div>
            </div>
            <div class="teacher-stat-card subjects">
                <div class="teacher-stat-icon">
                    <i class="fas fa-book"></i>
                </div>
                <div class="teacher-stat-info">
                    <span class="teacher-stat-value" id="stats-subjects-covered">0</span>
                    <span class="teacher-stat-label">Subjects Covered</span>
                </div>
            </div>
        </div>

        <div class="content-card" style="padding: 0; background: transparent; border: none; box-shadow: none;">
            <div class="teachers-header-controls">
                <div class="teachers-title-section">
                    <i class="fas fa-users"></i>
                    <h2>All Teachers</h2>
                </div>
                
                <div class="teachers-filter-group">
                    <div class="teacher-search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="teacher-list-search" placeholder="Search by name, email" onkeyup="handleTeacherListSearch()">
                    </div>
                    
                    <button class="btn-teacher-refresh" onclick="loadTeachers()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div id="teachers-list-loading" style="display: none;"></div>
            <div class="table-wrapper" style="background: var(--white); border-radius: 0 0 16px 16px;">
                <table class="data-table premium" id="teachers-list-table">
                    <thead>
                        <tr>
                            <th>TEACHER</th>
                            <th>EMAIL</th>
                            <th>PHONE</th>
                            <th>LOCATION</th>
                            <th>JOINED</th>
                            <th>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody id="teachers-list-tbody">
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 30px; color: var(--gray);">
                                Loading teachers...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function loadTeachersData() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/teachers', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            AppState.allTeachers = result.teachers;
            return result.teachers;
        } else {
            throw new Error(result.message || 'Failed to load teachers');
        }
    } catch (error) {
        console.error('Error loading teachers data:', error);
        throw error;
    }
}

async function loadTeachers() {
    const tbody = safeGetElement('teachers-list-tbody');
    if (!tbody) return;

    safeSetDisplay('teachers-list-loading', 'block');

    try {
        const teachers = await loadTeachersData();
        renderTeachersTable(teachers);

        safeSetDisplay('teachers-list-loading', 'none');
    } catch (error) {
        console.error('Error loading teachers:', error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 20px;">${error.message || 'Network error. Please try again.'}</td></tr>`;
        safeSetDisplay('teachers-list-loading', 'none');
    }
}

function renderTeachersTable(teachers) {
    const tbody = safeGetElement('teachers-list-tbody');
    if (!tbody) return;

    if (!teachers || teachers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--gray);">No teachers found</td></tr>`;
        return;
    }

    const avatarColors = ['av-blue', 'av-green', 'av-red', 'av-indigo', 'av-purple', 'av-pink', 'av-amber', 'av-teal'];

    tbody.innerHTML = teachers.map((teacher, index) => {
        const initials = teacher.name ? teacher.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'T';
        const colorClass = avatarColors[index % avatarColors.length];
        const joinedDate = teacher.createdAt ? formatDate(teacher.createdAt) : 'Feb 19, 2026';
        const location = teacher.city ? `${teacher.city}${teacher.state ? ', ' + teacher.state : ''}` : 'Petlad, Gujarat';

        return `
            <tr>
                <td>
                    <div class="teacher-profile-cell">
                        <div class="teacher-avatar-circle ${colorClass}">${initials}</div>
                        <div class="teacher-name-stack">
                            <span class="teacher-full-name">${teacher.name || '-'}</span>
                            <span class="teacher-id-text">ID: ${teacher.userId || '-'}</span>
                        </div>
                    </div>
                </td>
                <td><a href="mailto:${teacher.email}" class="teacher-email-text">${teacher.email || '-'}</a></td>
                <td>${teacher.mobileNumber || '-'}</td>
                <td>
                    <div class="teacher-location-box">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${location}</span>
                    </div>
                </td>
                <td><span class="teacher-date-cell">${joinedDate}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="teacher-action-btn edit" title="Edit Teacher" onclick="editTeacher('${teacher._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="teacher-action-btn delete" title="Delete Account" onclick="deleteTeacher('${teacher._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Update stats
    updateTeacherStats(teachers);
}

function updateTeacherStats(teachers) {
    const total = teachers.length;
    const active = teachers.filter(t => t.status !== 'inactive').length;

    // For "Subjects Covered", we'd ideally have a list of unique subjects
    const subjects = new Set();
    teachers.forEach(t => {
        if (t.subject && t.subject !== 'Not assigned') {
            subjects.add(t.subject);
        }
    });

    safeSetInnerHTML('stats-total-teachers', total);
    safeSetInnerHTML('stats-active-teachers', total); // Assuming all loaded are active for now as per image
    safeSetInnerHTML('stats-subjects-covered', subjects.size || 0);
}

function handleTeacherListSearch() {
    const searchTerm = safeGetElement('teacher-list-search')?.value.toLowerCase() || '';

    if (!AppState.allTeachers) return;

    const filtered = AppState.allTeachers.filter(t => {
        const matchesSearch = (
            t.name?.toLowerCase().includes(searchTerm) ||
            t.email?.toLowerCase().includes(searchTerm) ||
            t.userId?.toLowerCase().includes(searchTerm)
        );
        return matchesSearch;
    });

    renderTeachersTable(filtered);
}

// Teacher Management Functions
async function editTeacher(teacherId) {
    const teacher = AppState.allTeachers.find(t => t._id === teacherId);
    if (!teacher) {
        showToast('Teacher not found', 'error');
        return;
    }

    const modalContent = `
        <form id="edit-teacher-form" class="form-horizontal">
            <div class="form-group">
                <label>Name *</label>
                <input type="text" id="edit-teacher-name" value="${teacher.name || ''}" required>
            </div>
            <div class="form-group">
                <label>Email *</label>
                <input type="email" id="edit-teacher-email" value="${teacher.email || ''}" required>
            </div>
            <div class="form-group">
                <label>Mobile Number</label>
                <input type="tel" id="edit-teacher-mobile" value="${teacher.mobileNumber || ''}">
            </div>
            <div class="form-group">
                <label>City</label>
                <input type="text" id="edit-teacher-city" value="${teacher.city || ''}">
            </div>
            <div class="form-group">
                <label>New Password (leave blank to keep current)</label>
                <input type="password" id="edit-teacher-password" placeholder="Enter new password">
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal('edit-teacher-modal')">Cancel</button>
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i> Update Teacher
                </button>
            </div>
        </form>
    `;

    showModal('Edit Teacher', modalContent, 'edit-teacher-modal');

    // Handle form submission
    const form = document.getElementById('edit-teacher-form');
    form.onsubmit = async (e) => {
        e.preventDefault();

        const updateData = {
            name: document.getElementById('edit-teacher-name').value,
            email: document.getElementById('edit-teacher-email').value,
            mobileNumber: document.getElementById('edit-teacher-mobile').value,
            city: document.getElementById('edit-teacher-city').value
        };

        const password = document.getElementById('edit-teacher-password').value;
        if (password) {
            updateData.password = password;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/admin/teachers/${teacherId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });

            const result = await response.json();

            if (result.success) {
                showToast('Teacher updated successfully', 'success');
                closeModal('edit-teacher-modal');
                loadTeachers(); // Reload the teachers list
            } else {
                showToast(result.message || 'Failed to update teacher', 'error');
            }
        } catch (error) {
            console.error('Error updating teacher:', error);
            showToast('Network error. Please try again.', 'error');
        }
    };
}

async function deleteTeacher(teacherId) {
    const teacher = AppState.allTeachers.find(t => t._id === teacherId);
    if (!teacher) {
        showToast('Teacher not found', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete teacher "${teacher.name}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/teachers/${teacherId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            showToast('Teacher deleted successfully', 'success');
            loadTeachers(); // Reload the teachers list
        } else {
            showToast(result.message || 'Failed to delete teacher', 'error');
        }
    } catch (error) {
        console.error('Error deleting teacher:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

// Student Management Functions
async function loadStudents() {
    const tbody = safeGetElement('students-list-tbody');
    if (!tbody) return;

    safeSetDisplay('students-list-loading', 'block');

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/students', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            AppState.allStudents = result.data;
            renderStudentsTable(result.data);
        } else {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 20px;">${result.message || 'Failed to load students'}</td></tr>`;
        }
    } catch (error) {
        console.error('Error loading students:', error);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 20px;">Network error. Please try again.</td></tr>`;
    } finally {
        safeSetDisplay('students-list-loading', 'none');
    }
}

function renderStudentsTable(students) {
    const tbody = safeGetElement('students-list-tbody');
    if (!tbody) return;

    if (!students || students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--gray);">No students found</td></tr>`;
        return;
    }

    const avatarColors = ['av-blue', 'av-green', 'av-red', 'av-indigo', 'av-purple', 'av-pink', 'av-amber', 'av-teal'];

    tbody.innerHTML = students.map((student, index) => {
        const initials = student.name ? student.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'S';
        const colorClass = avatarColors[index % avatarColors.length];
        const joinedDate = student.createdAt ? formatDate(student.createdAt) : (student.joiningDate || '17/12/2025');

        return `
            <tr>
                <td>
                    <div class="teacher-profile-cell">
                        <div class="teacher-avatar-circle ${colorClass}">${initials}</div>
                        <div class="teacher-name-stack">
                            <span class="teacher-full-name">${student.name || '-'}</span>
                            <span class="teacher-id-text">ID: ${student.userId || '-'}</span>
                        </div>
                    </div>
                </td>
                <td><a href="mailto:${student.email}" class="teacher-email-text">${student.email || '-'}</a></td>
                <td>${student.mobileNumber || '-'}</td>
                <td><span class="student-class-badge">${student.class || '-'}</span></td>
                <td>${student.city || '-'}</td>
                <td><span class="teacher-date-cell">${joinedDate}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="teacher-action-btn edit" title="Edit Student" onclick="editStudent('${student._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="teacher-action-btn delete" title="Delete Student" onclick="deleteStudent('${student._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Update stats
    updateStudentStats(students);
}

function updateStudentStats(students) {
    const total = students.length;
    const active = students.filter(s => s.status !== 'inactive').length;

    // Calculate average age
    let avgAge = 0;
    if (total > 0) {
        const ages = students.map(s => s.age || 0).filter(a => a > 0);
        if (ages.length > 0) {
            avgAge = (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1);
        } else {
            avgAge = "9.8"; // Default placeholder from image if no data
        }
    }

    safeSetInnerHTML('stats-total-students', total);
    safeSetInnerHTML('stats-active-students', active);
    safeSetInnerHTML('stats-avg-age', avgAge);
}

function handleStudentListSearch() {
    const searchTerm = safeGetElement('student-list-search')?.value.toLowerCase() || '';
    if (!AppState.allStudents) return;

    const filtered = AppState.allStudents.filter(s =>
        s.name?.toLowerCase().includes(searchTerm) ||
        s.email?.toLowerCase().includes(searchTerm) ||
        s.userId?.toLowerCase().includes(searchTerm) ||
        s.class?.toLowerCase().includes(searchTerm)
    );

    renderStudentsTable(filtered);
}

async function editStudent(studentId) {
    const student = AppState.allStudents.find(s => s._id === studentId);
    if (!student) {
        showToast('Student not found', 'error');
        return;
    }

    const modalContent = `
        <form id="edit-student-form" class="form-horizontal">
            <div class="form-group">
                <label>Name *</label>
                <input type="text" id="edit-student-name" value="${student.name || ''}" required>
            </div>
            <div class="form-group">
                <label>Email *</label>
                <input type="email" id="edit-student-email" value="${student.email || ''}" required>
            </div>
            <div class="form-group">
                <label>Class</label>
                <input type="text" id="edit-student-class" value="${student.class || ''}">
            </div>
            <div class="form-group">
                <label>Mobile Number</label>
                <input type="tel" id="edit-student-mobile" value="${student.mobileNumber || ''}">
            </div>
            <div class="form-group">
                <label>New Password (leave blank to keep current)</label>
                <input type="password" id="edit-student-password" placeholder="Enter new password">
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal('edit-student-modal')">Cancel</button>
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i> Update Student
                </button>
            </div>
        </form>
    `;

    showModal('Edit Student', modalContent, 'edit-student-modal');

    // Handle form submission
    const form = document.getElementById('edit-student-form');
    form.onsubmit = async (e) => {
        e.preventDefault();

        const updateData = {
            name: document.getElementById('edit-student-name').value,
            email: document.getElementById('edit-student-email').value,
            class: document.getElementById('edit-student-class').value,
            mobileNumber: document.getElementById('edit-student-mobile').value
        };

        const password = document.getElementById('edit-student-password').value;
        if (password) {
            updateData.password = password;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/admin/students/${studentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });

            const result = await response.json();

            if (result.success) {
                showToast('Student updated successfully', 'success');
                closeModal('edit-student-modal');
                loadStudents(); // Reload the students list
            } else {
                showToast(result.message || 'Failed to update student', 'error');
            }
        } catch (error) {
            console.error('Error updating student:', error);
            showToast('Network error. Please try again.', 'error');
        }
    };
}

async function deleteStudent(studentId) {
    const student = AppState.allStudents.find(s => s._id === studentId);
    if (!student) {
        showToast('Student not found', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete student "${student.name}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/students/${studentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            showToast('Student deleted successfully', 'success');
            loadStudents(); // Reload the students list
        } else {
            showToast(result.message || 'Failed to delete student', 'error');
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

function renderAssignClass() {
    return `
        <div class="stats-grid assignment">
            <div class="stat-card assignment">
                <div class="stat-icon blue">
                    <i class="fas fa-school"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-value" id="stats-total-assign-classes">0</span>
                    <span class="stat-label">Total Classes</span>
                </div>
            </div>
            <div class="stat-card assignment">
                <div class="stat-icon green">
                    <i class="fas fa-user-check"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-value" id="stats-assigned-classes">0</span>
                    <span class="stat-label">Assigned</span>
                </div>
            </div>
            <div class="stat-card assignment">
                <div class="stat-icon yellow">
                    <i class="fas fa-user-clock"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-value" id="stats-unassigned-classes">0</span>
                    <span class="stat-label">Unassigned</span>
                </div>
            </div>
        </div>

        <div class="content-card" style="padding: 0; background: transparent; border: none; box-shadow: none;">
            <div class="teachers-header-controls" style="background: white; padding: 20px; border-radius: 16px 16px 0 0; border-bottom: 1px solid #f1f5f9;">
                <div class="teachers-title-section">
                    <i class="fas fa-link" style="color: #2563eb;"></i>
                    <h2 style="font-size: 18px; font-weight: 700;">Class Assignments</h2>
                </div>
                
                <div class="search-filter-container">
                    <div class="premium-search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="class-assign-search" placeholder="Search class or teacher..." onkeyup="filterAssignClasses()">
                    </div>
                    <select id="assign-classes-status-filter" class="premium-select-filter" onchange="filterAssignClasses()">
                        <option value="all">All Status</option>
                        <option value="assigned">Assigned</option>
                        <option value="unassigned">Unassigned</option>
                    </select>
                    <button class="btn-refresh" onclick="loadClassesWithTeachers()" style="background: #2563eb; padding: 10px 16px; border-radius: 8px;">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div class="table-wrapper" style="background: var(--white); border-radius: 0 0 16px 16px;">
                <table class="data-table premium" id="assign-class-table">
                    <thead>
                        <tr>
                            <th style="width: 30%;">CLASS</th>
                            <th style="width: 30%;">ASSIGNED TEACHER</th>
                            <th style="width: 25%;">ASSIGNMENT DATE</th>
                            <th style="width: 15%;">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody id="assign-class-tbody">
                        <tr>
                            <td colspan="4" style="text-align: center; padding: 30px; color: var(--gray);">
                                Loading assignments...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        ${Components.Modal('assign-modal', 'Assign Teacher to Class', 'assign-form-container', 'medium')}
    `;
}

function filterAssignClasses() {
    const searchQuery = document.getElementById('class-assign-search')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('assign-classes-status-filter')?.value || 'all';

    if (!AppState.allClassesWithTeachers) return;

    let filtered = AppState.allClassesWithTeachers;

    // Filter by status
    if (statusFilter === 'assigned') {
        filtered = filtered.filter(c => c.assignedTeacher && c.assignedTeacher.teacherId);
    } else if (statusFilter === 'unassigned') {
        filtered = filtered.filter(c => !c.assignedTeacher || !c.assignedTeacher.teacherId);
    }

    // Filter by search query
    if (searchQuery) {
        filtered = filtered.filter(c =>
            c.name.toLowerCase().includes(searchQuery) ||
            (c.assignedTeacher && c.assignedTeacher.teacherName && c.assignedTeacher.teacherName.toLowerCase().includes(searchQuery))
        );
    }

    renderAssignClassTable(filtered);
}

async function loadClassesWithTeachers() {
    const tbody = document.getElementById('assign-class-tbody');
    if (!tbody) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/assign/classes-with-teachers', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load assignments');

        const result = await response.json();
        if (result.success) {
            AppState.allClassesWithTeachers = result.data;
            filterAssignClasses();
        } else {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger); padding: 20px;">${result.message}</td></tr>`;
        }
    } catch (error) {
        console.error('Error loading assignments:', error);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger); padding: 20px;">Error loading assignments.</td></tr>`;
    }
}

function renderAssignClassTable(classes) {
    const tbody = document.getElementById('assign-class-tbody');
    if (!tbody) return;

    if (!classes || classes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px; color: var(--gray);">No classes found</td></tr>';
        return;
    }

    tbody.innerHTML = classes.map(cls => {
        const isAssigned = cls.assignedTeacher && cls.assignedTeacher.teacherId;
        const assignmentDate = isAssigned ? formatDate(cls.assignedTeacher.assignedAt) : '-';

        return `
            <tr>
                <td><span class="class-pill-badge">${cls.class || '-'}</span></td>
                <td>
                    ${isAssigned ? `
                        <div class="teacher-info-cell">
                            <span class="teacher-name-main">${cls.assignedTeacher.teacherName || ''}</span>
                            <span class="teacher-id-sub">ID: ${cls.assignedTeacher.teacherId.substring(0, 8)}...</span>
                        </div>
                    ` : '<span class="not-assigned-text">Not Assigned</span>'}
                </td>
                <td>
                    ${isAssigned ? `
                        <div class="date-cell">
                            <i class="far fa-calendar-alt"></i>
                            <span>${assignmentDate}</span>
                        </div>
                    ` : '-'}
                </td>
                <td>
                    ${isAssigned ? `
                        <button class="action-btn-circle unassign" title="Unassign Teacher" onclick="removeTeacherAssignment('${cls.class}')">
                            <i class="fas fa-unlink"></i>
                        </button>
                    ` : `
                        <button class="action-btn-circle assign" title="Assign Teacher" onclick="openAssignClassModal('${cls.class}')">
                            <i class="fas fa-link"></i>
                        </button>
                    `}
                </td>
            </tr>
        `;
    }).join('');

    // Update stats
    const total = classes.length;
    const assigned = classes.filter(c => c.assignedTeacher && c.assignedTeacher.teacherId).length;
    const unassigned = total - assigned;

    safeSetInnerHTML('stats-total-assign-classes', total);
    safeSetInnerHTML('stats-assigned-classes', assigned);
    safeSetInnerHTML('stats-unassigned-classes', unassigned);
}

async function openAssignClassModal(classId = '') {
    // Ensure we have teachers and classes
    if (AppState.allTeachers.length === 0) await loadTeachersData();
    if (AppState.allClasses.length === 0) await loadClassesData();

    const selectedClass = classId ? AppState.allClasses.find(c => c.class == classId) : null;

    const content = `
        <form class="form-horizontal" id="assign-class-form">
            <div class="form-group">
                <label>Select Class</label>
                <select id="assign-class-id" required ${classId ? 'disabled' : ''}>
                    <option value="">Choose Class...</option>
                    ${AppState.allClasses.map(c => `<option value="${c.class}" ${c.class == classId ? 'selected' : ''}>${c.class}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Select Teacher</label>
                <select id="assign-teacher-id" required>
                    <option value="">Choose Teacher...</option>
                    ${AppState.allTeachers.map(t => `<option value="${t._id}">${t.name} (${t.email})</option>`).join('')}
                </select>
            </div>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" onclick="closeModal('assign-modal')">Cancel</button>
                <button type="submit" class="btn btn-primary">Assign Teacher</button>
            </div>
        </form>
    `;

    showModal('Assign Teacher to Class', content, 'assign-modal');

    document.getElementById('assign-class-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const cid = document.getElementById('assign-class-id').value;
        const tid = document.getElementById('assign-teacher-id').value;

        await saveClassAssignment(cid, { teacherId: tid });
    });
}

async function saveClassAssignment(classId, data) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/assign/classes/${classId}/assign-teacher`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
            showToast('Teacher assigned successfully', 'success');
            closeModal('assign-modal');
            loadClassesWithTeachers();
            loadManageClasses(); // Refresh general class list if needed
        } else {
            showToast(result.message || 'Error assigning teacher', 'error');
        }
    } catch (error) {
        console.error('Error assigning teacher:', error);
        showToast('Network error', 'error');
    }
}

async function removeTeacherAssignment(classId) {
    if (!confirm('Are you sure you want to remove the assigned teacher from this class?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/assign/classes/${classId}/remove-teacher`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            showToast('Teacher unassigned successfully', 'success');
            loadClassesWithTeachers();
        } else {
            showToast(result.message || 'Error removing assignment', 'error');
        }
    } catch (error) {
        console.error('Error removing assignment:', error);
        showToast('Network error', 'error');
    }
}

function renderAssignSubject() {
    return `
        <div class="stats-grid assignment">
            <div class="stat-card assignment">
                <div class="stat-icon purple">
                    <i class="fas fa-book"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-value" id="stats-total-assign-subjects">0</span>
                    <span class="stat-label">Total Subjects</span>
                </div>
            </div>
            <div class="stat-card assignment">
                <div class="stat-icon green">
                    <i class="fas fa-check-double"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-value" id="stats-assigned-subjects">0</span>
                    <span class="stat-label">Assigned</span>
                </div>
            </div>
            <div class="stat-card assignment">
                <div class="stat-icon yellow">
                    <i class="far fa-clock"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-value" id="stats-unassigned-subjects">0</span>
                    <span class="stat-label">Unassigned</span>
                </div>
            </div>
        </div>

        <div class="content-card" style="padding: 0; background: transparent; border: none; box-shadow: none;">
            <div class="teachers-header-controls" style="background: white; padding: 20px; border-radius: 16px 16px 0 0; border-bottom: 1px solid #f1f5f9;">
                <div class="teachers-title-section">
                    <i class="fas fa-book-reader" style="color: #2563eb;"></i>
                    <h2 style="font-size: 18px; font-weight: 700;">Subject Assignments</h2>
                </div>
                
                <div class="search-filter-container">
                    <select id="assign-subjects-class-filter" class="premium-select-filter" onchange="filterAssignSubjects()" style="min-width: 200px;">
                        <option value="all">All Classes</option>
                    </select>
                    <select id="assign-subjects-status-filter" class="premium-select-filter" onchange="filterAssignSubjects()">
                        <option value="all">All Status</option>
                        <option value="assigned">Assigned</option>
                        <option value="unassigned">Unassigned</option>
                    </select>
                    <button class="btn-refresh" onclick="loadSubjectsForAssignment()" style="background: #2563eb; padding: 10px 16px; border-radius: 8px;">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div class="table-wrapper" style="background: var(--white); border-radius: 0 0 16px 16px;">
                <table class="data-table premium" id="assign-subject-table">
                    <thead>
                        <tr>
                            <th style="width: 30%;">SUBJECT</th>
                            <th style="width: 20%;">CLASS</th>
                            <th style="width: 25%;">ASSIGNED TEACHER</th>
                            <th style="width: 15%;">ASSIGNMENT DATE</th>
                            <th style="width: 10%;">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody id="assign-subject-tbody">
                        <tr>
                            <td colspan="5" style="text-align: center; padding: 30px; color: var(--gray);">
                                Loading subjects...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        ${Components.Modal('assign-subject-modal', 'Assign Teacher to Subject', 'assign-subject-form-container', 'medium')}
    `;
}

function filterAssignSubjects() {
    const classFilter = document.getElementById('assign-subjects-class-filter')?.value || 'all';
    const statusFilter = document.getElementById('assign-subjects-status-filter')?.value || 'all';

    if (!AppState.allSubjects) return;

    let filtered = AppState.allSubjects;

    // Filter by status
    if (statusFilter === 'assigned') {
        filtered = filtered.filter(s => s.assignedTeacher && s.assignedTeacher.teacherId);
    } else if (statusFilter === 'unassigned') {
        filtered = filtered.filter(s => !s.assignedTeacher || !s.assignedTeacher.teacherId);
    }

    // Filter by class
    if (classFilter !== 'all') {
        filtered = filtered.filter(s => s.classId === classFilter);
    }

    renderAssignSubjectTable(filtered);
}

async function loadSubjectsForAssignment() {
    const tbody = document.getElementById('assign-subject-tbody');
    if (!tbody) return;

    try {
        const subjectsPromise = AppState.allSubjects.length === 0 ? loadSubjects() : Promise.resolve();
        const classesPromise = AppState.allClasses.length === 0 ? loadManageClasses() : Promise.resolve();

        await Promise.all([subjectsPromise, classesPromise]);

        // Populate class filter dropdown
        const classFilter = document.getElementById('assign-subjects-class-filter');
        if (classFilter && AppState.allClasses.length > 0) {
            const currentVal = classFilter.value;
            classFilter.innerHTML = '<option value="all">All Classes</option>' +
                AppState.allClasses.map(c => `<option value="${c._id}" ${c._id === currentVal ? 'selected' : ''}>Class - ${c.class}</option>`).join('');
        }

        filterAssignSubjects();
    } catch (error) {
        console.error('Error loading subjects for assignment:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger); padding: 20px;">Error loading subjects.</td></tr>';
    }
}

function renderAssignSubjectTable(subjects) {
    const tbody = document.getElementById('assign-subject-tbody');
    if (!tbody) return;

    if (!subjects || subjects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--gray);">No subjects found</td></tr>';
        return;
    }

    tbody.innerHTML = subjects.map(sub => {
        const isAssigned = sub.assignedTeacher && sub.assignedTeacher.teacherId;

        return `
            <tr>
                <td>
                    <div class="subject-info-cell">
                        <span class="subject-name-main">${sub.name || '-'}</span>
                        <span class="subject-meta-sub">Code: ${sub.code || '-'} | Credits: ${sub.credits || '0'}</span>
                    </div>
                </td>
                <td><span class="class-pill-badge">${sub.class || '-'}</span></td>
                <td>
                    ${isAssigned ? `
                        <div class="teacher-info-cell">
                            <span class="teacher-name-main">${sub.assignedTeacher.teacherName || ''}</span>
                            <span class="teacher-id-sub">ID: ${sub.assignedTeacher.teacherId.substring(0, 8)}...</span>
                        </div>
                    ` : '<span class="not-assigned-text">Not Assigned</span>'}
                </td>
                <td>
                    ${isAssigned ? `
                        <div class="date-cell">
                            <i class="far fa-calendar-alt"></i>
                            <span>${formatDate(sub.assignedTeacher.assignedAt)}</span>
                        </div>
                    ` : '-'}
                </td>
                <td>
                    ${isAssigned ? `
                        <button class="action-btn-circle unassign" title="Unassign Teacher" onclick="removeSubjectAssignment('${sub.class}', '${sub._id}')">
                            <i class="fas fa-unlink"></i>
                        </button>
                    ` : `
                        <button class="action-btn-circle assign" title="Assign Teacher" onclick="openAssignSubjectModal('${sub._id}', '${sub.class}')">
                            <i class="fas fa-link"></i>
                        </button>
                    `}
                </td>
            </tr>
        `;
    }).join('');

    // Update stats
    const allSubjects = AppState.allSubjects || subjects;
    const total = allSubjects.length;
    const assigned = allSubjects.filter(s => s.assignedTeacher && s.assignedTeacher.teacherId).length;
    const unassigned = total - assigned;

    safeSetInnerHTML('stats-total-assign-subjects', total);
    safeSetInnerHTML('stats-assigned-subjects', assigned);
    safeSetInnerHTML('stats-unassigned-subjects', unassigned);
}

async function openAssignSubjectModal(subjectId, classId) {
    // Ensure we have teachers
    if (AppState.allTeachers.length === 0) await loadTeachersData();

    const subject = AppState.allSubjects.find(s => s._id === subjectId);

    const content = `
        <form class="form-horizontal" id="assign-subject-form">
            <div class="form-group">
                <label>Subject</label>
                <input type="text" value="${subject ? subject.name : ''}" disabled>
            </div>
            <div class="form-group">
                <label>Select Teacher</label>
                <select id="assign-sub-teacher-id" required>
                    <option value="">Choose Teacher...</option>
                    ${AppState.allTeachers.map(t => `<option value="${t._id}">${t.name} (${t.email})</option>`).join('')}
                </select>
            </div>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" onclick="closeModal('assign-subject-modal')">Cancel</button>
                <button type="submit" class="btn btn-primary">Assign Teacher</button>
            </div>
        </form>
    `;

    showModal('Assign Teacher to Subject', content, 'assign-subject-modal');

    const form = document.getElementById('assign-subject-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const tid = document.getElementById('assign-sub-teacher-id').value;
        await saveSubjectAssignment(classId, subjectId, tid);
    };
}

async function saveSubjectAssignment(classId, subjectId, teacherId) {
    try {
        const token = localStorage.getItem('token');
        const url = `/api/assign/subjects/${classId}/${subjectId}/assign-teacher`;
        console.log(`Sending POST request to: ${url}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ teacherId })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Error assigning teacher';
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.message || errorMessage;
            } catch (e) {
                console.error('Non-JSON error response:', errorText);
            }
            showToast(errorMessage, 'error');
            return;
        }

        const result = await response.json();
        if (result.success) {
            showToast('Teacher assigned to subject successfully', 'success');
            closeModal('assign-subject-modal');
            await loadSubjects(); // Refresh subjects list in state
            filterAssignSubjects(); // Re-render table with current filter
        } else {
            showToast(result.message || 'Error assigning teacher', 'error');
        }
    } catch (error) {
        console.error('Error assigning teacher to subject:', error);
        showToast('Network error', 'error');
    }
}

async function removeSubjectAssignment(classId, subjectId) {
    if (!confirm('Are you sure you want to remove the assigned teacher from this subject?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/assign/subjects/${classId}/${subjectId}/remove-teacher`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            showToast('Teacher unassigned successfully', 'success');
            await loadSubjects(); // Refresh subjects list in state
            filterAssignSubjects(); // Re-render table with current filter
        } else {
            showToast(result.message || 'Error removing assignment', 'error');
        }
    } catch (error) {
        console.error('Error removing assignment:', error);
        showToast('Network error', 'error');
    }
}

// ============================================
// ACADEMIC YEAR CONFIGURATION
// ============================================

// Global state for academic setup
let academicData = [];
let currentCalendarMonth = new Date().getMonth();
let currentCalendarYear = new Date().getFullYear();

function getAcademicYearString(month, year) {
    // School year usually starts in July (Month index 6)
    if (month >= 6) {
        return `${year}-${year + 1}`;
    } else {
        return `${year - 1}-${year}`;
    }
}

function renderAcademicYear() {
    return `
        <div class="academic-setup-container">
            <!-- Main Header Area -->
            <div class="academic-setup-header">
                <div class="header-top">
                    <h3><i class="fas fa-calendar-check" style="color:var(--primary); margin-right:10px;"></i>Configure Academic Year Data</h3>
                    <button class="btn btn-clear-all" onclick="handleClearAllAcademicData()">
                        <i class="fas fa-trash-alt"></i> Clear All
                    </button>
                </div>

                <div class="setup-summary-cards">
                    <!-- Holidays Card -->
                    <div class="summary-card holiday-summary">
                        <div class="card-icon-wrapper">
                            <i class="fas fa-umbrella-beach"></i>
                        </div>
                        <div class="card-info">
                            <h4>Holidays List</h4>
                            <p>Manage academic holidays</p>
                        </div>
                        <div class="card-actions">
                            <button class="icon-btn-utility" onclick="downloadSampleAcademicCSV('holiday')" title="Download Sample">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="btn btn-red-upload" onclick="document.getElementById('holiday-csv-input').click()">
                                Upload
                            </button>
                        </div>
                    </div>

                    <!-- Events Card -->
                    <div class="summary-card event-summary">
                        <div class="card-icon-wrapper">
                            <i class="fas fa-star"></i>
                        </div>
                        <div class="card-info">
                            <h4>School Events</h4>
                            <p>Hackathons, fests, meets</p>
                        </div>
                        <div class="card-actions">
                            <button class="icon-btn-utility" onclick="downloadSampleAcademicCSV('event')" title="Download Sample">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="btn btn-blue-upload" onclick="document.getElementById('holiday-csv-input').click()">
                                Upload
                            </button>
                        </div>
                    </div>
                </div>
                <input type="file" id="holiday-csv-input" accept=".csv" style="display: none;" onchange="handleHolidayUpload(this)">
            </div>

            <div class="setup-grid">
                <!-- Left: Calendar Preview -->
                <div class="content-card calendar-card-new">
                    <div class="calendar-card-header">
                        <div class="header-left">
                            <i class="fas fa-calendar-alt"></i> Academic Calendar
                        </div>
                    </div>
                    
                    <div class="calendar-nav-centered">
                        <button class="nav-arrow-edge" onclick="changeAcademicMonth(-1)"><i class="fas fa-chevron-left"></i></button>
                        <h2 id="calendar-month-year-display">${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][currentCalendarMonth]} ${currentCalendarYear}</h2>
                        <button class="nav-arrow-edge" onclick="changeAcademicMonth(1)"><i class="fas fa-chevron-right"></i></button>
                    </div>

                    <div id="academic-calendar-container" class="calendar-grid-wrapper">
                        <!-- Calendar grid will be rendered here -->
                    </div>
                </div>

                <!-- Right: Schedule List -->
                <div class="content-card schedule-card">
                    <div class="schedule-header">
                        <div class="header-left">
                            <i class="fas fa-list-ul"></i> Events & Holidays
                        </div>
                        <div class="list-filters-chips">
                            <button class="filter-chip-new active" data-type="all">All</button>
                            <button class="filter-chip-new" data-type="holiday">Holidays</button>
                            <button class="filter-chip-new" data-type="event">Events</button>
                        </div>
                    </div>
                    
                    <div class="current-month-banner" id="current-month-banner">
                        <i class="fas fa-calendar-day"></i> <span id="banner-month-text">${["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"][currentCalendarMonth]} ${currentCalendarYear}</span>
                    </div>

                    <div id="academic-list-tbody" class="schedule-list">
                        <!-- List items will be rendered here -->
                        <div class="empty-list-state">No data loaded for this month</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function initializeAcademicSetup() {
    // Add event listeners for chips
    document.querySelectorAll('.filter-chip-new').forEach(chip => {
        chip.addEventListener('click', function () {
            document.querySelectorAll('.filter-chip-new').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            renderAcademicList(this.dataset.type);
        });
    });

    await loadAcademicData();
}

async function loadAcademicData() {
    const container = document.getElementById('academic-calendar-container');
    if (!container) return;

    container.innerHTML = Components.LoadingState();

    try {
        const token = localStorage.getItem('token');
        const academicYear = getAcademicYearString(currentCalendarMonth, currentCalendarYear);

        const response = await fetch(`/api/academic-year/holidays?academicYear=${academicYear}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            academicData = result.data;
            renderAcademicCalendar();
            renderAcademicList('all');
        } else {
            showToast(result.message, 'error');
        }
    } catch (error) {
        console.error('Error loading academic data:', error);
    }
}

function renderAcademicCalendar() {
    const container = document.getElementById('academic-calendar-container');
    const displayElement = document.getElementById('calendar-month-year-display');
    if (!container) return;

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    if (displayElement) displayElement.textContent = `${monthNames[currentCalendarMonth]} ${currentCalendarYear}`;

    let html = `
        <div class="calendar-header-row">
            <div class="calendar-header-cell">Sun</div>
            <div class="calendar-header-cell">Mon</div>
            <div class="calendar-header-cell">Tue</div>
            <div class="calendar-header-cell">Wed</div>
            <div class="calendar-header-cell">Thu</div>
            <div class="calendar-header-cell">Fri</div>
            <div class="calendar-header-cell">Sat</div>
        </div>
        <div class="calendar-days-grid">
    `;

    // 7 columns x 6 rows = 42 cells
    const firstDayOfMonth = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay();
    const daysInMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentCalendarYear, currentCalendarMonth, 0).getDate();
    const today = new Date();

    for (let i = 0; i < 42; i++) {
        let dayNum;
        let isCurrentMonth = true;
        let cellDate;

        if (i < firstDayOfMonth) {
            dayNum = daysInPrevMonth - firstDayOfMonth + i + 1;
            isCurrentMonth = false;
            cellDate = new Date(currentCalendarYear, currentCalendarMonth - 1, dayNum);
        } else if (i < firstDayOfMonth + daysInMonth) {
            dayNum = i - firstDayOfMonth + 1;
            cellDate = new Date(currentCalendarYear, currentCalendarMonth, dayNum);
        } else {
            dayNum = i - (firstDayOfMonth + daysInMonth) + 1;
            isCurrentMonth = false;
            cellDate = new Date(currentCalendarYear, currentCalendarMonth + 1, dayNum);
        }

        const dateStr = getLocalDateString(cellDate);
        const isToday = today.toDateString() === cellDate.toDateString();

        // Find holiday/event for this specific date
        const items = academicData.filter(h => {
            const hDate = getUTCDateString(h.date);
            return hDate === dateStr;
        });

        let dayClass = isCurrentMonth ? 'current-month' : 'other-month';
        if (isToday) dayClass += ' today';

        let dayNumClass = 'day-num';
        let statusBoxesHtml = '';

        if (isCurrentMonth && items.length > 0) {
            const primaryItem = items[0];
            const hType = primaryItem.type?.toLowerCase() || "holiday";

            // Add background class to the cell
            if (hType === 'holiday') {
                dayClass += ' holiday-bg';
                dayNumClass += ' holiday-date';
            } else {
                dayClass += ' event-bg';
                dayNumClass += ' event-date';
            }

            // Add status boxes for all items on this day
            const statusBoxes = items.map(item => {
                const itemType = item.type?.toLowerCase() || 'holiday';
                return `<div class="status-box ${itemType}"></div>`;
            }).join('');
            statusBoxesHtml = `<div class="day-status-boxes">${statusBoxes}</div>`;
        }

        html += `
            <div class="calendar-day-cell ${dayClass}">
                <div class="${dayNumClass}">${dayNum}</div>
                ${statusBoxesHtml}
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

async function changeAcademicMonth(delta) {
    const prevYearString = getAcademicYearString(currentCalendarMonth, currentCalendarYear);

    currentCalendarMonth += delta;
    if (currentCalendarMonth > 11) {
        currentCalendarMonth = 0;
        currentCalendarYear++;
    } else if (currentCalendarMonth < 0) {
        currentCalendarMonth = 11;
        currentCalendarYear--;
    }

    const newYearString = getAcademicYearString(currentCalendarMonth, currentCalendarYear);

    // If we crossed an academic year boundary, reload data
    if (prevYearString !== newYearString) {
        await loadAcademicData();
    } else {
        renderAcademicCalendar();
        const activeFilter = document.querySelector('.filter-chip-new.active')?.dataset.type || 'all';
        renderAcademicList(activeFilter);
    }
}

function renderAcademicList(filterType = 'all') {
    const listContainer = document.getElementById('academic-list-tbody');
    const bannerText = document.getElementById('banner-month-text');
    if (!listContainer) return;

    const monthNamesUpper = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    if (bannerText) bannerText.textContent = `${monthNamesUpper[currentCalendarMonth]} ${currentCalendarYear}`;

    const filtered = academicData.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate.getUTCMonth() === currentCalendarMonth &&
            itemDate.getUTCFullYear() === currentCalendarYear &&
            (filterType === 'all' || item.type === filterType);
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<div class="empty-list-state">No entries found for this month</div>';
        return;
    }

    const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    listContainer.innerHTML = sorted.map(item => {
        const start = new Date(item.date);
        const dayNum = start.getUTCDate();
        const monthStr = monthNames[start.getUTCMonth()];

        const isHoliday = item.type?.toLowerCase() === 'holiday';
        const indicatorClass = isHoliday ? 'holiday' : 'event';

        return `
            <div class="schedule-item">
                <div class="schedule-date-box">
                    <div class="schedule-day">${dayNum}</div>
                    <div class="schedule-month">${monthStr}</div>
                </div>
                <div class="schedule-indicator ${indicatorClass}"></div>
                <div class="schedule-content">
                    <div class="schedule-title">${item.name}</div>
                    <div class="schedule-meta">${item.description || item.type}</div>
                </div>
            </div>
        `;
    }).join('');
}

async function handleClearAllAcademicData() {
    if (!confirm('Are you sure you want to clear ALL academic holidays and events? This action cannot be undone.')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/academic-year/clear-all', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            showToast('All academic data cleared', 'success');
            academicData = [];
            renderAcademicCalendar();
            renderAcademicList('all');
        } else {
            showToast(result.message || 'Failed to clear data', 'error');
        }
    } catch (error) {
        console.error('Error clearing academic data:', error);
        showToast('Failed to clear academic data', 'error');
    }
}

async function downloadSampleAcademicCSV(type = 'holiday') {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/academic-year/sample-csv?type=${type}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `academic_${type}_sample.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            const result = await response.json();
            showToast(result.message || 'Failed to download sample', 'error');
        }
    } catch (error) {
        console.error('Error downloading sample:', error);
        showToast('Failed to download sample CSV', 'error');
    }
}

async function handleHolidayUpload(input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const formData = new FormData();
    formData.append('holiday_csv', file);

    // Get current academic year based on calendar view
    const academicYear = getAcademicYearString(currentCalendarMonth, currentCalendarYear);
    formData.append('academicYear', academicYear);

    try {
        const token = localStorage.getItem('token');
        showToast('Uploading and processing schedule...', 'info');

        const response = await fetch('/api/academic-year/upload-holidays', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            showToast(result.message, 'success');
            await loadAcademicData();
        } else {
            showToast(result.message || 'Upload failed', 'error');
        }
    } catch (error) {
        console.error('Error uploading academic data:', error);
        showToast('Failed to upload file', 'error');
    } finally {
        input.value = ''; // Reset input
    }
}



function renderTimetable() {
    return `
        <div class="timetable-container" style="padding: 20px;">
            <div class="content-card" style="padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff;">
                <div class="section-header" style="margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px;">
                    <h3 style="font-size: 1.25rem; color: #1e293b; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-calendar-alt" style="color: #0052cc;"></i>
                        Generate Weekly Timetable
                    </h3>
                </div>

                <form id="timetable-gen-form">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #64748b; font-size: 0.9rem;">Select Class</label>
                            <select id="tt-class-select" required style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc;" onchange="checkExistingTimetableStatus()">
                                <option value="">Loading classes...</option>
                            </select>
                            <div id="timetable-status-msg" style="margin-top: 8px; font-size: 0.85rem; font-weight: 500; display: none;"></div>
                        </div>
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #64748b; font-size: 0.9rem;">Period Duration (Minutes)</label>
                            <input type="number" id="tt-duration" value="45" min="15" max="120" required style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc;">
                        </div>
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #64748b; font-size: 0.9rem;">Start Time</label>
                            <input type="time" id="tt-start-time" value="08:00" required style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc;">
                        </div>
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #64748b; font-size: 0.9rem;">End Time</label>
                            <input type="time" id="tt-end-time" value="14:00" required style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc;">
                        </div>
                    </div>

                    <div style="margin-top: 25px; display: flex; gap: 12px;">
                        <button type="submit" id="generate-tt-btn" class="btn btn-primary" style="flex: 2; padding: 12px; font-weight: 600; border-radius: 6px; background: #0052cc; border: none; color: #fff;">
                            Generate Timetable
                        </button>
                        <button type="button" onclick="loadExistingTimetable()" class="btn btn-secondary" style="flex: 1; padding: 12px; font-weight: 500; border-radius: 6px; background: #fff; border: 1px solid #e2e8f0; color: #475569;">
                            View Existing
                        </button>
                    </div>
                </form>
            </div>

            <div id="timetable-result-container" style="margin-top: 30px;">
                <!-- Result will be injected here -->
            </div>
        </div>
    `;
}

async function checkExistingTimetableStatus() {
    const classId = document.getElementById('tt-class-select').value;
    const msgEl = document.getElementById('timetable-status-msg');

    if (!classId) {
        msgEl.style.display = 'none';
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/class-subjects/view-timetable/${classId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
            msgEl.innerHTML = '<i class="fas fa-info-circle"></i> Timetable already exists for this class.';
            msgEl.style.color = '#f59e0b';
            msgEl.style.display = 'block';
        } else {
            msgEl.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking timetable status:', error);
    }
}


function downloadTimetablePDF() {
    const data = AppState.currentTimetableData;
    if (!data || data.length === 0) {
        showToast('No timetable data available to download', 'error');
        return;
    }

    const classSelect = document.getElementById('tt-class-select');
    const classNameFull = classSelect ? classSelect.options[classSelect.selectedIndex].text : 'Class';
    const className = classNameFull.split(' (')[0];

    // Standard days for school timetable
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const shortDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Group data by day
    const grouped = days.reduce((acc, day) => {
        acc[day] = data.filter(item => item.day === day);
        return acc;
    }, {});

    // Find all unique time slots
    const uniqueSlots = [];
    const slotMap = new Set();
    data.forEach(item => {
        const key = `${item.startTime}-${item.endTime}`;
        if (!slotMap.has(key)) {
            slotMap.add(key);
            uniqueSlots.push({ start: item.startTime, end: item.endTime });
        }
    });
    uniqueSlots.sort((a, b) => a.start.localeCompare(b.start));

    // Create professional PDF container
    const pdfDiv = document.createElement('div');
    pdfDiv.style.padding = '20px'; // Reduced padding
    pdfDiv.style.background = '#fff';
    // Use 1080px for better fit on A4 Landscape with margins
    pdfDiv.style.width = '1080px';
    pdfDiv.style.boxSizing = 'border-box';

    pdfDiv.innerHTML = `
        <div style="font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.4; width: 100%;">
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 2px solid #0052cc; padding-bottom: 10px;">
                <div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #0052cc; letter-spacing: -0.5px;">SCHOLARPATH</h1>
                    <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 500; color: #64748b;">Excellence in Digital Learning</p>
                </div>
                <div style="text-align: right;">
                    <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #1e293b;">Weekly Class Timetable</h2>
                    <p style="margin: 1px 0 0 0; font-size: 13px; font-weight: 600; color: #0052cc;">${className}</p>
                </div>
            </div>

            <!-- Timetable Table -->
            <table style="width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; table-layout: fixed;">
                <thead>
                    <tr style="background-color: #f8fafc;">
                        <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; border-right: 1px solid #e2e8f0; font-weight: 700; text-align: center; width: 14%; font-size: 11px; color: #475569; text-transform: uppercase;">Time Slot</th>
                        ${shortDays.map(day => `
                            <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; border-right: 1px solid #e2e8f0; font-weight: 700; text-align: center; font-size: 11px; color: #475569; text-transform: uppercase;">${day}</th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${uniqueSlots.map((slot, index) => `
                        <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                            <td style="border-bottom: 1px solid #e2e8f0; border-right: 2px solid #e2e8f0; padding: 10px; font-weight: 700; text-align: center; font-size: 11px; color: #334155; background-color: #f1f5f9;">
                                ${slot.start}<br><span style="font-size: 9px; color: #94a3b8; font-weight: 500;">to</span><br>${slot.end}
                            </td>
                            ${days.map(day => {
        const entry = grouped[day].find(e => e.startTime === slot.start);
        return `
                                    <td style="border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; padding: 8px; text-align: center; vertical-align: middle; height: 50px;">
                                        ${entry ? `
                                            <div style="font-weight: 700; font-size: 12px; color: #0052cc; margin-bottom: 2px; line-height: 1.1;">${entry.subjectName}</div>
                                            <div style="font-size: 10px; color: #64748b; font-weight: 500;">${entry.teacherName || '-'}</div>
                                        ` : '<span style="color: #cbd5e1; font-size: 14px;">•</span>'}
                                    </td>
                                `;
    }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <!-- Footer Info -->
            <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px dashed #e2e8f0;">
                <div style="font-size: 10px; color: #94a3b8; font-weight: 500;">
                    Generated from ScholarPath Admin Dashboard
                </div>
                <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Date: ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
            </div>
        </div>
    `;

    const opt = {
        margin: [5, 5, 5, 5],
        filename: `${className.replace(/\s+/g, '_')}_Timetable.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { scale: 2, useCORS: true, logging: false, width: 1080 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true }
    };

    html2pdf().set(opt).from(pdfDiv).save()
        .then(() => showToast('Timetable PDF generated successfully', 'success'))
        .catch(err => {
            console.error('PDF Generation Error:', err);
            showToast('Failed to generate professional PDF', 'error');
        });
}

// Global state for classes to avoid repeated fetches
let ttClasses = [];

async function initializeTimetable() {
    const classSelect = document.getElementById('tt-class-select');
    if (!classSelect) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/class-subjects/classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            ttClasses = result.data;
            classSelect.innerHTML = '<option value="">Select a class</option>' +
                ttClasses.map(c => `<option value="${c.class}">Class-${c.class}</option>`).join('');
        }
    } catch (error) {
        console.error('Error fetching classes for timetable:', error);
        classSelect.innerHTML = '<option value="">Error loading classes</option>';
    }

    const form = document.getElementById('timetable-gen-form');
    if (form) {
        form.onsubmit = handleGenerateTimetable;
    }
}

async function handleGenerateTimetable(e) {
    e.preventDefault();
    const classId = document.getElementById('tt-class-select').value;
    const duration = document.getElementById('tt-duration').value;
    const startTime = document.getElementById('tt-start-time').value;
    const endTime = document.getElementById('tt-end-time').value;

    if (!classId) {
        showToast('Please select a class', 'error');
        return;
    }

    // Check if timetable already exists based on UI message
    const msgEl = document.getElementById('timetable-status-msg');
    if (msgEl && msgEl.style.display === 'block') {
        showToast('Timetable already exists for this class.', 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        showToast('Generating timetable...', 'info');

        const response = await fetch('/api/class-subjects/generate-timetable', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ classId, startTime, endTime, duration })
        });

        const result = await response.json();
        if (result.success) {
            showToast(result.message, 'success');
            renderTimetablePreview(result.data);
        } else {
            showToast(result.message || 'Generation failed', 'error');
        }
    } catch (error) {
        console.error('Error generating timetable:', error);
        showToast('Failed to generate timetable', 'error');
    }
}

async function loadExistingTimetable() {
    const classId = document.getElementById('tt-class-select').value;
    if (!classId) {
        showToast('Please select a class first', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/class-subjects/view-timetable/${classId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            renderTimetablePreview(result.data);
        } else {
            showToast('No existing timetable found for this class', 'info');
            document.getElementById('timetable-result-container').innerHTML = '';
        }
    } catch (error) {
        console.error('Error loading timetable:', error);
        showToast('Failed to load timetable', 'error');
    }
}

function renderTimetablePreview(data) {
    AppState.currentTimetableData = data;
    const container = document.getElementById('timetable-result-container');
    if (!container) return;

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    // Group data by day
    const grouped = days.reduce((acc, day) => {
        acc[day] = data.filter(item => item.day === day);
        return acc;
    }, {});

    // Find all unique time slots across the week to build table rows
    const uniqueSlots = [];
    const slotMap = new Set();

    data.forEach(item => {
        const key = `${item.startTime}-${item.endTime}`;
        if (!slotMap.has(key)) {
            slotMap.add(key);
            uniqueSlots.push({ start: item.startTime, end: item.endTime });
        }
    });

    // Sort slots by start time
    uniqueSlots.sort((a, b) => a.start.localeCompare(b.start));

    let html = `
        <div class="content-card" style="padding: 0; overflow: hidden; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff;">
            <div style="padding: 15px 20px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0; font-weight: 600; color: #1e293b;">Weekly Timetable</h4>
                <button onclick="downloadTimetablePDF()" class="btn btn-primary" style="padding: 8px 16px; font-size: 0.85rem; border-radius: 4px; background: #0052cc; color: #fff; border: none; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-file-pdf"></i> Download PDF
                </button>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; min-width: 800px;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Time Slot</th>
                            ${days.map(day => `
                                <th style="padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; font-size: 0.8rem; color: #64748b; text-transform: uppercase;">${day}</th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${uniqueSlots.map(slot => `
                            <tr>
                                <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; font-size: 0.85rem;">
                                    ${slot.start} - ${slot.end}
                                </td>
                                ${days.map(day => {
        const entry = grouped[day].find(e => e.startTime === slot.start);
        return `
                                        <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: center;">
                                            ${entry ? `
                                                <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 6px; padding: 10px; min-height: 50px; display: flex; flex-direction: column; justify-content: center;">
                                                    <div style="font-weight: 600; color: #1e40af; font-size: 0.85rem;">${entry.subjectName}</div>
                                                    ${entry.teacherName ? `<div style="font-size: 0.7rem; color: #60a5fa; margin-top: 2px;">${entry.teacherName}</div>` : ''}
                                                </div>
                                            ` : '<span style="color: #cbd5e1; font-size: 0.8rem;">-</span>'}
                                        </td>
                                    `;
    }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function renderDailyAttendance() {
    return `
        <div class="content-card" >
            <div class="filter-bar">
                <div class="filter-group">
                    <label>Date:</label>
                    <input type="date" value="2026-02-27">
                </div>
                <div class="filter-group">
                    <label>Class:</label>
                    <select>
                        <option>All Classes</option>
                        ${mockData.classes.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <button class="btn btn-primary"><i class="fas fa-search"></i> View</button>
            </div>
            
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Total Students</th>
                        <th>Present</th>
                        <th>Absent</th>
                        <th>Attendance %</th>
                    </tr>
                </thead>
                <tbody>
                    ${mockData.attendance.map(a => `
                        <tr>
                            <td>${a.date}</td>
                            <td>${a.totalStudents}</td>
                            <td>${a.present}</td>
                            <td>${a.absent}</td>
                            <td>${Math.round((a.present / a.totalStudents) * 100)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div >
        `;
}

function renderMonthlyReport() {
    return `
        <div class="content-card" >
            <div class="filter-bar">
                <div class="filter-group">
                    <label>Month:</label>
                    <select>
                        <option>February 2026</option>
                        <option>January 2026</option>
                        <option>December 2025</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Class:</label>
                    <select>
                        <option>All Classes</option>
                        ${mockData.classes.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <button class="btn btn-primary"><i class="fas fa-download"></i> Export Report</button>
            </div>
            
            <div class="report-summary" style="margin-top: 20px;">
                <div class="summary-card">
                    <h4>Monthly Summary</h4>
                    <p style="color: var(--gray);">Monthly report will be displayed here</p>
                </div>
            </div>
        </div >
        `;
}

function renderDefineFees() {
    const classes = AppState.allClasses || [];
    // Sort classes by class in ascending order
    const sortedClasses = [...classes].sort((a, b) => (a.class || 0) - (b.class || 0));

    return `
        <div class="fees-management-container">
            <!-- SECTION 1: DEFINE CLASS FEES STRUCTURE -->
            <div class="fees-card mb-4">
                <div class="fees-card-header">
                    <div class="fees-header-left">
                        <i class="fas fa-coins fees-header-icon"></i>
                        <h3 class="fees-header-title">Define Class Fees Structure</h3>
                    </div>
                </div>
                <div class="fees-card-body">
                    <form id="define-fees-form">
                        <input type="hidden" id="total-fee">
                        
                        <div class="fees-grid-row">
                            <div class="fees-grid-col">
                                <label class="fees-form-label">Select Class</label>
                                <select id="fees-class-id" class="fees-form-input" required>
                                    <option value="">Choose Class...</option>
                                    ${sortedClasses.map(c => `<option value="${c.class}">Class-${c.class}</option>`).join('')}
                                </select>
                            </div>
                            
                            <div class="fees-grid-col">
                                <label class="fees-form-label">Annual Fee (INR ₹)</label>
                                <input type="text" id="tuition-fee" class="fees-form-input" placeholder="e.g. 50000" required>
                            </div>
                            
                            <div class="fees-grid-col">
                                <label class="fees-form-label">Exam Fee (INR ₹)</label>
                                <input type="text" id="exam-fee" class="fees-form-input" placeholder="e.g. 2000" required>
                            </div>

                            <div class="fees-grid-col fees-btn-col">
                                <button type="button" id="btn-save-fees" class="fees-save-button" onclick="saveClassFees()">
                                    <i class="fas fa-save"></i>
                                    Save Fees
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            <!-- SECTION 2: CURRENT FEES STRUCTURE -->
            <div class="fees-card">
                <div class="fees-card-header fees-header-between">
                    <div class="fees-header-left">
                        <i class="fas fa-list-alt fees-header-icon"></i>
                        <h3 class="fees-header-title">Current Fees Structure</h3>
                    </div>
                    <div class="fees-header-right">
                        <button class="fees-btn-refresh-blue" onclick="loadDefinedFees()">
                            <i class="fas fa-sync-alt"></i>
                            Refresh
                        </button>
                    </div>
                </div>
                
                <div class="table-responsive">
                    <table class="fees-table-modern">
                        <thead>
                            <tr>
                                <th>CLASS</th>
                                <th>TOTAL SUBJECTS</th>
                                <th>ANNUAL FEES</th>
                                <th>EXAM FEES</th>
                                <th>TOTAL FEES (INR ₹)</th>
                                <th>LAST UPDATED</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody id="defined-fees-tbody">
                            <tr><td colspan="7" class="text-center py-5">Fetching fee structures...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        `;
}
function renderPaymentUpdates() {
    return `
        <div class="payment-updates-container">
            <!-- Filters Section -->
            <div class="payment-filters-card">
                <div class="filters-header">
                    <h3><i class="fas fa-filter"></i> Payment Filters</h3>
                    <button class="btn btn-success" onclick="generateBulkReceipts()">
                        <i class="fas fa-file-invoice"></i> Generate Receipt
                    </button>
                </div>
                <div class="filters-grid">
                    <div class="filter-group">
                        <label>Filter by Class:</label>
                        <select id="payment-class-filter" onchange="loadPaymentStudents()">
                            <option value="">All Classes</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Payment Status:</label>
                        <select id="payment-status-filter" onchange="loadPaymentStudents()">
                            <option value="all">All</option>
                            <option value="paid">Paid</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Payment Table -->
            <div class="payment-table-card">
                <div class="table-header">
                    <h3><i class="fas fa-money-check-alt"></i> Payment Updates</h3>
                    <button class="btn btn-primary" onclick="loadPaymentStudents()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
                
                <div class="table-responsive">
                    <table class="payment-table">
                        <thead>
                            <tr>
                                <th>Student Name</th>
                                <th>Class</th>
                                <th>Total Fees</th>
                                <th>Paid Amount</th>
                                <th>Status</th>
                                <th>Due Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="payment-tbody">
                            <tr><td colspan="7" class="text-center py-5">Loading payment data...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Payment Update Modal -->
        <div id="payment-modal" class="modal" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Mark Payment as Paid</h3>
                    <button class="modal-close" onclick="closePaymentModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="payment-update-form">
                        <input type="hidden" id="payment-student-id">
                        <div class="pay-form-group">
                            <label>Student Name:</label>
                            <input type="text" id="modal-student-name" readonly>
                        </div>
                        <div class="pay-form-group">
                            <label>Class:</label>
                            <input type="text" id="modal-class-name" readonly>
                        </div>
                        <div class="pay-form-group">
                            <label>Total Fees:</label>
                            <input type="text" id="modal-total-fees" readonly>
                        </div>
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle"></i>
                            <strong>Full Payment Only:</strong> When you click "Mark as Paid", the full fee amount will be processed as complete payment.
                        </div>
                        <div class="pay-form-actions">
                            <button type="button" class="btn btn-success" onclick="processPaymentUpdate()">
                                <i class="fas fa-check-circle"></i> Mark as Paid
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="closePaymentModal()">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        `;
}
function renderNoticeManagement() {
    return `
        <div class="notice-container" >
            <div class="notice-form-card">
                <h3><i class="fas fa-pen"></i> Create New Notice</h3>
                <form class="form-horizontal" id="notice-form">
                    <div class="form-group">
                        <label>Notice Title</label>
                        <input type="text" id="notice-title" placeholder="Enter notice title">
                    </div>
                    <div class="form-group">
                        <label>Notice Type</label>
                        <select id="notice-type">
                            <option value="General">General</option>
                            <option value="Academic">Academic</option>
                            <option value="Event">Event</option>
                            <option value="Emergency">Emergency</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Send To</label>
                        <select id="notice-recipient">
                            <option value="All">All</option>
                            <option value="Students">Students</option>
                            <option value="Teachers">Teachers</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Notice Content</label>
                        <textarea id="notice-content" rows="4" placeholder="Write your notice here..."></textarea>
                    </div>
                    <button type="button" class="btn btn-primary" onclick="sendNotice()">
                        <i class="fas fa-paper-plane"></i> Send Notice
                    </button>
                </form>
            </div>
            
            <div class="notice-list-card">
                <h3><i class="fas fa-list"></i> Sent Notices</h3>
                <div class="notice-list" id="notice-list">
                    <div class="loading-state" style="text-align: center; padding: 20px;">
                        <i class="fas fa-spinner fa-spin"></i> Loading notices...
                    </div>
                </div>
            </div>
        </div >
        `;
}

function initializeNoticeManagement() {
    fetchNotices();
}

async function fetchNotices() {
    try {
        const response = await fetch('/api/admin/notices', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const data = await response.json();
        if (data.success) {
            renderNoticeList(data.notices);
        } else {
            console.error('Failed to fetch notices:', data.message);
        }
    } catch (error) {
        console.error('Error fetching notices:', error);
    }
}

function renderNoticeList(notices) {
    const listContainer = document.getElementById('notice-list');
    if (!listContainer) return;

    if (notices.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; padding: 20px; color: #666;">No notices found.</p>';
        return;
    }

    listContainer.innerHTML = notices.map(notice => `
        <div class="notice-item">
            <div class="notice-item-header">
                <span class="notice-title">${notice.title}</span>
                <span class="notice-type ${notice.type.toLowerCase()}">${notice.type}</span>
                <button class="btn btn-sm btn-danger delete-notice-btn" onclick="deleteNotice('${notice._id}')" title="Delete Notice">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="notice-item-body">
                <p>${notice.content}</p>
                <div class="notice-meta" style="font-size: 0.85em; color: #777; margin-top: 10px;">
                    <p><strong>Sent to:</strong> ${notice.recipientGroup}</p>
                    <p><strong>Date:</strong> ${new Date(notice.date).toLocaleDateString()}</p>
                </div>
            </div>
        </div>
    `).join('');
}

async function sendNotice() {
    const title = document.getElementById('notice-title').value;
    const type = document.getElementById('notice-type').value;
    const recipientGroup = document.getElementById('notice-recipient').value;
    const content = document.getElementById('notice-content').value;

    if (!title || !content) {
        alert('Please fill in all required fields');
        return;
    }

    try {
        const response = await fetch('/api/admin/notices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ title, type, recipientGroup, content })
        });

        const data = await response.json();
        if (data.success) {
            alert('Notice sent successfully!');
            document.getElementById('notice-form').reset();
            fetchNotices(); // Refresh the list
        } else {
            alert('Failed to send notice: ' + data.message);
        }
    } catch (error) {
        console.error('Error sending notice:', error);
        alert('Error sending notice. Please try again.');
    }
}

async function deleteNotice(id) {
    if (!confirm('Are you sure you want to delete this notice?')) return;

    try {
        const response = await fetch(`/api/admin/notices/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const data = await response.json();
        if (data.success) {
            fetchNotices(); // Refresh the list
        } else {
            alert('Failed to delete notice: ' + data.message);
        }
    } catch (error) {
        console.error('Error deleting notice:', error);
        alert('Error deleting notice. Please try again.');
    }
}

function renderProfile() {
    return `
        <div class="profile-container" >
            <div class="profile-view-section">
                <div class="profile-card">
                    <div class="profile-avatar-large">
                        <i class="fas fa-user-shield"></i>
                    </div>
                    <h3>Admin</h3>
                    <p class="profile-role">Administrator</p>
                    <p class="profile-email"><i class="fas fa-envelope"></i> admin@gmail.com</p>
                    <p class="profile-phone"><i class="fas fa-phone"></i> +91 9876543210</p>
                    <button class="btn btn-primary" onclick="toggleEditMode()">
                        <i class="fas fa-edit"></i> Edit Profile
                    </button>
                </div>
            </div>
            
            <div class="profile-edit-section" id="profile-edit-section" style="display: none;">
                <div class="content-card">
                    <h3><i class="fas fa-user-edit"></i> Edit Profile</h3>
                    <form class="form-horizontal">
                        <div class="form-group">
                            <label>Full Name</label>
                            <input type="text" id="profile-name" value="Admin">
                        </div>
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" value="admin@gmail.com" readonly>
                        </div>
                        <div class="form-group">
                            <label>Phone Number</label>
                            <input type="tel" id="profile-phone" value="+91 9876543210">
                        </div>
                        <div class="form-group">
                            <label>New Password (leave blank to keep current)</label>
                            <input type="password" placeholder="Enter new password">
                        </div>
                        <div class="form-group">
                            <label>Confirm Password</label>
                            <input type="password" placeholder="Confirm new password">
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-primary" onclick="saveProfile()">
                                <i class="fas fa-save"></i> Save Changes
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="toggleEditMode()">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div >
        `;
}

function toggleEditMode() {
    const viewSection = document.querySelector('.profile-view-section');
    const editSection = document.getElementById('profile-edit-section');

    if (editSection.style.display === 'none') {
        viewSection.style.display = 'none';
        editSection.style.display = 'block';
    } else {
        viewSection.style.display = 'block';
        editSection.style.display = 'none';
    }
}

function saveProfile() {
    const name = document.getElementById('profile-name').value;
    const phone = document.getElementById('profile-phone').value;

    if (!name) {
        alert('Please enter your name');
        return;
    }

    alert('Profile updated successfully!');
    toggleEditMode();
}

function renderSendNotice() {
    return `
        <div class="content-card" >
            <form class="form-horizontal">
                <div class="form-group">
                    <label>Select Notice</label>
                    <select>
                        <option>Select existing notice</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Send To</label>
                    <select>
                        <option>All Students</option>
                        <option>All Teachers</option>
                        <option>All Parents</option>
                        <option>Specific Class</option>
                    </select>
                </div>
                <button type="button" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Send Notice</button>
            </form>
        </div >
        `;
}

function renderExamTimetable() {
    return `
        <div class="content-card" >
            <form class="form-horizontal">
                <div class="form-group">
                    <label>Exam Name</label>
                    <input type="text" placeholder="e.g., Half Yearly Exam">
                </div>
                <div class="form-group">
                    <label>Class</label>
                    <select>
                        <option>Select Class</option>
                        ${mockData.classes.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <button type="button" class="btn btn-primary"><i class="fas fa-plus"></i> Add Exam Schedule</button>
            </form>
        </div >
        `;
}

function renderExamNotification() {
    return `
        <div class="content-card" >
            <form class="form-horizontal">
                <div class="form-group">
                    <label>Select Exam</label>
                    <select>
                        <option>Half Yearly Exam</option>
                        <option>Final Exam</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Message</label>
                    <textarea rows="4" placeholder="Enter notification message"></textarea>
                </div>
                <button type="button" class="btn btn-primary"><i class="fas fa-bell"></i> Send Notification</button>
            </form>
        </div >
        `;
}

function renderPublishResults() {
    return `
        <div class="content-card" >
            <form class="form-horizontal">
                <div class="form-group">
                    <label>Exam</label>
                    <select>
                        <option>Select Exam</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Class</label>
                    <select>
                        <option>Select Class</option>
                        ${mockData.classes.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <button type="button" class="btn btn-primary"><i class="fas fa-upload"></i> Publish Results</button>
            </form>
        </div >
        `;
}

function renderViewProfile() {
    return `
        <div class="content-card" >
            <div class="profile-info">
                <div class="profile-avatar-large">
                    <i class="fas fa-user"></i>
                </div>
                <h3>Admin</h3>
                <p>Administrator</p>
                <p>admin@gmail.com</p>
            </div>
        </div >
        `;
}

function renderEditProfile() {
    return `
        <div class="content-card" >
            <form class="form-horizontal">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" value="Admin">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" value="admin@gmail.com" readonly>
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" placeholder="Enter phone number">
                </div>
                <button type="button" class="btn btn-primary"><i class="fas fa-save"></i> Save Changes</button>
            </form>
        </div >
        `;
}

function filterFees() {
    const classFilter = document.getElementById('fees-class-filter')?.value || '';
    const statusFilter = document.getElementById('fees-status-filter')?.value || '';

    let filtered = mockData.fees;

    if (classFilter) {
        filtered = filtered.filter(f => f.class === classFilter);
    }

    if (statusFilter) {
        filtered = filtered.filter(f => f.status === statusFilter);
    }

    if (tbody) {
        tbody.innerHTML = filtered.map(fee => `
        <tr>
                <td>${fee.studentName}</td>
                <td>${fee.class}</td>
                <td>$${fee.totalFees.toLocaleString()}</td>
                <td>$${fee.paid.toLocaleString()}</td>
                <td>$${(fee.totalFees - fee.paid).toLocaleString()}</td>
                <td><span class="status ${fee.status}">${fee.status}</span></td>
                <td>${fee.dueDate}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="updatePayment(${fee.id})"><i class="fas fa-edit"></i> Update</button>
                    <button class="btn btn-sm btn-success" onclick="generateReceipt(${fee.id})"><i class="fas fa-file-invoice"></i> Receipt</button>
                </td>
            </tr >
        `).join('');
    }
}

async function approveStudent(id) {
    const application = currentApplications.find(app => app._id === id);
    const studentName = application?.studentName || 'Unknown';

    if (application && application.status !== 'pending') {
        showErrorNotification('Cannot Approve', `This application has already been ${application.status}.`);
        return;
    }

    if (!confirm(`Are you sure you want to approve this application ?\n\nStudent: ${studentName} \n\nThis will create a student account and send login credentials.`)) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admission/applications/' + id + '/approve', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token} `,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            showSuccessNotification('Application Approved!', `${studentName} 's application has been approved and student account created.`);
            updateApplicationCounts();
            setTimeout(() => loadApplications(), 500);
        } else {
            let errorMessage = result.message || 'Server approval failed. Please try again.';
            if (errorMessage.includes('already exists')) {
                errorMessage = 'Student account already exists. This application may have been approved previously.';
            }
            showErrorNotification('Approval Failed', errorMessage);
        }
    } catch (err) {
        console.error('Approval error:', err);
        showErrorNotification('Network Error', 'Failed to connect to server. Please check your connection.');
    }
}

let currentRejectId = null;

function openRejectModal(id) {
    currentRejectId = id;
    document.getElementById('reject-reason').value = '';
    document.getElementById('reject-modal').style.display = 'block';
}

function closeRejectModal() {
    document.getElementById('reject-modal').style.display = 'none';
    currentRejectId = null;
}

async function confirmReject() {
    if (!currentRejectId) return;

    const reason = document.getElementById('reject-reason').value;
    const application = currentApplications.find(app => app._id === currentRejectId);
    const studentName = application?.studentName || 'Unknown';

    if (application && application.status !== 'pending') {
        showErrorNotification('Cannot Reject', `This application has already been ${application.status}.`);
        closeRejectModal();
        return;
    }

    if (!confirm(`Are you sure you want to reject this application?\n\nStudent: ${studentName}\n${reason ? 'Reason: ' + reason : 'No reason provided'}`)) return;

    closeRejectModal();

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admission/applications/' + currentRejectId + '/reject', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: reason || '' })
        });

        const result = await response.json();

        if (result.success) {
            showWarningNotification('Application Rejected', `${studentName}'s application has been rejected.${reason ? '\nReason: ' + reason : ''}`);
            updateApplicationCounts();
            setTimeout(() => loadApplications(), 500);
        } else {
            showErrorNotification('Rejection Failed', result.message || 'Server rejection failed. Please try again.');
        }
    } catch (err) {
        console.error('Rejection error:', err);
        showErrorNotification('Network Error', 'Failed to connect to server. Please check your connection.');
    }
}

function updateApplicationCounts() {
    const token = localStorage.getItem('token');
    if (!token) return;

    Promise.all([
        fetch('/api/admission/applications/count', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/teacher-applications/applications/counts', { headers: { 'Authorization': `Bearer ${token}` } })
    ])
        .then(([studentsRes, teachersRes]) => Promise.all([studentsRes.json(), teachersRes.json()]))
        .then(([studentResult, teacherResult]) => {
            if (studentResult.success || teacherResult.success) {
                const pendingEl = document.getElementById('pending-applications');
                const statsPending = document.getElementById('stats-pending');
                const statsApproved = document.getElementById('stats-approved');
                const statsRejected = document.getElementById('stats-rejected');

                const studentPending = studentResult.success ? (studentResult.pending || 0) : 0;
                const teacherPending = teacherResult.success ? (teacherResult.pending || 0) : 0;
                const totalPending = studentPending + teacherPending;

                if (pendingEl) pendingEl.textContent = totalPending;
                if (statsPending) statsPending.textContent = studentPending; // Keep student specific in student apps page
                if (statsApproved) statsApproved.textContent = studentResult.approved || 0;
                if (statsRejected) statsRejected.textContent = studentResult.rejected || 0;
            }
        })
        .catch(console.error);
}

function updateTeacherApplicationCounts() {
    const token = localStorage.getItem('token');
    fetch('/api/teacher-applications/count', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(result => {
            if (result.success) {
                const statsPending = document.getElementById('teacher-stats-pending');
                const statsApproved = document.getElementById('teacher-stats-approved');
                const statsRejected = document.getElementById('teacher-stats-rejected');

                if (statsPending) statsPending.textContent = result.pending;
                if (statsApproved) statsApproved.textContent = result.approved;
                if (statsRejected) statsRejected.textContent = result.rejected;
            }
        })
        .catch(console.error);
}

async function viewApplication(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admission/applications/' + id, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            const app = result.application;
            const statusBadge = app.status === 'approved'
                ? '<span style="background: #d4edda; color: #155724; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">Approved</span>'
                : app.status === 'rejected'
                    ? '<span style="background: #f8d7da; color: #721c24; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">Rejected</span>'
                    : '<span style="background: #fff3cd; color: #856404; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">Pending</span>';

            const detailsHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="grid-column: 1 / -1; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h3 style="margin: 0 0 5px 0; color: #333; font-size: 20px;">${app.studentName || 'N/A'}</h3>
                                <p style="margin: 0; color: #666; font-size: 14px;">${app.email || 'N/A'}</p>
                            </div>
                            ${statusBadge}
                        </div>
                    </div>
                    
                    <div style="grid-column: 1 / -1; margin-top: 10px;">
                        <h4 style="color: #0A66FF; margin: 0 0 12px 0; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;">Student Information</h4>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">Application ID</p>
                        <p style="margin: 0; font-weight: 600;"><code>${app.applicationId || '-'}</code></p>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">Class Applied</p>
                        <p style="margin: 0; font-weight: 600;">${app.class || '-'}</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">Date of Birth</p>
                        <p style="margin: 0; font-weight: 600;">${app.dob ? new Date(app.dob).toLocaleDateString() : '-'}</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">Gender</p>
                        <p style="margin: 0; font-weight: 600; text-transform: capitalize;">${app.gender || '-'}</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">Student Email</p>
                        <p style="margin: 0; font-weight: 600;">${app.studentEmail || '-'}</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">Contact Number</p>
                        <p style="margin: 0; font-weight: 600;">${app.contactNumber || '-'}</p>
                    </div>
                    
                    <div style="grid-column: 1 / -1; margin-top: 15px;">
                        <h4 style="color: #0A66FF; margin: 0 0 12px 0; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;">Parent/Guardian Information</h4>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">Parent Name</p>
                        <p style="margin: 0; font-weight: 600;">${app.parentName || '-'}</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">Relationship</p>
                        <p style="margin: 0; font-weight: 600; text-transform: capitalize;">${app.relationship || '-'}</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">Phone</p>
                        <p style="margin: 0; font-weight: 600;">${app.phone || '-'}</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">Occupation</p>
                        <p style="margin: 0; font-weight: 600;">${app.occupation || '-'}</p>
                    </div>
                    
                    <div style="grid-column: 1 / -1; margin-top: 15px;">
                        <h4 style="color: #0A66FF; margin: 0 0 12px 0; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;">Address Information</h4>
                    </div>
                    <div style="grid-column: 1 / -1; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">Street Address</p>
                        <p style="margin: 0; font-weight: 600;">${app.streetAddress || '-'}</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">City</p>
                        <p style="margin: 0; font-weight: 600;">${app.city || '-'}</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">State</p>
                        <p style="margin: 0; font-weight: 600;">${app.state || '-'}</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">ZIP Code</p>
                        <p style="margin: 0; font-weight: 600;">${app.zipCode || '-'}</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">Country</p>
                        <p style="margin: 0; font-weight: 600;">${app.country || '-'}</p>
                    </div>
                    
                    <div style="grid-column: 1 / -1; margin-top: 15px;">
                        <h4 style="color: #0A66FF; margin: 0 0 12px 0; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;">Application Timeline</h4>
                    </div>
                    <div style="background: #e8f5e9; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #2e7d32;">Submitted</p>
                        <p style="margin: 0; font-weight: 600; color: #2e7d32;">${app.createdAt ? new Date(app.createdAt).toLocaleString() : '-'}</p>
                    </div>
                    ${app.reviewedAt ? `
                    <div style="background: #e3f2fd; padding: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #1565c0;">Reviewed</p>
                        <p style="margin: 0; font-weight: 600; color: #1565c0;">${new Date(app.reviewedAt).toLocaleString()}</p>
                    </div>
                    ` : ''}
                    ${app.rejectionReason ? `
                    <div style="grid-column: 1 / -1; background: #ffebee; padding: 12px; border-radius: 8px; border-left: 4px solid #dc3545;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; color: #c62828;">Rejection Reason</p>
                        <p style="margin: 0; font-weight: 600; color: #c62828;">${app.rejectionReason}</p>
                    </div>
                    ` : ''}
                </div>
                
                ${app.status === 'pending' ? `
                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee; display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="closeApplicationModal(); openRejectModal('${app._id}');" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                        <i class="fas fa-times"></i> Reject
                    </button>
                    <button onclick="approveStudent('${app._id}'); closeApplicationModal();" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                        <i class="fas fa-check"></i> Approve
                    </button>
                </div>
                ` : ''}
            `;

            document.getElementById('application-details').innerHTML = detailsHtml;
            document.getElementById('application-modal').style.display = 'block';
        } else {
            alert(result.message || 'Failed to load application');
        }
    } catch (error) {
        console.error('Error loading application:', error);
        alert('Error loading application details');
    }
}

function closeApplicationModal() {
    closeModal('application-modal');
}

function closeTeacherApplicationModal() {
    closeModal('teacher-application-modal');
}

window.onclick = function (event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function showSuccessNotification(title, message) {
    showNotification(title, message, '#28a745', '#20c997');
}

function showWarningNotification(title, message) {
    showNotification(title, message, '#ffc107', '#fd7e14');
}

function showErrorNotification(title, message) {
    showNotification(title, message, '#dc3545', '#c82333');
}

function showNotification(title, message, bgColor, borderColor) {
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(notificationContainer);
    }

    const notification = document.createElement('div');
    notification.style.cssText = `
        background: linear-gradient(135deg, ${bgColor} 0%, ${borderColor} 100%);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        margin-bottom: 10px;
        box-shadow: 0 8px 25px ${bgColor}33;
        border-left: 4px solid ${borderColor};
        animation: slideIn 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 12px;
    `;

    const icon = bgColor === '#28a745' ? 'fa-check-circle' :
        bgColor === '#ffc107' ? 'fa-exclamation-triangle' : 'fa-times-circle';

    notification.innerHTML = `
        <div style="flex-shrink: 0;">
            <i class="fas ${icon}" style="font-size: 20px;"></i>
        </div>
        <div>
            <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 14px; opacity: 0.9;">${message}</div>
        </div>
        <div style="flex-shrink: 0; cursor: pointer; margin-left: auto;" onclick="this.parentElement.remove()">
            <i class="fas fa-times" style="font-size: 14px; opacity: 0.8;"></i>
        </div>
    `;

    notificationContainer.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}

function fetchDashboardStats() {
    const token = localStorage.getItem('token');
    if (!token) return;

    Promise.all([
        fetch('/api/admission/students/count', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admission/teachers/count', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admission/applications/count', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/teacher-applications/applications/counts', { headers: { 'Authorization': `Bearer ${token}` } })
    ])
        .then(([studentsRes, teachersRes, appsRes, teacherAppsRes]) =>
            Promise.all([studentsRes.json(), teachersRes.json(), appsRes.json(), teacherAppsRes.json()])
        )
        .then(([studentsData, teachersData, appsData, teacherAppsData]) => {
            const elTotalStudents = document.getElementById('total-students');
            const elTotalTeachers = document.getElementById('total-teachers');
            const elPendingApps = document.getElementById('pending-applications');

            if (studentsData.success && elTotalStudents) {
                elTotalStudents.textContent = studentsData.count || 0;
            }
            if (teachersData.success && elTotalTeachers) {
                elTotalTeachers.textContent = teachersData.count || 0;
            }
            if (elPendingApps) {
                const studentPending = appsData.success ? (appsData.pending || 0) : 0;
                const teacherPending = teacherAppsData.success ? (teacherAppsData.pending || 0) : 0;
                elPendingApps.textContent = studentPending + teacherPending;
            }
        })
        .catch(err => {
            console.error('Error fetching dashboard stats:', err);
            // Silently fail without breaking the UI
        });
}

async function approveTeacher(id) {
    const application = currentTeacherApplications.find(app => app._id === id);
    const teacherName = application?.fullName || 'Unknown';

    if (application && application.status !== 'pending') {
        showErrorNotification('Cannot Approve', `This application has already been ${application.status}.`);
        return;
    }

    if (!confirm(`Are you sure you want to approve this teacher application?\n\nTeacher: ${teacherName}\n\nThis will create a teacher account and email them.`)) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/teacher-applications/applications/' + id + '/approve', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            showSuccessNotification('Application Approved!', `${teacherName}'s application has been approved and account created.`);
            updateApplicationCounts();
            if (typeof loadTeacherApplications === 'function') setTimeout(() => loadTeacherApplications(), 500);
        } else {
            showErrorNotification('Approval Failed', result.message || 'Server approval failed.');
        }
    } catch (err) {
        console.error('Teacher approval error:', err);
        showErrorNotification('Network Error', 'Failed to connect to server.');
    }
}

let currentTeacherRejectId = null;
function openTeacherRejectModal(id) {
    currentTeacherRejectId = id;
    const modal = document.getElementById('reject-modal');
    if (modal) {
        modal.style.display = 'flex';
        const title = modal.querySelector('h3');
        if (title) title.textContent = 'Reject Teacher Application';
        // Redefine confirm button for teacher
        const confirmBtn = modal.querySelector('.btn-reject-confirm');
        if (confirmBtn) {
            confirmBtn.onclick = confirmTeacherReject;
        }
    }
}

async function confirmTeacherReject() {
    const reason = document.getElementById('reject-reason').value;
    if (!currentTeacherRejectId) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/teacher-applications/applications/' + currentTeacherRejectId + '/reject', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });

        if (response.ok) {
            showSuccessNotification('Application Rejected', 'The teacher application has been rejected.');
            closeRejectModal();
            updateApplicationCounts();
            if (typeof loadTeacherApplications === 'function') setTimeout(() => loadTeacherApplications(), 500);
        } else {
            const result = await response.json();
            showErrorNotification('Rejection Failed', result.message || 'Server rejection failed.');
        }
    } catch (err) {
        console.error('Teacher rejection error:', err);
        showErrorNotification('Network Error', 'Failed to connect to server.');
    }
}

function rejectTeacher(id) {
    openTeacherRejectModal(id);
}

function updatePayment(id) {
    alert('Update payment functionality');
}

function generateReceipt(id) {
    alert('Generate receipt for student ID: ' + id);
}

function filterStudents() {
    console.log('Filtering students...');
}

function setupNavGroups() {
    const navGroups = document.querySelectorAll('.nav-group');

    navGroups.forEach(group => {
        const toggle = group.querySelector('.nav-group-toggle');
        if (toggle) {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                group.classList.toggle('open');

                navGroups.forEach(otherGroup => {
                    if (otherGroup !== group) {
                        otherGroup.classList.remove('open');
                    }
                });
            });
        }
    });
}

function setupNavItems() {
    const navItems = document.querySelectorAll('.nav-item[data-page]');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            loadPage(item.dataset.page, item.dataset.title);
        });
    });
}

function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    const dropdownLogout = document.getElementById('dropdown-logout');

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('adminUser');
        window.location.href = '/login.html';
    };

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }

    if (dropdownLogout) {
        dropdownLogout.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
}

function setupDropdown() {
    const profileDropdown = document.querySelector('.profile-dropdown');

    if (profileDropdown) {
        profileDropdown.addEventListener('click', () => {
            profileDropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!profileDropdown.contains(e.target)) {
                profileDropdown.classList.remove('active');
            }
        });
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

window.toggleSidebar = toggleSidebar;

// Teacher Application Management Functions
let currentTeacherApplications = [];
let currentTeacherApplicationId = null;

async function loadTeacherApplications() {
    logDebug('loadTeacherApplications', 'Starting...');

    // Check if required DOM elements exist
    const loadingEl = safeGetElement('teacher-applications-loading');
    const tableEl = safeGetElement('teacher-applications-table');
    const emptyEl = safeGetElement('teacher-applications-empty');
    const errorEl = safeGetElement('teacher-applications-error');
    const searchInput = safeGetElement('teacher-search-input');
    const statusFilter = safeGetElement('teacher-application-status-filter');

    // Show loading state if element exists
    if (loadingEl) {
        safeSetInnerHTML('teacher-applications-loading', Components.LoadingState('Loading teacher applications...'));
        safeSetDisplay('teacher-applications-loading', 'block');
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        let url = '/api/teacher-applications/applications';
        const params = [];

        if (statusFilter) {
            const statusValue = statusFilter.value;
            if (statusValue && statusValue !== 'all') params.push(`status=${statusValue}`);
        }

        if (searchInput) {
            const searchValue = searchInput.value;
            if (searchValue) params.push(`search=${encodeURIComponent(searchValue)}`);
        }

        if (params.length > 0) url += '?' + params.join('&');

        logDebug('API URL', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server returned non-JSON response');
        }

        const result = await response.json();
        logDebug('API Response', result);

        // Hide loading state
        safeSetDisplay('teacher-applications-loading', 'none');

        // Update stats from loaded data only when no filter is applied
        const isFiltered = (statusFilter && statusFilter.value !== 'all') || (searchInput && searchInput.value);
        if (result.success && result.applications && !isFiltered) {
            const pending = result.applications.filter(a => a.status === 'pending').length;
            const approved = result.applications.filter(a => a.status === 'approved').length;
            const rejected = result.applications.filter(a => a.status === 'rejected').length;

            const statsPending = document.getElementById('teacher-stats-pending');
            const statsApproved = document.getElementById('teacher-stats-approved');
            const statsRejected = document.getElementById('teacher-stats-rejected');

            if (statsPending) statsPending.textContent = pending;
            if (statsApproved) statsApproved.textContent = approved;
            if (statsRejected) statsRejected.textContent = rejected;
        }

        if (result.success && result.applications && result.applications.length > 0) {
            currentTeacherApplications = result.applications;
            renderTeacherApplicationsTable(result.applications);

            if (tableEl) safeSetDisplay('teacher-applications-table', 'table');
            if (emptyEl) safeSetDisplay('teacher-applications-empty', 'none');
            if (errorEl) safeSetDisplay('teacher-applications-error', 'none');

            logDebug('Teacher Applications Loaded', result.applications.length);
        } else {
            if (tableEl) safeSetDisplay('teacher-applications-table', 'none');
            if (emptyEl) {
                safeSetInnerHTML('teacher-applications-empty', Components.EmptyState('user-tie', 'No Applications Found', 'There are no teacher applications matching your criteria.'));
                safeSetDisplay('teacher-applications-empty', 'block');
            }
            if (errorEl) safeSetDisplay('teacher-applications-error', 'none');

            logDebug('No Teacher Applications', 'Empty result');
        }
    } catch (error) {
        logError('loadTeacherApplications failed', error);

        // Hide loading state
        safeSetDisplay('teacher-applications-loading', 'none');

        // Show error state
        if (tableEl) safeSetDisplay('teacher-applications-table', 'none');
        if (emptyEl) safeSetDisplay('teacher-applications-empty', 'none');
        if (errorEl) {
            safeSetInnerHTML('teacher-applications-error', Components.ErrorState('Failed to load applications. Please check your connection and try again.', 'loadTeacherApplications()'));
            safeSetDisplay('teacher-applications-error', 'block');
        }
    }
}

function renderTeacherApplicationsTable(applications) {
    logDebug('renderTeacherApplicationsTable called', applications.length);

    const tbody = document.getElementById('teacher-applications-tbody');
    logDebug('tbody element:', !!tbody);

    if (!tbody) {
        logError('tbody not found', 'teacher-applications-tbody');
        return;
    }

    tbody.innerHTML = applications.map((app, index) => {
        const appliedDate = app.createdAt ? formatDate(app.createdAt) : '-';

        return `
            <tr data-teacher-application-id="${app._id}">
                <td><span class="id-badge">${app.applicationId || '-'}</span></td>
                <td>${app.fullName || '-'}</td>
                <td>${app.position || '-'}</td>
                <td>${app.email || '-'}</td>
                <td>${app.phone || '-'}</td>
                <td>${appliedDate}</td>
                <td>${Components.StatusBadge(app.status || 'pending')}</td>
                <td>${Components.ActionButtons(app, 'teacher')}</td>
            </tr>
        `;
    }).join('');

    logDebug('tbody innerHTML length', tbody.innerHTML.length);
}

async function filterTeacherApplications() {
    await loadTeacherApplications();
}

function handleTeacherSearch() {
    const searchValue = document.getElementById('teacher-search-input').value;
    AppState.teacherSearch = searchValue;
    loadTeacherApplications();
}

async function viewTeacherApplication(applicationId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/teacher-applications/applications/${applicationId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            const app = result.application;
            const detailsHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h4 style="margin-bottom: 15px; color: #333; border-bottom: 2px solid #0A66FF; padding-bottom: 8px;">Personal Information</h4>
                        <div style="margin-bottom: 12px;"><strong>Full Name:</strong> ${app.fullName || '-'}</div>
                        <div style="margin-bottom: 12px;"><strong>Date of Birth:</strong> ${app.dob ? new Date(app.dob).toLocaleDateString() : '-'}</div>

                        <div style="margin-bottom: 12px;"><strong>Gender:</strong> ${app.gender || '-'}</div>
                        <div style="margin-bottom: 12px;"><strong>Email:</strong> ${app.email || '-'}</div>
                        <div style="margin-bottom: 12px;"><strong>Phone:</strong> ${app.phone || '-'}</div>
                        <div style="margin-bottom: 12px;"><strong>Marital Status:</strong> ${app.maritalStatus || '-'}</div>
                    </div>
                    <div>
                        <h4 style="margin-bottom: 15px; color: #333; border-bottom: 2px solid #0A66FF; padding-bottom: 8px;">Position Details</h4>
                        <div style="margin-bottom: 12px;"><strong>Position Applied:</strong> ${app.position || '-'}</div>
                        <div style="margin-bottom: 12px;"><strong>Department:</strong> ${app.department || '-'}</div>
                        <div style="margin-bottom: 12px;"><strong>Experience:</strong> ${app.experience || '-'}</div>
                        <div style="margin-bottom: 12px;"><strong>Applied Date:</strong> ${app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-'}</div>
                        <div style="margin-bottom: 12px;"><strong>Status:</strong> <span class="status ${app.status}" style="padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: capitalize; background: ${app.status === 'pending' ? '#fff3cd' : app.status === 'approved' ? '#d4edda' : '#f8d7da'}; color: ${app.status === 'pending' ? '#856404' : app.status === 'approved' ? '#155724' : '#721c24'};">${app.status}</span></div>
                    </div>
                </div>
                <div style="margin-top: 20px;">
                    <h4 style="margin-bottom: 15px; color: #333; border-bottom: 2px solid #0A66FF; padding-bottom: 8px;">Education & Qualifications</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div>
                            <div style="margin-bottom: 12px;"><strong>Highest Qualification:</strong> ${app.qualification || '-'}</div>
                            <div style="margin-bottom: 12px;"><strong>University/College:</strong> ${app.university || '-'}</div>
                            <div style="margin-bottom: 12px;"><strong>Year of Passing:</strong> ${app.yearPassing || '-'}</div>
                        </div>
                        <div>
                            <div style="margin-bottom: 12px;"><strong>Additional Qualification:</strong> ${app.additionalQualification || '-'}</div>
                            <div style="margin-bottom: 12px;"><strong>Additional Institution:</strong> ${app.additionalInstitution || '-'}</div>
                            <div style="margin-bottom: 12px;"><strong>Percentage/Class:</strong> ${app.percentage || '-'}</div>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 20px;">
                    <h4 style="margin-bottom: 15px; color: #333; border-bottom: 2px solid #0A66FF; padding-bottom: 8px;">Work Experience & Skills</h4>
                    <div style="margin-bottom: 12px;"><strong>Previous Work Experience:</strong></div>
                    <div style="margin-bottom: 20px; padding: 10px; background: #f8f9fa; border-radius: 6px;">${app.previousExperience || 'Not provided'}</div>
                    <div style="margin-bottom: 12px;"><strong>Skills & Specializations:</strong></div>
                    <div style="padding: 10px; background: #f8f9fa; border-radius: 6px;">${app.skills || 'Not provided'}</div>
                </div>
                <div style="margin-top: 20px;">
                    <h4 style="margin-bottom: 15px; color: #333; border-bottom: 2px solid #0A66FF; padding-bottom: 8px;">Address Information</h4>
                    <div style="margin-bottom: 12px;"><strong>Street Address:</strong> ${app.streetAddress || '-'}</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                        <div><strong>City:</strong> ${app.city || '-'}</div>
                        <div><strong>State:</strong> ${app.state || '-'}</div>
                        <div><strong>ZIP Code:</strong> ${app.zipCode || '-'}</div>
                    </div>
                    <div style="margin-top: 12px;"><strong>Country:</strong> ${app.country || '-'}</div>
                    <div style="margin-top: 12px;"><strong>Timezone:</strong> ${app.timezone || '-'}</div>
                </div>
                ${app.resume || app.coverLetter || app.certificates?.length > 0 || app.profilePhoto ? `
                <div style="margin-top: 20px;">
                    <h4 style="margin-bottom: 15px; color: #333; border-bottom: 2px solid #0A66FF; padding-bottom: 8px;">Documents</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        ${app.resume ? `<div><strong>Resume:</strong> <a href="${app.resume}" target="_blank" style="color: #0A66FF;">View Document</a></div>` : ''}
                        ${app.coverLetter ? `<div><strong>Cover Letter:</strong> <a href="${app.coverLetter}" target="_blank" style="color: #0A66FF;">View Document</a></div>` : ''}
                        ${app.profilePhoto ? `<div><strong>Profile Photo:</strong> <a href="${app.profilePhoto}" target="_blank" style="color: #0A66FF;">View Photo</a></div>` : ''}
                        ${app.certificates && app.certificates.length > 0 ? `<div><strong>Certificates:</strong> ${app.certificates.length} file(s)</div>` : ''}
                    </div>
                </div>
                ` : ''}
                ${app.status === 'rejected' && app.rejectionReason ? `
                <div style="margin-top: 20px;">
                    <h4 style="margin-bottom: 15px; color: #dc3545; border-bottom: 2px solid #dc3545; padding-bottom: 8px;">Rejection Reason</h4>
                    <div style="padding: 10px; background: #f8d7da; border-radius: 6px; color: #721c24;">${app.rejectionReason}</div>
                </div>
                ` : ''}
            `;

            document.getElementById('teacher-application-details').innerHTML = detailsHtml;
            document.getElementById('teacher-application-modal').style.display = 'block';
        }
    } catch (error) {
        console.error('Error viewing teacher application:', error);
        alert('Error loading application details');
    }
}

async function approveTeacher(applicationId) {
    if (!confirm('Are you sure you want to approve this teacher application? This will create a teacher account.')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/teacher-applications/applications/${applicationId}/approve`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            showSuccessNotification('Teacher Approved!', result.userExisted ? 'Teacher account already existed and has been linked.' : 'New teacher account created.');
            setTimeout(() => loadTeacherApplications(), 500);
        } else {
            showErrorNotification('Error', result.message || 'Failed to approve application.');
        }
    } catch (error) {
        console.error('Error approving teacher application:', error);
        showErrorNotification('Network Error', 'Failed to connect to server.');
    }
}

function openTeacherRejectModal(applicationId) {
    currentTeacherApplicationId = applicationId;
    document.getElementById('teacher-reject-reason').value = '';
    document.getElementById('teacher-reject-modal').style.display = 'block';
}

function closeTeacherRejectModal() {
    document.getElementById('teacher-reject-modal').style.display = 'none';
    currentTeacherApplicationId = null;
}

async function confirmTeacherReject() {
    if (!currentTeacherApplicationId) return;

    const reason = document.getElementById('teacher-reject-reason').value;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/teacher-applications/applications/${currentTeacherApplicationId}/reject`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            closeTeacherRejectModal();
            showWarningNotification('Application Rejected', 'Teacher application has been rejected.');
            setTimeout(() => loadTeacherApplications(), 500);
        } else {
            showErrorNotification('Error', result.message || 'Failed to reject application.');
        }
    } catch (error) {
        console.error('Error rejecting teacher application:', error);
        showErrorNotification('Network Error', 'Failed to connect to server.');
    }
}

// ============================================
// PUBLIC HOLIDAYS MANAGEMENT
// ============================================

let currentHolidayDate = new Date();
let academicYearHolidays = [];
let selectedHolidayData = null;

function initializeHolidayLogic() {
    currentHolidayDate = new Date();
    selectedHolidayData = null;
    fetchAndRenderHolidays();
}

async function fetchAndRenderHolidays() {
    const ayYear = document.getElementById('ay-year')?.value || "2025-2026";
    const container = document.getElementById('holiday-calendar-container');

    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/academic-year/holidays?academicYear=${ayYear}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            academicYearHolidays = result.data;
            renderHolidayCalendar();
        } else {
            container.innerHTML = `<div class="error-msg">${result.message}</div>`;
        }
    } catch (error) {
        console.error('Error fetching holidays:', error);
        container.innerHTML = `<div class="error-msg">Failed to load holidays</div>`;
    }
}

function renderHolidayCalendar() {
    const container = document.getElementById('holiday-calendar-container');
    if (!container) return;

    const year = currentHolidayDate.getFullYear();
    const month = currentHolidayDate.getMonth();
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentHolidayDate);

    // Days calculation for 7x6 grid (42 cells)
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const today = new Date();

    let html = `
        <div class="calendar-nav-header">
            <span class="month-title">${monthName} ${year}</span>
            <div class="nav-btns-wrapper">
                <button class="btn-nav" onclick="changeHolidayMonth(-1)"><i class="fas fa-chevron-left"></i></button>
                <div class="nav-divider"></div>
                <button class="btn-nav" onclick="changeHolidayMonth(1)"><i class="fas fa-chevron-right"></i></button>
            </div>
        </div>
        <div class="holiday-month-grid">
            <div class="calendar-day-header">Sun</div>
            <div class="calendar-day-header">Mon</div>
            <div class="calendar-day-header">Tue</div>
            <div class="calendar-day-header">Wed</div>
            <div class="calendar-day-header">Thu</div>
            <div class="calendar-day-header">Fri</div>
            <div class="calendar-day-header">Sat</div>
    `;

    // 7 columns x 6 rows = 42 cells
    for (let i = 0; i < 42; i++) {
        let dayNum;
        let isCurrentMonth = true;
        let cellDate;

        if (i < firstDayOfMonth) {
            // Previous month days
            dayNum = daysInPrevMonth - firstDayOfMonth + i + 1;
            isCurrentMonth = false;
            cellDate = new Date(year, month - 1, dayNum);
        } else if (i < firstDayOfMonth + daysInMonth) {
            // Current month days
            dayNum = i - firstDayOfMonth + 1;
            cellDate = new Date(year, month, dayNum);
        } else {
            // Next month days
            dayNum = i - (firstDayOfMonth + daysInMonth) + 1;
            isCurrentMonth = false;
            cellDate = new Date(year, month + 1, dayNum);
        }

        const dateStr = cellDate.toISOString().split('T')[0];
        const isToday = today.toDateString() === cellDate.toDateString();

        // Find holiday for this specific date
        const holiday = academicYearHolidays.find(h => {
            const hDate = new Date(h.date).toISOString().split('T')[0];
            return hDate === dateStr;
        });

        let dayClass = isCurrentMonth ? 'current-month' : 'other-month';
        if (isToday) dayClass += ' today';

        let styleAttr = '';
        let clickHandler = '';

        if (holiday) {
            const hName = holiday.name?.toLowerCase() || "";
            const hCountry = holiday.country?.toLowerCase() || "";
            const hDesc = holiday.description?.toLowerCase() || "";

            let category = "holiday"; // Default Pinkish
            let bgColor = "#FFE3E3";

            if (hName.includes("hackathon") || hName.includes("competition") || hName.includes("quiz")) {
                category = "competition";
                bgColor = "#FFF9C4"; // Yellow
            } else if (hCountry.includes("online") || hName.includes("meeting") || hName.includes("fair") || hDesc.includes("virtual")) {
                category = "online-event";
                bgColor = "#E1EFFF"; // Blue
            }

            dayClass += ` ${category}`;
            styleAttr = `style="background-color: ${bgColor};"`;
            clickHandler = `onclick="showHolidayDetail(${JSON.stringify(holiday).replace(/"/g, '&quot;')}, ${dayNum}, '${dateStr}')"`;

            if (selectedHolidayData && selectedHolidayData._id === holiday._id) {
                dayClass += ' selected';
            }
        }

        html += `
            <div class="calendar-day ${dayClass}" ${styleAttr} ${clickHandler}>
                <span class="day-num">${dayNum}</span>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;

    // Refresh side panel if we have selected data
    if (selectedHolidayData) {
        updateSidePanel(selectedHolidayData);
    }
}

function changeHolidayMonth(offset) {
    currentHolidayDate.setMonth(currentHolidayDate.getMonth() + offset);
    renderHolidayCalendar();
}

function showHolidayDetail(holiday, day, fullDate) {
    selectedHolidayData = holiday;
    renderHolidayCalendar(); // To update 'selected' class
    updateSidePanel(holiday, day, fullDate);
}

function updateSidePanel(holiday, dayVal, dateStr) {
    const panel = document.getElementById('holiday-details-side-panel');
    if (!panel) return;

    if (!holiday) {
        panel.innerHTML = `
            <div class="empty-panel-state">
                <i class="fas fa-calendar-alt"></i>
                <p style="font-weight:700; color:#2563eb;">No Event Selected</p>
                <p style="font-size:0.85rem; max-width:180px;">Tap any colored date to view the official details</p>
            </div>
        `;
        return;
    }

    const date = new Date(holiday.date);
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);

    const hName = holiday.name?.toLowerCase() || "";
    const hCountry = holiday.country?.toLowerCase() || "";
    const hDesc = holiday.description?.toLowerCase() || "";

    let category = "holiday";
    let tagIcon = '<i class="fas fa-umbrella-beach"></i>';
    let label = "Public Holiday";

    if (hName.includes("hackathon") || hName.includes("competition") || hName.includes("quiz")) {
        category = "competition";
        tagIcon = '<i class="fas fa-trophy"></i>';
        label = "Competition / Contest";
    } else if (hCountry.includes("online") || hName.includes("meeting") || hName.includes("fair") || hDesc.includes("virtual")) {
        category = "online-event";
        tagIcon = '<i class="fas fa-laptop"></i>';
        label = "Online Activity";
    }

    panel.innerHTML = `
        <div class="detail-card" style="animation: fadeIn 0.4s ease-out;">
            <div class="detail-header-premium">
                <div class="premium-date-card">
                    <span class="month-label">${dayName.substring(0, 3)}</span>
                    <span class="day-label">${date.getDate()}</span>
                </div>
                <div>
                    <h4 style="margin:0; font-weight:800; color:#1e3a8a; font-size:1.1rem;">${monthName}</h4>
                    <span style="font-size:0.75rem; color:#3b82f6; font-weight:600;">Academic Event</span>
                </div>
            </div>
            
            <div class="info-card-premium">
                <span class="premium-tag ${category}">
                    ${tagIcon} ${label}
                </span>
                <h3 class="premium-title">${holiday.name}</h3>
                <p class="premium-desc">${holiday.description || 'Details regarding this official entry are maintained within the school academic management system.'}</p>
                
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div class="premium-meta-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>Location: <strong>${holiday.country || 'Global'}</strong></span>
                    </div>
                    <div class="premium-meta-item">
                        <i class="fas fa-check-circle"></i>
                        <span>Status: <strong>Confirmed Schedule</strong></span>
                    </div>
                </div>
            </div>
        </div>
    `;
}


async function handleHolidayCSVUpload(input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const ayYear = document.getElementById('ay-year')?.value || "2025-2026";

    const formData = new FormData();
    formData.append('holiday_csv', file);
    formData.append('academicYear', ayYear);

    showToast('Uploading holidays...', 'info');

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/academic-year/upload-holidays', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            showToast(result.message, 'success');
            fetchAndRenderHolidays();
        } else {
            showToast(result.message || 'Upload failed', 'error');
        }
    } catch (error) {
        console.error('Error uploading holidays:', error);
        showToast('Network error while uploading holidays', 'error');
    }

    // Reset input
    input.value = '';
}

// ============================================
// FEES MANAGEMENT FUNCTIONS
// ============================================

async function initializeDefineFees() {
    console.log('Initializing Define Fees Page');
    try {
        // Ensure classes are loaded
        if (!AppState.allClasses || AppState.allClasses.length === 0) {
            await loadClassesData();
            // Re-render to show classes in dropdown
            const content = document.getElementById('admin-content') || document.getElementById('dashboard-content');
            if (content) content.innerHTML = renderDefineFees();
        }

        const tuitionInput = document.getElementById('tuition-fee');
        const examInput = document.getElementById('exam-fee');
        const classSelect = document.getElementById('fees-class-id');

        if (tuitionInput && examInput) {
            tuitionInput.addEventListener('input', calculateTotalFees);
            examInput.addEventListener('input', calculateTotalFees);
        }

        if (classSelect) {
            classSelect.addEventListener('change', async (e) => {
                const classId = e.target.value;
                if (classId) {
                    await fetchExistingFees(classId);
                } else {
                    document.getElementById('define-fees-form').reset();
                    document.getElementById('total-fee').value = '';
                }
            });
        }

        await loadDefinedFees();
    } catch (error) {
        console.error('Error in initializeDefineFees:', error);
    }
}

function calculateTotalFees() {
    const tuitionEl = document.getElementById('tuition-fee');
    const examEl = document.getElementById('exam-fee');
    const totalEl = document.getElementById('total-fee');

    if (tuitionEl && examEl && totalEl) {
        const tuition = parseFloat(tuitionEl.value) || 0;
        const exam = parseFloat(examEl.value) || 0;
        totalEl.value = (tuition + exam).toFixed(2);
    }
}

async function fetchExistingFees(classId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/fees/class-fees/${classId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                const tuitionInput = document.getElementById('tuition-fee');
                const examInput = document.getElementById('exam-fee');

                if (tuitionInput) tuitionInput.value = result.data.tuitionFee;
                if (examInput) examInput.value = result.data.examFee;

                calculateTotalFees();
            }
        }
    } catch (error) {
        console.error('Error fetching existing fees:', error);
    }
}

async function saveClassFees() {
    const classIdEl = document.getElementById('fees-class-id');
    const tuitionFeeInput = document.getElementById('tuition-fee');
    const examFeeInput = document.getElementById('exam-fee');
    const saveBtn = document.getElementById('btn-save-fees');

    if (!classIdEl || !tuitionFeeInput || !examFeeInput || !saveBtn) return;

    const classId = classIdEl.value;
    const tuitionFee = parseFloat(tuitionFeeInput.value);
    const examFee = parseFloat(examFeeInput.value);

    // Validation
    if (!classId) {
        alert('Please select a class');
        return;
    }
    if (isNaN(tuitionFee) || isNaN(examFee)) {
        alert('Please enter valid fee amounts');
        return;
    }

    const payload = { classId, tuitionFee, examFee };
    console.log('Saving Fees Payload:', payload);

    // Set loading state
    const originalBtnContent = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Saving...';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/fees/class-fees', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('API Response:', result);

        if (result.success) {
            alert('Fees saved successfully!');
            const form = document.getElementById('define-fees-form');
            if (form) form.reset();

            const totalEl = document.getElementById('total-fee');
            if (totalEl) totalEl.value = '';

            await loadDefinedFees();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error saving fees:', error);
        alert('Network error. Please try again.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnContent;
    }
}

async function loadDefinedFees() {
    const tbody = document.getElementById('defined-fees-tbody');
    if (!tbody) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/fees/class-fees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load fees');

        const result = await response.json();
        if (result.success) {
            if (!result.data || result.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">No fees defined yet.</td></tr>';
                return;
            }

            tbody.innerHTML = result.data
                .sort((a, b) => {
                    // Extract class numbers for sorting
                    const classA = parseInt(a.classId?.class) || 0;
                    const classB = parseInt(b.classId?.class) || 0;
                    return classA - classB; // Ascending order
                })
                .map(fee => {
                    // classId is populated object from backend
                    const classData = fee.classId || {};
                    const classIdForEdit = classData.class || fee.classId; // Use numeric class for edit lookup

                    const subjectsCount = fee.totalSubjects || classData.subjects?.length || 5;
                    const className = classData.class || 'Unknown';

                    return `
                    <tr>
                        <td><strong>${className}</strong></td>
                        <td style="color: #666;">${subjectsCount} Subjects</td>
                        <td>₹${fee.tuitionFee.toLocaleString()}</td>
                        <td>₹${fee.examFee.toLocaleString()}</td>
                        <td><span class="text-total-green">₹${fee.totalFee.toLocaleString()}</span></td>
                        <td style="color: #888; font-size: 13px;">${formatDate(fee.updatedAt)}</td>
                        <td>
                            <button class="btn-edit-yellow" title="Edit Fee" onclick="editFee('${className}', ${fee.tuitionFee}, ${fee.examFee})">
                                <i class="fas fa-edit"></i>
                            </button>
                        </td>
                    </tr>
                `;
                }).join('');
        }
    } catch (error) {
        console.error('Error loading defined fees:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-danger"><i class="fas fa-exclamation-triangle mr-2"></i> Error loading data</td></tr>';
    }
}

function editFee(classId, tuition, exam) {
    const classSelect = document.getElementById('fees-class-id');
    const tuitionInput = document.getElementById('tuition-fee');
    const examInput = document.getElementById('exam-fee');

    if (classSelect) classSelect.value = classId;
    if (tuitionInput) tuitionInput.value = tuition;
    if (examInput) examInput.value = exam;

    calculateTotalFees();

    // Scroll to top form
    document.getElementById('define-fees-form').scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// PAYMENT UPDATES FUNCTIONS
// ============================================

// Global payment data storage
let paymentData = [];

// Initialize payment updates when page loads
async function initializePaymentUpdates() {
    await loadPaymentClasses();
    await loadPaymentStudents();
}

// Load classes for dropdown (only classes with fees)
async function loadPaymentClasses() {
    try {
        const token = localStorage.getItem('token');
        // Load classes that have fees defined
        const response = await fetch('/api/payments/students', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load classes');

        const result = await response.json();
        if (result.success && result.data) {
            // Extract unique classes from student data (using numeric class)
            const uniqueClasses = [...new Set(result.data.map(s => s.class))].filter(Boolean);

            const classSelect = document.getElementById('payment-class-filter');
            if (classSelect) {
                // Sort classes numerically
                const sortedClasses = uniqueClasses.sort((a, b) => a - b);

                classSelect.innerHTML = '<option value="">All Classes</option>' +
                    sortedClasses.map(c => `<option value="${c}">Class-${c}</option>`).join('');
            }
        }
    } catch (error) {
        console.error('Error loading classes:', error);
    }
}

// Load students with payment data
async function loadPaymentStudents() {
    try {
        const token = localStorage.getItem('token');
        const classFilter = document.getElementById('payment-class-filter')?.value || '';
        const statusFilter = document.getElementById('payment-status-filter')?.value || 'all';

        const queryParams = new URLSearchParams();
        if (classFilter) queryParams.append('class_id', classFilter);
        if (statusFilter) queryParams.append('status', statusFilter);

        const response = await fetch(`/api/payments/students?${queryParams}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load payment data');

        const result = await response.json();
        if (result.success) {
            paymentData = result.data;
            renderPaymentTable(paymentData);
        }
    } catch (error) {
        console.error('Error loading payment students:', error);
        const tbody = document.getElementById('payment-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-danger"><i class="fas fa-exclamation-triangle mr-2"></i> Error loading payment data</td></tr>';
        }
    }
}

// Render payment table
function renderPaymentTable(students) {
    const tbody = document.getElementById('payment-tbody');
    if (!tbody) return;

    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">No payment records found.</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(student => {
        const statusClass = student.status === 'paid' ? 'status-paid' : 'status-pending';

        return `
            <tr>
                <td><strong>${student.student_name}</strong></td>
                <td>${student.class}</td>
                <td>₹${student.total_fees.toLocaleString()}</td>
                <td>₹${student.paid_amount.toLocaleString()}</td>
                <td><span class="status-badge ${statusClass}">${student.status}</span></td>
                <td>${formatDate(student.due_date)}</td>
                <td>
                    ${student.status === 'pending' ?
                `<button class="btn btn-success" onclick="openPaymentModal('${student.student_id}', '${student.student_name}', '${student.class}', ${student.total_fees}, ${student.paid_amount})">
                            <i class="fas fa-check-circle"></i> Mark as Paid
                        </button>` :
                `<button class="btn btn-success" onclick="generateSingleReceipt('${student.student_id}')">
                            <i class="fas fa-file-invoice"></i> Receipt
                        </button>`
            }
                </td>
            </tr>
        `;
    }).join('');
}

// Open payment update modal
function openPaymentModal(studentId, studentName, className, totalFees, currentPaid) {
    const modal = document.getElementById('payment-modal');
    if (!modal) return;

    // Populate modal fields
    document.getElementById('payment-student-id').value = studentId;
    document.getElementById('modal-student-name').value = studentName;
    document.getElementById('modal-class-name').value = className;
    document.getElementById('modal-total-fees').value = `₹${totalFees.toLocaleString()}`;

    // Show modal
    modal.style.display = 'flex';
}

// Close payment modal
function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Process payment update
async function processPaymentUpdate() {
    try {
        const studentId = document.getElementById('payment-student-id').value;

        if (!studentId) {
            alert('Invalid student');
            return;
        }

        // Confirm full payment
        if (!confirm('Are you sure you want to mark this student as fully paid?')) {
            return;
        }

        // Create or update payment record
        const token = localStorage.getItem('token');
        const response = await fetch('/api/payments/update-student-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                studentId
            })
        });

        const result = await response.json();
        if (result.success) {
            alert('Payment marked as paid successfully!');
            closePaymentModal();
            loadPaymentStudents(); // Refresh table
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error updating payment:', error);
        alert('Error updating payment');
    }
}

// Generate single receipt
async function generateSingleReceipt(studentId) {
    try {
        const token = localStorage.getItem('token');

        // First, get the student's payment record
        const studentsResponse = await fetch('/api/payments/students', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!studentsResponse.ok) throw new Error('Failed to fetch student data');

        const studentsResult = await studentsResponse.json();
        if (!studentsResult.success) throw new Error('No student data found');

        // Find the student and their payment data
        const studentData = studentsResult.data.find(s => s.student_id === studentId);
        if (!studentData) {
            throw new Error('Student not found');
        }

        // Create receipt data directly from student data
        const receiptData = {
            schoolName: "Smart School System",
            studentName: studentData.student_name,
            className: studentData.class_name,
            totalFees: studentData.total_fees,
            paidAmount: studentData.paid_amount,
            status: studentData.status,
            paymentDate: new Date().toISOString(),
            receiptNumber: `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            paymentMethod: 'N/A',
            academicYear: new Date().getFullYear().toString(),
        };

        // Generate PDF directly
        generatePDFReceipt(receiptData);

    } catch (error) {
        console.error('Error generating receipt:', error);
        alert('Error generating receipt: ' + error.message);
    }
}

// Generate bulk receipts - uses currently filtered data
async function generateBulkReceipts() {
    try {
        // Use all currently filtered/displayed students (not just paid)
        const filteredStudents = paymentData;

        if (filteredStudents.length === 0) {
            alert('No students found for receipt generation. Please adjust your filters.');
            return;
        }

        // Get current filter values for the report header
        const classFilter = document.getElementById('payment-class-filter')?.value || '';
        const statusFilter = document.getElementById('payment-status-filter')?.value || 'all';

        // Get filter display names
        const classSelect = document.getElementById('payment-class-filter');
        const classFilterName = classFilter ?
            classSelect.options[classSelect.selectedIndex].text : 'All Classes';
        const statusFilterName = statusFilter === 'all' ? 'All' :
            statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);

        // Generate comprehensive receipt report
        generatePaymentReportPDF(filteredStudents, {
            classFilter: classFilterName,
            statusFilter: statusFilterName
        });

        alert(`Generated receipt report for ${filteredStudents.length} students!`);
    } catch (error) {
        console.error('Error generating bulk receipts:', error);
        alert('Error generating receipt report');
    }
}

// Generate PDF receipt
function generatePDFReceipt(receiptData) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Add school header
    doc.setFontSize(20);
    doc.text(receiptData.schoolName || 'School Management System', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text('Payment Receipt', 105, 30, { align: 'center' });

    // Add receipt details
    doc.setFontSize(10);
    let yPosition = 50;

    doc.text(`Receipt Number: ${receiptData.receiptNumber || 'N/A'}`, 20, yPosition);
    yPosition += 10;
    doc.text(`Date: ${new Date(receiptData.paymentDate || Date.now()).toLocaleDateString()}`, 20, yPosition);
    yPosition += 10;
    doc.text(`Academic Year: ${receiptData.academicYear || new Date().getFullYear()}`, 20, yPosition);
    yPosition += 20;

    // Student details
    doc.text(`Student Name: ${receiptData.studentName}`, 20, yPosition);
    yPosition += 10;
    doc.text(`Class: ${receiptData.className}`, 20, yPosition);
    yPosition += 20;

    // Payment details
    doc.text(`Total Fees: ₹${receiptData.totalFees.toLocaleString()}`, 20, yPosition);
    yPosition += 10;
    doc.text(`Paid Amount: ₹${receiptData.paidAmount.toLocaleString()}`, 20, yPosition);
    yPosition += 10;
    doc.text(`Status: ${receiptData.paymentStatus || 'Paid'}`, 20, yPosition);
    yPosition += 10;
    doc.text(`Payment Method: ${receiptData.paymentMethod || 'N/A'}`, 20, yPosition);

    // Save the PDF
    doc.save(`receipt_${receiptData.receiptNumber || Date.now()}.pdf`);
}

// Generate comprehensive payment report PDF with table format
function generatePaymentReportPDF(students, filters) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape'); // Use landscape for more columns

    const generatedDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Header Section
    doc.setFillColor(41, 128, 185); // Blue header background
    doc.rect(0, 0, 297, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('SmartSchool', 148.5, 20, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Student Fee Payment Report', 148.5, 32, { align: 'center' });

    // Report Info Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    let yPos = 50;

    doc.setFont('helvetica', 'bold');
    doc.text('Report Details:', 14, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 6;
    doc.text(`Generated On: ${generatedDate}`, 14, yPos);
    yPos += 6;
    doc.text(`Filters Applied: Class: ${filters.classFilter} | Status: ${filters.statusFilter}`, 14, yPos);
    yPos += 6;
    doc.text(`Total Records: ${students.length}`, 14, yPos);
    yPos += 12;

    // Table Header
    const headers = ['Student Name', 'Class', 'Total Fees', 'Paid Amount', 'Remaining', 'Status', 'Payment Date', 'Due Date'];
    const colWidths = [45, 30, 30, 30, 30, 25, 35, 35];
    const startX = 14;
    let currentX = startX;

    // Draw table header background
    doc.setFillColor(52, 73, 94);
    doc.rect(startX, yPos - 5, 260, 10, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    headers.forEach((header, index) => {
        doc.text(header, currentX + 2, yPos);
        currentX += colWidths[index];
    });

    yPos += 10;

    // Table Rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    students.forEach((student, index) => {
        // Check if we need a new page
        if (yPos > 180) {
            doc.addPage();
            yPos = 20;

            // Redraw header on new page
            doc.setFillColor(52, 73, 94);
            doc.rect(startX, yPos - 5, 260, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            currentX = startX;
            headers.forEach((header, i) => {
                doc.text(header, currentX + 2, yPos);
                currentX += colWidths[i];
            });
            yPos += 10;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
        }

        // Alternate row background
        if (index % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(startX, yPos - 4, 260, 8, 'F');
        }

        // Calculate remaining amount
        const remaining = student.total_fees - student.paid_amount;

        // Format dates
        const paymentDate = student.payment_date ?
            new Date(student.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) :
            '-';
        const dueDate = student.due_date ?
            new Date(student.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) :
            '-';

        // Set status color
        const isPaid = student.status === 'paid';
        const statusColor = isPaid ? [39, 174, 96] : [231, 76, 60]; // Green for paid, red for pending
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);

        currentX = startX;
        const rowData = [
            student.student_name || 'N/A',
            student.class_name || 'N/A',
            `₹${(student.total_fees || 0).toLocaleString()}`,
            `₹${(student.paid_amount || 0).toLocaleString()}`,
            `₹${remaining.toLocaleString()}`,
            (student.status || 'Pending').toUpperCase(),
            paymentDate,
            dueDate
        ];

        rowData.forEach((cell, i) => {
            // Reset text color for non-status columns
            if (i !== 5) doc.setTextColor(0, 0, 0);
            doc.text(String(cell).substring(0, 20), currentX + 2, yPos);
            currentX += colWidths[i];
        });

        yPos += 8;
    });

    // Summary Section at the bottom
    yPos += 10;
    if (yPos > 170) {
        doc.addPage();
        yPos = 20;
    }

    const totalFees = students.reduce((sum, s) => sum + (s.total_fees || 0), 0);
    const totalPaid = students.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
    const totalPending = totalFees - totalPaid;
    const paidCount = students.filter(s => s.status === 'paid').length;
    const pendingCount = students.length - paidCount;

    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.5);
    doc.line(14, yPos, 283, yPos);
    yPos += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(41, 128, 185);
    doc.text('Summary', 14, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    doc.text(`Total Fees: ₹${totalFees.toLocaleString()}`, 14, yPos);
    doc.text(`Total Paid: ₹${totalPaid.toLocaleString()}`, 80, yPos);
    doc.text(`Total Pending: ₹${totalPending.toLocaleString()}`, 150, yPos);
    yPos += 6;
    doc.text(`Paid Students: ${paidCount}`, 14, yPos);
    doc.text(`Pending Students: ${pendingCount}`, 80, yPos);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('This is a computer-generated report. SmartSchool Management System.', 148.5, 200, { align: 'center' });

    // Save the PDF
    const timestamp = new Date().getTime();
    doc.save(`Fee_Payment_Report_${timestamp}.pdf`);
}
