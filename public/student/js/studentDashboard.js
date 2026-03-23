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

document.addEventListener('DOMContentLoaded', function () {
    // Check if student is logged in
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    if (!token) {
        window.location.href = '/login';
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
        case 'join-session':
            loadLiveSessions();
            startLiveSessionsPolling(); // Start polling
            break;
        case 'view-results':
            loadResults();
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
        const [timetableRes, sessionsRes] = await Promise.all([
            fetch('/api/students/me/timetable', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/live-session/today', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (timetableRes.status === 401 || sessionsRes.status === 401) {
            window.location.href = '/login';
            return;
        }

        const timetableResult = await timetableRes.json();
        const sessionsResult = await sessionsRes.json();

        if (!timetableResult.success || !timetableResult.data || !timetableResult.data.timetable) {
            container.innerHTML = `<div style="text-align: center; color: #64748b; font-size: 13px;">No schedule found for today.</div>`;
            return;
        }

        const timetableGrid = timetableResult.data.timetable;
        const liveSessions = sessionsResult.success ? (sessionsResult.data || []) : [];

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayDay = days[new Date().getDay()];
        const todayClasses = timetableGrid[todayDay] || [];

        if (todayClasses.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #64748b; font-size: 13px;">No classes scheduled for today (${todayDay}).</div>`;
            return;
        }

        // Sort chronologically
        todayClasses.sort((a, b) => {
            const timeA = new Date(`1970/01/01 ${a.startTime}`).getTime();
            const timeB = new Date(`1970/01/01 ${b.startTime}`).getTime();
            return timeA - timeB;
        });

        const classNameDisplay = currentUser && currentUser.class ? `Class ${currentUser.class}` : 'Your Class';

        container.innerHTML = todayClasses.map(cls => {
            // Match with live session
            const liveSession = liveSessions.find(s =>
                s.subjectName?.trim().toLowerCase() === cls.subjectName?.trim().toLowerCase() &&
                s.startTime?.trim() === cls.startTime?.trim()
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

            const numericClass = currentUser && currentUser.class ? currentUser.class : 'N/A';

            return `
                <div class="schedule-item" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                    <div style="display: flex; align-items: center; gap: 20px; flex: 1;">
                        <div class="schedule-time" style="min-width: 85px; font-weight: 700; color: #2563eb; font-size: 14px;">${cls.startTime}</div>
                        <div class="schedule-info">
                            <div style="font-weight: 600; color: #1e293b; font-size: 15px; margin-bottom: 2px;">${cls.subjectName}</div>
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

// Placeholder functions for missing HTML interaction handlers
window.tcNavigateMonth = function (dir) {
    console.log('Navigate month:', dir);
    // Future: implement full calendar logic
};

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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
