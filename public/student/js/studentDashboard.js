// SmartSchool Student Dashboard JavaScript

// Global state
let currentUser = null;
const ACADEMIC_API_BASE = '/api/academic-year';
const USER_API_BASE = '/api/users';
const TIMETABLE_API_BASE = '/api/students/me/timetable';
const ANNOUNCEMENT_API = '/api/students/me/notices';

// Academic Calendar State
let currentCalendarMonth = new Date().getMonth();
let currentCalendarYear = new Date().getFullYear();
let academicData = [];
let currentFilterType = 'all';
let liveSessionsInterval = null;

// Proctoring Global State
let proctorState = {
    isExamActive: false,
    startTime: null,
    duration: 0, // In minutes
    timeLeft: 0, // In seconds
    timerInterval: null,
    stream: null,
    timetableId: null,
    examData: null,
    violations: 0
};

document.addEventListener('DOMContentLoaded', function () {
    // Check if student is logged in
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    if (!token) {
        window.location.href = '/login';
        return;
    }

    if (userData.feesStatus === 'pending') {
        window.location.href = '/student/fees-pending';
        return;
    }

    currentUser = userData;

    // Initialize UI with whatever is in localStorage first (fast paint)
    initDashboard();
    setupNavigation();
    setupSidebar();
    setupLogout();
    setupDropdownNav();
    loadDashboardStats();
    loadTodaySchedule();
    loadRecentAnnouncements();

    // Then fetch fresh profile from API to update name
    fetchStudentProfile();

    // Start interval refresh
});

function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    const dropdownLogout = document.getElementById('dropdown-logout');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            window.logout();
        });
    }
    if (dropdownLogout) {
        dropdownLogout.addEventListener('click', function (e) {
            e.preventDefault();
            window.logout();
        });
    }
}

function setupDropdownNav() {
    // Handles nav links inside dropdown menus that don't have .nav-item class
    document.querySelectorAll('.dropdown-menu a[data-page]').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            const linkText = this.querySelector('i + *')?.textContent?.trim() || this.textContent.trim();
            const targetNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
            if (targetNav) {
                targetNav.click();
            } else {
                // Directly switch page if no sidebar nav item exists
                document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
                const section = document.getElementById(`page-${pageId}`);
                if (section) section.classList.add('active');
                // Update page title
                const pageTitle = document.getElementById('navbar-page-title');
                if (pageTitle) pageTitle.textContent = linkText || 'Profile';
                loadPageData(pageId);
            }
            // Close dropdown
            document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('show'));
        });
    });
}

async function fetchStudentProfile() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/students/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return;
        }
        const result = await response.json();
        if (result.success && result.data) {
            currentUser = { ...currentUser, ...result.data };
            localStorage.setItem('userData', JSON.stringify(currentUser));
            // Update name in the top navbar
            const nameDisplay = document.getElementById('student-name-display');
            if (nameDisplay && currentUser.name) {
                nameDisplay.textContent = currentUser.name;
            }
        }
    } catch (err) {
        console.error('Error fetching student profile:', err);
    }
}

function initDashboard() {
    // Set student name in profile
    const nameDisplay = document.getElementById('student-name-display');
    if (nameDisplay && currentUser.name) {
        nameDisplay.textContent = currentUser.name;
    }
}

window.toggleSidebar = function () {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        // Desktop toggle
        sidebar.classList.toggle('collapsed');
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.toggle('expanded');
        }
        // Mobile toggle
        sidebar.classList.toggle('active');
    }
};

window.toggleNavGroup = function (element) {
    const group = element.parentElement;
    if (group) {
        group.classList.toggle('active');
    }
};

window.toggleProfileDropdown = function () {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
};

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active') &&
            !sidebar.contains(e.target) && !e.target.closest('.sidebar-toggle') && !e.target.closest('.menu-toggle')) {
            sidebar.classList.remove('active');
        }
    });

    // Close profile dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('profile-dropdown');
        const profile = document.querySelector('.navbar-profile');
        if (dropdown && dropdown.classList.contains('show') && !profile || (profile && !profile.contains(e.target))) {
            if (dropdown) dropdown.classList.remove('show');
        }
    });
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-page]');
    const sections = document.querySelectorAll('.page-section');
    const pageTitle = document.getElementById('navbar-page-title');

    navItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');

            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            // Show current section
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === `page-${pageId}`) {
                    section.classList.add('active');
                }
            });

            // Update page title
            if (pageTitle) {
                const span = this.querySelector('span');
                pageTitle.textContent = span ? span.textContent : 'Dashboard';
            }

            // Load page specific data
            loadPageData(pageId);

            // Close sidebar on mobile
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) sidebar.classList.remove('active');
            }
        });
    });
}

function loadPageData(pageId) {
    // Always stop polling when switching pages
    stopLiveSessionsPolling();

    switch (pageId) {
        case 'dashboard':
            loadDashboardStats();
            loadTodaySchedule();
            loadRecentAnnouncements();
            startLiveSessionsPolling(); // Start polling for dashboard too
            break;
        case 'view-profile':
            loadProfileData();
            break;
        case 'view-calendar':
            loadAcademicCalendar();
            break;
        case 'weekly-schedule':
            loadStudentTimetable();
            break;
        case 'view-announcements':
            loadAnnouncements();
            break;
        case 'view-attendance':
            loadAttendanceData();
            break;
        case 'pending-assignments':
            loadAssignments('pending');
            break;
        case 'submitted-assignments':
            loadAssignments('submitted');
            break;
        case 'view-materials':
            loadStudyMaterials();
            break;
        case 'my-fees':
            loadMyFees();
            break;
        case 'join-session':
            loadLiveSessions();
            startLiveSessionsPolling(); // Start polling
            break;
        case 'view-result':
            loadMyResults();
            break;
        case 'exam-timetable':
            loadStudentExamTimetable();
            break;
        case 'attend-exam':
            loadAvailableExams();
            break;
    }
}

// ────────────────────────────────────────────────
// Dashboard Stats & Schedule
// ────────────────────────────────────────────────

function loadDashboardStats() {
    const stats = {
        subjects: 8,
        lessons: 4,
        attendance: '95%',
        assignments: 3
    };

    const mapping = {
        'student-subject-count': stats.subjects,
        'student-lesson-count': stats.lessons,
        'student-attendance-rate': stats.attendance,
        'student-assignment-count': stats.assignments
    };

    for (const [id, value] of Object.entries(mapping)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
}

async function loadTodaySchedule() {
    const container = document.getElementById('today-schedule-container');
    if (!container) return;

    container.innerHTML = `<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`;

    const token = localStorage.getItem('token');
    try {
        const [timetableRes, sessionsRes, examsRes] = await Promise.all([
            fetch('/api/students/me/timetable', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/live-session/today', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/exams/student/available-exams', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (timetableRes.status === 401 || sessionsRes.status === 401 || examsRes.status === 401) {
            window.location.href = '/login';
            return;
        }

        const timetableResult = await timetableRes.json();
        const sessionsResult = await sessionsRes.json();
        const examsResult = await examsRes.json();

        if (!timetableResult.success || !timetableResult.data || !timetableResult.data.timetable) {
            container.innerHTML = `<div style="text-align: center; color: #64748b; font-size: 13px;">No schedule found for today.</div>`;
            return;
        }

        const timetableGrid = timetableResult.data.timetable;
        const liveSessions = sessionsResult.success ? (sessionsResult.data || []) : [];
        const todayExams = examsResult.success ? (examsResult.data || []).filter(e => e.isToday) : [];

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayDay = days[new Date().getDay()];
        const todayClasses = timetableGrid[todayDay] || [];

        if (todayClasses.length === 0 && todayExams.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #64748b; font-size: 13px;">No classes or exams scheduled for today (${todayDay}).</div>`;
            return;
        }

        // Sort chronologically (merge classes and exams)
        const combinedSchedule = [
            ...todayClasses.map(c => ({ ...c, type: 'class' })),
            ...todayExams.map(e => ({
                subjectName: e.subjectName,
                startTime: e.startTime,
                endTime: e.endTime,
                type: 'exam',
                examId: e._id
            }))
        ];

        combinedSchedule.sort((a, b) => {
            const timeA = new Date(`1970/01/01 ${a.startTime}`).getTime();
            const timeB = new Date(`1970/01/01 ${b.startTime}`).getTime();
            return timeA - timeB;
        });

        const classNameDisplay = currentUser && currentUser.class ? `Class ${currentUser.class}` : 'Your Class';

        const numericClass = currentUser && (currentUser.class || currentUser.studentData?.class) ? (currentUser.class || currentUser.studentData?.class) : 'N/A';

        container.innerHTML = combinedSchedule.map(item => {
            if (item.type === 'exam') {
                return `
                    <div class="schedule-item" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: #fff1f2; border: 1.5px solid #fecaca; border-radius: 12px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(225, 29, 72, 0.05);">
                        <div style="display: flex; align-items: center; gap: 20px; flex: 1;">
                            <div class="schedule-time" style="min-width: 85px; font-weight: 700; color: #e11d48; font-size: 14px;">${item.startTime}</div>
                            <div class="schedule-info">
                                <div style="font-weight: 700; color: #1e293b; font-size: 15px; margin-bottom: 2px;">${item.subjectName} <span style="background: #e11d48; color: white; font-size: 9px; padding: 2px 6px; border-radius: 4px; margin-left: 4px; vertical-align: middle;">EXAM</span></div>
                                <div style="color: #64748b; font-size: 12px; font-weight: 500;">Class: <span style="color: #334155; font-weight: 600;">${numericClass}</span></div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <button class="btn-join" onclick="const attendBtn = document.querySelector('.nav-item[data-page=\'attend-exam\']'); if(attendBtn) attendBtn.click();" style="padding: 6px 16px; border-radius: 20px; border: none; background: #e11d48; color: white; font-size: 12px; cursor: pointer; font-weight: 600; box-shadow: 0 2px 4px rgba(225, 29, 72, 0.2); transition: all 0.2s;">View Exam</button>
                        </div>
                    </div>
                `;
            }

            // Match with live session
            const liveSession = liveSessions.find(s =>
                s.subjectName?.trim().toLowerCase() === item.subjectName?.trim().toLowerCase() &&
                s.startTime?.trim() === item.startTime?.trim()
            );

            const isLive = liveSession && liveSession.status === 'live';
            const isCompleted = liveSession && liveSession.status === 'completed';

            let statusText = 'Class';
            let statusStyle = 'color: #64748b;';
            if (isLive) {
                statusText = '🔴 LIVE';
                statusStyle = 'color: #ef4444; font-weight: 700;';
            } else if (isCompleted) {
                statusText = 'Completed';
                statusStyle = 'color: #10b981;';
            }

            return `
                <div class="schedule-item" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                    <div style="display: flex; align-items: center; gap: 20px; flex: 1;">
                        <div class="schedule-time" style="min-width: 85px; font-weight: 700; color: #2563eb; font-size: 14px;">${item.startTime}</div>
                        <div class="schedule-info">
                            <div style="font-weight: 600; color: #1e293b; font-size: 15px; margin-bottom: 2px;">${item.subjectName}</div>
                            <div style="color: #64748b; font-size: 12px; font-weight: 500;">Class: <span style="color: #334155; font-weight: 600;">${numericClass}</span></div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <span style="${statusStyle} font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: ${isLive ? '#fee2e2' : isCompleted ? '#dcfce7' : '#f1f5f9'};">${statusText}</span>
                        ${isLive ? `
                            <button class="btn-join" onclick="studentJoinSession('${liveSession._id}')" style="padding: 6px 16px; border-radius: 20px; border: none; background: #ef4444; color: white; font-size: 12px; cursor: pointer; font-weight: 600; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2); transition: all 0.2s;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='none';">Join</button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error loading today schedule:', err);
        if (container) container.innerHTML = `<div style="text-align: center; color: #ef4444; font-size: 12px;">Failed to load.</div>`;
    }
}

// ────────────────────────────────────────────────
// Announcements
// ────────────────────────────────────────────────

async function loadAnnouncements() {
    const container = document.getElementById('teacher-notices-list');
    if (!container) return;

    container.innerHTML = `<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(ANNOUNCEMENT_API, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return;
        }

        const result = await response.json();

        if (!result.success || !result.notices || result.notices.length === 0) {
            container.innerHTML = `<div style="text-align: center; padding: 40px; color: #94a3b8;">No announcements found.</div>`;
            return;
        }

        renderAnnouncementsList(result.notices, container);
    } catch (err) {
        console.error('Error:', err);
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ef4444;">Failed to load.</div>`;
    }
}

async function loadRecentAnnouncements() {
    const container = document.getElementById('recent-announcements-container');
    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(ANNOUNCEMENT_API, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return;
        }
        const result = await response.json();

        if (!result.success || !result.notices || result.notices.length === 0) {
            container.innerHTML = `<p style="font-size: 13px; color: #94a3b8;">No recent announcements.</p>`;
            return;
        }

        const recent = result.notices.slice(0, 3);
        container.innerHTML = recent.map(notice => `
            <div class="recent-announcement-item" style="padding: 12px; border-radius: 12px; background: #f8fafc; border-left: 4px solid #3b82f6; margin-bottom: 8px; cursor: pointer;" onclick="document.querySelector('[data-page=\\'view-announcements\\']').click()">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                    <h5 style="font-size: 13px; font-weight: 600; color: #1e293b; margin: 0;">${notice.title}</h5>
                    <span style="font-size: 10px; color: #94a3b8;">${new Date(notice.createdAt).toLocaleDateString()}</span>
                </div>
                <p style="font-size: 12px; color: #64748b; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${notice.content}</p>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error:', err);
    }
}

function renderAnnouncementsList(announcements, container) {
    const cards = announcements.map(notice => {
        const date = new Date(notice.createdAt || notice.date).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        const postedBy = notice.createdByRole === 'teacher' ? 'Teacher' : 'Admin';
        return `
            <div class="notice-card" style="
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 20px 24px;
                border-left: 4px solid #3b82f6;
                box-shadow: 0 1px 3px rgba(0,0,0,0.04);
            ">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px;">
                    <h4 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 0; flex: 1;">${notice.title}</h4>
                    <span style="font-size: 12px; color: #94a3b8; white-space: nowrap; padding-top: 2px;">
                        <i class="fas fa-calendar-alt" style="margin-right: 4px;"></i>${date}
                    </span>
                </div>
                <p style="font-size: 14px; color: #475569; line-height: 1.7; margin: 0 0 14px 0;">${notice.content}</p>
                <div style="font-size: 12px; color: #3b82f6; font-weight: 600;">
                    <i class="fas fa-user-circle" style="margin-right: 6px;"></i>Posted by ${postedBy}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `<div style="display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); width: 100%; margin: 0 auto; padding-bottom: 20px;">${cards}</div>`;
}

// ────────────────────────────────────────────────
// Timetable
// ────────────────────────────────────────────────

async function loadStudentTimetable() {
    const container = document.getElementById('student-weekly-timetable-container');
    if (!container) return;

    container.innerHTML = `<div style="text-align: center; padding: 60px;">
                               <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3b82f6; margin-bottom: 16px;"></i>
                               <p style="color: #64748b;">Loading timetable...</p>
                           </div>`;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/students/me/timetable', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return;
        }

        const result = await response.json();

        if (!result.success || !result.data || !result.data.timetable) {
            container.innerHTML = `<div style="text-align: center; padding: 40px; color: #94a3b8;">
                <i class="fas fa-calendar-times" style="font-size: 48px; color: #e2e8f0; margin-bottom: 16px;"></i>
                <p>No timetable available for your class.</p>
            </div>`;
            return;
        }

        const timetableGrid = result.data.timetable;
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // Create a unique identifier for each time slot (start-end) and sort chronologically
        let timeSlots = [];
        let seenSlots = new Set();

        days.forEach(day => {
            if (timetableGrid[day]) {
                timetableGrid[day].forEach(slot => {
                    const slotId = `${slot.startTime}-${slot.endTime}`;
                    if (!seenSlots.has(slotId)) {
                        timeSlots.push({ start: slot.startTime, end: slot.endTime });
                        seenSlots.add(slotId);
                    }
                });
            }
        });

        // Sort slots chronologically
        timeSlots.sort((a, b) => {
            const timeA = new Date(`1970/01/01 ${a.start}`).getTime();
            const timeB = new Date(`1970/01/01 ${b.start}`).getTime();
            return timeA - timeB;
        });

        if (timeSlots.length === 0) {
            container.innerHTML = `<div style="text-align: center; padding: 40px; color: #94a3b8;">
                <i class="fas fa-calendar-times" style="font-size: 48px; color: #e2e8f0; margin-bottom: 16px;"></i>
                <p>No timetable available for your class.</p>
            </div>`;
            return;
        }

        let html = `
            <table class="weekly-schedule-grid" style="width: 100%; border-collapse: collapse; min-width: 800px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <thead>
                    <tr>
                        <th style="width: 140px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; font-weight: 600; font-size: 14px; text-align: center;">Time Slot</th>
                        ${days.map(d => `<th style="padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; color: #1e293b; font-weight: 600; font-size: 14px; text-align: center;">${d}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        timeSlots.forEach(slotInfo => {
            html += `<tr><td class="time-column" style="padding: 14px 8px; border: 1px solid #e2e8f0; font-weight: 600; color: #64748b; font-size: 13px; text-align: center; background: #f8fafc;">${slotInfo.start} - ${slotInfo.end}</td>`;

            days.forEach(day => {
                const slots = timetableGrid[day] || [];
                // Find all slots that start and end at this specific slot time
                const cellSlots = slots.filter(s => s.startTime === slotInfo.start && s.endTime === slotInfo.end);

                if (cellSlots.length > 0) {
                    html += `<td style="padding: 12px 8px; border: 1px solid #e2e8f0; vertical-align: top; background: white;">`;

                    cellSlots.forEach(slot => {
                        html += `
                            <div class="schedule-session-card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #3b82f6; border-radius: 6px; padding: 10px; margin-bottom: 6px; transition: all 0.2s ease;">
                                <div class="session-subject" style="font-weight: 700; color: #1e293b; font-size: 14px; margin-bottom: 2px;">${slot.subjectName || slot.subjectCode}</div>
                                <div style="color: #64748b; font-size: 12px; font-weight: 400;">${slot.teacherName || 'TBA'}</div>
                            </div>
                        `;
                    });

                    html += `</td>`;
                } else {
                    html += `<td style="padding: 12px 8px; border: 1px solid #e2e8f0; background: #fafbfc;"></td>`;
                }
            });
            html += `</tr>`;
        });

        html += `</tbody></table>`;

        // Add hover effect and responsive styles
        html += `
            <style>
                .weekly-schedule-grid {
                    font-family: 'Poppins', sans-serif;
                }
                
                .schedule-session-card:hover {
                    background: #f1f5f9 !important;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .weekly-schedule-grid th {
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                
                @media (max-width: 768px) {
                    .weekly-schedule-grid {
                        min-width: 600px;
                        font-size: 12px;
                    }
                    
                    .weekly-schedule-grid th,
                    .weekly-schedule-grid td {
                        padding: 8px 4px;
                        font-size: 11px;
                    }
                    
                    .time-column {
                        width: 100px !important;
                    }
                    
                    .session-subject {
                        font-size: 12px !important;
                    }
                }
            </style>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error("Error fetching timetable:", error);
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ef4444;">Failed to load timetable. Please try again later.</div>`;
    }
}

// ────────────────────────────────────────────────
// Assignments & Materials
// ────────────────────────────────────────────────

async function loadAssignments(status) {
    const container = document.getElementById(`${status}-assignments-list`);
    if (!container) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3b82f6; margin-bottom: 16px;"></i>
            <p style="color: #64748b;">Loading assignments...</p>
        </div>
    `;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/students/me/assignments?status=${encodeURIComponent(status)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return;
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.assignments) || result.assignments.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #94a3b8;">
                    <i class="fas fa-clipboard-list" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No assignments available for your class.</p>
                </div>
            `;
            return;
        }

        renderAssignments(result.assignments, status, result.className || 'Your Class');
    } catch (error) {
        console.error('Error loading assignments:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px;"></i>
                <p>Error loading assignments.</p>
                <small>Please try again later.</small>
            </div>
        `;
    }
}

function renderAssignments(assignments, status, className) {
    const container = document.getElementById(`${status}-assignments-list`);
    if (!container) return;

    const cards = assignments.map((assignment) => {
        const dueDate = assignment.deadline
            ? new Date(assignment.deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : 'N/A';

        const fileLink = assignment.fileUrl
            ? `
                <a href="${assignment.fileUrl}" target="_blank" rel="noopener noreferrer" style="color: #475569; font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 6px; background: #f1f5f9; padding: 10px 16px; border-radius: 10px; font-size: 13px; border: 1px solid #e2e8f0; transition: all 0.2s;" onmouseover="this.style.background='#e2e8f0';this.style.transform='translateY(-1px)';" onmouseout="this.style.background='#f1f5f9';this.style.transform='none';">
                    <i class="fas fa-file-pdf" style="color: #ef4444; font-size: 14px;"></i> View Material
                </a>
            `
            : '<span style="color: #94a3b8; font-size: 13px; font-style: italic;">No attachment</span>';


        return `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); cursor: default; display: flex; flex-direction: column; justify-content: space-between;" 
                 onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 24px rgba(148,163,184,0.08)';this.style.borderColor='#cbd5e1';" 
                 onmouseout="this.style.transform='none';this.style.boxShadow='0 1px 3px rgba(0,0,0,0.02)';this.style.borderColor='#e2e8f0';">
                
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                        <div>
                            <h3 style="margin: 0 0 4px 0; color: #0f172a; font-size: 17px; font-weight: 700; line-height: 1.4;">${escapeHtml(assignment.title || '')}</h3>
                            <div style="display: flex; gap: 8px; align-items: center; font-size: 12px; color: #64748b; font-weight: 500;">
                                <span><i class="fas fa-graduation-cap" style="margin-right: 4px;"></i>${escapeHtml(assignment.class || className)}</span>
                                <span style="color: #cbd5e1;">|</span>
                                <span><i class="fas fa-book" style="margin-right: 4px;"></i>${escapeHtml(assignment.subject || '—')}</span>
                            </div>
                        </div>
                        <span style="flex-shrink: 0; background: ${status === 'submitted' ? '#ecfdf5' : '#fffbeb'}; color: ${status === 'submitted' ? '#047857' : '#d97706'}; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 4px; border: 1px solid ${status === 'submitted' ? '#d1fae5' : '#fef3c7'};">
                            <i class="fas ${status === 'submitted' ? 'fa-check-circle' : 'fa-clock'}"></i>
                            ${status === 'submitted' ? 'Submitted' : 'Pending'}
                        </span>
                    </div>

                    ${assignment.description ? `<p style="margin: 0 0 16px 0; color: #475569; font-size: 13.5px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(assignment.description)}</p>` : '<div style="margin-bottom: 16px;"></div>'}

                    <div style="background: #f8fafc; border-radius: 12px; padding: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12.5px; margin-bottom: 20px; border: 1px solid #f1f5f9;">
                        <div><strong style="color: #64748b; font-weight: 500;">Teacher:</strong> <span style="color: #334155; font-weight: 600;">${escapeHtml(assignment.teacherName || 'Faculty')}</span></div>
                        <div><strong style="color: #64748b; font-weight: 500;">Uploaded:</strong> <span style="color: #334155; font-weight: 600;">${new Date(assignment.createdAt).toLocaleDateString()}</span></div>
                        <div style="grid-column: 1 / -1;"><strong style="color: #64748b; font-weight: 500;">Due Date:</strong> <span style="background: #fee2e2; color: #ef4444; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">${dueDate}</span></div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: auto;">
                    <div>${fileLink}</div>
                    <div>
                        ${status === 'submitted' ? `
                            <a href="${assignment.fileUrl || '#'}" target="_blank" rel="noopener noreferrer" style="background: #10b981; color: white; padding: 10px 18px; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(16,185,129,0.2); transition: background 0.2s;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
                                <i class="fas fa-eye"></i> View Submit
                            </a>
                        ` : `
                            <button onclick="openSubmitModal('${assignment._id}', '${escapeHtml(assignment.title || '')}')" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 10px 20px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(37,99,235,0.25); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 16px rgba(37,99,235,0.35)';" onmouseout="this.style.transform='none';this.style.boxShadow='0 4px 12px rgba(37,99,235,0.25)';">
                                <i class="fas fa-paper-plane"></i> Submit
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
                <div>
                    <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
                        <i class="fas ${status === 'submitted' ? 'fa-check-double' : 'fa-clipboard-list'}" style="color: ${status === 'submitted' ? '#10b981' : '#0A66FF'};"></i>
                        ${status === 'submitted' ? 'Submitted Assignments' : 'Your Assignments'}
                    </h2>
                    <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Manage and monitor tasks for <strong>${escapeHtml(className)}</strong></p>
                </div>
                <div style="background: ${status === 'submitted' ? '#ecfdf5' : '#e0f2fe'}; color: ${status === 'submitted' ? '#047857' : '#0369a1'}; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; border: 1px solid ${status === 'submitted' ? '#d1fae5' : '#bae6fd'};">
                    Total: ${assignments.length}
                </div>
            </div>

            <div class="assignments-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">
                ${cards}
            </div>
        </div>
    `;


}

// ────────────────────────────────────────────────
// Submit Assignment Modal Handlers
// ────────────────────────────────────────────────

let selectedSamFile = null;

window.openSubmitModal = function (assignmentId, title) {
    const modal = document.getElementById('submit-assignment-modal');
    const form = document.getElementById('submit-assignment-form');
    if (form) form.reset();
    selectedSamFile = null;

    const fileDisplay = document.getElementById('sam-file-name');
    if (fileDisplay) fileDisplay.style.display = 'none';

    document.getElementById('sam-assignment-id').value = assignmentId;
    document.getElementById('sam-title').textContent = `Submit: ${title}`;

    if (modal) modal.style.display = 'flex';
};

window.closeSubmitModal = function () {
    const modal = document.getElementById('submit-assignment-modal');
    if (modal) modal.style.display = 'none';
};

window.handleSamFileSelect = function (input) {
    const file = input.files[0];
    const fileDisplay = document.getElementById('sam-file-name');

    if (file) {
        if (file.size > 10 * 1024 * 1024) { // 10MB
            alert('File is too large! Maximum allowed is 10MB.');
            input.value = '';
            return;
        }
        selectedSamFile = file;
        if (fileDisplay) {
            fileDisplay.style.display = 'inline-flex';
            fileDisplay.querySelector('span').textContent = file.name;
        }
    }
};

window.handleAssignmentSubmit = async function (event) {
    event.preventDefault();

    if (!selectedSamFile) {
        alert('Please select a file to upload for submission.');
        return;
    }

    const assignmentId = document.getElementById('sam-assignment-id').value;
    const comments = document.getElementById('sam-comments').value || '';
    const token = localStorage.getItem('token');

    const formData = new FormData();
    formData.append('file', selectedSamFile);
    formData.append('comments', comments);

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalBtnHTML = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    try {
        const response = await fetch(`/api/students/assignments/${assignmentId}/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            alert('Assignment submitted successfully!');
            closeSubmitModal();
            // Reload page data to reflect updates
            loadAssignments('pending');
        } else {
            alert(result.message || 'Failed to submit assignment.');
        }
    } catch (error) {
        console.error('Error submitting assignment:', error);
        alert('An error occurred during submission.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    }
};

function loadStudyMaterials() {
    const container = document.getElementById('study-materials-list');
    if (!container) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3b82f6; margin-bottom: 16px;"></i>
            <p style="color: #64748b;">Loading study materials...</p>
        </div>
    `;

    const token = localStorage.getItem('token');
    fetch('/api/students/me/materials', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(response => {
            if (response.status === 401 || response.status === 403) {
                window.location.href = '/login';
                return Promise.reject('Unauthorized');
            }
            return response.json();
        })
        .then(result => {
            if (result.success && result.materials.length > 0) {
                renderStudyMaterials(result.materials, result.className);
            } else {
                container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #94a3b8;">
                    <i class="fas fa-book-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No study materials available for your class.</p>
                    <small style="color: #64748b;">Check back later for updates from your teachers.</small>
                </div>
            `;
            }
        })
        .catch(error => {
            console.error('Error loading study materials:', error);
            container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px;"></i>
                <p>Error loading study materials.</p>
                <small>Please try again later.</small>
            </div>
        `;
        });
}

function renderStudyMaterials(materials, className) {
    const container = document.getElementById('study-materials-list');
    if (!container) return;

    const materialsHTML = materials.map(material => {
        const typeIcon = {
            'PDF': 'fa-file-pdf',
            'Video': 'fa-video',
            'Document': 'fa-file-word'
        }[material.type] || 'fa-file';

        const uploadDate = new Date(material.uploadDate || material.createdAt).toLocaleDateString();
        const fileSize = material.fileSize ? `${(material.fileSize / 1024 / 1024).toFixed(2)} MB` : '';
        const materialClass = material.class_id || material.targetClass || className;

        return `
            <div class="material-card" style="
                padding: 16px;
                border: 1px solid #f1f5f9;
                border-radius: 12px;
                background: #f8fafc;
                transition: all 0.2s ease;
            ">
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                    <div style="
                        background: ${material.type === 'PDF' ? '#fee2e2' : material.type === 'Video' ? '#dbeafe' : '#f0fdf4'};
                        color: ${material.type === 'PDF' ? '#dc2626' : material.type === 'Video' ? '#2563eb' : '#16a34a'};
                        width: 48px;
                        height: 48px;
                        border-radius: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    ">
                        <i class="fas ${typeIcon}" style="font-size: 20px;"></i>
                    </div>
                    
                    <div style="flex: 1; min-width: 0;">
                        <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px; font-weight: 600;">
                            ${material.title}
                        </h3>
                        
                        ${material.description ? `
                            <p style="margin: 0 0 12px 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                                ${material.description}
                            </p>
                        ` : ''}
                        
                        <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                            <span style="
                                background: #f1f5f9;
                                color: #475569;
                                padding: 4px 8px;
                                border-radius: 4px;
                                font-size: 12px;
                                font-weight: 500;
                            ">
                                <i class="fas fa-folder" style="margin-right: 4px;"></i>
                                ${materialClass}
                            </span>

                            <span style="color: #475569; font-size: 12px;">
                                <i class="fas fa-file" style="margin-right: 4px;"></i>
                                ${material.type || 'Document'}
                            </span>
                            
                            <span style="color: #64748b; font-size: 12px;">
                                <i class="fas fa-user" style="margin-right: 4px;"></i>
                                ${material.teacherId?.name || 'Teacher'}
                            </span>
                            
                            <span style="color: #64748b; font-size: 12px;">
                                <i class="fas fa-calendar" style="margin-right: 4px;"></i>
                                ${uploadDate}
                            </span>
                            
                            ${fileSize ? `
                                <span style="color: #64748b; font-size: 12px;">
                                    <i class="fas fa-database" style="margin-right: 4px;"></i>
                                    ${fileSize}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <a href="${material.fileUrl}"
                           target="_blank"
                           rel="noopener noreferrer"
                           style="
                               background: #10b981;
                               color: white;
                               padding: 8px 16px;
                               border-radius: 6px;
                               text-decoration: none;
                               font-size: 14px;
                               font-weight: 500;
                               text-align: center;
                               transition: background 0.2s;
                           "
                           onmouseover="this.style.background='#059669'"
                           onmouseout="this.style.background='#10b981'">
                            <i class="fas fa-eye" style="margin-right: 6px;"></i>
                            View
                        </a>
                        <a href="${material.fileUrl}"
                           download="${material.title}"
                           style="
                               background: #3b82f6;
                               color: white;
                               padding: 8px 16px;
                               border-radius: 6px;
                               text-decoration: none;
                               font-size: 14px;
                               font-weight: 500;
                               text-align: center;
                               transition: background 0.2s;
                           "
                           onmouseover="this.style.background='#2563eb'"
                           onmouseout="this.style.background='#3b82f6'">
                            <i class="fas fa-download" style="margin-right: 6px;"></i>
                            Download
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const numericClass = currentUser && currentUser.class ? currentUser.class : 'N/A';

    container.innerHTML = `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); max-width: 1200px; margin: 0 auto;">
            <p style="margin: 0 0 20px 0; color: #64748b; font-size: 14px; font-weight: 500;">Showing <strong>${materials.length}</strong> material${materials.length !== 1 ? 's' : ''} for Class <strong>${numericClass}</strong></p>
            <div class="materials-grid">
                ${materialsHTML}
            </div>
        </div>
        <style>
            .material-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            
            .materials-grid {
                display: grid;
                gap: 16px;
            }
            
            @media (max-width: 768px) {
                .material-card {
                    padding: 16px;
                }
                
                .material-card .flex {
                    flex-direction: column;
                    gap: 12px;
                }
            }
        </style>
    `;
}

window.viewMaterial = function (fileUrl) {
    window.open(fileUrl, '_blank');
};

// ────────────────────────────────────────────────
// Attendance & Results
// ────────────────────────────────────────────────

function loadAttendanceData() {
    const container = document.getElementById('attendance-data-container');
    if (!container) return;
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 20px;">
            <div class="dashboard-card" style="text-align: center; padding: 40px;">
                <h2 style="font-size: 48px; color: #10b981; margin-bottom: 10px;">95%</h2>
                <p style="color: #64748b;">Overall Attendance Rate</p>
            </div>
            <div class="dashboard-card" style="padding: 20px;">
                <h4 style="margin-bottom: 15px;">Monthly Summary</h4>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Present</span>
                    <span style="color: #10b981; font-weight: 600;">22 Days</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Absent</span>
                    <span style="color: #ef4444; font-weight: 600;">1 Day</span>
                </div>
            </div>
        </div>
    `;
}

function loadResults() {
    const container = document.getElementById('results-data-container');
    if (!container) return;
    container.innerHTML = `<div style="text-align: center; padding: 40px; color: #94a3b8;">No exam results published yet.</div>`;
}

// ────────────────────────────────────────────────
// Live Sessions
// ────────────────────────────────────────────────

function stopLiveSessionsPolling() {
    if (liveSessionsInterval) {
        clearInterval(liveSessionsInterval);
        liveSessionsInterval = null;
    }
}

function startLiveSessionsPolling() {
    if (!liveSessionsInterval) {
        liveSessionsInterval = setInterval(() => {
            // Check if we are still on dashboard or join-session page before loading
            const dashboardActive = document.getElementById('page-dashboard')?.classList.contains('active');
            const joinActive = document.getElementById('page-join-session')?.classList.contains('active');

            if (dashboardActive) {
                loadTodaySchedule();
            } else if (joinActive) {
                loadLiveSessions(true);
            } else {
                stopLiveSessionsPolling();
            }
        }, 5000); // 5 seconds
    }
}

function loadLiveSessions(isSilent = false) {
    const container = document.getElementById('live-sessions-container');
    if (!container) return;

    if (!isSilent) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #3b82f6; margin-bottom: 20px;"></i>
                <h3>Loading Live Sessions</h3>
                <p style="color: #64748b;">Please wait while we fetch your live classes.</p>
            </div>
        `;
    }

    const token = localStorage.getItem('token');

    // Fetch both Timetable and Today's Live Sessions
    Promise.all([
        fetch('/api/students/me/timetable', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/live-session/today', { headers: { 'Authorization': `Bearer ${token}` } })
    ])
        .then(async ([timetableRes, sessionsRes]) => {
            if (timetableRes.status === 401 || sessionsRes.status === 401 ||
                timetableRes.status === 403 || sessionsRes.status === 403) {
                window.location.href = '/login';
                return Promise.reject('Unauthorized');
            }

            const timetableResult = await timetableRes.json();
            const sessionsResult = await sessionsRes.json();

            const containerHeader = `
            <h3 style="margin-bottom: 24px; color: #1e293b; font-size: 20px; display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-broadcast-tower" style="color: #0A66FF; font-size: 18px;"></i> Today's Live Sessions
            </h3>
        `;

            if (!timetableResult.success || !timetableResult.data || !timetableResult.data.timetable) {
                container.innerHTML = `
                <div style="max-width: 900px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                    ${containerHeader}
                    <div style="text-align: center; padding: 40px; color: #94a3b8;">
                        <i class="fas fa-calendar-times" style="font-size: 40px; color: #cbd5e1; margin-bottom: 16px; display: block;"></i>
                        <p style="font-weight: 500; color: #64748b;">No timetable found for your class.</p>
                    </div>
                </div>
            `;
                return;
            }

            const timetableGrid = timetableResult.data.timetable;
            const liveSessions = sessionsResult.success ? (sessionsResult.data || []) : [];

            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const todayDay = days[new Date().getDay()];
            const todayClasses = timetableGrid[todayDay] || [];

            if (todayClasses.length === 0) {
                container.innerHTML = `
                <div style="max-width: 900px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                    ${containerHeader}
                    <div style="text-align: center; padding: 40px; color: #94a3b8;">
                        <i class="fas fa-calendar-times" style="font-size: 40px; color: #cbd5e1; margin-bottom: 16px; display: block;"></i>
                        <p style="font-weight: 500; color: #64748b;">You have no scheduled classes for today.</p>
                    </div>
                </div>
            `;
                return;
            }

            // Sort chronologically
            todayClasses.sort((a, b) => {
                const timeA = new Date(`1970/01/01 ${a.startTime}`).getTime();
                const timeB = new Date(`1970/01/01 ${b.startTime}`).getTime();
                return timeA - timeB;
            });

            const matchedSessionIds = [];

            const sessionsHTML = todayClasses.map(cls => {
                // Find matched live session
                const liveSession = liveSessions.find(s =>
                    s.subjectName?.trim().toLowerCase() === cls.subjectName?.trim().toLowerCase() &&
                    s.startTime?.trim() === cls.startTime?.trim()
                );

                if (liveSession) {
                    matchedSessionIds.push(liveSession._id);
                }

                const now = new Date();
                const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
                const [endH, endM] = cls.endTime.split(':').map(Number);
                const endTotalMinutes = endH * 60 + endM;
                const isPastEndTime = currentTotalMinutes > endTotalMinutes;

                const isLive = liveSession && liveSession.status === 'live' && !isPastEndTime;
                const isCompleted = (liveSession && liveSession.status === 'completed') || isPastEndTime;
                const isEnded = liveSession && liveSession.status === 'ended';
                const classNameDisplay = currentUser && currentUser.class ? currentUser.class : 'Your Class';


                return `
                <div class="class-card ${isLive ? 'active-session' : ''}">
                    <div class="class-card-header">
                        <div>
                            <h4 class="class-subject">${cls.subjectName}</h4>
                            <p class="class-name">Class: ${classNameDisplay}</p>
                        </div>
                        <span class="status-badge ${isLive ? 'status-live' : (isCompleted || isEnded) ? 'status-completed' : 'status-scheduled'}" style="${isEnded || isCompleted ? 'background: #d1fae5; color: #059669;' : ''}">
                            ${isLive ? '🔴 LIVE' : isEnded ? 'Ended' : isCompleted ? 'Completed' : 'Scheduled'}
                        </span>
                    </div>
                    <div class="class-time">
                        <i class="fas fa-clock" style="font-size: 13px; color: #94a3b8;"></i>
                        <span>${cls.startTime} - ${cls.endTime}</span>
                    </div>
                    <p style="margin: 8px 0 0; color: #64748b; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-user-tie" style="color: #94a3b8;"></i> <span>${cls.teacherName || 'Teacher'}</span>
                    </p>
                    <div class="class-actions" style="margin-top: 12px;">
                        ${isLive ? `
                            <button class="btn-action btn-join-live" onclick="studentJoinSession('${liveSession._id}')">
                                <i class="fas fa-video"></i> Join
                            </button>
                        ` : isCompleted ? `
                            <div class="completed-status" style="width: 100%; text-align: center; padding: 10px; background: #f8fafc; color: #059669; font-weight: 600; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                                <i class="fas fa-check-circle"></i> Completed
                            </div>
                        ` : `
                            <button class="btn-action btn-join-live" disabled>
                                <i class="fas fa-video"></i> Join
                            </button>
                        `}
                    </div>
                </div>
            `;
            }).join('');

            // ────────────────────────────────────────────────
            // Append Unmatched Active Sessions (Safety Net)
            // ────────────────────────────────────────────────
            const unmatchedSessions = liveSessions.filter(s => !matchedSessionIds.includes(s._id) && (s.status === 'live' || s.status === 'scheduled'));
            const unmatchedHTML = unmatchedSessions.map(session => {
                const now = new Date();
                const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
                const [endH, endM] = session.endTime.split(':').map(Number);
                const endTotalMinutes = endH * 60 + endM;
                const isPastEndTime = currentTotalMinutes > endTotalMinutes;

                const isLive = session.status === 'live' && !isPastEndTime;
                const isCompleted = session.status === 'completed' || isPastEndTime;
                const isEnded = session.status === 'ended';
                const classNameDisplay = currentUser && currentUser.class ? currentUser.class : 'Your Class';


                return `
                <div class="class-card ${isLive ? 'active-session' : ''}">
                    <div class="class-card-header">
                        <div>
                            <h4 class="class-subject">${session.subjectName}</h4>
                            <p class="class-name">${classNameDisplay}</p>
                        </div>
                        <span class="status-badge ${isLive ? 'status-live' : (isCompleted || isEnded) ? 'status-completed' : 'status-scheduled'}" style="${isEnded || isCompleted ? 'background: #d1fae5; color: #059669;' : ''}">
                            ${isLive ? '🔴 LIVE' : isEnded ? 'Ended' : isCompleted ? 'Completed' : 'Scheduled'}
                        </span>
                    </div>
                    <div class="class-time">
                        <i class="fas fa-clock" style="font-size: 13px; color: #94a3b8;"></i>
                        <span>${session.startTime} - ${session.endTime}</span>
                    </div>
                    <p style="margin: 8px 0 0; color: #64748b; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-user-tie" style="color: #94a3b8;"></i> <span>${session.teacherName || 'Teacher'}</span>
                    </p>
                    <div class="class-actions" style="margin-top: 12px;">
                        ${isLive ? `
                            <button class="btn-action btn-join-live" onclick="studentJoinSession('${session._id}')">
                                <i class="fas fa-video"></i> Join
                            </button>
                        ` : isCompleted ? `
                            <div class="completed-status" style="width: 100%; text-align: center; padding: 10px; background: #f8fafc; color: #059669; font-weight: 600; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                                <i class="fas fa-check-circle"></i> Completed
                            </div>
                        ` : `
                            <button class="btn-action btn-join-live" disabled>
                                <i class="fas fa-video"></i> Join
                            </button>
                        `}
                    </div>
                </div>
            `;
            }).join('');

            const finalHTML = sessionsHTML + unmatchedHTML;

            container.innerHTML = `
            <div class="live-class-container" style="max-width: 1200px; margin: 0 auto;">
                <div style="background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <div>
                            <h2 style="margin: 0; font-size: 24px; font-weight: 600; color: #0f172a;">Today's Live Sessions</h2>
                            <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">
                                ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <div class="today-classes-grid">
                        ${finalHTML}
                    </div>
                </div>
            </div>
        `;
        })
        .catch(error => {
            if (error !== 'Unauthorized') {
                console.error('Error fetching live sessions:', error);
                container.innerHTML = `<div class="dashboard-card" style="text-align: center; padding: 40px; color: #ef4444;"><i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 12px;"></i><p>Failed to load live sessions.</p></div>`;
            }
        });
}

function studentJoinSession(sessionId) {
    const token = localStorage.getItem('token');

    // Show loading toast or update button state if available
    if (typeof showToast === 'function') {
        showToast('Joining session...', 'info');
    }

    fetch(`/api/live-session/${sessionId}/join`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(response => response.json())
        .then(result => {
            if (result.success && result.data && result.data.meetingLink) {
                window.open(result.data.meetingLink, '_blank');
            } else {
                if (typeof showToast === 'function') {
                    showToast(result.message || 'Failed to join session', 'danger');
                } else {
                    alert(result.message || 'Failed to join session');
                }
            }
        })
        .catch(error => {
            console.error('Error joining session:', error);
            if (typeof showToast === 'function') {
                showToast('Error joining session', 'danger');
            }
        });
}

function openResetPasswordModal() {
    const token = localStorage.getItem('token');
    if (!window.SmartSchoolResetPassword || !token) {
        showToast('Reset password module unavailable', 'danger');
        return;
    }

    window.SmartSchoolResetPassword.open({
        token,
        toast: (message, type) => showToast(message, type === 'error' ? 'danger' : 'success'),
        onSuccess: () => {
            setTimeout(() => {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }, 1000);
        }
    });
}

// ────────────────────────────────────────────────
// Profile & Auth
// ────────────────────────────────────────────────

async function loadProfileData() {
    const container = document.getElementById('profile-info-container');

    // Show loading state if container is present in the profile page
    if (container) {
        container.innerHTML = `<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i> Loading profile...</div>`;
    }

    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/students/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return;
        }
        const result = await response.json();
        const profile = result.data || currentUser;

        // Update global currentUser with latest data
        if (result.success && result.data) {
            currentUser = { ...currentUser, ...result.data };
        }

        const fields = {
            'profile-fullName': profile.name,
            'profile-email': profile.email,
            'profile-userId': profile.userId,
            'profile-role': profile.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Student',
            'profile-class': profile.class,
            'profile-city': profile.city,
            'profile-state': profile.state,
            'profile-mobile': profile.mobileNumber || profile.mobileNo,
            'profile-rollNo': profile.rollNo,
            'profile-dob': profile.dob ? new Date(profile.dob).toLocaleDateString() : null,
            'profile-gender': profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : null,
        };

        for (const [id, value] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value || 'N/A';
        }

        // Update profile image if exists
        const imgEl = document.getElementById('profile-avatar-img');
        const iconEl = document.getElementById('profile-avatar-icon');
        if (imgEl && profile.profileImage) {
            imgEl.src = profile.profileImage;
            imgEl.style.display = 'block';
            if (iconEl) iconEl.style.display = 'none';
        }

    } catch (err) {
        console.error('Error loading profile:', err);
        if (container) {
            container.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444;">Failed to load profile.</div>`;
        }
    }
}

// ============================================
// ACADEMIC CALENDAR FUNCTIONS
// ============================================

function loadAcademicCalendar() {
    const container = document.getElementById('tc-calendar-container');
    const monthTitle = document.getElementById('tc-month-title');
    const bannerText = document.getElementById('tc-banner-text');
    const eventsList = document.getElementById('tc-events-list');

    if (!container || !monthTitle) return;

    // Set month title
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthNamesUpper = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    monthTitle.textContent = `${monthNames[currentCalendarMonth]} ${currentCalendarYear}`;
    if (bannerText) {
        bannerText.textContent = `${monthNamesUpper[currentCalendarMonth]} ${currentCalendarYear}`;
    }

    // Show loading state
    container.innerHTML = `
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
            <div style="text-align: center; padding: 40px; grid-column: span 7;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>
        </div>
    `;
    if (eventsList) {
        eventsList.innerHTML = `<div class="empty-list-state"><i class="fas fa-spinner fa-spin"></i> Loading events...</div>`;
    }

    // Load data
    loadStudentAcademicData();
}

async function loadStudentAcademicData() {
    const container = document.getElementById('tc-calendar-container');
    const eventsList = document.getElementById('tc-events-list');

    try {
        const token = localStorage.getItem('token');
        const academicYear = getAcademicYearString(currentCalendarMonth, currentCalendarYear);

        // Fetch holidays and events from the academic year endpoint
        const response = await fetch(`${ACADEMIC_API_BASE}/holidays?academicYear=${academicYear}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (result.success) {
            academicData = result.data || [];
            renderStudentAcademicCalendar();
            renderStudentAcademicList('all');
        } else {
            if (eventsList) {
                eventsList.innerHTML = `<div class="empty-list-state">Failed to load events</div>`;
            }
        }
    } catch (error) {
        console.error('Error loading academic data:', error);
        if (eventsList) {
            eventsList.innerHTML = `<div class="empty-list-state">Error connecting to server</div>`;
        }
    }
}

function renderStudentAcademicCalendar() {
    const container = document.getElementById('tc-calendar-container');
    if (!container) return;

    // 7 columns x 6 rows = 42 cells
    const firstDayOfMonth = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay();
    const daysInMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentCalendarYear, currentCalendarMonth, 0).getDate();
    const today = new Date();

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

function renderStudentAcademicList(filterType = 'all') {
    const listContainer = document.getElementById('tc-events-list');
    if (!listContainer) return;

    const filtered = academicData.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate.getUTCMonth() === currentCalendarMonth &&
            itemDate.getUTCFullYear() === currentCalendarYear &&
            (filterType === 'all' || item.type === filterType);
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-list-state">
                <i class="fas fa-calendar-day"></i>
                <p>No events found for this month</p>
            </div>
        `;
        return;
    }

    const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    listContainer.innerHTML = sorted.map(item => {
        const start = new Date(item.date);
        const end = item.endDate ? new Date(item.endDate) : null;

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

// Filter function for student events
function filterStudentEvents(filterType) {
    // Update active chip
    document.querySelectorAll('.filter-chip-new').forEach(chip => {
        chip.classList.remove('active');
        if (chip.dataset.type === filterType) {
            chip.classList.add('active');
        }
    });

    // Re-render list with filter
    renderStudentAcademicList(filterType);
}

function getAcademicYearString(month, year) {
    // Academic year runs from April to March
    // If month is Jan-Mar, academic year is (year-1)-(year)
    // If month is Apr-Dec, academic year is (year)-(year+1)
    if (month < 3) {
        return `${year - 1}-${year}`;
    }
    return `${year}-${year + 1}`;
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

// Navigation functions for Academic Calendar
window.tcNavigateMonth = function (dir) {
    const prevYearString = getAcademicYearString(currentCalendarMonth, currentCalendarYear);

    currentCalendarMonth += dir;
    if (currentCalendarMonth > 11) {
        currentCalendarMonth = 0;
        currentCalendarYear++;
    } else if (currentCalendarMonth < 0) {
        currentCalendarMonth = 11;
        currentCalendarYear--;
    }

    const newYearString = getAcademicYearString(currentCalendarMonth, currentCalendarYear);

    // Update month title
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthTitle = document.getElementById('tc-month-title');
    if (monthTitle) {
        monthTitle.textContent = `${monthNames[currentCalendarMonth]} ${currentCalendarYear}`;
    }

    if (prevYearString !== newYearString) {
        loadStudentAcademicData();
    } else {
        renderStudentAcademicCalendar();
        renderStudentAcademicList('all');
    }
};

// Util functions
window.showToast = function (message, type = 'info') {
    const toast = document.getElementById('notification-toast');
    const msgEl = document.getElementById('toast-message');
    if (!toast || !msgEl) {
        // Fallback to simple toast if element not found
        const fallbackToast = document.createElement('div');
        fallbackToast.className = `toast toast-${type}`;
        fallbackToast.style = `
            position: fixed; top: 20px; right: 20px; padding: 12px 24px; 
            background: ${type === 'danger' ? '#ef4444' : '#10b981'}; color: white;
            border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;
        fallbackToast.textContent = message;
        document.body.appendChild(fallbackToast);
        setTimeout(() => fallbackToast.remove(), 3000);
        return;
    }
    msgEl.textContent = message;
    toast.className = `notification-toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 5000);
};

window.hideToast = function () {
    const toast = document.getElementById('notification-toast');
    if (toast) {
        toast.classList.remove('show');
    }
};

window.logout = function () {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    window.location.href = '/login';
};

window.handleLogout = window.logout;


window.loadTeacherAnnouncements = function () {
    loadAnnouncements();
};

window.clearTeacherNoticeForm = function () {
    const form = document.getElementById('teacher-post-notice-form');
    if (form) form.reset();
};

window.loadAssignedClasses = function () {
    console.log('Loading assigned classes...');
};

window.filterAssignedClasses = function () {
    console.log('Filtering classes...');
};

window.sortAssignedClasses = function () {
    console.log('Sorting classes...');
};


/**
 * Utility to escape HTML and prevent XSS
 */
function escapeHtml(text) {
    if (text === undefined || text === null) return '';
    const div = document.createElement('div');
    div.textContent = text.toString();
    return div.innerHTML;
}

/**
 * High-fidelity rendering of the student's exam timetable
 * Groups entries by exam and provides a clean, professional tabular layout.
 */
async function loadStudentExamTimetable() {
    const container = document.getElementById('student-exam-timetable-container');
    if (!container) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 60px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3b82f6; margin-bottom: 16px;"></i>
            <p style="color: #64748b;">Loading your examination schedule...</p>
        </div>
    `;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/exams/student/timetable', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return;
        }

        const result = await response.json();

        if (!result.success || !result.data || result.data.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; color: #94a3b8;">
                    <div style="width: 64px; height: 64px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <i class="fas fa-calendar-times" style="font-size: 28px; color: #cbd5e1;"></i>
                    </div>
                    <h3 style="color: #1e293b; font-size: 18px; margin-bottom: 8px;">No Exams Scheduled</h3>
                    <p style="font-size: 14px;">Great news! You have no upcoming examinations at this time.</p>
                </div>
            `;
            return;
        }

        const timetable = result.data;
        const exams = result.exams || [];

        // Group by exam
        const grouped = {};
        timetable.forEach(entry => {
            const examId = entry.examId?._id || entry.examId;
            if (!grouped[examId]) grouped[examId] = [];
            grouped[examId].push(entry);
        });

        let html = '<div id="student-exam-pdf-content">';

        for (const examId in grouped) {
            const examInfo = exams.find(e => e._id === examId) ||
                (timetable.find(t => (t.examId?._id || t.examId) === examId)?.examId) ||
                { name: 'Examination' };

            const entries = grouped[examId];

            html += `
                <div class="exam-group" style="margin-bottom: 40px; background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <div style="background: #f8fafc; padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="margin: 0; color: #0f172a; font-size: 18px; font-weight: 700;">${escapeHtml(examInfo.name)}</h4>
                            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px; font-weight: 500;">
                                <i class="fas fa-graduation-cap" style="margin-right: 6px;"></i>Academic Session ${escapeHtml(examInfo.academicYear)}
                            </p>
                        </div>
                        <div style="background: #eff6ff; color: #2563eb; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; border: 1px solid #dbeafe;">
                            Upcoming
                        </div>
                    </div>
                    
                    <div class="exam-pdf-header" style="text-align: center; margin-bottom: 25px; padding: 20px; border-bottom: 2px solid #f1f5f9; display: none;">
                        <h1 style="color: #1e293b; margin: 0; font-size: 24px;">SmartSchool</h1>
                        <h2 style="color: #64748b; margin: 5px 0 0 0; font-size: 18px;">${escapeHtml(examInfo.name)} Timetable</h2>
                        <p style="color: #94a3b8; font-size: 14px; margin-top: 5px;">Student: ${escapeHtml(currentUser.name)} | Class: ${escapeHtml(currentUser.class || currentUser.studentData?.class)}</p>
                    </div>

                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #fafafa;">
                                    <th style="padding: 16px 24px; text-align: left; font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Date & Day</th>
                                    <th style="padding: 16px 24px; text-align: left; font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Subject</th>
                                    <th style="padding: 16px 24px; text-align: left; font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Timing</th>
                                    <th style="padding: 16px 24px; text-align: left; font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Duration</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            entries.forEach((entry, idx) => {
                const dateObj = new Date(entry.date);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                const dateDisplay = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

                html += `
                    <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;">
                        <td style="padding: 18px 24px;">
                            <div style="font-weight: 700; color: #1e293b; font-size: 14.5px;">${dateDisplay}</div>
                            <div style="color: #64748b; font-size: 12px; font-weight: 500;">${dayName}</div>
                        </td>
                        <td style="padding: 18px 24px;">
                            <div style="font-weight: 700; color: #2563eb; font-size: 15px;">${escapeHtml(entry.subjectName)}</div>
                            <div style="color: #94a3b8; font-size: 12px;">Code: ${escapeHtml(entry.subjectCode)}</div>
                        </td>
                        <td style="padding: 18px 24px;">
                            <span style="background: #f1f5f9; color: #334155; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; border: 1px solid #e2e8f0; display: inline-flex; align-items: center; gap: 8px;">
                                <i class="far fa-clock" style="color: #64748b;"></i>${entry.startTime} - ${entry.endTime}
                            </span>
                        </td>
                        <td style="padding: 18px 24px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></div>
                                <span style="font-size: 14px; font-weight: 600; color: #475569;">${entry.duration} Mins</span>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                            </tbody>
                        </table>
                    </div>
                    <div style="padding: 16px 24px; background: #fafafa; border-top: 1px solid #f1f5f9; text-align: center;">
                        <p style="margin: 0; color: #94a3b8; font-size: 12px;">Bring your identification card and arrive 15 minutes before the start time.</p>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error("Error loading exam timetable:", error);
        container.innerHTML = `
            <div style="text-align: center; padding: 60px; color: #ef4444;">
                <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 16px;"></i>
                <p>Failed to load the examination schedule. Please refresh the page.</p>
            </div>
        `;
    }
}

function downloadStudentExamPDF() {
    const element = document.getElementById('student-exam-pdf-content');
    if (!element) {
        showToast('No timetable found to export', 'warning');
        return;
    }

    // Temporarily show headers inside each exam group for PDF
    const groups = element.querySelectorAll('.exam-group');
    groups.forEach(group => {
        const header = group.querySelector('.exam-pdf-header');
        if (header) header.style.display = 'block';
    });

    const opt = {
        margin: 10,
        filename: `Exam_Timetable_${currentUser.class || currentUser.studentData?.class || 'Class'}_${currentUser.name || 'Student'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(element).save().then(() => {
            groups.forEach(group => {
                const header = group.querySelector('.exam-pdf-header');
                if (header) header.style.display = 'none';
            });
        });
    } else {
        // Fallback or script loading
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => {
            html2pdf().set(opt).from(element).save().then(() => {
                groups.forEach(group => {
                    const header = group.querySelector('.exam-pdf-header');
                    if (header) header.style.display = 'none';
                });
            });
        };
        document.head.appendChild(script);
    }
}

function formatDate(dateStr) {
    if (!dateStr) return 'TBA';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('notification-toast');
    const msgEl = document.getElementById('toast-message');
    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    toast.className = `notification-toast visible ${type}`;

    setTimeout(() => {
        toast.className = 'notification-toast';
    }, 4000);
}

// ────────────────────────────────────────────────
// Attend Exam Logic
// ────────────────────────────────────────────────

let currentExamTimetableId = null;

async function loadAvailableExams() {
    const container = document.getElementById('available-exams-container');
    if (!container) return;

    container.innerHTML = `<div class="loading-state" style="text-align: center; padding: 60px; grid-column: 1 / -1;">
        <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3b82f6; margin-bottom: 16px;"></i>
        <p style="color: #64748b;">Loading available exams...</p>
    </div>`;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/exams/student/available-exams', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return;
        }

        const result = await response.json();
        const studentClassInfo = result.studentClass ? `Class ${result.studentClass}` : 'No Class Detected';

        if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
            container.innerHTML = `<div style="text-align: center; padding: 60px; color: #94a3b8; grid-column: 1 / -1; background: #f8fafc; border-radius: 16px; border: 2px dashed #e2e8f0;">
                <div style="width: 80px; height: 80px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <i class="fas fa-laptop-code" style="font-size: 32px; color: #cbd5e1;"></i>
                </div>
                <h3 style="color: #475569; font-size: 18px; margin-bottom: 8px;">No Exams Found</h3>
                <p style="font-size: 14px; margin-bottom: 4px;">We couldn't find any exams scheduled for your profile.</p>
                <div style="display: inline-block; margin-top: 12px; padding: 6px 16px; background: #eff6ff; color: #3b82f6; border-radius: 20px; font-size: 12px; font-weight: 700; border: 1px solid #dbeafe;">
                    Detected: ${escapeHtml(studentClassInfo)}
                </div>
            </div>`;
            return;
        }

        container.innerHTML = result.data.map(exam => {
            const dateStr = new Date(exam.date).toLocaleDateString();
            let btnText = '<i class="fas fa-pen-alt"></i> Attend Exam';
            let btnColor = exam.isToday ? '#ef4444' : '#2563eb';
            let btnDisabled = false;
            let statusLabel = '';

            if (exam.isSubmitted) {
                statusLabel = `<span style="background: #ecfdf5; color: #047857; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1px solid #d1fae5;">Submitted</span>`;
                btnText = '<i class="fas fa-check"></i> Already Submitted';
                btnColor = '#cbd5e1';
                btnDisabled = true;
            } else if (!exam.hasQuestions) {
                statusLabel = `<span style="background: #fff7ed; color: #c2410c; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1px solid #ffedd5;">Ready Soon</span>`;
                btnText = '<i class="fas fa-clock"></i> Questions Pending';
                btnColor = '#94a3b8';
                btnDisabled = true;
            } else if (exam.isToday) {
                statusLabel = `<span style="background: #fef2f2; color: #ef4444; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1px solid #fee2e2;">Live Now</span>`;
            } else if (exam.isUpcoming) {
                statusLabel = `<span style="background: #f8fafc; color: #64748b; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1px solid #e2e8f0;">Upcoming</span>`;
                btnText = '<i class="fas fa-calendar-alt"></i> Upcoming';
                btnColor = '#64748b';
                btnDisabled = true;
            } else if (exam.isPast) {
                statusLabel = `<span style="background: #f1f5f9; color: #94a3b8; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1px solid #e2e8f0;">Ended</span>`;
                btnText = '<i class="fas fa-history"></i> Exam Over';
                btnColor = '#cbd5e1';
                btnDisabled = true;
            }

            const onClickAction = exam.isOnlineExam ? `openOnlineExamZone('${exam._id}')` : `openExamFormModal('${exam._id}')`;

            return `
                <div style="background: white; border: ${exam.isToday ? '2px solid #ef4444' : '1px solid #e2e8f0'}; border-radius: 16px; padding: 24px; box-shadow: ${exam.isToday ? '0 10px 25px -5px rgba(239, 68, 68, 0.1), 0 8px 10px -6px rgba(239, 68, 68, 0.1)' : '0 1px 3px rgba(0,0,0,0.02)'}; display: flex; flex-direction: column; justify-content: space-between; position: relative; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='none';">
                    ${exam.isToday ? `<div style="position: absolute; top: -10px; left: 24px; background: #ef4444; color: white; padding: 4px 14px; border-radius: 30px; font-size: 11px; font-weight: 800; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2); text-transform: uppercase; letter-spacing: 0.5px; border: 2px solid white;">Today's Exam</div>` : ''}
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                            <h4 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b; line-height: 1.4;">${escapeHtml(exam.subjectName)}</h4>
                            ${statusLabel}
                        </div>
                        <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b; font-weight: 500;">
                            <i class="fas fa-file-alt" style="margin-right: 6px; color: #cbd5e1;"></i>Type: <strong style="color: #334155;">${exam.isOnlineExam ? 'Online CBT' : 'Paper Based'}</strong>
                        </p>
                        <div style="font-size: 13px; color: #475569; margin-bottom: 24px; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #f1f5f9;">
                            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                                <i class="far fa-calendar" style="width: 16px; margin-right: 10px; color: #94a3b8;"></i>
                                <span><strong>Date:</strong> ${dateStr}</span>
                            </div>
                            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                                <i class="far fa-clock" style="width: 16px; margin-right: 10px; color: #94a3b8;"></i>
                                <span><strong>Time:</strong> ${exam.startTime} - ${exam.endTime}</span>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="${onClickAction}" ${btnDisabled ? 'disabled' : ''} style="width: 100%; border-radius: 12px; font-weight: 700; padding: 12px; background: ${btnColor}; border: none; color: white; cursor: ${btnDisabled ? 'not-allowed' : 'pointer'}; box-shadow: ${btnDisabled ? 'none' : '0 4px 10px rgba(0,0,0,0.1)'}; transition: background 0.2s;">
                        ${btnText}
                    </button>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error fetching available exams:', error);
        container.innerHTML = `<div style="text-align: center; color: #ef4444; grid-column: 1 / -1; padding: 40px;">Error loading exams. Please try again later.</div>`;
    }
}

async function openExamFormModal(timetableId) {
    currentExamTimetableId = timetableId;
    const modal = document.getElementById('exam-form-modal');
    const container = document.getElementById('exam-questions-container');

    if (modal) modal.style.display = 'flex';
    container.innerHTML = `<div class="loading-state" style="text-align: center; padding: 60px;">
        <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3b82f6; margin-bottom: 16px;"></i>
        <p style="color: #64748b;">Loading questions...</p>
    </div>`;

    document.getElementById('submit-exam-btn').disabled = true;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/exams/student/exam-questions/${timetableId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (!result.success) {
            container.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 40px;">${result.message || 'Error loading questions.'}</div>`;
            return;
        }

        document.getElementById('exam-form-subject').textContent = result.data.subjectName;
        document.getElementById('exam-form-title').textContent = result.data.examName;

        const questions = result.data.questions || [];
        const questionPaper = result.data.questionPaper;

        let questionsHtml = '';

        if (questionPaper) {
            questionsHtml += `
                <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
                    <div style="width: 48px; height: 48px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.1);">
                        <i class="fas fa-file-pdf" style="font-size: 20px; color: #2563eb;"></i>
                    </div>
                    <h5 style="margin: 0 0 8px 0; color: #1e293b; font-size: 15px; font-weight: 700;">Question Paper Ready</h5>
                    <p style="margin: 0 0 16px 0; color: #64748b; font-size: 13px;">Please download the question paper before you begin.</p>
                    <a href="/${questionPaper}" target="_blank" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">
                        <i class="fas fa-download"></i> View / Download Paper
                    </a>
                </div>
            `;
        }

        if (questions.length === 0) {
            if (questionPaper) {
                // If there's a paper but no structured questions, show a general answer textarea
                questionsHtml += `
                    <div class="exam-question-item" data-id="general" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        <label style="display: block; margin-bottom: 12px; font-weight: 700; color: #1e293b; font-size: 14.5px;">Your Answer / Student Sheet</label>
                        <p style="color: #64748b; font-size: 13px; margin-bottom: 16px;">Type your detailed answer or summarize your answer sheet below.</p>
                        <textarea class="exam-answer-input" data-id="general" rows="12" placeholder="Type your answers for all questions here..." style="width: 100%; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 15px; font-size: 14.5px; font-family: inherit; line-height: 1.6; resize: vertical;" required></textarea>
                    </div>
                `;
            } else {
                container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 40px;">No questions defined for this exam.</div>`;
                return;
            }
        } else {
            questionsHtml += questions.map((q, idx) => `
                <div class="exam-question-item" data-id="${q._id}" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <h5 style="margin: 0; font-size: 15px; font-weight: 700; color: #1e293b; line-height: 1.5;">${idx + 1}. ${escapeHtml(q.questionText)}</h5>
                        <span style="font-size: 12px; font-weight: 600; color: #3b82f6; background: #eff6ff; padding: 4px 8px; border-radius: 6px; white-space: nowrap; margin-left: 12px;">${q.maxMarks} Marks</span>
                    </div>
                    <textarea class="exam-answer-input" data-id="${q._id}" rows="5" placeholder="Type your answer here..." style="width: 100%; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 14px; font-family: inherit; resize: vertical; margin-top: 8px;" required></textarea>
                </div>
            `).join('');
        }

        container.innerHTML = questionsHtml;

        document.getElementById('submit-exam-btn').disabled = false;

    } catch (error) {
        console.error('Error fetching questions:', error);
        container.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 40px;">Error loading questions.</div>`;
    }
}

function closeExamFormModal() {
    const modal = document.getElementById('exam-form-modal');
    if (confirm("Are you sure you want to exit? Your answers will NOT be saved.")) {
        if (modal) modal.style.display = 'none';
        currentExamTimetableId = null;
    }
}

async function submitExamAnswers() {
    if (!currentExamTimetableId) return;

    const answerInputs = document.querySelectorAll('.exam-answer-input');
    const answers = [];

    // Validate that all questions have at least some text
    let allFilled = true;
    answerInputs.forEach(input => {
        const text = input.value.trim();
        if (!text) {
            allFilled = false;
        }
        answers.push({
            questionId: input.getAttribute('data-id'),
            answerText: text
        });
    });

    if (!allFilled) {
        if (!confirm("You have left some answers blank. Are you sure you want to submit?")) {
            return;
        }
    }

    const btn = document.getElementById('submit-exam-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Submitting...`;
    btn.disabled = true;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/exams/student/submit-exam/${currentExamTimetableId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ answers })
        });

        const result = await response.json();

        if (result.success) {
            showToast("Exam submitted successfully!", "success");
            const modal = document.getElementById('exam-form-modal');
            if (modal) modal.style.display = 'none';
            currentExamTimetableId = null;
            loadAvailableExams(); // Refresh grid
        } else {
            showToast(result.message || "Failed to submit exam", "error");
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    } catch (error) {
        console.error('Error submitting exam:', error);
        showToast("Error submitting exam.", "error");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ────────────────────────────────────────────────
// ONLINE (CSV) EXAM ZONE LOGIC
// ────────────────────────────────────────────────

async function openOnlineExamZone(timetableId) {
    if (!timetableId) return;

    // Redirect to the new dedicated exam environment
    // This ensures a clean, isolated session from the start
    window.location.href = `/exam/exam.html?id=${encodeURIComponent(timetableId)}`;
}

/*
// Legacy Modal Logic (Deprecated)
async function _old_openOnlineExamZone(timetableId) {
    currentExamTimetableId = timetableId;
    proctorState.timetableId = timetableId;
    
    const modal = document.getElementById('exam-form-modal');
    const container = document.getElementById('exam-questions-container');
    
    if (modal) modal.style.display = 'flex';
    container.innerHTML = `<div style="text-align: center; padding: 60px;"><i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3b82f6;"></i><p>Establishing secure connection...</p></div>`;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/exams/student/csv-exam-paper/${timetableId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            proctorState.examData = result.data;
            proctorState.duration = result.data.duration || 60; // Default 60 mins if missing
            renderExamInstructions(result.data);
        } else {
            container.innerHTML = `<div style="text-align: center; color: red; padding: 40px;">${result.message}</div>`;
        }
    } catch (error) {
        console.error('Error loading online exam:', error);
        container.innerHTML = `<div style="text-align: center; color: red; padding: 40px;">Connection error</div>`;
    }
}
*/


function renderExamInstructions(data) {
    const container = document.getElementById('exam-questions-container');
    document.getElementById('exam-form-subject').textContent = data.subjectName;
    document.getElementById('exam-form-title').textContent = (data.examName || 'Online Exam');

    container.innerHTML = `
        <div class="instruction-hero">
            <h2 style="text-align: center; margin-bottom: 30px; color: #1e293b;">Examination Instructions</h2>
            <div class="rule-list">
                <div class="rule-item">
                    <div class="rule-icon"><i class="fas fa-expand"></i></div>
                    <div>
                        <strong>Full-Screen Mode Required</strong>
                        <p style="font-size: 0.9rem; color: #64748b; margin-top: 4px;">The exam will only run in full-screen. Exiting will cause immediate submission.</p>
                    </div>
                </div>
                <div class="rule-item">
                    <div class="rule-icon"><i class="fas fa-window-restore"></i></div>
                    <div>
                        <strong>No Tab Switching</strong>
                        <p style="font-size: 0.9rem; color: #64748b; margin-top: 4px;">Switching tabs or windows is considered malpractice and will auto-submit the exam.</p>
                    </div>
                </div>
                <div class="rule-item">
                    <div class="rule-icon"><i class="fas fa-video"></i></div>
                    <div>
                        <strong>Live Camera Proctoring</strong>
                        <p style="font-size: 0.9rem; color: #64748b; margin-top: 4px;">Camera must be active throughout. Blur detection is active.</p>
                    </div>
                </div>
                <div class="rule-item">
                    <div class="rule-icon"><i class="fas fa-clock"></i></div>
                    <div>
                        <strong>Auto-Submit Timer</strong>
                        <p style="font-size: 0.9rem; color: #64748b; margin-top: 4px;">Duration: ${proctorState.duration} Minutes. Auto-submits on timeout.</p>
                    </div>
                </div>
            </div>

            <div style="background: #eff6ff; padding: 20px; border-radius: 12px; margin-bottom: 30px;">
                <h4 style="margin-bottom: 15px; font-size: 1rem;"><i class="fas fa-camera"></i> Camera Verification</h4>
                <div id="camera-loading-state" style="text-align: center; padding: 20px;">
                    <i class="fas fa-spinner fa-spin"></i> Initializing camera...
                </div>
                <div id="camera-preview-container" style="display: none;">
                    <div class="camera-preview-zone">
                        <video id="proctor-video-feed" autoplay playsinline muted></video>
                    </div>
                    <p style="text-align: center; font-size: 0.85rem; color: #3b82f6; margin-top: 10px;">Please ensure your face is clearly visible.</p>
                </div>
                <div id="camera-error-state" style="display: none; color: #ef4444; padding: 10px; text-align: center; font-weight: 600;">
                    <i class="fas fa-exclamation-triangle"></i> Camera permission denied. Please enable camera to start.
                </div>
            </div>

            <button id="btn-start-exam" class="btn btn-primary" onclick="initiateExamStart()" style="width: 100%; padding: 16px; font-size: 1.1rem; font-weight: 700; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 10px;" disabled>
                <i class="fas fa-play"></i> Start Guided Exam
            </button>
        </div>
    `;

    // Try to get camera
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            proctorState.stream = stream;
            const video = document.getElementById('proctor-video-feed');
            if (video) {
                video.srcObject = stream;
                document.getElementById('camera-loading-state').style.display = 'none';
                document.getElementById('camera-preview-container').style.display = 'block';
                document.getElementById('btn-start-exam').disabled = false;
            }
        })
        .catch(err => {
            console.error("Camera access failed:", err);
            document.getElementById('camera-loading-state').style.display = 'none';
            document.getElementById('camera-error-state').style.display = 'block';
        });

    // Hide standard submit button during instructions
    const submitBtn = document.getElementById('submit-exam-btn');
    if (submitBtn) submitBtn.style.display = 'none';
}

async function initiateExamStart() {
    if (!proctorState.stream) return;

    try {
        // Step 1: Request Fullscreen
        if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
        }

        // Step 2: Initialize Proctoring Observers
        document.addEventListener('fullscreenchange', handleFullscreenExitDetection);
        document.addEventListener('visibilitychange', handleVisibilityChangeDetection);

        // Step 3: Setup UI for Exam mode
        document.body.classList.add('exam-mode-active');
        proctorState.isExamActive = true;
        proctorState.timeLeft = proctorState.duration * 60;

        // Step 4: Render Questions & Start Timer
        startExamTimer();
        renderProctoredQuestions();

        // Step 5: Setup Camera Monitoring
        startCameraMonitoring();

        showToast("Secure Examination Started", "success");
    } catch (err) {
        console.error("Failed to start secure session:", err);
        showToast("Full-screen mode is required to start the exam.", "danger");
    }
}

function startExamTimer() {
    const header = document.querySelector('.exam-form-header');
    if (header) {
        header.innerHTML += `
            <div class="proctor-timer" id="floating-timer">
                <i class="fas fa-clock"></i>
                <span id="timer-display">--:--</span>
            </div>
        `;
    }

    proctorState.timerInterval = setInterval(() => {
        proctorState.timeLeft--;
        updateTimerDisplay();

        if (proctorState.timeLeft === 300) {
            showToast("5 Minutes Remaining!", "warning");
        }

        if (proctorState.timeLeft <= 0) {
            clearInterval(proctorState.timerInterval);
            forceSubmitExam("Time Out");
        }
    }, 1000);
}

function updateTimerDisplay() {
    const el = document.getElementById('timer-display');
    const timerBox = document.getElementById('floating-timer');
    if (!el) return;

    const mins = Math.floor(proctorState.timeLeft / 60);
    const secs = proctorState.timeLeft % 60;
    el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (proctorState.timeLeft < 300 && timerBox) {
        timerBox.classList.add('low-time');
    }
}

function renderProctoredQuestions() {
    const container = document.getElementById('exam-questions-container');
    const data = proctorState.examData;
    let html = '';

    data.questions.forEach((q, idx) => {
        let optionsHtml = '';
        if (q.questionType === 'MCQ') {
            const options = Array.isArray(q.options) ? q.options : (q.options ? q.options.toString().split(/,|\|/) : []);
            optionsHtml = options.map(opt => `
                <label style="display: block; padding: 15px; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 10px; cursor: pointer; transition: 0.2s;">
                    <input type="radio" name="question_${q._id}" value="${escapeHtml(opt.toString().trim())}" style="margin-right: 12px;" required>
                    <span style="font-size: 1rem;">${escapeHtml(opt.toString().trim())}</span>
                </label>
            `).join('');
        } else if (q.questionType === 'TF') {
            optionsHtml = `
                <div style="display: flex; gap: 20px;">
                    <label style="flex: 1; padding: 15px; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; text-align: center;">
                        <input type="radio" name="question_${q._id}" value="TRUE" required> True
                    </label>
                    <label style="flex: 1; padding: 15px; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; text-align: center;">
                        <input type="radio" name="question_${q._id}" value="FALSE" required> False
                    </label>
                </div>
            `;
        } else {
            optionsHtml = `<textarea name="question_${q._id}" rows="6" placeholder="Type your descriptive answer..." style="width: 100%; padding: 15px; border: 1px solid #e2e8f0; border-radius: 10px; font-family: inherit; resize: vertical;" required></textarea>`;
        }

        html += `
            <div class="proctor-question-card online-question-item" data-id="${q._id}" data-type="${q.questionType}">
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                    <span style="background: #f1f5f9; color: #475569; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 700;">Question ${idx + 1}</span>
                    <span style="color: #3b82f6; font-weight: 700;">${q.maxMarks} Marks</span>
                </div>
                <div style="font-size: 1.1rem; font-weight: 600; color: #1e293b; margin-bottom: 25px; line-height: 1.6;">${escapeHtml(q.questionText)}</div>
                <div class="answer-zone">${optionsHtml}</div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Show submit button in footer
    const submitBtn = document.getElementById('submit-exam-btn');
    if (submitBtn) {
        submitBtn.style.display = 'inline-flex';
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Final Submission';
        submitBtn.onclick = (e) => {
            e.preventDefault();
            submitProctoredExam();
        };
    }
}

function startCameraMonitoring() {
    // Add cam-overlay if not exists
    if (!document.getElementById('proctor-blur-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'proctor-blur-overlay';
        overlay.className = 'proctor-alert-overlay';
        overlay.style.display = 'none';
        overlay.innerHTML = `
            <i class="fas fa-video-slash violation-icon"></i>
            <h1>CAMERA SIGNAL LOST</h1>
            <p>Your screen has been blurred for security. Please turn your camera back on immediately.</p>
            <button class="btn btn-primary" onclick="requestCameraReaccess()" style="margin-top: 20px;">Re-enable Camera</button>
        `;
        document.body.appendChild(overlay);
    }

    const checkInterval = setInterval(() => {
        if (!proctorState.isExamActive) {
            clearInterval(checkInterval);
            return;
        }

        const videoTrack = proctorState.stream?.getVideoTracks()[0];
        if (!videoTrack || !videoTrack.enabled || videoTrack.readyState !== 'live') {
            document.getElementById('proctor-blur-overlay').style.display = 'flex';
            document.getElementById('exam-questions-container').style.filter = 'blur(20px)';
        } else {
            document.getElementById('proctor-blur-overlay').style.display = 'none';
            document.getElementById('exam-questions-container').style.filter = 'none';
        }
    }, 2000);
}

function handleFullscreenExitDetection() {
    if (proctorState.isExamActive && !document.fullscreenElement) {
        forceSubmitExam("Security Breach: Fullscreen exit detected");
    }
}

function handleVisibilityChangeDetection() {
    if (proctorState.isExamActive && document.visibilityState === 'hidden') {
        forceSubmitExam("Security Breach: Tab switching detected");
    }
}

async function forceSubmitExam(reason) {
    if (!proctorState.isExamActive) return;

    showToast(`${reason}. Submitting exam...`, "danger");
    proctorState.isExamActive = false;

    // Stop all trackers
    cleanupProctoring();

    // Auto-save whatever is filled
    submitProctoredExam(true, reason);
}

function cleanupProctoring() {
    clearInterval(proctorState.timerInterval);
    document.removeEventListener('fullscreenchange', handleFullscreenExitDetection);
    document.removeEventListener('visibilitychange', handleVisibilityChangeDetection);
    document.body.classList.remove('exam-mode-active');

    if (proctorState.stream) {
        proctorState.stream.getTracks().forEach(track => track.stop());
    }

    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.error(err));
    }

    const timer = document.getElementById('floating-timer');
    if (timer) timer.remove();
}

async function requestCameraReaccess() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        proctorState.stream = stream;
        showToast("Camera Signal Restored", "success");
    } catch (err) {
        showToast("Could not access camera. Please check permissions.", "danger");
    }
}

async function submitProctoredExam(isAuto = false, autoReason = "") {
    if (!isAuto && !confirm("Are you sure you want to finish the exam? Once submitted, you cannot return.")) return;

    proctorState.isExamActive = false;
    const items = document.querySelectorAll('.online-question-item');
    const answers = [];

    items.forEach(item => {
        const qId = item.dataset.id;
        const qType = item.dataset.type;
        let val = '';

        if (qType === 'DESCRIPTIVE') {
            const el = item.querySelector(`textarea[name="question_${qId}"]`);
            val = el ? el.value.trim() : '';
        } else {
            const checked = item.querySelector(`input[name="question_${qId}"]:checked`);
            val = checked ? checked.value : '';
        }
        answers.push({ questionId: qId, studentAnswer: val });
    });

    const submitBtn = document.getElementById('submit-exam-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizing...';
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/exams/student/csv-submit-exam/${proctorState.timetableId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                answers,
                isAutoSubmission: isAuto,
                submissionReason: autoReason || "Manual Submission"
            })
        });

        const result = await response.json();
        cleanupProctoring();

        if (result.success) {
            showToast(isAuto ? "Exam Auto-Submitted due to Security Policy" : "Exam successfully submitted!", isAuto ? "danger" : "success");
            const modal = document.getElementById('exam-form-modal');
            if (modal) modal.style.display = 'none';
            loadAvailableExams();
        } else {
            showToast(result.message || "Submission error", "error");
        }
    } catch (error) {
        console.error('Error submitting exam:', error);
        cleanupProctoring();
        showToast("Critical error during submission. Results may not have saved.", "danger");
    }
}

async function submitOnlineExam(timetableId) {
    if (!confirm("Are you sure you want to submit your online exam? You cannot make changes after submission.")) return;

    const items = document.querySelectorAll('.online-question-item');
    const answers = [];

    let allAnswered = true;
    items.forEach(item => {
        const qId = item.dataset.id;
        const qType = item.dataset.type;
        let val = '';

        if (qType === 'DESCRIPTIVE') {
            val = item.querySelector(`textarea[name="question_${qId}"]`).value.trim();
        } else {
            const checked = item.querySelector(`input[name="question_${qId}"]:checked`);
            val = checked ? checked.value : '';
        }

        if (!val) allAnswered = false;
        answers.push({ questionId: qId, studentAnswer: val });
    });

    if (!allAnswered) {
        if (!confirm("You have not answered all questions. Are you sure you want to submit?")) return;
    }

    const submitBtn = document.getElementById('submit-exam-btn');
    const originalContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/exams/student/csv-submit-exam/${timetableId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ answers })
        });

        const result = await response.json();
        if (result.success) {
            showToast("Success! Your exam has been submitted for evaluation.", "success");
            const modal = document.getElementById('exam-form-modal');
            if (modal) modal.style.display = 'none';
            loadAvailableExams();
        } else {
            showToast(result.message || "Submission failed", "error");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalContent;
        }
    } catch (error) {
        console.error('Error submitting online exam:', error);
        showToast("Connection error during submission", "error");
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalContent;
    }
}

// ────────────────────────────────────────────────
// Student Results Module
// ────────────────────────────────────────────────

async function loadMyResults() {
    const loading = document.getElementById('student-results-loading');
    const empty = document.getElementById('student-results-empty');
    const container = document.getElementById('student-results-container');

    if (!container) return;

    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/exams/student/my-results', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (loading) loading.style.display = 'none';

        if (result.success && result.data && result.data.length > 0) {
            if (container) {
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.gap = '30px';

                // Group by examName
                const grouped = {};
                result.data.forEach(res => {
                    const exam = res.examName;
                    if (!grouped[exam]) {
                        grouped[exam] = {
                            examName: exam,
                            subjects: [],
                            totalMarks: 0,
                            totalMaxMarks: 0
                        };
                    }
                    grouped[exam].subjects.push(res);
                    grouped[exam].totalMarks += parseFloat(res.totalMarks || 0);
                    grouped[exam].totalMaxMarks += parseFloat(res.totalMaxMarks || 0);
                });

                let html = '';
                for (const exam in grouped) {
                    const data = grouped[exam];
                    const percentageValue = data.totalMaxMarks > 0 ? ((data.totalMarks / data.totalMaxMarks) * 100).toFixed(2) : 0;
                    const status = percentageValue >= 35 ? 'PASS' : 'FAIL';
                    const statusColor = status === 'PASS' ? '#10b981' : '#ef4444';

                    html += `
                        <div class="result-summary-card" style="background: white; border-radius: 24px; padding: 40px; border: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); font-family: 'Poppins', sans-serif; position: relative; overflow: hidden;">
                            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 6px; background: linear-gradient(90deg, #2563eb, #3b82f6);"></div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 1px solid #f1f5f9; padding-bottom: 30px;">
                                <div>
                                    <h3 style="font-size: 1.8rem; font-weight: 800; color: #0f172a; margin: 0;">${data.examName}</h3>
                                    <p style="color: #64748b; margin: 5px 0 0; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                                        <i class="fas fa-file-invoice" style="color: #2563eb;"></i> Performance Report Card
                                    </p>
                                </div>
                                <div style="text-align: right;">
                                    <div style="background: ${statusColor}15; color: ${statusColor}; padding: 10px 20px; border-radius: 12px; font-weight: 900; font-size: 1.2rem; letter-spacing: 1px; border: 1px solid ${statusColor}30;">${status}</div>
                                    <p style="color: #94a3b8; font-size: 0.7rem; margin-top: 8px; font-weight: 800; text-transform: uppercase;">Final Status</p>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; margin-bottom: 40px;">
                                <div style="background: #f8fafc; border-radius: 20px; padding: 24px; border: 1px solid #f1f5f9; display: flex; align-items: center; gap: 18px;">
                                    <div style="width: 54px; height: 54px; background: #eff6ff; color: #2563eb; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.1);">
                                        <i class="fas fa-chart-line"></i>
                                    </div>
                                    <div>
                                        <p style="margin: 0; font-size: 0.75rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Aggregate Score</p>
                                        <p style="margin: 2px 0 0; font-size: 1.5rem; font-weight: 900; color: #1e293b;">${percentageValue}<span style="font-size: 1rem; color: #94a3b8; margin-left: 2px;">%</span></p>
                                    </div>
                                </div>
                                <div style="background: #f8fafc; border-radius: 20px; padding: 24px; border: 1px solid #f1f5f9; display: flex; align-items: center; gap: 18px;">
                                    <div style="width: 54px; height: 54px; background: #f0fdf4; color: #16a34a; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.1);">
                                        <i class="fas fa-star"></i>
                                    </div>
                                    <div>
                                        <p style="margin: 0; font-size: 0.75rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Grand Total</p>
                                        <p style="margin: 2px 0 0; font-size: 1.5rem; font-weight: 900; color: #1e293b;">${data.totalMarks} <span style="font-size: 0.9rem; color: #cbd5e1; font-weight: 700;">/ ${data.totalMaxMarks}</span></p>
                                    </div>
                                </div>
                                <div style="background: #f8fafc; border-radius: 20px; padding: 24px; border: 1px solid #f1f5f9; display: flex; align-items: center; gap: 18px;">
                                    <div style="width: 54px; height: 54px; background: #fffbeb; color: #d97706; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; box-shadow: 0 4px 6px -1px rgba(217, 119, 6, 0.1);">
                                        <i class="fas fa-layer-group"></i>
                                    </div>
                                    <div>
                                        <p style="margin: 0; font-size: 0.75rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Subjects Analyzed</p>
                                        <p style="margin: 2px 0 0; font-size: 1.5rem; font-weight: 900; color: #1e293b;">${data.subjects.length}</p>
                                    </div>
                                </div>
                            </div>

                            <div style="overflow-x: auto; background: #fcfdfe; border-radius: 20px; border: 1px solid #f1f5f9; padding: 10px;">
                                <table style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
                                    <thead>
                                        <tr style="color: #64748b; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
                                            <th style="text-align: left; padding: 12px 20px;">Course Subject</th>
                                            <th style="padding: 12px 20px; text-align: center;">Max</th>
                                            <th style="padding: 12px 20px; text-align: center;">Marks</th>
                                            <th style="padding: 12px 20px; text-align: center;">%</th>
                                            <th style="padding: 12px 20px; text-align: right;">Evaluation</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${data.subjects.map(s => {
                        const perfVal = parseFloat(s.percentage);
                        const grade = perfVal >= 90 ? 'A+' : perfVal >= 80 ? 'A' : perfVal >= 70 ? 'B+' : perfVal >= 60 ? 'B' : perfVal >= 50 ? 'C' : perfVal >= 35 ? 'D' : 'E';
                        const perfColor = perfVal >= 80 ? '#10b981' : perfVal >= 60 ? '#3b82f6' : perfVal >= 40 ? '#f59e0b' : '#ef4444';

                        return `
                                                <tr style="background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                                                    <td style="padding: 18px 20px; border-radius: 12px 0 0 12px; font-weight: 700; color: #334155;">${s.subjectName}</td>
                                                    <td style="padding: 18px 20px; text-align: center; color: #94a3b8; font-weight: 600;">${s.totalMaxMarks}</td>
                                                    <td style="padding: 18px 20px; text-align: center; font-weight: 800; color: #0f172a;">${s.totalMarks}</td>
                                                    <td style="padding: 18px 20px; text-align: center; font-weight: 800; color: #2563eb;">${s.percentage}%</td>
                                                    <td style="padding: 18px 20px; border-radius: 0 12px 12px 0; text-align: right;">
                                                        <span style="background: ${perfColor}15; color: ${perfColor}; padding: 4px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 800;">Grade: ${grade}</span>
                                                    </td>
                                                </tr>
                                            `;
                    }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }
                container.innerHTML = html;
                container.style.display = 'flex';
            }
        } else {
            if (empty) empty.style.display = 'block';
        }

    } catch (err) {
        console.error('Error fetching results:', err);
        if (loading) loading.style.display = 'none';
        if (empty) {
            empty.style.display = 'block';
            empty.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="width: 80px; height: 80px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <i class="fas fa-exclamation-circle" style="font-size: 32px; color: #ef4444;"></i>
                    </div>
                    <h3 style="color: #1e293b; font-weight: 800;">Results Unavailable</h3>
                    <p style="color: #64748b; font-size: 0.95rem;">Scheduled results have not been published yet or there was a system error.</p>
                </div>
            `;
        }
    }
}
// My Fees Logic
// ────────────────────────────────────────────────

let dashboardPaymentDetails = null;

async function loadMyFees() {
    document.getElementById('my-fees-content').style.display = 'none';
    document.getElementById('my-fees-loading').style.display = 'block';

    const token = localStorage.getItem('token');

    try {
        const res = await fetch('/api/student-fees/status', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401 || res.status === 403) {
            window.location.href = '/login';
            return;
        }

        const result = await res.json();

        if (result.success && result.data) {
            dashboardPaymentDetails = result.data;
            renderMyFees(result.data);
        } else {
            document.getElementById('my-fees-loading').innerHTML =
                `<span style="color:#ef4444;"><i class="fas fa-exclamation-triangle"></i> Failed to load fees details.</span>`;
        }
    } catch (err) {
        console.error(err);
        document.getElementById('my-fees-loading').innerHTML =
            `<span style="color:#ef4444;"><i class="fas fa-exclamation-triangle"></i> Network Error.</span>`;
    }
}

function renderMyFees(data) {
    document.getElementById('my-fees-loading').style.display = 'none';
    document.getElementById('my-fees-content').style.display = 'block';

    document.getElementById('mf-student-name').textContent = data.studentName;
    document.getElementById('mf-class-name').textContent = data.className;
    document.getElementById('mf-total-fees').textContent = `₹${data.totalFees}`;
    document.getElementById('mf-paid-amount').textContent = `₹${data.paidAmount}`;

    const statusBadge = document.getElementById('mf-status-badge');
    const payBtn = document.getElementById('mf-pay-btn');
    const receiptBtn = document.getElementById('mf-receipt-btn');

    if (data.feesStatus === 'paid' || (data.totalFees - data.paidAmount) <= 0) {
        statusBadge.textContent = 'Paid';
        statusBadge.style.background = '#dcfce7';
        statusBadge.style.color = '#10b981';
        payBtn.style.display = 'none';
        receiptBtn.style.display = 'block';
    } else {
        statusBadge.textContent = 'Pending';
        statusBadge.style.background = '#fee2e2';
        statusBadge.style.color = '#ef4444';
        payBtn.style.display = 'block';
        receiptBtn.style.display = 'none';
    }
}

async function initiateDashboardPayment() {
    const btn = document.getElementById('mf-pay-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;

    const token = localStorage.getItem('token');

    try {
        const orderRes = await fetch('/api/student-fees/create-order', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const orderData = await orderRes.json();

        if (!orderData.success) throw new Error(orderData.message || "Failed to create order");

        const startOptions = {
            key: orderData.data.keyId,
            amount: orderData.data.amount,
            currency: orderData.data.currency,
            name: "Smart School System",
            description: `Fees - ${dashboardPaymentDetails.className}`,
            order_id: orderData.data.orderId,
            handler: async function (response) {
                await verifyDashboardPayment(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
            },
            prefill: {
                name: orderData.data.studentName,
                email: orderData.data.studentEmail,
                contact: orderData.data.contact
            },
            theme: { color: "#0A66FF" },
            modal: {
                ondismiss: function () {
                    btn.disabled = false;
                    btn.innerHTML = `<i class="fas fa-credit-card"></i> Pay Now`;
                }
            }
        };

        const rzp = new Razorpay(startOptions);
        rzp.open();

    } catch (err) {
        alert(err.message || 'Payment initiation failed');
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-credit-card"></i> Pay Now`;
    }
}

async function verifyDashboardPayment(orderId, paymentId, signature) {
    const btn = document.getElementById('mf-pay-btn');
    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Verifying...`;

    const token = localStorage.getItem('token');

    try {
        const verifyRes = await fetch('/api/student-fees/verify-payment', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                razorpay_order_id: orderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: signature
            })
        });

        const result = await verifyRes.json();

        if (result.success) {
            let userData = JSON.parse(localStorage.getItem('userData') || '{}');
            userData.feesStatus = 'paid';
            localStorage.setItem('userData', JSON.stringify(userData));

            btn.innerHTML = `<i class="fas fa-check"></i> Paid!`;
            btn.style.background = "#10b981";

            // Reload UI
            setTimeout(loadMyFees, 1500);
        } else {
            throw new Error(result.message || "Payment verification failed");
        }
    } catch (err) {
        alert(err.message || 'Verification failed. Contact admin.');
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-credit-card"></i> Pay Now`;
    }
}

async function downloadMyReceipt() {
    const btn = document.getElementById('mf-receipt-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating...`;
    btn.disabled = true;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/student-fees/receipt', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();

        if (!result.success) throw new Error(result.message);

        const data = result.data;
        const html = `
            <div style="padding: 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; background: #fff;">
                <div style="border-bottom: 2px solid #0A66FF; padding-bottom: 20px; display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h1 style="color: #0A66FF; margin: 0 0 5px 0;">Smart School System</h1>
                        <p style="margin: 0; color: #666;">Fees Payment Receipt</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0; color: #333;">RECEIPT</h2>
                        <b style="color: #666; font-size: 14px;">#${data.receiptNumber}</b><br>
                        <span style="color: #666; font-size: 14px;">Date: ${new Date(data.paymentDate).toLocaleDateString()}</span>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; margin-top: 30px;">
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: #666; text-transform: uppercase;">Student Details</h4>
                        <p style="margin: 0 0 5px 0;"><strong>Name:</strong> ${data.studentName}</p>
                        <p style="margin: 0 0 5px 0;"><strong>Class:</strong> ${data.className}</p>
                    </div>
                    <div style="text-align: right;">
                        <h4 style="margin: 0 0 10px 0; color: #666; text-transform: uppercase;">Payment Info</h4>
                        <p style="margin: 0 0 5px 0;"><strong>Method:</strong> ${data.paymentMethod}</p>
                        <p style="margin: 0 0 5px 0;"><strong>Transaction ID:</strong> ${data.transactionId}</p>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-top: 40px;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Description</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Class</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e2e8f0;">Amount Paid</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 15px 12px; border-bottom: 1px solid #e2e8f0;">Class Fees</td>
                            <td style="padding: 15px 12px; border-bottom: 1px solid #e2e8f0;">${data.className}</td>
                            <td style="padding: 15px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${data.paidAmount}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
                    <table style="width: 300px;">
                        <tr>
                            <td style="padding: 8px; font-weight: bold; font-size: 18px; color: #0f172a;">Total Paid:</td>
                            <td style="padding: 8px; text-align: right; font-weight: bold; font-size: 18px; color: #10b981;">₹${data.paidAmount}</td>
                        </tr>
                    </table>
                </div>

                <div style="margin-top: 60px; text-align: center; color: #94a3b8; font-size: 13px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                    <p>This is a computer-generated receipt and does not require a physical signature.</p>
                </div>
            </div>
        `;

        const opt = {
            margin: 0.5,
            filename: `Receipt_${data.receiptNumber}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container);

        await html2pdf().set(opt).from(container).save();
        document.body.removeChild(container);

    } catch (err) {
        console.error(err);
        alert(err.message || 'Failed to download receipt');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
