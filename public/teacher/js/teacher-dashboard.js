/**
 * Teacher Dashboard JavaScript
 * Handles navigation, content loading, and UI interactions
 */

// ============================================
// REUSABLE UI COMPONENTS
// ============================================
const Components = {
    StatusBadge: (status) => {
        const statusConfig = {
            pending: { class: 'pending', label: 'Pending' },
            approved: { class: 'approved', label: 'Approved' },
            rejected: { class: 'rejected', label: 'Rejected' },
            active: { class: 'approved', label: 'Active' },
            inactive: { class: 'rejected', label: 'Inactive' }
        };
        const config = statusConfig[status.toLowerCase()] || statusConfig.pending;
        return `<span class="status-badge ${config.class}">${config.label}</span>`;
    },

    LoadingState: (message = 'Loading...') => `
        <div class="loading-state" style="text-align: center; padding: 40px;">
            <div class="loading-spinner" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #0A66FF; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
            <p style="color: #666;">${message}</p>
        </div>
    `,

    EmptyState: (icon = 'inbox', title = 'No data found', message = 'There are no items to display.') => `
        <div class="empty-state" style="text-align: center; padding: 60px 20px;">
            <i class="fas fa-${icon}" style="font-size: 48px; color: #ccc; margin-bottom: 20px;"></i>
            <h3 style="color: #333; margin-bottom: 10px;">${title}</h3>
            <p style="color: #777;">${message}</p>
        </div>
    `,

    ErrorState: (message = 'Something went wrong', onRetry = 'location.reload()') => `
        <div class="error-state" style="text-align: center; padding: 40px;">
            <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #dc3545; margin-bottom: 20px;"></i>
            <h3 style="color: #333; margin-bottom: 10px;">Error</h3>
            <p style="color: #777; margin-bottom: 20px;">${message}</p>
            <button class="btn btn-primary" onclick="${onRetry}">
                <i class="fas fa-redo"></i> Try Again
            </button>
        </div>
    `
};

// ============================================
// APPLICATION STATE
// ============================================
const AppState = {
    user: null,
    teacherProfile: null,
    activePage: 'dashboard',
    notifications: [],
    isLoading: false
};

// Global state for academic calendar
let academicData = [];
let currentCalendarMonth = new Date().getMonth();
let currentCalendarYear = new Date().getFullYear();

// ============================================
// MAIN INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    checkAuth();
    initializeUI();
    fetchTeacherProfile();
    loadPage('dashboard');
});

/**
 * Check if user is authenticated and is a teacher
 */
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role !== 'teacher') {
            window.location.href = '/login';
            return;
        }
        AppState.user = payload;

        // Update UI with user info
        const profileNameEl = document.getElementById('top-profile-name');
        if (profileNameEl && payload.name) {
            profileNameEl.textContent = payload.name;
        }
    } catch (e) {
        console.error('Auth check error:', e);
        window.location.href = '/login';
    }
}

/**
 * Initialize UI components and event listeners
 */
function initializeUI() {
    setupSidebar();
    setupDropdowns();
    setupLogout();
}

/**
 * Handle Sidebar Interactions
 */
function setupSidebar() {
    const navItems = document.querySelectorAll('.nav-item');
    const navGroups = document.querySelectorAll('.nav-group');

    // Handle Nav Item Clicks
    navItems.forEach(item => {
        item.addEventListener('click', function (e) {
            const page = this.dataset.page;
            if (page && page !== '#') {
                e.preventDefault();

                // Update active state
                navItems.forEach(i => i.classList.remove('active'));
                this.classList.add('active');

                // Load the page
                const title = this.dataset.title || (this.querySelector('span') ? this.querySelector('span').textContent : '');
                loadPage(page, title);

                // Close sidebar on mobile
                if (window.innerWidth <= 768) {
                    toggleSidebar();
                }
            }
        });
    });

    // Handle Nav Group Toggles
    navGroups.forEach(group => {
        const toggle = group.querySelector('.nav-group-toggle');
        if (toggle) {
            toggle.addEventListener('click', function () {
                const isOpen = group.classList.contains('open');

                // Close other groups
                navGroups.forEach(g => {
                    if (g !== group) g.classList.remove('open');
                });

                // Toggle current group
                group.classList.toggle('open');
                toggle.setAttribute('aria-expanded', !isOpen);
            });
        }
    });
}

/**
 * Toggle Sidebar visibility on mobile
 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}

/**
 * Update sidebar active state based on current page
 * @param {string} page - Current page identifier
 */
function updateSidebarActiveState(page) {
    const navItems = document.querySelectorAll('.nav-item');
    const navGroups = document.querySelectorAll('.nav-group');

    // Remove active from all items
    navItems.forEach(item => item.classList.remove('active'));

    // Find and activate the correct nav item
    navItems.forEach(item => {
        const itemPage = item.dataset.page;
        if (itemPage === page) {
            item.classList.add('active');
            // Open parent group if exists
            const parentGroup = item.closest('.nav-group');
            if (parentGroup) {
                parentGroup.classList.add('open');
                const toggle = parentGroup.querySelector('.nav-group-toggle');
                if (toggle) toggle.setAttribute('aria-expanded', 'true');
            }
        }
    });
}

/**
 * Handle Profile Dropdown
 */
function setupDropdowns() {
    const profileBtn = document.querySelector('.profile-btn');
    const profileDropdown = document.querySelector('.profile-dropdown');

    if (profileBtn) {
        profileBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function () {
        if (profileDropdown) {
            profileDropdown.classList.remove('active');
        }
    });

    // Dropdown items
    const dropdownItems = document.querySelectorAll('.dropdown-menu a');
    dropdownItems.forEach(item => {
        item.addEventListener('click', function (e) {
            const page = this.dataset.page;
            if (page) {
                e.preventDefault();
                const title = this.dataset.title || this.textContent.trim();
                loadPage(page, title);
            }
        });
    });
}

/**
 * Handle Logout
 */
function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    const dropdownLogout = document.getElementById('dropdown-logout');

    const handleLogout = (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
    };

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (dropdownLogout) dropdownLogout.addEventListener('click', handleLogout);
}

/**
 * Load Page Content
 */
function loadPage(page, title = null) {
    const content = document.getElementById('dashboard-content');
    const navbarTitle = document.getElementById('navbar-page-title');

    if (title && navbarTitle) {
        navbarTitle.textContent = title;
    }

    AppState.activePage = page;

    // Update sidebar active state
    updateSidebarActiveState(page);

    // Show loading state
    content.innerHTML = Components.LoadingState(`Loading ${page}...`);

    // Map of page IDs to their render functions
    const pageRenders = {
        'dashboard': renderDashboard,
        'profile': renderProfile,
        'edit-profile': renderEditProfile,
        'academic-calendar': renderAcademicCalendarPage,
        'view-announcements': renderAnnouncements,
        'post-announcement': renderPostAnnouncement,
        'exam-timetable': renderExamTimetable,
        'upload-question-paper': renderUploadPaper,
        'enter-marks': renderEnterMarks,
        'view-results': renderViewResults,
        'submit-results': renderSubmitResults,
        'view-attendance': renderAttendancePage,
        'edit-attendance': renderAttendancePage,
        'submit-attendance': renderAttendancePage,
        'attendance': renderAttendancePage,

        'weekly-schedule': renderWeeklySchedule,
        'assigned-classes': renderAssignedClasses,
        'students-list': renderStudentsList,
        'view-materials': renderMaterials,
        'upload-pdf': renderUploadPDF,
        'upload-video': renderUploadVideo,
        'update-material': renderUpdateMaterial,
        'delete-material': renderDeleteMaterial,
        'manage-assignments': renderManageAssignments,
        'submissions-marks': renderSubmissionsMarks,
        'create-live-session': renderCreateLiveSession,
        'generate-link': renderGenerateLink,
        'send-session-notification': renderSendSessionNotification,
        'join-session': renderJoinSession,
        'mark-session-attendance': renderMarkSessionAttendance,
        'end-session': renderEndSession,
        'manage-live-class': renderManageLiveClass,
        'join-live-class': renderJoinLiveClass,
        'class-details': renderClassDetails
    };

    setTimeout(() => {
        if (pageRenders[page]) {
            content.innerHTML = pageRenders[page]();
            // Initialize page-specific scripts if needed
            initializePageScripts(page);
        } else {
            content.innerHTML = Components.EmptyState('tools', 'Module in Development', `The <strong>${page}</strong> module is currently being developed.`);
        }
    }, 300);
}

/**
 * Page-specific initializers
 */
function initializePageScripts(page) {
    if (page === 'dashboard') {
        fetchDashboardData();
    } else if (page === 'academic-calendar') {
        initializeAcademicCalendar();
    } else if (page === 'assigned-classes') {
        fetchAssignedClasses();
    } else if (page === 'class-details') {
        fetchClassDetails();

    } else if (page === 'weekly-schedule') {
        fetchWeeklySchedule();
    } else if (page === 'students-list') {
        fetchStudents();
    } else if (page === 'view-announcements') {
        fetchTeacherNotices();
    } else if (page === 'post-announcement') {
        initializePostAnnouncement();
    } else if (page === 'manage-assignments') {
        fetchTeacherAssignments();
    } else if (page === 'submissions-marks') {
        fetchAllSubmissions();
    } else if (page === 'view-materials') {
        fetchMaterials();
    } else if (page === 'upload-pdf') {
        initializeUploadMaterial();
    } else if (page === 'profile') {
        populateTeacherProfileView();
    } else if (page === 'edit-profile') {
        initializeEditProfileForm();
    } else if (page === 'manage-live-class') {
        initializeManageLiveClass();
    } else if (page === 'join-live-class') {
        initializeJoinLiveClass();
    } else if (page === 'attendance' || page === 'view-attendance' || page === 'edit-attendance' || page === 'submit-attendance') {
        initializeAttendancePage();
    }
}

async function fetchTeacherProfile() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return null;

        const response = await fetch('/api/teachers/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return null;
        }

        const result = await response.json();
        if (result.success && result.data) {
            AppState.teacherProfile = result.data;
            AppState.user = { ...AppState.user, ...result.data };

            const profileNameEl = document.getElementById('top-profile-name');
            if (profileNameEl && result.data.name) {
                profileNameEl.textContent = result.data.name;
            }

            return result.data;
        }
    } catch (error) {
        console.error('Failed to fetch teacher profile:', error);
    }

    return null;
}

function getTeacherProfileData() {
    return AppState.teacherProfile || AppState.user || {};
}

// ============================================
// HELPER UTILITIES
// ============================================

function getAcademicYearString(month, year) {
    if (month >= 6) {
        return `${year}-${year + 1}`;
    } else {
        return `${year - 1}-${year}`;
    }
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

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/// ============================================
// ATTENDANCE PAGE
// ============================================

function renderAttendancePage() {
    return `
        <div style="width:100%;">
            <div style="background:#fff; border-radius:16px; padding:32px 36px; box-shadow:0 1px 4px rgba(0,0,0,0.06); border:1px solid #e2e8f0;">
                <!-- Header -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; flex-wrap:wrap; gap:16px;">
                    <div>
                        <h2 style="margin:0; font-size:22px; font-weight:700; color:#0f172a;">Attendance Records</h2>
                        <p style="margin:5px 0 0; color:#64748b; font-size:14px;">Session-wise attendance — click any row to view student details</p>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <label for="attendance-class-filter" style="font-size:14px; font-weight:500; color:#374151; white-space:nowrap;">Filter by Class:</label>
                        <select id="attendance-class-filter" onchange="loadAttendanceForClass(this.value)"
                            style="padding:9px 16px; border:1px solid #e2e8f0; border-radius:10px; font-size:14px; color:#374151; background:#f8fafc; min-width:170px; cursor:pointer; outline:none;">
                            <option value="">All Classes</option>
                        </select>
                    </div>
                </div>

                <!-- Records Table -->
                <div id="attendance-records-container">
                    <div style="text-align:center; padding:48px; color:#94a3b8;">
                        <div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#0A66FF;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 14px;"></div>
                        <p style="margin:0;font-size:14px;">Loading attendance records...</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Student Attendance Detail Modal -->
        <div id="attendance-detail-modal" onclick="if(event.target===this)closeAttendanceDetailModal()" style="display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.45);z-index:9999;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:16px;width:680px;max-width:95vw;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,0.12);overflow:hidden;">
                <!-- Modal Header -->
                <div style="background:#fff;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;border-bottom:1px solid #f1f5f9;">
                    <div>
                        <div id="adm-subject" style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:2px;"></div>
                        <div id="adm-meta" style="font-size:13px;color:#64748b;"></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <button onclick="downloadAttendancePDF()" style="padding:9px 18px;background:#0A66FF;border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;transition:background 0.15s;" onmouseover="this.style.background='#0052cc'" onmouseout="this.style.background='#0A66FF'">
                            <i class="fas fa-download"></i> Download PDF
                        </button>
                        <button onclick="closeAttendanceDetailModal()" style="background:none;border:none;color:#94a3b8;font-size:22px;cursor:pointer;padding:4px;display:flex;align-items:center;justify-content:center;transition:color 0.15s;" onmouseover="this.style.color='#475569'" onmouseout="this.style.color='#94a3b8'">&times;</button>
                    </div>
                </div>
                <!-- Summary Chips -->
                <div style="padding:16px 28px;background:#fff;border-bottom:1px solid #f1f5f9;display:flex;gap:12px;flex-shrink:0;">
                    <span id="adm-present-chip" style="display:inline-flex;align-items:center;gap:6px;background:#ecfdf5;color:#047857;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;"></span>
                    <span id="adm-absent-chip" style="display:inline-flex;align-items:center;gap:6px;background:#fef2f2;color:#b91c1c;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;"></span>
                    <span id="adm-total-chip" style="display:inline-flex;align-items:center;gap:6px;background:#f8fafc;color:#475569;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;border:1px solid #e2e8f0;"></span>
                </div>
                <!-- Student Table -->
                <div id="adm-body" style="overflow-y:auto;flex:1;padding:0;min-height:200px;"></div>

            </div>
        </div>
    `;
}

// Holds the session data currently displayed in the detail modal (for PDF export)
let _currentDetailSession = null;

async function initializeAttendancePage() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/teachers/assigned-classes', { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await res.json();

        const select = document.getElementById('attendance-class-filter');
        if (select && result.success && result.data && result.data.length > 0) {
            result.data.forEach(cls => {
                const opt = document.createElement('option');
                opt.value = cls._id;
                opt.textContent = cls.name || cls.class || cls._id;
                select.appendChild(opt);
            });
        }

        await loadAttendanceForClass('');
    } catch (err) {
        console.error('Error initializing attendance page:', err);
        const container = document.getElementById('attendance-records-container');
        if (container) container.innerHTML = Components.ErrorState('Failed to load attendance data');
    }
}

async function loadAttendanceForClass(classId) {
    const container = document.getElementById('attendance-records-container');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center;padding:48px;color:#94a3b8;">
        <div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#0A66FF;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 14px;"></div>
        <p style="margin:0;font-size:14px;">Loading...</p></div>`;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/live-session/my-sessions?limit=100', { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await res.json();

        if (!result.success || !result.data || result.data.length === 0) {
            container.innerHTML = Components.EmptyState('clipboard-list', 'No Records Found', 'No live sessions found. Attendance will appear here once sessions are completed.');
            return;
        }

        let sessions = result.data;
        if (classId) {
            sessions = sessions.filter(s => {
                const sid = s.classId && s.classId._id ? s.classId._id.toString() : (s.classId ? s.classId.toString() : '');
                return sid === classId;
            });
        }

        sessions = sessions.filter(s => s.status === 'ended' || s.status === 'live');

        if (sessions.length === 0) {
            container.innerHTML = Components.EmptyState('calendar-check', 'No Records Found', 'No completed sessions found for the selected class.');
            return;
        }

        // Store sessions for modal access
        window._attendanceSessions = sessions;

        const rows = sessions.map((session, idx) => {
            const date = new Date(session.scheduledDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            const attendanceArr = session.attendance || [];
            const presentCount = attendanceArr.filter(a => a.status === 'present').length;
            const absentCount = attendanceArr.filter(a => a.status === 'absent').length;
            const isLive = session.status === 'live';

            return `
                <tr onclick="openAttendanceDetailModal(${idx})" style="border-bottom:1px solid #f1f5f9;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                    <td style="padding:16px 20px;font-weight:600;color:#0f172a;font-size:14px;">${escapeHtml(session.subjectName || '—')}</td>
                    <td style="padding:16px 20px;color:#475569;font-size:14px;">${escapeHtml(session.className || '—')}</td>
                    <td style="padding:16px 20px;color:#475569;font-size:14px;">${date}</td>
                    <td style="padding:16px 20px;color:#475569;font-size:14px;">${session.startTime} – ${session.endTime}</td>
                    <td style="padding:16px 20px;">
                        <span style="display:inline-flex;align-items:center;gap:5px;background:#d1fae5;color:#059669;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:600;">
                            <i class="fas fa-check-circle"></i> ${presentCount}
                        </span>
                    </td>
                    <td style="padding:16px 20px;">
                        <span style="display:inline-flex;align-items:center;gap:5px;background:#fee2e2;color:#dc2626;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:600;">
                            <i class="fas fa-times-circle"></i> ${absentCount}
                        </span>
                    </td>
                    <td style="padding:16px 20px;">
                        <span style="padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;
                            background:${isLive ? '#fee2e2' : '#f1f5f9'};
                            color:${isLive ? '#dc2626' : '#64748b'};">
                            ${isLive ? '🔴 LIVE' : 'Completed'}
                        </span>
                    </td>
                    <td style="padding:16px 20px;">
                        <span style="display:inline-flex;align-items:center;gap:5px;color:#0A66FF;font-size:13px;font-weight:500;">
                            <i class="fas fa-users"></i> View Students
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                            <th style="padding:13px 20px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Subject</th>
                            <th style="padding:13px 20px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Class</th>
                            <th style="padding:13px 20px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Date</th>
                            <th style="padding:13px 20px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Time</th>
                            <th style="padding:13px 20px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Present</th>
                            <th style="padding:13px 20px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Absent</th>
                            <th style="padding:13px 20px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Status</th>
                            <th style="padding:13px 20px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Students</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    } catch (err) {
        console.error('Error loading attendance:', err);
        container.innerHTML = Components.ErrorState('Failed to load attendance records');
    }
}

function openAttendanceDetailModal(sessionIdx) {
    const sessions = window._attendanceSessions || [];
    const session = sessions[sessionIdx];
    if (!session) return;

    _currentDetailSession = session;

    const attendanceArr = session.attendance || [];
    const presentCount = attendanceArr.filter(a => a.status === 'present').length;
    const absentCount = attendanceArr.filter(a => a.status === 'absent').length;
    const total = attendanceArr.length;
    const date = new Date(session.scheduledDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const subjEl = document.getElementById('adm-subject');
    const metaEl = document.getElementById('adm-meta');
    if (subjEl) subjEl.textContent = session.subjectName + ' — ' + session.className;
    if (metaEl) metaEl.textContent = date + '  •  ' + session.startTime + ' – ' + session.endTime;

    const pChip = document.getElementById('adm-present-chip');
    const aChip = document.getElementById('adm-absent-chip');
    const tChip = document.getElementById('adm-total-chip');
    if (pChip) pChip.innerHTML = '<i class="fas fa-check-circle"></i> Present: ' + presentCount;
    if (aChip) aChip.innerHTML = '<i class="fas fa-times-circle"></i> Absent: ' + absentCount;
    if (tChip) tChip.innerHTML = '<i class="fas fa-users"></i> Total: ' + total;

    const bodyEl = document.getElementById('adm-body');
    if (bodyEl) {
        if (attendanceArr.length === 0) {
            bodyEl.innerHTML = '<div style="padding:48px;text-align:center;color:#94a3b8;"><i class="fas fa-users" style="font-size:36px;margin-bottom:12px;display:block;"></i><p style="margin:0;font-size:14px;">No student attendance recorded for this session.</p></div>';
        } else {
            const studentRows = attendanceArr.map((a, i) => {
                const isPresent = a.status === 'present';
                const isLate = a.status === 'late';
                const statusColor = isPresent ? '#059669' : isLate ? '#d97706' : '#dc2626';
                const statusBg = isPresent ? '#d1fae5' : isLate ? '#fef3c7' : '#fee2e2';
                const statusLabel = isPresent ? 'Present' : isLate ? 'Late' : 'Absent';
                const statusIcon = isPresent ? 'check-circle' : isLate ? 'clock' : 'times-circle';
                return `
                    <tr style="border-bottom:1px solid #f1f5f9;background:${i % 2 === 0 ? '#fff' : '#fafbfc'};">
                        <td style="padding:15px 28px;">
                            <div style="display:flex;align-items:center;gap:12px;">
                                <div style="width:36px;height:36px;background:#eff6ff;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                    <i class="fas fa-user" style="color:#0A66FF;font-size:13px;"></i>
                                </div>
                                <span style="font-weight:600;color:#0f172a;font-size:14px;">${escapeHtml(a.studentName || '—')}</span>
                            </div>
                        </td>
                        <td style="padding:15px 28px;color:#475569;font-size:14px;">${escapeHtml(session.className || '—')}</td>
                        <td style="padding:15px 28px;">
                            <span style="display:inline-flex;align-items:center;gap:6px;background:${statusBg};color:${statusColor};padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;">
                                <i class="fas fa-${statusIcon}"></i> ${statusLabel}
                            </span>
                        </td>
                    </tr>`;
            }).join('');

            bodyEl.innerHTML = `
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;position:sticky;top:0;">
                            <th style="padding:14px 28px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;width:45%;">Student Name</th>
                            <th style="padding:14px 28px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;width:25%;">Class</th>
                            <th style="padding:14px 28px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;width:30%;">Attendance Status</th>
                        </tr>
                    </thead>
                    <tbody>${studentRows}</tbody>
                </table>`;
        }
    }

    const modal = document.getElementById('attendance-detail-modal');
    if (modal) {
        // Use fitTimeout to let current click event finish, preventing click overlay race condition
        setTimeout(() => {
            modal.style.display = 'flex';
        }, 50);
    }
}

function closeAttendanceDetailModal() {
    const modal = document.getElementById('attendance-detail-modal');
    if (modal) modal.style.display = 'none';
    _currentDetailSession = null;
}

function downloadAttendancePDF() {
    const session = _currentDetailSession;
    if (!session) return;

    if (typeof html2pdf === 'undefined') {
        showToast('PDF library not loaded yet.', 'error');
        return;
    }

    const attendanceArr = session.attendance || [];
    const date = new Date(session.scheduledDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const presentCount = attendanceArr.filter(a => a.status === 'present').length;
    const absentCount = attendanceArr.filter(a => a.status === 'absent').length;

    const rows = attendanceArr.map((a, i) => {
        const isPresent = a.status === 'present';
        const isLate = a.status === 'late';
        const statusLabel = isPresent ? 'Present' : isLate ? 'Late' : 'Absent';
        const statusColor = isPresent ? '#059669' : isLate ? '#d97706' : '#dc2626';
        return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};"><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#374151;">${i + 1}</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:500;">${escapeHtml(a.studentName || '—')}</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;">${escapeHtml(session.className || '—')}</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;color:${statusColor};">${statusLabel}</td></tr>`;
    }).join('');

    const printContent = `<div style="font-family:'Segoe UI',Arial,sans-serif;padding:30px;color:#0f172a;">
        <div style="border-bottom:2px solid #0A66FF;padding-bottom:16px;margin-bottom:20px;">
            <h1 style="margin:0;font-size:22px;color:#0A66FF;">Attendance Report</h1>
            <p style="margin:4px 0 0;font-size:12px;color:#64748b;">SmartSchool &nbsp;•&nbsp; Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div style="display:flex;gap:32px;margin-bottom:20px;">
            <div style="font-size:12px;"><strong style="color:#64748b;display:block;text-transform:uppercase;font-size:11px;">Subject:</strong><span style="font-weight:600;">${escapeHtml(session.subjectName || '—')}</span></div>
            <div style="font-size:12px;"><strong style="color:#64748b;display:block;text-transform:uppercase;font-size:11px;">Class:</strong><span style="font-weight:600;">${escapeHtml(session.className || '—')}</span></div>
            <div style="font-size:12px;"><strong style="color:#64748b;display:block;text-transform:uppercase;font-size:11px;">Date:</strong><span style="font-weight:600;">${date}</span></div>
            <div style="font-size:12px;"><strong style="color:#64748b;display:block;text-transform:uppercase;font-size:11px;">Time:</strong><span style="font-weight:600;">${session.startTime} – ${session.endTime}</span></div>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:24px;">
            <div style="background:#d1fae5;color:#059669;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;">✔ Present: ${presentCount}</div>
            <div style="background:#fee2e2;color:#dc2626;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;">✖ Absent: ${absentCount}</div>
            <div style="background:#f1f5f9;color:#475569;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;">Total: ${attendanceArr.length}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:#0A66FF;color:#fff;">
                <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;">#</th>
                <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;">Student Name</th>
                <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;">Class</th>
                <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;">Attendance Status</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table></div>`;

    const element = document.createElement('div');
    element.innerHTML = printContent;
    document.body.appendChild(element);

    const opt = {
        margin: [10, 10, 10, 10],
        filename: `Attendance_${session.subjectName || 'Report'}_${session.className || ''}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(element).set(opt).save().then(() => {
        document.body.removeChild(element);
    }).catch(err => {
        console.error('PDF Generation Error:', err);
        showToast('Failed to generate PDF', 'error');
        document.body.removeChild(element);
    });
}

function renderDashboard() {
    return `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon students">
                    <i class="fas fa-user-graduate"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Total Students</span>
                    <span class="stat-value" id="stat-students">0</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon classes">
                    <i class="fas fa-laptop"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Assigned Classes</span>
                    <span class="stat-value" id="stat-classes">0</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon subjects">
                    <i class="fas fa-book"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Assigned Subjects</span>
                    <span class="stat-value" id="stat-subjects">0</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon attendance">
                    <i class="fas fa-calendar-check"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Attendance Rate</span>
                    <span class="stat-value" id="stat-attendance">0%</span>
                </div>
            </div>
        </div>

        <div class="dashboard-main-grid">
            <!-- Today's Schedule -->
            <div class="schedule-section">
                <div class="content-card">
                    <div class="section-card-header">
                        <div class="header-left">
                            <i class="fas fa-calendar-alt"></i>
                            <h2>Today's Schedule</h2>
                        </div>
                        <a href="#" class="view-all-link" onclick="loadPage('weekly-schedule', 'Weekly Schedule')">View All</a>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table dashboard-table">
                            <thead>
                                <tr>
                                    <th>TIME</th>
                                    <th>CLASS</th>
                                    <th>SUBJECT</th>
                                    <th>STATUS</th>
                                </tr>
                            </thead>
                            <tbody id="today-schedule-body">
                                <tr>
                                    <td colspan="4" class="text-center">Loading schedule...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Recent Announcements -->
            <div class="announcements-section">
                <div class="content-card">
                    <div class="section-card-header">
                        <div class="header-left">
                            <i class="fas fa-bullhorn"></i>
                            <h2>Recent Announcements</h2>
                        </div>
                    </div>
                    <div class="announcements-list" id="recent-announcements-list">
                        <div class="loading-placeholder">Loading announcements...</div>
                    </div>
                    <div class="view-all-announcements">
                        <button class="btn-outline-blue" onclick="loadPage('view-announcements', 'View Announcements')">View All Announcements</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderProfile() {
    const profile = getTeacherProfileData();

    return `
        <div class="profile-container">
            <div class="profile-view-section">
                <div class="profile-card">
                    <div class="profile-avatar-large">
                        <i class="fas fa-user-tie"></i>
                    </div>
                    <h3 id="teacher-profile-name">${profile.name || 'Teacher Name'}</h3>
                    <p class="profile-role" id="teacher-profile-role">Teacher</p>
                    <div class="profile-email">
                        <i class="fas fa-envelope"></i>
                        <span id="teacher-profile-email">${profile.email || 'email@school.com'}</span>
                    </div>
                    <div class="profile-phone">
                        <i class="fas fa-phone"></i>
                        <span id="teacher-profile-mobile">${profile.phone || profile.mobileNumber || 'N/A'}</span>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="loadPage('edit-profile', 'Edit Profile')">
                            <i class="fas fa-edit"></i> Edit Profile
                        </button>
                        <button class="btn btn-secondary" type="button" onclick="openResetPasswordModal()">
                            <i class="fas fa-key"></i> Reset Password
                        </button>
                    </div>
                </div>
            </div>
            <div class="profile-edit-section">
                <div class="content-card">
                    <h3><i class="fas fa-info-circle"></i> Professional Information</h3>
                    <div class="detail-grid" style="margin-top: 20px;">
                        <div class="detail-item">
                            <span class="detail-label">Employee ID</span>
                            <span class="detail-value" id="teacher-profile-userid">${profile.employee_id || profile.userId || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Role</span>
                            <span class="detail-value" id="teacher-profile-role-value">${profile.role || 'teacher'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">City</span>
                            <span class="detail-value" id="teacher-profile-city">${profile.city || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">State</span>
                            <span class="detail-value" id="teacher-profile-state">${profile.state || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Country</span>
                            <span class="detail-value" id="teacher-profile-country">${profile.country || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Created At</span>
                            <span class="detail-value" id="teacher-profile-created">${profile.created_at || profile.createdAt ? new Date(profile.created_at || profile.createdAt).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Last Updated</span>
                            <span class="detail-value" id="teacher-profile-updated">${profile.updated_at || profile.updatedAt ? new Date(profile.updated_at || profile.updatedAt).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>
                </div> 
            </div>
        </div>
    `;
}

function renderEditProfile() {
    const profile = getTeacherProfileData();

    return `
        <div class="content-card">
            <div class="section-header">
                <i class="fas fa-user-edit"></i>
                <h2>Edit Profile Information</h2>
            </div>
            <form id="edit-profile-form" class="form-horizontal" style="max-width: 800px; margin-top: 20px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" id="teacher-edit-name" value="${profile.name || ''}" placeholder="Enter full name" required>
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" id="teacher-edit-email" value="${profile.email || ''}" readonly>
                        <small style="color: #999;">Email cannot be changed</small>
                    </div>
                    <div class="form-group">
                        <label>Phone Number</label>
                        <input type="text" id="teacher-edit-mobile" value="${profile.phone || profile.mobileNumber || ''}" placeholder="Enter phone number">
                    </div>
                    <div class="form-group">
                        <label>City</label>
                        <input type="text" id="teacher-edit-city" value="${profile.city || ''}" placeholder="Enter city">
                    </div>
                    <div class="form-group">
                        <label>State</label>
                        <input type="text" id="teacher-edit-state" value="${profile.state || ''}" placeholder="Enter state">
                    </div>
                    <div class="form-group">
                        <label>Country</label>
                        <input type="text" id="teacher-edit-country" value="${profile.country || ''}" placeholder="Enter country">
                    </div>
                </div>
                <div class="form-actions" style="justify-content: flex-end; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="loadPage('profile', 'My Profile')">Cancel</button>
                    <button type="submit" id="teacher-profile-save-btn" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        </div>
    `;
}

async function populateTeacherProfileView() {
    await fetchTeacherProfile();
    const profile = getTeacherProfileData();

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || 'N/A';
    };

    setText('teacher-profile-name', profile.name || 'Teacher Name');
    setText('teacher-profile-email', profile.email || 'N/A');
    setText('teacher-profile-mobile', profile.phone || profile.mobileNumber || 'N/A');
    setText('teacher-profile-userid', profile.employee_id || profile.userId || 'N/A');
    setText('teacher-profile-role-value', profile.role || 'teacher');
    setText('teacher-profile-city', profile.city || 'N/A');
    setText('teacher-profile-state', profile.state || 'N/A');
    setText('teacher-profile-country', profile.country || 'N/A');
    setText('teacher-profile-created', profile.created_at || profile.createdAt ? new Date(profile.created_at || profile.createdAt).toLocaleDateString() : 'N/A');
    setText('teacher-profile-updated', profile.updated_at || profile.updatedAt ? new Date(profile.updated_at || profile.updatedAt).toLocaleDateString() : 'N/A');
}

async function initializeEditProfileForm() {
    const profile = (await fetchTeacherProfile()) || getTeacherProfileData();

    const nameInput = document.getElementById('teacher-edit-name');
    const mobileInput = document.getElementById('teacher-edit-mobile');
    const cityInput = document.getElementById('teacher-edit-city');
    const stateInput = document.getElementById('teacher-edit-state');
    const countryInput = document.getElementById('teacher-edit-country');

    if (nameInput) nameInput.value = profile.name || '';
    if (mobileInput) mobileInput.value = profile.phone || profile.mobileNumber || '';
    if (cityInput) cityInput.value = profile.city || '';
    if (stateInput) stateInput.value = profile.state || '';
    if (countryInput) countryInput.value = profile.country || '';

    const form = document.getElementById('edit-profile-form');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();

        const saveBtn = document.getElementById('teacher-profile-save-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }

        try {
            const token = localStorage.getItem('token');
            const payload = {
                name: nameInput ? nameInput.value.trim() : '',
                mobileNumber: mobileInput ? mobileInput.value.trim() : '',
                city: cityInput ? cityInput.value.trim() : '',
                state: stateInput ? stateInput.value.trim() : '',
                country: countryInput ? countryInput.value.trim() : ''
            };

            const response = await fetch('/api/teachers/me', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to update profile');
            }

            AppState.teacherProfile = result.data;
            AppState.user = { ...AppState.user, ...result.data };

            showToast('Profile updated successfully', 'success');
            loadPage('profile', 'My Profile');
        } catch (error) {
            console.error('Teacher profile update failed:', error);
            showToast(error.message || 'Failed to update profile', 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
            }
        }
    };
}

function openResetPasswordModal() {
    const token = localStorage.getItem('token');
    if (!window.SmartSchoolResetPassword || !token) {
        showToast('Reset password module unavailable', 'error');
        return;
    }

    window.SmartSchoolResetPassword.open({
        token,
        toast: (message, type) => showToast(message, type === 'error' ? 'error' : 'success'),
        onSuccess: () => {
            setTimeout(() => {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }, 1000);
        }
    });
}

// ============================================
// ACADEMIC CALENDAR FUNCTIONS
// ============================================

function renderAcademicCalendarPage() {
    return `
        <div class="academic-setup-container">
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

async function initializeAcademicCalendar() {
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

        // Fetch holidays and events from the new teacher endpoints
        const [holidaysRes, eventsRes] = await Promise.all([
            fetch(`/api/teachers/holidays?academicYear=${academicYear}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`/api/teachers/events?academicYear=${academicYear}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        const holidaysResult = await holidaysRes.json();
        const eventsResult = await eventsRes.json();

        if (holidaysResult.success && eventsResult.success) {
            academicData = [...holidaysResult.data, ...eventsResult.data];
            renderAcademicCalendar();
            renderAcademicList('all');
        } else {
            const errorMsg = (!holidaysResult.success ? holidaysResult.message : eventsResult.message) || "Failed to load data";
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        console.error('Error loading academic data:', error);
        showToast("Error connecting to server", "error");
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

// ============================================
// OTHER PAGE RENDER FUNCTIONS
// ============================================

function renderAnnouncements() {
    return `
        <div class="notice-container">
            <!-- Left: Admin Notices -->
            <div class="notice-list-card">
                <h3><i class="fas fa-bullhorn"></i> Admin Notices</h3>
                <div id="admin-notice-list" class="notice-list">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading admin notices...</p>
                    </div>
                </div>
            </div>

            <!-- Right: My Class Announcements -->
            <div class="notice-list-card">
                <div class="section-header" style="justify-content: space-between; margin-bottom: 20px;">
                    <h3><i class="fas fa-plus-circle"></i> My Announcements</h3>
                    <button class="btn btn-primary btn-sm" onclick="loadPage('post-announcement', 'Post Announcement')">
                        <i class="fas fa-plus"></i> New Post
                    </button>
                </div>
                <div id="my-notice-list" class="notice-list">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading your announcements...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function fetchTeacherNotices() {
    const adminList = document.getElementById('admin-notice-list');
    const myList = document.getElementById('my-notice-list');
    const token = localStorage.getItem('token');

    try {
        // Fetch Admin Notices
        const adminRes = await fetch('/api/teachers/notices/admin', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const adminResult = await adminRes.json();

        if (adminResult.success) {
            if (adminResult.notices.length === 0) {
                adminList.innerHTML = Components.EmptyState('bullhorn', 'No Notices', 'No notices from admin yet.');
            } else {
                adminList.innerHTML = adminResult.notices.map(notice => `
                    <div class="notice-item">
                        <div class="notice-item-header">
                            <span class="notice-title">${notice.title}</span>
                            <span class="notice-type ${notice.type.toLowerCase()}">${notice.type}</span>
                        </div>
                        <div class="notice-item-body">
                            <p>${notice.content}</p>
                        </div>
                        <div class="notice-item-footer">
                            <span class="notice-status" style="color: #64748b;">
                                <i class="fas fa-calendar-alt"></i> ${new Date(notice.date).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Fetch My Announcements
        const myRes = await fetch('/api/teachers/notices/my', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const myResult = await myRes.json();

        if (myResult.success) {
            if (myResult.notices.length === 0) {
                myList.innerHTML = Components.EmptyState('paper-plane', 'No Posts', 'You haven\\\'t posted any announcements yet.');
            } else {
                myList.innerHTML = myResult.notices.map(notice => `
                    <div class="notice-item" style="border-left-color: #28a745;">
                        <div class="notice-item-header">
                            <span class="notice-title">${notice.title}</span>
                            <span class="notice-type ${notice.type.toLowerCase()}">${notice.type}</span>
                        </div>
                        <div class="notice-item-body">
                            <p><strong>Target Class:</strong> Class ${notice.targetClass}</p>
                            <p>${notice.content}</p>
                        </div>
                        <div class="notice-item-footer">
                            <span class="notice-status" style="color: #64748b;">
                                <i class="fas fa-calendar-alt"></i> ${new Date(notice.date).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error fetching notices:', error);
        if (adminList) adminList.innerHTML = Components.ErrorState('Failed to load admin notices');
        if (myList) myList.innerHTML = Components.ErrorState('Failed to load your announcements');
    }
}

function renderPostAnnouncement() {
    return `
        <div class="compact-form-container">
            <div class="compact-form-header">
                <div class="header-left">
                    <i class="fas fa-bullhorn"></i>
                    <h2>New Class Announcement</h2>
                </div>
            </div>

            <div class="content-card compact-card">
                <form id="post-announcement-form">
                    <!-- Row 1: Target Class and Category (Equal Width) -->
                    <div class="compact-form-row">
                        <div class="form-group flex-1">
                            <label>Target Class</label>
                            <select id="announce-target-class" required>
                                <option value="">Loading assigned classes...</option>
                            </select>
                        </div>
                        <div class="form-group flex-1">
                            <label>Category</label>
                            <select id="announce-type" required>
                                <option value="General">General</option>
                                <option value="Academic">Academic</option>
                                <option value="Event">Event</option>
                                <option value="Emergency">Emergency</option>
                            </select>
                        </div>
                    </div>

                    <!-- Row 2: Headline / Title -->
                    <div class="form-group">
                        <label>Headline / Title</label>
                        <input type="text" id="announce-title" placeholder="e.g., Tomorrow's Lab Session Cancelled" required>
                    </div>

                    <!-- Row 3: Message Content (Taller Textarea) -->
                    <div class="form-group">
                        <label>Message Content</label>
                        <textarea id="announce-content" placeholder="Write your detailed message here..." rows="6" required></textarea>
                    </div>

                    <!-- Footer: Right-aligned Submit Button -->
                    <div class="compact-form-footer">
                        <button type="submit" class="btn btn-primary" id="btn-submit-announcement">
                            <i class="fas fa-paper-plane"></i> Publish Announcement
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function renderCreateAssignment() {
    return `
        <div class="compact-form-container">
            <div class="compact-form-header">
                <div class="header-left">
                    <i class="fas fa-plus-square"></i>
                    <h2>Create Class Assignment</h2>
                </div>
                <button class="btn btn-light btn-sm" onclick="loadPage('view-submissions', 'View Submissions')">
                    <i class="fas fa-eye"></i> Submissions
                </button>
            </div>

            <div class="content-card compact-card">
                <form id="create-assignment-form" enctype="multipart/form-data">
                    <div class="compact-form-row">
                        <div class="form-group flex-1">
                            <label>Target Class</label>
                            <select id="assignment-target-class" required>
                                <option value="">Loading classes...</option>
                            </select>
                        </div>
                        <div class="form-group flex-1">
                            <label>Due Date</label>
                            <input type="date" id="assignment-due-date" required>
                        </div>
                    </div>

                    <div class="compact-form-row">
                        <div class="form-group flex-2">
                            <label>Assignment Title</label>
                            <input type="text" id="assignment-title" placeholder="e.g., Chapter 1 Exercise" required>
                        </div>
                        <div class="form-group flex-1">
                            <label>Total Marks</label>
                            <input type="number" id="assignment-marks" value="100" min="1" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Instructions (Optional)</label>
                        <textarea id="assignment-description" placeholder="Briefly describe the assignment tasks..." rows="3"></textarea>
                    </div>

                    <div class="form-group">
                        <label>Reference File (Optional)</label>
                        <div class="compact-file-input">
                            <input type="file" id="assignment-file" onchange="updateAssignmentFileName(this)">
                            <label for="assignment-file" id="assign-file-label">
                                <i class="fas fa-cloud-upload-alt"></i> 
                                <span>Click to attach PDF/DOC (Max 20MB)</span>
                            </label>
                        </div>
                    </div>

                    <div class="compact-form-footer">
                        <button type="submit" class="btn btn-primary" id="btn-submit-assignment">
                            <i class="fas fa-check-circle"></i> Create Assignment
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function updateAssignmentFileName(input) {
    const label = document.getElementById('assign-file-label').querySelector('span');
    label.textContent = input.files[0]?.name || 'Click to attach PDF/DOC (Max 20MB)';
}

async function initializePostAnnouncement() {
    const classSelect = document.getElementById('announce-target-class');
    const form = document.getElementById('post-announcement-form');
    const token = localStorage.getItem('token');

    if (!classSelect || !form) return;

    try {
        const response = await fetch('/api/teachers/assigned-classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            if (result.data.length === 0) {
                classSelect.innerHTML = '<option value="">No classes assigned</option>';
                document.getElementById('btn-submit-announcement').disabled = true;
            } else {
                classSelect.innerHTML = '<option value="">-- Choose Class --</option>' +
                    result.data.map(cls => `<option value="${cls._id}">${cls.name}</option>`).join('');
            }
        }
    } catch (error) {
        console.error('Error fetching classes:', error);
        classSelect.innerHTML = '<option value="">Error loading classes</option>';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('btn-submit-announcement');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

        const data = {
            targetClass: document.getElementById('announce-target-class').value,
            title: document.getElementById('announce-title').value,
            type: document.getElementById('announce-type').value,
            content: document.getElementById('announce-content').value
        };

        try {
            const res = await fetch('/api/teachers/notices/class', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            const result = await res.json();
            if (result.success) {
                showToast('Announcement posted successfully!', 'success');
                loadPage('view-announcements', 'View Announcements');
            } else {
                showToast(result.message || 'Failed to post announcement', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Announcement';
            }
        } catch (error) {
            console.error('Error posting announcement:', error);
            showToast('Connection error', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Announcement';
        }
    });
}

async function initializeCreateAssignment() {
    const classSelect = document.getElementById('assignment-target-class');
    const form = document.getElementById('create-assignment-form');
    const token = localStorage.getItem('token');

    if (!classSelect || !form) return;

    try {
        const response = await fetch('/api/teachers/assigned-classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            classSelect.innerHTML = '<option value="">-- Choose Class --</option>' +
                result.data.map(cls => `<option value="${cls._id}">${cls.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error fetching classes:', error);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('btn-submit-assignment');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        const formData = new FormData();
        formData.append('title', document.getElementById('assignment-title').value);
        formData.append('targetClass', document.getElementById('assignment-target-class').value);
        formData.append('dueDate', document.getElementById('assignment-due-date').value);
        formData.append('totalMarks', document.getElementById('assignment-marks').value);
        formData.append('description', document.getElementById('assignment-description').value);

        const fileInput = document.getElementById('assignment-file');
        if (fileInput.files[0]) {
            formData.append('file', fileInput.files[0]);
        }

        try {
            const res = await fetch('/api/teachers/assignments', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const result = await res.json();
            if (result.success) {
                showToast('Assignment created successfully!', 'success');
                loadPage('dashboard', 'Dashboard');
            } else {
                showToast(result.message || 'Failed to create assignment', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Create Assignment';
            }
        } catch (error) {
            console.error('Error creating assignment:', error);
            showToast('Connection error', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Create Assignment';
        }
    });
}

// ============================================
// DATA FETCHING FUNCTIONS
// ============================================

async function fetchDashboardData() {
    try {
        const token = localStorage.getItem('token');

        // Fetch stats
        const statsRes = await fetch('/api/teachers/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const statsResult = await statsRes.json();

        if (statsResult.success) {
            const stats = statsResult.data;
            safeSetText('stat-students', stats.totalStudents || 0);
            safeSetText('stat-classes', stats.totalClasses || 0);
            safeSetText('stat-subjects', stats.totalSubjects || 0);
            safeSetText('stat-attendance', (stats.todayAttendance || 0) + '%');
        }

        // Fetch Schedule for Today
        fetchTodaySchedule();

        // Fetch Recent Announcements
        fetchRecentAnnouncements();

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
    }
}

async function fetchTodaySchedule() {
    const container = document.getElementById('today-schedule-body');
    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/teachers/assigned-classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            const teacherMongoId = AppState.user.id;
            const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            const todaySessions = [];

            result.data.forEach(cls => {
                if (cls.timetable) {
                    cls.timetable.forEach(t => {
                        if (t.day.toLowerCase() === today && t.teacherId === teacherMongoId) {
                            todaySessions.push({
                                ...t,
                                className: cls.name
                            });
                        }
                    });
                }
            });

            if (todaySessions.length === 0) {
                container.innerHTML = '<tr><td colspan="4" class="text-center">No classes scheduled for today</td></tr>';
                return;
            }

            // Sort by time
            todaySessions.sort((a, b) => a.startTime.localeCompare(b.startTime));

            container.innerHTML = todaySessions.map(s => `
                <tr>
                    <td class="time-cell">${s.startTime} - ${s.endTime}</td>
                    <td><span class="class-pill">${s.className}</span></td>
                    <td>${s.subjectName}</td>
                    <td><span class="status-pill upcoming">UPCOMING</span></td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error fetching today schedule:', error);
        container.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load schedule</td></tr>';
    }
}

async function fetchRecentAnnouncements() {
    const container = document.getElementById('recent-announcements-list');
    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        // Fetch Admin Notices for now as "Announcements"
        const response = await fetch('/api/teachers/notices/admin', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            if (result.notices.length === 0) {
                container.innerHTML = '<div class="empty-placeholder">No recent announcements</div>';
                return;
            }

            // Show latest 1-2 announcements
            const latest = result.notices.slice(0, 2);

            container.innerHTML = latest.map(notice => `
                <div class="announcement-item">
                    <div class="announcement-content">
                        <div class="announcement-header">
                            <h3 class="announcement-title">${notice.title}</h3>
                            <span class="announcement-date">${new Date(notice.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        <p class="announcement-text">${notice.content.length > 100 ? notice.content.substring(0, 100) + '...' : notice.content}</p>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error fetching recent announcements:', error);
        container.innerHTML = '<div class="text-danger">Failed to load announcements</div>';
    }
}



function renderWeeklySchedule() {
    return `
        <div class="timetable-page-container">
            <!-- Section 1: My Personal Timetable -->
            <div class="content-card" style="margin-bottom: 30px;">
                <div class="section-header">
                    <i class="fas fa-user-clock"></i>
                    <h2>My Weekly Timetable</h2>
                </div>
                <p class="section-desc">Lectures assigned specifically to you across all your classes.</p>
                <div id="personal-timetable-container" class="timetable-grid-container">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading your personal schedule...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function fetchWeeklySchedule() {
    const personalContainer = document.getElementById('personal-timetable-container');

    if (!personalContainer) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/teachers/assigned-classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            const teacherMongoId = AppState.user.id;
            const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

            // 1. Process Personal Timetable
            const personalGrid = {};
            days.forEach(day => personalGrid[day] = []);

            result.data.forEach(cls => {
                if (cls.timetable) {
                    cls.timetable.forEach(t => {
                        const day = t.day.toLowerCase();
                        if (days.includes(day)) {
                            // Add to personal grid if this teacher is the lecturer
                            if (t.teacherId === teacherMongoId) {
                                personalGrid[day].push({
                                    ...t,
                                    className: cls.name,
                                    class: cls.class
                                });
                            }
                        }
                    });
                }
            });

            // Render Personal Timetable
            renderTimetableGridHTML(personalContainer, personalGrid, true);
        } else {
            personalContainer.innerHTML = Components.ErrorState(result.message);
        }
    } catch (error) {
        console.error('Error fetching weekly schedule:', error);
        personalContainer.innerHTML = Components.ErrorState('Failed to load weekly timetable');
    }
}

function renderTimetableGridHTML(container, grid, isPersonal = true) {
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    // Find unique time slots and sort them
    const allSlotsSet = new Set();
    days.forEach(day => {
        grid[day].forEach(t => {
            allSlotsSet.add(`${t.startTime} - ${t.endTime}`);
        });
    });

    const allSlots = Array.from(allSlotsSet).sort((a, b) => a.localeCompare(b));

    if (allSlots.length === 0) {
        container.innerHTML = Components.EmptyState('calendar-week', 'No Schedule Found',
            isPersonal ? 'You have no teaching periods assigned.' : 'No timetable data for this class.');
        return;
    }

    let html = `
        <div class="timetable-grid">
            <div class="grid-header-cell">Time</div>
            ${days.map(d => `<div class="grid-header-cell">${d}</div>`).join('')}
    `;

    allSlots.forEach(slot => {
        html += `<div class="grid-time-cell">${slot}</div>`;

        days.forEach(day => {
            const sessions = grid[day].filter(t => `${t.startTime} - ${t.endTime}` === slot);
            html += `<div class="grid-subject-cell">`;
            if (sessions.length > 0) {
                sessions.forEach(s => {
                    html += `
                        <div class="subject-item-box ${!isPersonal ? 'class-timetable' : ''}">
                            <span class="subject-name">${s.subjectName}</span>
                            <div class="subject-info">
                                ${isPersonal ?
                            `<span><i class="fas fa-school"></i> ${s.className}</span>` :
                            `<span><i class="fas fa-user-tie"></i> ${s.teacherName || 'TBA'}</span>`
                        }
                            </div>
                        </div>
                    `;
                });
            }
            html += `</div>`;
        });
    });

    html += `</div>`;
    container.innerHTML = html;
}


// ============================================
// DATA FETCHING FUNCTIONS (Old)
// ============================================

// ============================================
// HELPER FUNCTIONS
// ============================================

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

function showToast(message, type = 'success') {
    // Simple alert for now, can be replaced with a proper toast component
    alert(message);
}

// Add CSS for animations if not already present
if (!document.getElementById('teacher-animations-css')) {
    const style = document.createElement('style');
    style.id = 'teacher-animations-css';
    style.innerHTML = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

function renderClassDetails() {
    return `
        <div class="class-details-container">
            <div id="class-details-header" class="class-details-header">
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading class details...</p>
                </div>
            </div>

            <div class="class-details-grid">
                <!-- Timetable Section -->
                <div class="content-card">
                    <div class="section-header">
                        <i class="fas fa-calendar-alt"></i>
                        <h2>Weekly Timetable</h2>
                    </div>
                    <div id="timetable-grid" class="timetable-grid-container">
                        <!-- Timetable will be rendered here -->
                    </div>
                </div>

                <!-- Students Section -->
                <div class="content-card">
                    <div class="section-header">
                        <i class="fas fa-users"></i>
                        <h2>Student List</h2>
                        <div class="header-actions">
                            <div class="search-group" style="margin: 0;">
                                <i class="fas fa-search"></i>
                                <input type="text" id="student-search" placeholder="Search students..." onkeyup="filterStudents(this.value)">
                            </div>
                        </div>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Roll No</th>
                                    <th>Student</th>
                                    <th>Email</th>
                                    <th>Contact</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody id="students-table-body">
                                <!-- Students will be rendered here -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function loadClassDetails(classId) {
    AppState.activeClassId = classId;
    loadPage('class-details', 'Class Details');
}

async function fetchClassDetails() {
    const classId = AppState.activeClassId;
    if (!classId) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/teachers/assigned-classes/${classId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            const cls = result.data;

            // Render Header
            const header = document.getElementById('class-details-header');
            if (header) {
                header.innerHTML = `
                    <div class="class-info-main">
                        <h1>${cls.name} <span class="class-badge">Class ${cls.class}</span></h1>
                        <p style="color: #64748b; margin-top: 5px;">${cls.isClassTeacher ? '<i class="fas fa-certificate" style="color: #ffd700;"></i> You are the Class Teacher' : 'Subject Teacher'}</p>
                    </div>
                    <div class="class-header-actions">
                        <button class="btn btn-secondary" onclick="loadPage('assigned-classes', 'Assigned Classes')">
                            <i class="fas fa-arrow-left"></i> Back to Classes
                        </button>
                    </div>
                `;
            }

            // Render Timetable
            renderTimetableGrid(cls.timetableGrid);

            // Render Students
            renderStudentsTable(cls.students);

            // Store students for filtering
            window.currentClassStudents = cls.students;

        } else {
            showToast(result.message, 'error');
        }
    } catch (error) {
        console.error('Error fetching class details:', error);
        showToast('Failed to load class details', 'error');
    }
}

function renderTimetableGrid(grid) {
    const container = document.getElementById('timetable-grid');
    if (!container) return;

    if (!grid || Object.keys(grid).length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No timetable available for this class.</p>';
        return;
    }

    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    // Find unique time slots
    const allSlots = [];
    days.forEach(day => {
        grid[day].forEach(t => {
            const slot = `${t.startTime} - ${t.endTime}`;
            if (!allSlots.includes(slot)) allSlots.push(slot);
        });
    });
    allSlots.sort();

    if (allSlots.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: #999; border: 1px dashed #ccc;">No sessions scheduled.</p>';
        return;
    }

    let html = `
        <div class="timetable-grid">
            <div class="grid-header-cell">Time</div>
            ${days.map(d => `<div class="grid-header-cell">${d}</div>`).join('')}
    `;

    allSlots.forEach(slot => {
        html += `<div class="grid-time-cell">${slot}</div>`;

        days.forEach(day => {
            const sessions = grid[day].filter(t => `${t.startTime} - ${t.endTime}` === slot);
            html += `<div class="grid-subject-cell">`;
            if (sessions.length > 0) {
                sessions.forEach(s => {
                    html += `
                        <div class="subject-item-box">
                            <span class="subject-name">${s.subjectName}</span>
                            <span class="subject-time">${s.subjectCode || ''}</span>
                        </div>
                    `;
                });
            }
            html += `</div>`;
        });
    });

    html += `</div>`;
    container.innerHTML = html;
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('students-table-body');
    if (!tbody) return;

    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #999;">No students enrolled in this class.</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(s => `
        <tr>
            <td><strong>#${s.rollNo || 'N/A'}</strong></td>
            <td>
                <div class="student-profile-mini">
                    <img src="${s.profileImage || '/images/default-avatar.png'}" class="student-img-mini">
                    <div class="student-info-mini">
                        <span class="student-name-mini">${s.name}</span>
                        <span class="student-id-mini">${s.userId}</span>
                    </div>
                </div>
            </td>
            <td>${s.email}</td>
            <td>${s.mobileNumber || 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="loadPage('student-profile', 'Student Profile', '${s.userId}')">
                    <i class="fas fa-id-card"></i> Profile
                </button>
            </td>
        </tr>
    `).join('');
}

function filterStudents(query) {
    const students = window.currentClassStudents || [];
    const filtered = students.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.userId.toLowerCase().includes(query.toLowerCase()) ||
        (s.rollNo && s.rollNo.toString().includes(query))
    );
    renderStudentsTable(filtered);
}
// Placeholder functions for missing modules to prevent errors
function renderUploadPaper() { return Components.EmptyState('upload', 'Upload Question Paper', 'This module allows you to upload examination papers.'); }
function renderEnterMarks() { return Components.EmptyState('edit', 'Enter Marks', 'This module allows you to enter student marks.'); }
function renderViewResults() { return Components.EmptyState('chart-bar', 'View Results', 'View examination results for your classes.'); }
function renderSubmitResults() { return Components.EmptyState('paper-plane', 'Submit Results', 'Submit finalized results to the administrator.'); }
function renderViewAttendance() { return Components.EmptyState('clipboard-list', 'View Attendance', 'View attendance history for your students.'); }
function renderEditAttendance() { return Components.EmptyState('user-edit', 'Edit Attendance', 'Modify previously marked attendance.'); }
function renderSubmitAttendance() { return Components.EmptyState('check-double', 'Submit Attendance', 'Mark and submit today\\\'s attendance.'); }

function renderAssignedClasses() {
    return `
        <div class="assigned-classes-master-detail">
            <!-- Sidebar: Class List -->
            <div class="classes-sidebar">
                <div class="sidebar-header">
                    <div class="sidebar-title-wrapper">
                        <i class="fas fa-school"></i>
                        <h2>My Assigned Classes</h2>
                    </div>
                </div>
                <div id="classes-list-container" class="classes-list">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading classes...</p>
                    </div>
                </div>
            </div>

            <!-- Main: Class Details -->
            <div id="class-detail-main" class="class-detail-view">
                <div class="empty-detail-state">
                    <i class="fas fa-arrow-left"></i>
                    <h3>Select a Class</h3>
                    <p>Choose a class from the list to view its full timetable and student roster.</p>
                </div>
            </div>
        </div>
    `;
}

async function fetchAssignedClasses() {
    const listContainer = document.getElementById('classes-list-container');
    if (!listContainer) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/teachers/assigned-classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            if (result.data.length === 0) {
                listContainer.innerHTML = Components.EmptyState('school', 'No Classes', 'You have no assigned classes.');
                return;
            }

            // Store classes globally for reference
            window.allAssignedClasses = result.data;

            listContainer.innerHTML = result.data.map((cls, index) => `
                <div class="class-item-card" onclick="showClassInDetail('${cls._id}', this)">
                    <div class="class-item-info">
                        <h4>${cls.name}</h4>
                    </div>
                    <span class="class-item-badge ${cls.isClassTeacher ? 'class-teacher' : ''}">
                        ${cls.isClassTeacher ? 'Class Teacher' : 'Subject'}
                    </span>
                </div>
            `).join('');

            // Automatically show the first class
            const firstCard = listContainer.querySelector('.class-item-card');
            if (firstCard) firstCard.click();

        } else {
            listContainer.innerHTML = Components.ErrorState(result.message);
        }
    } catch (error) {
        console.error('Error fetching assigned classes:', error);
        listContainer.innerHTML = Components.ErrorState('Failed to connect to server');
    }
}

function showClassInDetail(classId, element) {
    // Update active state in sidebar
    document.querySelectorAll('.class-item-card').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    const cls = window.allAssignedClasses.find(c => c._id === classId);
    const detailView = document.getElementById('class-detail-main');
    if (!cls || !detailView) return;

    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    // Find unique time slots
    const slotsMap = new Set();
    cls.timetable.forEach(t => slotsMap.add(`${t.startTime} - ${t.endTime}`));
    const sortedSlots = Array.from(slotsMap).sort();

    detailView.innerHTML = `
        <div class="detail-content-wrapper">
            <div class="detail-header">
                <div class="detail-title-area">
                    <h1>${cls.name}</h1>
                    <div class="detail-subtitle">
                        <span class="detail-badge ${cls.isClassTeacher ? 'success' : 'primary'}">
                            <i class="fas ${cls.isClassTeacher ? 'fa-certificate' : 'fa-book-reader'}"></i> 
                            ${cls.isClassTeacher ? 'Class Teacher' : 'Subject Teacher'}
                        </span>
                        <span><i class="fas fa-users"></i> ${cls.studentCount || cls.students.length} Students</span>
                    </div>
                </div>
            </div>

            <div id="tab-timetable" class="detail-tab-content">
                <div class="detail-section-card" style="max-height: 600px; display: flex; flex-direction: column; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #fff;">
                    <div class="detail-section-header" style="padding: 15px 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-calendar-alt" style="color: #0A66FF;"></i>
                        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">Class Weekly Timetable</h3>
                    </div>
                    <div class="detail-section-body" style="padding: 0; overflow: auto; flex: 1;">
                        ${sortedSlots.length > 0 ? `
                            <table class="timetable-premium" style="width: 100%; table-layout: fixed; min-width: 700px; border-collapse: collapse;">
                                <thead style="position: sticky; top: 0; z-index: 10; background: #f1f5f9;">
                                    <tr>
                                        <th style="width: 100px; padding: 12px; font-size: 0.8rem; text-align: left; color: #64748b; font-weight: 600;">Time</th>
                                        ${days.map(d => `<th style="width: calc((100% - 100px) / 6); padding: 12px; font-size: 0.8rem; text-align: left; color: #64748b; font-weight: 600; text-transform: capitalize;">${d}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sortedSlots.map(slot => `
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td class="time-col" style="font-size: 0.75rem; padding: 12px; vertical-align: top; font-weight: 600; color: #0A66FF; background: #f8fafc;">${slot}</td>
                                            ${days.map(day => {
        const sessions = (cls.timetable || []).filter(t => t.day.toLowerCase() === day && `${t.startTime} - ${t.endTime}` === slot);
        return `
                                                    <td style="padding: 6px; vertical-align: top;">
                                                        ${sessions.map(s => `
                                                            <div class="slot-entry" style="padding: 8px; margin-bottom: 4px; font-size: 0.75rem; border-radius: 8px; background: #e0f2fe; border-left: 3px solid #0A66FF; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                                <div style="font-weight: 600; color: #0369a1; margin-bottom: 2px;">${s.subjectName}</div>
                                                                <div style="color: #64748b; font-size: 0.7rem;"><i class="fas fa-user-tie" style="font-size: 9px;"></i> ${s.teacherName || 'TBA'}</div>
                                                            </div>
                                                        `).join('')}
                                                    </td>
                                                `;
    }).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : `<div style="text-align:center; padding: 60px 40px; color: #94a3b8;">
                                <i class="fas fa-calendar-times" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
                                <p>No timetable data available for this class.</p>
                             </div>`}
                    </div>
                </div>
            </div>
        </div>
    `;
}


function switchDetailTab(btn, tabId, classId = null) {
    // Update active button
    const parent = btn.parentElement;
    parent.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.color = '#64748b';
        b.style.borderBottom = 'none';
    });
    btn.classList.add('active');
    btn.style.color = '#0A66FF';
    btn.style.borderBottom = '2px solid #0A66FF';

    // Update active content
    document.querySelectorAll('.detail-tab-content').forEach(c => c.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';

    if (tabId === 'tab-students' && classId) {
        fetchClassStudents(classId);
    }
}

async function fetchClassStudents(classId) {
    const tbody = document.getElementById('class-students-tbody');
    if (!tbody) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/teachers/assigned-classes/${classId}/students`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            if (result.data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="padding: 40px; text-align: center; color: #64748b;"><i class="fas fa-users" style="font-size: 48px; margin-bottom: 16px; display: block;"></i>No students officially enrolled in this class.</td></tr>`;
                return;
            }

            tbody.innerHTML = result.data.map((s, index) => `
                <tr style="border-bottom: 1px solid #e2e8f0; ${index % 2 === 0 ? 'background: #fff;' : 'background: #f8fafc;'}">
                    <td style="padding: 12px;">${s.rollNo || 'N/A'}</td>
                    <td style="padding: 12px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="${s.profileImage || '/images/default-avatar.png'}" alt="${s.name}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                            <div>
                                <div style="font-weight: 500;">${s.name}</div>
                                <div style="font-size: 11px; color: #64748b;">${s.userId}</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 12px; text-transform: capitalize;">${s.gender || 'N/A'}</td>
                    <td style="padding: 12px;">${s.parentName || 'N/A'}</td>
                    <td style="padding: 12px; text-align: center;">
                        <button class="btn btn-sm btn-outline-primary" onclick="viewStudentProfile('${s.userId}')">
                            <i class="fas fa-user"></i> View Profile
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 40px; text-align: center; color: #dc3545;"><i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>${result.message || 'Failed to load students'}</td></tr>`;
        }
    } catch (error) {
        console.error('Error fetching class students:', error);
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 40px; text-align: center; color: #dc3545;"><i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>Failed to load students list</td></tr>`;
    }
}

function switchClassTab(btn, tabId) {
    const card = btn.closest('.class-card');

    // Toggle buttons
    card.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Toggle content
    card.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    card.querySelector(`#${tabId}`).style.display = 'block';
}
function renderStudentsList() {
    return `
        <div class="students-list-container">
            <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <i class="fas fa-users" style="font-size: 24px; color: #0A66FF;"></i>
                    <h2 style="margin: 0; font-size: 22px; font-weight: 700;">Assigned Students List</h2>
                </div>
                <div class="header-actions" style="display: flex; gap: 15px; align-items: center;">
                    <div class="search-group" style="margin: 0; position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 14px;"></i>
                        <input type="text" id="students-search" placeholder="Search students..." onkeyup="filterStudentsTable(this.value)" style="padding: 10px 15px 10px 35px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px; width: 300px; outline: none; transition: all 0.2s;">
                    </div>
                </div>
            </div>

            <div id="students-table-container" class="students-table-wrapper" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);">
                <div class="loading-state" style="text-align: center; padding: 60px;">
                    <div class="loading-spinner" style="width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #0A66FF; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                    <p style="color: #64748b;">Loading students roster...</p>
                </div>
            </div>
        </div>
    `;
}


async function fetchStudents() {
    const container = document.getElementById('students-table-container');
    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/teachers/students', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            window.allAssignedStudents = result.data;

            if (result.data.length === 0) {
                container.innerHTML = Components.EmptyState('users', 'No Students', 'No students found in your assigned classes.');
                return;
            }

            renderStudentsTable(result.data);
        } else {
            container.innerHTML = Components.ErrorState(result.message);
        }
    } catch (error) {
        console.error('Error fetching students:', error);
        container.innerHTML = Components.ErrorState('Failed to load students list');
    }
}



function renderStudentsTable(students) {
    const container = document.getElementById('students-table-container');
    if (!container) return;

    if (students.length === 0) {
        container.innerHTML = Components.EmptyState('users', 'No Students Found', 'No students match your search criteria.');
        return;
    }

    const tableHTML = `
        <table class="students-data-table">
            <thead>
                <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>Class</th>
                    <th>Gender</th>
                    <th>Parent</th>
                    <th>Contact</th>
                    <th style="text-align: center;">Action</th>
                </tr>
            </thead>
            <tbody>
                ${students.map((s, index) => `
                    <tr>
                        <td style="font-weight: 600; color: #0A66FF;">#${s.rollNo || '-'}</td>
                        <td>
                            <div class="student-info-cell">
                                <img src="${s.profileImage || '/images/default-avatar.png'}" alt="${s.name}" class="student-img-circle">
                                <div>
                                    <span class="student-name-main">${s.name}</span>
                                    <span class="student-id-sub">${s.userId}</span>
                                </div>
                            </div>
                        </td>
                        <td><span class="class-pill">Class ${s.class || '-'}</span></td>
                        <td style="text-transform: capitalize;">${s.gender || '-'}</td>
                        <td>${s.parentName || '-'}</td>
                        <td>${s.parentPhone || s.mobileNumber || '-'}</td>
                        <td style="text-align: center;">
                            <button class="btn-view-profile" onclick="viewStudentProfile('${s.userId}')">
                                <i class="fas fa-user"></i> View Profile
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div style="padding: 15px 20px; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9; background: #f8fafc;">
            Showing <strong>${students.length}</strong> student${students.length !== 1 ? 's' : ''} roster
        </div>
    `;

    container.innerHTML = tableHTML;
}

function filterStudentsTable(query) {
    if (!window.allAssignedStudents) return;
    const searchTerm = query.toLowerCase().trim();
    const filtered = window.allAssignedStudents.filter(s =>
        s.name.toLowerCase().includes(searchTerm) ||
        s.userId.toLowerCase().includes(searchTerm) ||
        (s.rollNo && s.rollNo.toString().includes(searchTerm)) ||
        (s.class && s.class.toLowerCase().includes(searchTerm)) ||
        (s.parentName && s.parentName.toLowerCase().includes(searchTerm))
    );
    renderStudentsTable(filtered);
}
// View Student Profile - Opens modal with student details
async function viewStudentProfile(studentId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/teachers/students/${studentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            showStudentProfileModal(result.data);
        } else {
            alert('Error: ' + (result.message || 'Failed to load student profile'));
        }
    } catch (error) {
        console.error('Error fetching student profile:', error);
        alert('Error loading student profile');
    }
}

// Show Student Profile Modal
function showStudentProfileModal(student) {
    // Format dates
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const modalHTML = `
        <div id="student-profile-modal" class="modal" style="display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;">
            <div class="modal-content" style="background: white; border-radius: 12px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
                <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px 12px 0 0;">
                    <h2 style="margin: 0; font-size: 1.25rem;"><i class="fas fa-user-graduate"></i> Student Profile</h2>
                    <button onclick="closeStudentProfileModal()" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body" style="padding: 24px;">
                    <div style="display: flex; gap: 20px; margin-bottom: 24px;">
                        <img src="${student.profileImage || '/images/default-avatar.png'}" alt="${student.name}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #e2e8f0;">
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 8px 0; font-size: 1.5rem; color: #1e293b;">${student.name}</h3>
                            <p style="margin: 0 0 4px 0; color: #64748b;"><i class="fas fa-id-card"></i> ${student.userId}</p>
                            <p style="margin: 0 0 4px 0; color: #64748b;"><i class="fas fa-graduation-cap"></i> Class ${student.class}</p>
                            <span style="display: inline-block; padding: 4px 12px; background: #dbeafe; color: #1e40af; border-radius: 20px; font-size: 0.875rem; font-weight: 500;">Roll No: ${student.rollNo || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="background: #f8fafc; padding: 16px; border-radius: 8px;">
                            <h4 style="margin: 0 0 12px 0; font-size: 0.875rem; color: #64748b; text-transform: uppercase;"><i class="fas fa-info-circle"></i> Personal Info</h4>
                            <div style="margin-bottom: 8px;"><span style="color: #64748b;">Gender:</span> <strong style="color: #1e293b; text-transform: capitalize;">${student.gender || 'N/A'}</strong></div>
                            <div style="margin-bottom: 8px;"><span style="color: #64748b;">Date of Birth:</span> <strong style="color: #1e293b;">${formatDate(student.dob)}</strong></div>
                        </div>
                        
                        <div style="background: #f8fafc; padding: 16px; border-radius: 8px;">
                            <h4 style="margin: 0 0 12px 0; font-size: 0.875rem; color: #64748b; text-transform: uppercase;"><i class="fas fa-user-friends"></i> Parent Info</h4>
                            <div style="margin-bottom: 8px;"><span style="color: #64748b;">Name:</span> <strong style="color: #1e293b;">${student.parentName || 'N/A'}</strong></div>
                            <div style="margin-bottom: 8px;"><span style="color: #64748b;">Relation:</span> <strong style="color: #1e293b; text-transform: capitalize;">${student.parentRelationship || 'N/A'}</strong></div>
                            <div><span style="color: #64748b;">Contact:</span> <strong style="color: #1e293b;">${student.parentPhone || student.mobileNumber || 'N/A'}</strong></div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 16px; background: #f8fafc; padding: 16px; border-radius: 8px;">
                        <h4 style="margin: 0 0 12px 0; font-size: 0.875rem; color: #64748b; text-transform: uppercase;"><i class="fas fa-map-marker-alt"></i> Contact Info</h4>
                        <div style="margin-bottom: 8px;"><span style="color: #64748b;">Email:</span> <strong style="color: #1e293b;">${student.email}</strong></div>
                        <div style="margin-bottom: 8px;"><span style="color: #64748b;">Phone:</span> <strong style="color: #1e293b;">${student.mobileNumber || 'N/A'}</strong></div>
                        <div style="margin-bottom: 8px;"><span style="color: #64748b;">Address:</span> <strong style="color: #1e293b;">${student.address || `${student.city || ''}, ${student.state || ''}, ${student.country || ''}`.replace(/^,\s*|,\s*$/g, '') || 'N/A'}</strong></div>
                        <div><span style="color: #64748b;">Admission Date:</span> <strong style="color: #1e293b;">${formatDate(student.admissionDate || student.createdAt)}</strong></div>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px;">
                    <button onclick="closeStudentProfileModal()" style="padding: 8px 16px; background: #e2e8f0; color: #475569; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Close</button>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('student-profile-modal');
    if (existingModal) existingModal.remove();

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Close Student Profile Modal
function closeStudentProfileModal() {
    const modal = document.getElementById('student-profile-modal');
    if (modal) modal.remove();
}


function renderUploadPDF() {
    return `
        <div class="modern-card">
            <form id="upload-material-form" enctype="multipart/form-data">
                <div class="form-section">
                    <h3 class="form-section-title"><i class="fas fa-info-circle"></i> Material Details</h3>
                    <div class="form-row three-col">
                        <div class="form-group-modern">
                            <label>Target Class <span class="required">*</span></label>
                            <select id="material-target-class" required class="form-control-modern">
                                <option value="">-- Choose Class --</option>
                            </select>
                        </div>
                        <div class="form-group-modern">
                            <label>Material Type <span class="required">*</span></label>
                            <select id="material-type" required class="form-control-modern">
                                <option value="PDF">PDF Document</option>
                                <option value="Video">Video Lecture</option>
                                <option value="Document">Other Document</option>
                            </select>
                        </div>
                        <div class="form-group-modern">
                            <label>Material Title <span class="required">*</span></label>
                            <input type="text" id="material-title" placeholder="e.g., Chapter 1 Algebra Notes" required class="form-control-modern">
                        </div>
                    </div>
                    <div class="form-group-modern">
                        <label>Description <span class="optional" style="color: #94a3b8; font-weight: 400;">(Optional)</span></label>
                        <textarea id="material-description" placeholder="Provide a brief overview of what this material contains..." rows="3" class="form-control-modern"></textarea>
                    </div>
                </div>

                <div class="form-section">
                    <h3 class="form-section-title" style="margin-top: 25px;"><i class="fas fa-paperclip"></i> Attachment</h3>
                    <div class="upload-drag-zone" onclick="document.getElementById('material-file').click()">
                        <input type="file" id="material-file" onchange="updateFileName(this)" style="display: none;">
                        <div class="upload-icon-pulse">
                            <i class="fas fa-cloud-upload-alt"></i>
                        </div>
                        <h4>Drop your files here or <span class="text-primary" style="color: #0A66FF;">browse</span></h4>
                        <p id="material-file-label">Supports PDF, MP4, and Word documents (Max 100MB)</p>
                    </div>
                </div>

                <div class="form-actions-modern">
                    <button type="button" class="btn-modern btn-cancel" onclick="loadPage('view-materials', 'Manage Materials')">
                        Cancel
                    </button>
                    <button type="submit" id="btn-submit-material" class="btn-modern btn-primary">
                        <i class="fas fa-cloud-upload-alt"></i> Confirm and Upload
                    </button>
                </div>
            </form>
        </div>
    `;
}


function updateFileName(input) {
    const label = document.getElementById('material-file-label');
    if (label) {
        if (input.files && input.files.length > 0) {
            const fileName = input.files[0].name;
            const fileSize = (input.files[0].size / (1024 * 1024)).toFixed(2);
            label.innerHTML = `<span style="color: #0A66FF; font-weight: 600;"><i class="fas fa-file-alt"></i> ${fileName}</span> (${fileSize} MB)`;
            const zone = document.querySelector('.upload-drag-zone');
            if (zone) {
                zone.classList.add('has-file');
            }
        } else {
            label.textContent = 'Supports PDF, MP4, and Word documents (Max 100MB)';
            const zone = document.querySelector('.upload-drag-zone');
            if (zone) {
                zone.classList.remove('has-file');
            }
        }
    }
}

async function initializeUploadMaterial() {
    const classSelect = document.getElementById('material-target-class');
    const form = document.getElementById('upload-material-form');
    const token = localStorage.getItem('token');

    if (!classSelect || !form) return;

    try {
        const response = await fetch('/api/teachers/assigned-classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            classSelect.innerHTML = '<option value="">-- Choose Class --</option>' +
                result.data.map(cls => `<option value="${cls.class}">${cls.name} (Class ${cls.class})</option>`).join('');
        }
    } catch (error) {
        console.error('Error fetching classes:', error);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('btn-submit-material');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

        const formData = new FormData();
        formData.append('title', document.getElementById('material-title').value);
        formData.append('type', document.getElementById('material-type').value);
        formData.append('targetClass', document.getElementById('material-target-class').value);
        formData.append('description', document.getElementById('material-description').value);
        formData.append('file', document.getElementById('material-file').files[0]);

        try {
            const res = await fetch('/api/teachers/materials', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const result = await res.json();
            if (result.success) {
                showToast('Material uploaded successfully!', 'success');
                loadPage('dashboard', 'Dashboard');
            } else {
                showToast(result.message || 'Failed to upload material', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Material';
            }
        } catch (error) {
            console.error('Error uploading material:', error);
            showToast('Connection error', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Material';
        }
    });
}

window.allMaterialsData = [];

function renderMaterials() {
    return `
        <div class="page-header-new" style="justify-content: flex-end; margin-bottom: 20px;">
            <div class="header-actions">
                <button class="btn-modern btn-primary" onclick="loadPage('upload-pdf', 'Upload Material')">
                    <i class="fas fa-plus"></i> Upload New
                </button>
            </div>
        </div>

        <div class="modern-card">
            <div class="materials-filter-bar">
                <div class="search-modern">
                    <i class="fas fa-search"></i>
                    <input type="text" id="materials-search" placeholder="Search materials..." onkeyup="filterMaterials()">
                </div>
                <select id="materials-class-filter" class="form-control-modern" style="width: 200px;" onchange="filterMaterials()">
                    <option value="all">All Classes</option>
                </select>
                <select id="materials-type-filter" class="form-control-modern" style="width: 200px;" onchange="filterMaterials()">
                    <option value="all">All Types</option>
                    <option value="PDF">PDF Document</option>
                    <option value="Video">Video Lecture</option>
                    <option value="Document">Other Document</option>
                </select>
            </div>

            <div class="table-container">
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th>Title & Type</th>
                            <th>Class</th>
                            <th>Description</th>
                            <th>Date</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="materials-table-body">
                        <tr>
                            <td colspan="5" class="loading-cell">
                                <div class="loading-spinner"></div>
                                <p>Loading materials...</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function fetchMaterials() {
    const tbody = document.getElementById('materials-table-body');
    const token = localStorage.getItem('token');

    if (!tbody) return;

    try {
        const res = await fetch('/api/teachers/materials', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();

        if (result.success) {
            window.allMaterialsData = result.materials || [];
            populateMaterialsClassFilter();
            renderMaterialsTable(window.allMaterialsData);
        } else {
            tbody.innerHTML = `<tr><td colspan="5" class="error-cell">Failed to load materials</td></tr>`;
        }
    } catch (error) {
        console.error('Error fetching materials:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="error-cell">Failed to load materials</td></tr>`;
    }
}

function populateMaterialsClassFilter() {
    const select = document.getElementById('materials-class-filter');
    if (!select || !window.allMaterialsData.length) return;

    const uniqueClasses = [...new Set(window.allMaterialsData.map(m => m.targetClass))];
    select.innerHTML = '<option value="all">All Classes</option>' +
        uniqueClasses.map(c => `<option value="${c}">Class ${c}</option>`).join('');
}

function filterMaterials() {
    const searchVal = document.getElementById('materials-search')?.value.toLowerCase() || '';
    const classVal = document.getElementById('materials-class-filter')?.value || 'all';
    const typeVal = document.getElementById('materials-type-filter')?.value || 'all';

    const filtered = window.allMaterialsData.filter(m => {
        const matchSearch = m.title.toLowerCase().includes(searchVal) ||
            (m.description || '').toLowerCase().includes(searchVal);
        const matchClass = classVal === 'all' || m.targetClass.toString() === classVal.toString();
        const matchType = typeVal === 'all' || m.type === typeVal;
        return matchSearch && matchClass && matchType;
    });

    renderMaterialsTable(filtered);
}

function renderMaterialsTable(materials) {
    const tbody = document.getElementById('materials-table-body');
    if (!tbody) return;

    if (materials.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: #64748b;">No materials found.</td></tr>`;
        return;
    }

    const escapeHtmlFn = window.escapeHtml || function (text) {
        // Fallback simple escaper if escapeHtml isn't available
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    tbody.innerHTML = materials.map(m => {
        let icon = 'file-pdf';
        let badgeClass = 'danger';
        if (m.type === 'Video') { icon = 'video'; badgeClass = 'primary'; }
        if (m.type === 'Document') { icon = 'file-word'; badgeClass = 'info'; }

        // Format Date
        const date = new Date(m.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

        return `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div class="material-icon-small ${badgeClass}" style="width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: ${badgeClass === 'danger' ? '#fee2e2' : badgeClass === 'primary' ? '#eff6ff' : '#e0f2fe'}; color: ${badgeClass === 'danger' ? '#ef4444' : badgeClass === 'primary' ? '#3b82f6' : '#0ea5e9'};">
                            <i class="fas fa-${icon}" style="font-size: 20px;"></i>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: #1e293b; font-size: 15px; margin-bottom: 2px;">${escapeHtmlFn(m.title)}</div>
                            <span class="status-badge ${badgeClass}" style="font-size: 11px; padding: 2px 8px; border-radius: 4px;">${m.type}</span>
                        </div>
                    </div>
                </td>
                <td><span class="class-pill">Class ${m.targetClass}</span></td>
                <td><span class="truncate-text" style="max-width: 250px; display: inline-block;">${escapeHtmlFn(m.description || 'No description')}</span></td>
                <td style="color: #64748b; font-size: 14px;">${date}</td>
                <td style="text-align: right;">
                    <div class="action-buttons-flex" style="justify-content: flex-end;">
                        <a href="${m.fileUrl}" target="_blank" class="btn-icon view" title="View">
                            <i class="fas fa-eye"></i>
                        </a>
                        <button class="btn-icon delete" onclick="deleteMaterial('${m._id}')" title="Delete">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function deleteMaterial(id) {
    if (!confirm('Are you sure you want to delete this material?')) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/teachers/materials/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await res.json();
        if (result.success) {
            showToast('Material deleted successfully', 'success');
            fetchMaterials();
        } else {
            showToast(result.message, 'error');
        }
    } catch (error) {
        console.error('Error deleting material:', error);
        showToast('Connection error', 'error');
    }
}
function renderUploadVideo() { return Components.EmptyState('video', 'Upload Video Lectures', 'Share recorded lectures or video resources.'); }
function renderUpdateMaterial() { return Components.EmptyState('sync-alt', 'Update Study Material', 'Manage and update existing study materials.'); }
function renderDeleteMaterial() { return Components.EmptyState('trash-alt', 'Delete Material', 'Remove study materials from the system.'); }
function renderCreateLiveSession() { return Components.EmptyState('video', 'Create Live Session', 'Schedule and set up virtual classrooms.'); }
function renderJoinSession() { return Components.EmptyState('sign-in-alt', 'Start / Join Class', 'Start or enter your scheduled live sessions.'); }
function renderExamTimetable() { return Components.EmptyState('table', 'Exam Timetable', 'View or manage the examination schedule.'); }
function renderGenerateLink() { return Components.EmptyState('link', 'Generate Meeting Link', 'Generate a meeting link for your live session.'); }
function renderSendSessionNotification() { return Components.EmptyState('paper-plane', 'Send Session Notification', 'Notify students about the live session.'); }
function renderMarkSessionAttendance() { return Components.EmptyState('user-check', 'Mark Attendance', 'Mark attendance for the live session.'); }
function renderEndSession() { return Components.EmptyState('stop-circle', 'End Session', 'Conclude the current live session.'); }

// ============================================
// ASSIGNMENTS MODULE
// ============================================

// Global state for assignments
let assignmentsData = [];
let submissionsData = [];
let teacherClasses = [];
let currentAssignmentFilter = 'all';

/**
 * Render Manage Assignments Page
 */
function renderManageAssignments() {
    return `
        <div class="page-header-new" style="justify-content: flex-end; margin-bottom: 20px;">
            <div class="header-actions">
                <button class="btn-modern btn-primary" onclick="openAssignmentModal('create')">
                    <i class="fas fa-plus"></i> Create Assignment
                </button>
            </div>
        </div>

        <div class="stats-grid-modern" id="assignment-stats">
            <div class="stat-card-modern">
                <div class="stat-icon-wrapper blue"><i class="fas fa-tasks"></i></div>
                <div class="stat-content">
                    <p>Total Assignments</p>
                    <h3 id="stat-total-assignments">0</h3>
                </div>
            </div>
            <div class="stat-card-modern">
                <div class="stat-icon-wrapper green"><i class="fas fa-check-circle"></i></div>
                <div class="stat-content">
                    <p>Active</p>
                    <h3 id="stat-active-assignments">0</h3>
                </div>
            </div>
            <div class="stat-card-modern">
                <div class="stat-icon-wrapper orange"><i class="fas fa-clock"></i></div>
                <div class="stat-content">
                    <p>Pending Submissions</p>
                    <h3 id="stat-pending-submissions">0</h3>
                </div>
            </div>
            <div class="stat-card-modern">
                <div class="stat-icon-wrapper purple"><i class="fas fa-star"></i></div>
                <div class="stat-content">
                    <p>Evaluated</p>
                    <h3 id="stat-evaluated">0</h3>
                </div>
            </div>
        </div>

        <div class="modern-card">
            <div class="table-container">
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th>Assignment</th>
                            <th>Class</th>
                            <th>Subject</th>
                            <th>Deadline</th>
                            <th>Submissions</th>
                            <th>Status</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="assignments-table-body">
                        <tr>
                            <td colspan="7" class="loading-cell">
                                <div class="loading-spinner"></div>
                                <p>Loading assignments...</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="assignment-cards" id="assignment-cards">
                <!-- Mobile cards will be rendered here -->
            </div>
        </div>
    `;
}

/**
 * Render Submissions & Marks Page
 */
function renderSubmissionsMarks() {
    return `
        <div class="page-header-new" style="justify-content: flex-end; margin-bottom: 20px;">
            <div class="header-actions">
                <button class="btn-modern btn-success" onclick="publishSelectedMarks()" id="publish-marks-btn" style="display: none;">
                    <i class="fas fa-bullhorn"></i> Publish Selected
                </button>
            </div>
        </div>

        <div class="modern-card">
            <div class="materials-filter-bar">
                <select id="filter-assignment" class="form-control-modern" style="flex: 1; max-width: 400px;" onchange="filterSubmissions()">
                    <option value="all">All Assignments</option>
                </select>
                <select id="filter-status" class="form-control-modern" style="width: 200px;" onchange="filterSubmissions()">
                    <option value="all">All Status</option>
                    <option value="submitted">Submitted</option>
                    <option value="late">Late</option>
                    <option value="evaluated">Evaluated</option>
                    <option value="published">Published</option>
                </select>
            </div>

            <div class="table-container">
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;">
                                <label class="custom-checkbox mb-0">
                                    <input type="checkbox" id="select-all-submissions" onchange="toggleSelectAllSubmissions()">
                                    <span class="checkmark"></span>
                                </label>
                            </th>
                            <th>Student</th>
                            <th>Class</th>
                            <th>Assignment</th>
                            <th>Submitted On</th>
                            <th>Status</th>
                            <th>Marks</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="submissions-table-body">
                        <tr>
                            <td colspan="8" class="loading-cell">
                                <div class="loading-spinner"></div>
                                <p>Loading submissions...</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="assignment-cards" id="submissions-cards">
                <!-- Mobile cards will be rendered here -->
            </div>
        </div>
    `;
}

/**
 * Fetch teacher's assignments from API
 */
async function fetchTeacherAssignments() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/assignments/teacher', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            assignmentsData = result.data;
            renderAssignmentsTable(assignmentsData);
            updateAssignmentStats(assignmentsData);
        } else {
            showToast(result.message || 'Failed to load assignments', 'error');
        }
    } catch (error) {
        console.error('Error fetching assignments:', error);
        showToast('Connection error', 'error');
    }
}

/**
 * Update assignment statistics
 */
function updateAssignmentStats(assignments) {
    const total = assignments.length;
    const active = assignments.filter(a => a.computedStatus === 'published').length;
    const pendingSubmissions = assignments.reduce((sum, a) => sum + (a.submissionCount || 0), 0);
    const evaluated = assignments.reduce((sum, a) => {
        return sum + (a.submissions ? a.submissions.filter(s => s.status === 'evaluated' || s.status === 'published').length : 0);
    }, 0);

    document.getElementById('stat-total-assignments').textContent = total;
    document.getElementById('stat-active-assignments').textContent = active;
    document.getElementById('stat-pending-submissions').textContent = pendingSubmissions;
    document.getElementById('stat-evaluated').textContent = evaluated;
}

/**
 * Render assignments table
 */
function renderAssignmentsTable(assignments) {
    const tbody = document.getElementById('assignments-table-body');
    const cardsContainer = document.getElementById('assignment-cards');

    if (!assignments || assignments.length === 0) {
        const emptyState = `
            <tr>
                <td colspan="7">
                    <div class="assignments-empty-state">
                        <i class="fas fa-clipboard-list"></i>
                        <h3>No Assignments Yet</h3>
                        <p>Create your first assignment to get started</p>
                    </div>
                </td>
            </tr>
        `;
        tbody.innerHTML = emptyState;
        cardsContainer.innerHTML = `
            <div class="assignments-empty-state" style="padding: 40px; text-align: center; background: #f8fafc; border-radius: 12px; margin-top: 15px;">
                <i class="fas fa-clipboard-list" style="font-size: 48px; color: #cbd5e1; margin-bottom: 15px;"></i>
                <h3 style="margin: 0 0 8px 0; color: #1e293b;">No Assignments Yet</h3>
                <p style="margin: 0; color: #64748b;">Create your first assignment to get started</p>
            </div>
        `;
        return;
    }

    const escapeHtmlFn = window.escapeHtml || function (text) {
        // Fallback simple escaper if escapeHtml isn't available
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    // Render table rows
    tbody.innerHTML = assignments.map(assignment => {
        const deadline = new Date(assignment.deadline);
        const isExpired = new Date() > deadline;
        const statusClass = isExpired ? 'expired' : assignment.status;
        const statusText = isExpired ? 'Expired' : assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1);

        // Status badge class mapping
        let badgeClass = 'primary';
        if (statusClass === 'published' || statusClass === 'active') badgeClass = 'success';
        if (statusClass === 'expired') badgeClass = 'danger';

        return `
            <tr>
                <td>
                    <div class="assignment-info-modern">
                        <span class="assignment-title-modern">${escapeHtmlFn(assignment.title)}</span>
                        ${assignment.description ? `<span class="assignment-desc-modern">${escapeHtmlFn(assignment.description)}</span>` : ''}
                    </div>
                </td>
                <td><span class="class-pill">${escapeHtmlFn(assignment.class)}</span></td>
                <td>
                    <div class="class-subject-modern">
                        <span class="subject-text">${escapeHtmlFn(assignment.subject)}</span>
                    </div>
                </td>
                <td>
                    <div class="deadline-modern">
                        <i class="far fa-calendar-alt"></i>
                        <span>${formatDeadline(assignment.deadline)}</span>
                    </div>
                </td>
                <td>
                    <div class="submissions-count">
                        <i class="fas fa-users" style="margin-right: 6px;"></i>
                        <span>${assignment.submissionCount || 0}</span>
                    </div>
                </td>
                <td><span class="status-badge-modern ${statusClass}">${statusText}</span></td>
                <td style="text-align: right;">
                    <div class="action-buttons-flex">
                        <button class="btn-action view" onclick="viewAssignmentFile('${assignment._id}')" title="View Assignment File">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action edit" onclick="openAssignmentModal('edit', '${assignment._id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action delete" onclick="deleteAssignment('${assignment._id}')" title="Delete">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Render mobile cards
    cardsContainer.innerHTML = assignments.map(assignment => {
        const deadline = new Date(assignment.deadline);
        const isExpired = new Date() > deadline;
        const statusClass = isExpired ? 'expired' : assignment.status;
        const statusText = isExpired ? 'Expired' : assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1);

        let badgeClass = 'primary';
        if (statusClass === 'published' || statusClass === 'active') badgeClass = 'success';
        if (statusClass === 'expired') badgeClass = 'danger';

        return `
            <div class="assignment-card modern-card" style="padding: 20px; margin-bottom: 15px;">
                <div class="assignment-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <h4 class="assignment-card-title" style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${escapeHtmlFn(assignment.title)}</h4>
                    <span class="status-badge ${badgeClass}">${statusText}</span>
                </div>
                <div class="assignment-card-meta" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; font-size: 14px;">
                    <div class="assignment-card-meta-item">
                        <span class="assignment-card-meta-label" style="color: #64748b; display: block; margin-bottom: 2px;">Class</span>
                        <span class="assignment-card-meta-value" style="font-weight: 500; color: #1e293b;">${escapeHtmlFn(assignment.class)}</span>
                    </div>
                    <div class="assignment-card-meta-item">
                        <span class="assignment-card-meta-label" style="color: #64748b; display: block; margin-bottom: 2px;">Subject</span>
                        <span class="assignment-card-meta-value" style="font-weight: 500; color: #1e293b;">${escapeHtmlFn(assignment.subject)}</span>
                    </div>
                    <div class="assignment-card-meta-item" style="grid-column: 1 / -1;">
                        <span class="assignment-card-meta-label" style="color: #64748b; display: block; margin-bottom: 2px;">Deadline</span>
                        <span class="assignment-card-meta-value" style="font-weight: 500; color: #dc3545;">${formatDateTime(assignment.deadline)}</span>
                    </div>
                    <div class="assignment-card-meta-item" style="grid-column: 1 / -1;">
                        <span class="assignment-card-meta-label" style="color: #64748b; display: block; margin-bottom: 2px;">Submissions</span>
                        <span class="assignment-card-meta-value" style="font-weight: 600; color: #0A66FF;">${assignment.submissionCount || 0} Students</span>
                    </div>
                </div>
                <div class="assignment-card-actions" style="display: flex; gap: 10px;">
                    <button class="btn-modern btn-outline" style="flex: 1; padding: 8px; font-size: 13px;" onclick="viewAssignmentFile('${assignment._id}')">
                        <i class="fas fa-eye"></i> View File
                    </button>
                    <button class="btn-modern btn-primary" style="flex: 1; padding: 8px; font-size: 13px;" onclick="openAssignmentModal('edit', '${assignment._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-icon delete" style="padding: 8px 12px; height: auto;" onclick="deleteAssignment('${assignment._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Fetch all submissions for teacher
 */
async function fetchAllSubmissions() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/assignments/submissions/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            submissionsData = result.data;
            populateAssignmentFilter();
            renderSubmissionsTable(submissionsData);
        } else {
            showToast(result.message || 'Failed to load submissions', 'error');
        }
    } catch (error) {
        console.error('Error fetching submissions:', error);
        showToast('Connection error', 'error');
    }
}

/**
 * Populate assignment filter dropdown
 */
function populateAssignmentFilter() {
    const select = document.getElementById('filter-assignment');
    if (!select) return;

    const uniqueAssignments = [...new Set(submissionsData.map(s => s.assignment._id))];
    const assignmentMap = {};
    submissionsData.forEach(s => {
        assignmentMap[s.assignment._id] = s.assignment.title;
    });

    select.innerHTML = '<option value="all">All Assignments</option>' +
        uniqueAssignments.map(id => `<option value="${id}">${escapeHtml(assignmentMap[id])}</option>`).join('');
}

/**
 * Filter submissions based on selected filters
 */
function filterSubmissions() {
    const assignmentFilter = document.getElementById('filter-assignment').value;
    const statusFilter = document.getElementById('filter-status').value;

    let filtered = submissionsData;

    if (assignmentFilter !== 'all') {
        filtered = filtered.filter(s => s.assignment._id === assignmentFilter);
    }

    if (statusFilter !== 'all') {
        filtered = filtered.filter(s => s.status === statusFilter);
    }

    renderSubmissionsTable(filtered);
}

/**
 * Render submissions table
 */
function renderSubmissionsTable(submissions) {
    const tbody = document.getElementById('submissions-table-body');
    const cardsContainer = document.getElementById('submissions-cards');
    const publishBtn = document.getElementById('publish-marks-btn');

    if (!submissions || submissions.length === 0) {
        const emptyState = `
            <tr>
                <td colspan="8">
                    <div class="assignments-empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>No Submissions Yet</h3>
                        <p>Student submissions will appear here</p>
                    </div>
                </td>
            </tr>
        `;
        tbody.innerHTML = emptyState;
        cardsContainer.innerHTML = `
            <div class="assignments-empty-state" style="padding: 40px; text-align: center; background: #f8fafc; border-radius: 12px; margin-top: 15px;">
                <i class="fas fa-inbox" style="font-size: 48px; color: #cbd5e1; margin-bottom: 15px;"></i>
                <h3 style="margin: 0 0 8px 0; color: #1e293b;">No Submissions Yet</h3>
                <p style="margin: 0; color: #64748b;">Student submissions will appear here</p>
            </div>
        `;
        if (publishBtn) publishBtn.style.display = 'none';
        return;
    }

    const evaluatedSubmissions = submissions.filter(s => s.status === 'evaluated');
    if (publishBtn) {
        publishBtn.style.display = evaluatedSubmissions.length > 0 ? 'inline-flex' : 'none';
    }

    const escapeHtmlFn = window.escapeHtml || function (text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    // Render table rows
    tbody.innerHTML = submissions.map(submission => {
        const statusClass = submission.status;
        const statusText = submission.status.charAt(0).toUpperCase() + submission.status.slice(1);
        const marksDisplay = submission.marks !== null && submission.marks !== undefined
            ? `<span style="font-weight: 600; color: #1e293b;">${submission.marks}</span><span style="color: #64748b;">/${submission.assignment.totalMarks}</span>`
            : '-';

        let badgeClass = 'primary';
        if (statusClass === 'published' || statusClass === 'evaluated') badgeClass = 'success';
        if (statusClass === 'late') badgeClass = 'warning';

        return `
            <tr class="${submission.status === 'evaluated' ? 'row-highlight-evaluated' : ''}">
                <td style="padding-left: 20px;">
                    <label class="custom-checkbox student-info-cell mb-0">
                        <input type="checkbox" class="submission-checkbox" value="${submission._id}"
                            ${submission.status === 'evaluated' ? '' : 'disabled'}>
                        <span class="checkmark"></span>
                    </label>
                </td>
                <td>
                    <div class="student-details-modern">
                        <div class="student-name-modern">${escapeHtmlFn(submission.studentName)}</div>
                        <div style="font-size: 11px; color: #64748b;">${escapeHtmlFn(submission.studentUserId)}</div>
                    </div>
                </td>
                <td>
                    <span class="class-pill" style="background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">${escapeHtmlFn(submission.assignment.class)}</span>
                </td>
                <td>
                    <div class="class-subject-modern">
                        <span class="subject-text" style="font-weight: 500;">${escapeHtmlFn(submission.assignment.title)}</span>
                    </div>
                </td>
                <td>
                    <div class="date-time-modern">
                        ${formatDateTime(submission.submissionDate)}
                    </div>
                </td>
                <td><span class="status-badge-modern ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="marks-display-modern ${marksDisplay && marksDisplay.includes('<span style') ? 'marks-pass' : ''}">
                        ${marksDisplay.replace('<span style="font-weight: 600; color: #1e293b;">', '<strong>').replace('</span><span style="color: #64748b;">', '</strong><span class="total-marks">')}
                    </div>
                </td>
                <td style="text-align: right;">
                    <div class="action-buttons-flex">
                        <button class="btn-action view" onclick="viewSubmissionDetail('${submission._id}')" title="View Submission">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${submission.status !== 'published' ? `
                        <button class="btn-action evaluate" onclick="openEvaluationModal('${submission._id}')" title="Evaluate">
                            <i class="fas fa-star"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Render mobile cards
    cardsContainer.innerHTML = submissions.map(submission => {
        const statusClass = submission.status;
        const statusText = submission.status.charAt(0).toUpperCase() + submission.status.slice(1);
        const marksDisplay = submission.marks !== null && submission.marks !== undefined
            ? `${submission.marks}/${submission.assignment.totalMarks}`
            : '-';

        let badgeClass = 'primary';
        if (statusClass === 'published' || statusClass === 'evaluated') badgeClass = 'success';
        if (statusClass === 'late') badgeClass = 'warning';

        return `
            <div class="assignment-card modern-card" style="padding: 20px; margin-bottom: 15px;">
                <div class="assignment-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div>
                        <h4 class="assignment-card-title" style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${escapeHtmlFn(submission.studentName)}</h4>
                        <div style="font-size: 13px; color: #64748b; margin-top: 2px;">${escapeHtmlFn(submission.studentUserId)}</div>
                    </div>
                    <span class="status-badge ${badgeClass}">${statusText}</span>
                </div>
                <div class="assignment-card-meta" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; font-size: 14px;">
                    <div class="assignment-card-meta-item" style="grid-column: 1 / -1;">
                        <span class="assignment-card-meta-label" style="color: #64748b; display: block; margin-bottom: 2px;">Assignment</span>
                        <span class="assignment-card-meta-value" style="font-weight: 500; color: #1e293b;">${escapeHtmlFn(submission.assignment.title)}</span>
                    </div>
                    <div class="assignment-card-meta-item">
                        <span class="assignment-card-meta-label" style="color: #64748b; display: block; margin-bottom: 2px;">Submitted On</span>
                        <span class="assignment-card-meta-value" style="font-weight: 500; color: #475569;">${formatDateTime(submission.submissionDate)}</span>
                    </div>
                    <div class="assignment-card-meta-item">
                        <span class="assignment-card-meta-label" style="color: #64748b; display: block; margin-bottom: 2px;">Marks</span>
                        <span class="assignment-card-meta-value" style="font-weight: 600; color: #0A66FF;">${marksDisplay}</span>
                    </div>
                </div>
                <div class="assignment-card-actions" style="display: flex; gap: 10px;">
                    <button class="btn-modern btn-outline" style="flex: 1; padding: 8px; font-size: 13px;" onclick="viewSubmissionDetail('${submission._id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    ${submission.status !== 'published' ? `
                    <button class="btn-modern btn-success" style="flex: 1; padding: 8px; font-size: 13px;" onclick="openEvaluationModal('${submission._id}')">
                        <i class="fas fa-star"></i> Evaluate
                    </button>
                    ` : ''}
                    ${submission.status === 'evaluated' ? `
                    <label style="display: flex; align-items: center; justify-content: center; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer;">
                        <input type="checkbox" class="submission-checkbox-mobile" value="${submission._id}" title="Select to publish" style="margin-right: 6px;"> Publish
                    </label>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Toggle select all submissions
 */
function toggleSelectAllSubmissions() {
    const selectAll = document.getElementById('select-all-submissions');
    const checkboxes = document.querySelectorAll('.submission-checkbox:not(:disabled)');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
}

/**
 * Open assignment modal (create/edit mode)
 */
async function openAssignmentModal(mode, assignmentId = null) {
    const modal = document.getElementById('assignment-modal');
    const title = document.getElementById('assignment-modal-title');
    const saveBtn = document.getElementById('assignment-save-btn');
    const form = document.getElementById('assignment-form');

    // Reset form
    form.reset();
    document.getElementById('assignment-id').value = '';
    document.getElementById('selected-file-name').textContent = '';
    document.getElementById('file-upload-zone').classList.remove('has-file');

    // Load teacher classes
    await loadTeacherClasses();

    if (mode === 'edit' && assignmentId) {
        title.textContent = 'Edit Assignment';
        saveBtn.textContent = 'Update Assignment';
        await loadAssignmentData(assignmentId);
    } else {
        title.textContent = 'Create Assignment';
        saveBtn.textContent = 'Create Assignment';
        // Set default deadline to 7 days from now
        const defaultDeadline = new Date();
        defaultDeadline.setDate(defaultDeadline.getDate() + 7);
        document.getElementById('assignment-deadline').value = formatDateTimeLocal(defaultDeadline);
    }

    modal.style.display = 'flex';
    setupFileUploadZone();
}

/**
 * Close assignment modal
 */
function closeAssignmentModal() {
    const modal = document.getElementById('assignment-modal');
    modal.style.display = 'none';
}

/**
 * Load teacher classes and subjects
 */
async function loadTeacherClasses() {
    const classSelect = document.getElementById('assignment-class');

    // Show loading state
    if (classSelect) {
        classSelect.innerHTML = '<option value="">Loading classes...</option>';
        classSelect.disabled = true;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/assignments/teacher/classes-subjects', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            teacherClasses = result.data;
            populateClassDropdown();
        } else {
            showToast(result.message || 'Failed to load classes', 'error');
            if (classSelect) {
                classSelect.innerHTML = '<option value="">Failed to load</option>';
            }
        }
    } catch (error) {
        console.error('Error loading teacher classes:', error);
        showToast('Error loading classes', 'error');
        if (classSelect) {
            classSelect.innerHTML = '<option value="">Error loading</option>';
        }
    } finally {
        if (classSelect) classSelect.disabled = false;
    }
}

/**
 * Populate class dropdown
 */
function populateClassDropdown() {
    const classSelect = document.getElementById('assignment-class');
    const subjectSelect = document.getElementById('assignment-subject');

    // Reset dropdowns
    classSelect.innerHTML = '<option value="">Select Class</option>';
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';

    if (!teacherClasses || teacherClasses.length === 0) {
        classSelect.innerHTML += '<option value="" disabled>No classes assigned</option>';
        return;
    }

    // Add class options
    teacherClasses.forEach(tc => {
        const option = document.createElement('option');
        option.value = tc.class;
        option.textContent = tc.class;
        classSelect.appendChild(option);
    });

    // Add change listener to update subjects (remove old listener first)
    classSelect.onchange = function () {
        populateSubjectDropdown(this.value);
    };
}

/**
 * Populate subject dropdown based on selected class
 */
function populateSubjectDropdown(className) {
    const subjectSelect = document.getElementById('assignment-subject');

    // Reset subject dropdown
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';

    if (!className) return;

    const classData = teacherClasses.find(tc => tc.class === className);

    if (classData && classData.subjects && classData.subjects.length > 0) {
        classData.subjects.forEach(sub => {
            const option = document.createElement('option');
            option.value = sub;
            option.textContent = sub;
            subjectSelect.appendChild(option);
        });
    } else {
        subjectSelect.innerHTML += '<option value="" disabled>No subjects assigned</option>';
    }
}

/**
 * Load assignment data for editing
 */
async function loadAssignmentData(assignmentId) {
    const assignment = assignmentsData.find(a => a._id === assignmentId);
    if (!assignment) return;

    document.getElementById('assignment-id').value = assignment._id;
    document.getElementById('assignment-title').value = assignment.title;
    document.getElementById('assignment-class').value = assignment.class;
    populateSubjectDropdown(assignment.class);
    document.getElementById('assignment-subject').value = assignment.subject;
    document.getElementById('assignment-description').value = assignment.description || '';
    document.getElementById('assignment-deadline').value = formatDateTimeLocal(new Date(assignment.deadline));
    document.getElementById('assignment-total-marks').value = assignment.totalMarks;
    document.getElementById('assignment-late-submission').checked = assignment.allowLateSubmission;

    if (assignment.fileName) {
        document.getElementById('selected-file-name').textContent = assignment.fileName;
        document.getElementById('file-upload-zone').classList.add('has-file');
    }
}

/**
 * Setup file upload zone
 */
function setupFileUploadZone() {
    const zone = document.getElementById('file-upload-zone');
    const input = document.getElementById('assignment-file');
    const fileName = document.getElementById('selected-file-name');

    // Remove the old click listener, handled by inline HTML

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            input.files = e.dataTransfer.files;
            updateAssignmentFileName(input);
        }
    });
}

/**
 * Handle Assignment File Selection
 */
function updateAssignmentFileName(input) {
    const fileNameElement = document.getElementById('selected-file-name');
    const dragZone = document.getElementById('file-upload-zone');

    if (input.files && input.files.length > 0) {
        fileNameElement.textContent = input.files[0].name;
        dragZone.classList.add('has-file');
    } else {
        fileNameElement.textContent = '';
        dragZone.classList.remove('has-file');
    }
}


/**
 * Save assignment (create or update)
 */
async function saveAssignment() {
    const assignmentId = document.getElementById('assignment-id').value;
    const saveBtn = document.getElementById('assignment-save-btn');
    const formData = new FormData();

    // Get form values
    const title = document.getElementById('assignment-title').value.trim();
    const className = document.getElementById('assignment-class').value;
    const subject = document.getElementById('assignment-subject').value;
    const description = document.getElementById('assignment-description').value.trim();
    const deadline = document.getElementById('assignment-deadline').value;
    const totalMarks = document.getElementById('assignment-total-marks').value;
    const allowLateSubmission = document.getElementById('assignment-late-submission').checked;

    // Validate required fields
    if (!title) {
        showToast('Please enter assignment title', 'error');
        document.getElementById('assignment-title').focus();
        return;
    }
    if (!className) {
        showToast('Please select a class', 'error');
        document.getElementById('assignment-class').focus();
        return;
    }
    if (!subject) {
        showToast('Please select a subject', 'error');
        document.getElementById('assignment-subject').focus();
        return;
    }
    if (!deadline) {
        showToast('Please select a deadline', 'error');
        document.getElementById('assignment-deadline').focus();
        return;
    }

    // Append to formData
    formData.append('title', title);
    formData.append('class', className);
    formData.append('subject', subject);
    formData.append('description', description);
    formData.append('deadline', deadline);
    formData.append('totalMarks', totalMarks);
    formData.append('allowLateSubmission', allowLateSubmission);

    const fileInput = document.getElementById('assignment-file');
    if (fileInput.files.length) {
        formData.append('file', fileInput.files[0]);
    }

    // Show loading state
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
        const token = localStorage.getItem('token');
        const url = assignmentId ? `/api/assignments/${assignmentId}` : '/api/assignments';
        const method = assignmentId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            showToast(assignmentId ? 'Assignment updated successfully' : 'Assignment created successfully', 'success');
            closeAssignmentModal();
            fetchTeacherAssignments();
        } else {
            showToast(result.message || 'Failed to save assignment', 'error');
        }
    } catch (error) {
        console.error('Error saving assignment:', error);
        showToast('Connection error', 'error');
    } finally {
        // Restore button state
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

/**
 * Delete assignment
 */
async function deleteAssignment(assignmentId) {
    if (!confirm('Are you sure you want to delete this assignment? This will also delete all submissions.')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/assignments/${assignmentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
            showToast('Assignment deleted successfully', 'success');
            fetchTeacherAssignments();
        } else {
            showToast(result.message || 'Failed to delete assignment', 'error');
        }
    } catch (error) {
        console.error('Error deleting assignment:', error);
        showToast('Connection error', 'error');
    }
}

/**
 * View assignment file directly
 */
function viewAssignmentFile(assignmentId) {
    // Find the assignment in the current data
    const assignment = assignmentsData.find(a => a._id === assignmentId);

    if (!assignment) {
        showToast('Assignment not found', 'error');
        return;
    }

    // Check if assignment has a file
    if (assignment.fileUrl || assignment.filePath) {
        const fileUrl = assignment.fileUrl || assignment.filePath;
        // Open file in new tab
        window.open(fileUrl, '_blank');
    } else if (assignment.attachments && assignment.attachments.length > 0) {
        // If assignment has multiple attachments, open the first one
        window.open(assignment.attachments[0].url || assignment.attachments[0].filePath, '_blank');
    } else {
        showToast('No file attached to this assignment', 'warning');
    }
}

/**
 * View submissions for an assignment
 */
function viewSubmissions(assignmentId) {
    loadPage('submissions-marks', 'Submissions & Marks');
    // Wait for page to load then filter
    setTimeout(() => {
        const filterSelect = document.getElementById('filter-assignment');
        if (filterSelect) {
            filterSelect.value = assignmentId;
            filterSubmissions();
        }
    }, 500);
}

/**
 * Open evaluation modal
 */
function openEvaluationModal(submissionId) {
    const modal = document.getElementById('evaluation-modal');
    const submission = submissionsData.find(s => s._id === submissionId);

    if (!submission) return;

    document.getElementById('evaluation-submission-id').value = submissionId;
    document.getElementById('evaluation-marks').value = submission.marks || '';
    document.getElementById('evaluation-total-marks').value = submission.assignment.totalMarks;
    document.getElementById('evaluation-feedback').value = submission.feedback || '';

    // Populate submission info
    document.getElementById('evaluation-submission-info').innerHTML = `
        <div class="submission-info-row">
            <span class="submission-info-label">Student:</span>
            <span class="submission-info-value">${escapeHtml(submission.studentName)}</span>
        </div>
        <div class="submission-info-row">
            <span class="submission-info-label">Assignment:</span>
            <span class="submission-info-value">${escapeHtml(submission.assignment.title)}</span>
        </div>
        <div class="submission-info-row">
            <span class="submission-info-label">Submitted:</span>
            <span class="submission-info-value">${formatDateTime(submission.submissionDate)}</span>
        </div>
    `;

    modal.style.display = 'flex';
}

/**
 * Close evaluation modal
 */
function closeEvaluationModal() {
    const modal = document.getElementById('evaluation-modal');
    modal.style.display = 'none';
}

/**
 * Save evaluation
 */
async function saveEvaluation() {
    const submissionId = document.getElementById('evaluation-submission-id').value;
    const marks = parseFloat(document.getElementById('evaluation-marks').value);
    const feedback = document.getElementById('evaluation-feedback').value;
    const totalMarks = parseFloat(document.getElementById('evaluation-total-marks').value);

    if (isNaN(marks) || marks < 0) {
        showToast('Please enter valid marks', 'error');
        return;
    }

    if (marks > totalMarks) {
        showToast(`Marks cannot exceed total marks (${totalMarks})`, 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/assignments/submissions/${submissionId}/evaluate`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ marks, feedback })
        });

        const result = await response.json();
        if (result.success) {
            showToast('Evaluation saved successfully', 'success');
            closeEvaluationModal();
            fetchAllSubmissions();
        } else {
            showToast(result.message || 'Failed to save evaluation', 'error');
        }
    } catch (error) {
        console.error('Error saving evaluation:', error);
        showToast('Connection error', 'error');
    }
}

/**
 * View submission detail
 */
function viewSubmissionDetail(submissionId) {
    const modal = document.getElementById('view-submission-modal');
    const submission = submissionsData.find(s => s._id === submissionId);

    if (!submission) return;

    const marksDisplay = submission.marks !== null && submission.marks !== undefined
        ? `${submission.marks}/${submission.assignment.totalMarks}`
        : 'Not evaluated';

    document.getElementById('view-submission-body').innerHTML = `
        <div class="submission-detail-row">
            <span class="submission-detail-label">Student Name</span>
            <span class="submission-detail-value">${escapeHtml(submission.studentName)}</span>
        </div>
        <div class="submission-detail-row">
            <span class="submission-detail-label">Student ID</span>
            <span class="submission-detail-value">${submission.studentUserId}</span>
        </div>
        <div class="submission-detail-row">
            <span class="submission-detail-label">Assignment</span>
            <span class="submission-detail-value">${escapeHtml(submission.assignment.title)}</span>
        </div>
        <div class="submission-detail-row">
            <span class="submission-detail-label">Class</span>
            <span class="submission-detail-value">${escapeHtml(submission.assignment.class)}</span>
        </div>
        <div class="submission-detail-row">
            <span class="submission-detail-label">Subject</span>
            <span class="submission-detail-value">${escapeHtml(submission.assignment.subject)}</span>
        </div>
        <div class="submission-detail-row">
            <span class="submission-detail-label">Submission Date</span>
            <span class="submission-detail-value">${formatDateTime(submission.submissionDate)}</span>
        </div>
        <div class="submission-detail-row">
            <span class="submission-detail-label">Status</span>
            <span class="submission-detail-value">
                <span class="status-badge ${submission.status}">${submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}</span>
            </span>
        </div>
        <div class="submission-detail-row">
            <span class="submission-detail-label">Marks</span>
            <span class="submission-detail-value">${marksDisplay}</span>
        </div>
        ${submission.feedback ? `
        <div class="submission-detail-row">
            <span class="submission-detail-label">Feedback</span>
            <span class="submission-detail-value">${escapeHtml(submission.feedback)}</span>
        </div>
        ` : ''}
        ${submission.fileUrl ? `
        <div class="submission-detail-row">
            <span class="submission-detail-label">Submitted File</span>
            <span class="submission-detail-value">
                <a href="${submission.fileUrl}" target="_blank" class="submission-file-link">
                    <i class="fas fa-file-download"></i> Download Submission
                </a>
            </span>
        </div>
        ` : ''}
    `;

    modal.style.display = 'flex';
}

/**
 * Close view submission modal
 */
function closeViewSubmissionModal() {
    const modal = document.getElementById('view-submission-modal');
    modal.style.display = 'none';
}

/**
 * Publish selected marks
 */
async function publishSelectedMarks() {
    const checkboxes = document.querySelectorAll('.submission-checkbox:checked');
    const mobileCheckboxes = document.querySelectorAll('.submission-checkbox-mobile:checked');

    const submissionIds = [
        ...Array.from(checkboxes).map(cb => cb.value),
        ...Array.from(mobileCheckboxes).map(cb => cb.value)
    ];

    if (submissionIds.length === 0) {
        showToast('Please select submissions to publish', 'error');
        return;
    }

    if (!confirm(`Publish marks for ${submissionIds.length} submission(s)?`)) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/assignments/submissions/publish', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ submissionIds })
        });

        const result = await response.json();
        if (result.success) {
            showToast(result.message, 'success');
            fetchAllSubmissions();
        } else {
            showToast(result.message || 'Failed to publish marks', 'error');
        }
    } catch (error) {
        console.error('Error publishing marks:', error);
        showToast('Connection error', 'error');
    }
}

/**
 * Helper: Format date and time
 */
function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Helper: Format deadline for better display
 */
function formatDeadline(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const options = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleString('en-US', options).replace(',', ' •');
}

/**
 * Helper: Format date for datetime-local input
 */
function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Helper: Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ------------------------------------------------
// Evaluate Submission Handlers
// ------------------------------------------------

window.openEvaluationModal = function (submissionId) {
    const modal = document.getElementById('evaluation-modal');
    if (!modal) return;

    const submission = submissionsData.find(s => s._id === submissionId);
    if (!submission) return;

    document.getElementById('evaluation-submission-id').value = submissionId;
    document.getElementById('evaluation-marks').value = submission.marks !== null ? submission.marks : '';
    document.getElementById('evaluation-total-marks').value = submission.assignment.totalMarks;
    document.getElementById('evaluation-feedback').value = submission.feedback || '';

    const info = document.getElementById('evaluation-submission-info');
    if (info) {
        info.innerHTML = `
            <div style="margin-bottom: 15px; font-size: 14px; color: #475569; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <div style="margin-bottom: 4px;"><strong>Student:</strong> ${submission.studentName}</div>
                <div style="margin-bottom: 4px;"><strong>Assignment:</strong> ${submission.assignment.title}</div>
                <div><strong>Submitted On:</strong> ${new Date(submission.submissionDate).toLocaleString()}</div>
            </div>
        `;
    }

    const preview = document.getElementById('evaluation-submission-preview');
    if (preview) {
        if (submission.fileUrl) {
            preview.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <span style="font-size: 13px; color: #64748b;"><i class="fas fa-paperclip"></i> Attachment Included</span>
                    <a href="${submission.fileUrl}" target="_blank" rel="noopener noreferrer" style="background: white; border: 1px solid #e2e8f0; padding: 10px 16px; border-radius: 8px; text-decoration: none; color: #0088cc; font-weight: 600; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s;" onmouseover="this.style.background='#f8fafc';this.style.transform='translateY(-1px)';" onmouseout="this.style.background='white';this.style.transform='none';">
                        <i class="fas fa-file-pdf" style="color: #ef4444; font-size: 15px;"></i> View Submission File
                    </a>
                </div>
            `;
        } else {
            preview.innerHTML = '<span style="color: #94a3b8; font-size: 13px; font-style: italic;">No file attached.</span>';
        }
    }

    modal.style.display = 'flex';
};

window.closeEvaluationModal = function () {
    const modal = document.getElementById('evaluation-modal');
    if (modal) modal.style.display = 'none';
};

window.saveEvaluation = async function (action = 'save') {
    const submissionId = document.getElementById('evaluation-submission-id').value;
    const marks = document.getElementById('evaluation-marks').value;
    const feedback = document.getElementById('evaluation-feedback').value;

    if (marks === '') {
        alert('Please enter marks');
        return;
    }

    const token = localStorage.getItem('token');
    try {
        // 1. Save Evaluation Marks
        const response = await fetch(`/api/assignments/submissions/${submissionId}/evaluate`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ marks: Number(marks), feedback })
        });

        const result = await response.json();
        if (!result.success) {
            alert(result.message || 'Failed to save evaluation');
            return;
        }

        // 2. If action is "publish", call publish endpoint for SINGLE ID
        if (action === 'publish') {
            const publishResponse = await fetch('/api/assignments/submissions/publish', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ submissionIds: [submissionId] })
            });

            const publishResult = await publishResponse.json();
            if (!publishResult.success) {
                alert(publishResult.message || 'Saved but failed to publish.');
                closeEvaluationModal();
                if (typeof fetchAllSubmissions === 'function') fetchAllSubmissions();
                return;
            }
            if (typeof showToast === 'function') showToast('Marks saved & Published successfully!', 'success');
        } else {
            if (typeof showToast === 'function') showToast('Evaluation saved successfully', 'success');
        }

        closeEvaluationModal();
        if (typeof fetchAllSubmissions === 'function') fetchAllSubmissions();
    } catch (error) {
        console.error('Error saving evaluation:', error);
        alert('Connection error');
    }
};
