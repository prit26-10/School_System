/**
 * Live Class Functions
 * ====================
 */

// Store for today's schedule data
let todayScheduleData = [];
let liveSessionsData = [];
let currentAttendanceSessionId = null; // tracks which session's attendance modal is open

/**
 * Render Manage Live Class Page
 */
function renderManageLiveClass() {
    return `
        <div class="live-class-container">
            <div style="background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                <!-- Header Section -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <div>
                        <h2 style="margin: 0; font-size: 24px; font-weight: 600; color: #0f172a;">Today's Live Sessions</h2>
                        <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">
                            ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </p>
                    </div>
                    <button class="btn" onclick="refreshLiveSessions()" style="border-radius: 12px; padding: 10px 16px; font-size: 14px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; font-weight: 500; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>

                <!-- Today's Classes Cards -->
                <div id="today-classes-container" class="today-classes-grid">
                    ${Components.LoadingState('Loading today\'s schedule...')}
                </div>


            </div>
        </div>

        <style>
            .today-classes-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 16px;
                margin-top: 20px;
            }
            @media (max-width: 1200px) {
                .today-classes-grid {
                    grid-template-columns: repeat(3, 1fr);
                }
            }
            @media (max-width: 992px) {
                .today-classes-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
            @media (max-width: 576px) {
                .today-classes-grid {
                    grid-template-columns: 1fr;
                }
            }
            .class-card {
                background: #fff;
                border-radius: 12px;
                padding: 20px;
                border: 1px solid #e2e8f0;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                min-height: 160px;
                box-shadow: 0 1px 2px rgba(0,0,0,0.03);
            }
            .class-card:hover {
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                transform: translateY(-2px);
            }
            .class-card.active-session {
                border-color: #ef4444;
                box-shadow: 0 4px 15px rgba(239, 68, 68, 0.08);
            }
            .class-card-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 12px;
            }
            .class-subject {
                font-size: 16px;
                font-weight: 600;
                color: #0f172a;
                margin: 0;
            }
            .class-name {
                font-size: 13px;
                color: #64748b;
                margin-top: 2px;
                font-weight: 500;
            }
            .class-time {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 13px;
                color: #64748b;
                margin-top: auto;
                padding-top: 12px;
                border-top: 1px solid #f1f5f9;
            }
            .class-actions {
                margin-top: 16px;
                display: flex;
                gap: 8px;
            }
            .status-badge {
                padding: 4px 8px;
                border-radius: 8px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }
            .status-scheduled {
                background: #f1f5f9;
                color: #475569;
            }
            .status-live {
                background: #fee2e2;
                color: #dc2626;
                animation: pulse 2s infinite;
            }
            .status-ended {
                background: #f1f5f9;
                color: #94a3b8;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.8; }
            }
            .btn-action {
                flex: 1;
                padding: 10px;
                border: none;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                transition: background 0.2s;
            }
            .btn-start-live {
                background: #10b981;
                color: #fff;
            }
            .btn-start-live:hover {
                background: #059669;
            }
            .btn-start-live:disabled {
                background: #f1f5f9;
                color: #94a3b8;
                cursor: not-allowed;
            }
            .btn-join-live {
                background: #10b981;
                color: #fff;
            }
            .btn-join-live:hover {
                background: #059669;
            }
            .btn-notify-sm {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                color: #475569;
                padding: 8px;
                border-radius: 8px;
                cursor: pointer;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }
            .btn-notify-sm:hover {
                background: #f1f5f9;
            }
            #live-sessions-container {
                max-height: 400px;
                overflow-y: auto;
            }
            .session-list-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                border-bottom: 1px solid #f1f5f9;
                transition: background 0.2s;
            }
            .session-list-item:hover {
                background: #f8fafc;
            }
            .session-list-item:last-child {
                border-bottom: none;
            }
            .session-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .session-title {
                font-weight: 600;
                color: #0f172a;
                font-size: 15px;
            }
            .session-meta {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                color: #64748b;
            }
            .session-actions {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            .btn-sm {
                padding: 6px 12px;
                border: none;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
                transition: all 0.2s;
            }
            .btn-sm.btn-join-live {
                background: #10b981;
                color: #fff;
            }
            .btn-sm.btn-join-live:hover {
                background: #059669;
            }
            .btn-sm.btn-copy-link {
                background: #f1f5f9;
                color: #475569;
            }
            .btn-sm.btn-attendance {
                background: #f1f5f9;
                color: #475569;
            }
            .btn-sm.btn-end {
                background: #fee2e2;
                color: #dc2626;
            }
        </style>
    `
}

/**
 * Render Join Live Class Page
 */
function renderJoinLiveClass() {
    return `
        <div class="live-class-container">
            <div class="content-card">
                <div class="section-header" style="border-bottom: none;">
                    <div class="header-left">
                        <i class="fas fa-sign-in-alt" style="color: #0A66FF; font-size: 24px;"></i>
                        <div>
                            <h2 style="margin: 0; font-size: 20px;">Join Live Class</h2>
                            <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">Enter meeting details to join your class</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="content-card" style="margin-top: 20px; max-width: 600px;">
                <div class="join-form" style="padding: 20px 0;">
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">Meeting ID or Link</label>
                        <input type="text" id="join-meeting-input" class="form-control" 
                            placeholder="Enter meeting ID or paste meeting link" 
                            style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 15px;">
                    </div>
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">Password (if required)</label>
                        <input type="password" id="join-password-input" class="form-control" 
                            placeholder="Enter meeting password" 
                            style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 15px;">
                    </div>
                    <button class="btn btn-primary" onclick="joinLiveClass()" 
                        style="width: 100%; padding: 14px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <i class="fas fa-video"></i> Join Live Class
                    </button>
                </div>
            </div>

            <!-- Active Sessions -->
            <div class="content-card" style="margin-top: 20px;">
                <div class="section-header">
                    <div class="header-left">
                        <i class="fas fa-broadcast-tower" style="color: #10b981;"></i>
                        <h3>Active Live Sessions</h3>
                    </div>
                </div>
                <div id="active-sessions-container">
                    ${Components.LoadingState('Loading active sessions...')}
                </div>
            </div>
        </div>
    `;
}

/**
 * Initialize Manage Live Class page
 */
async function initializeManageLiveClass() {
    await fetchTodayScheduleWithLiveStatus();
    await fetchLiveSessions();
}

/**
 * Initialize Join Live Class page
 */
async function initializeJoinLiveClass() {
    await fetchActiveSessionsForJoin();
}

/**
 * Fetch today's schedule with live session status
 */
async function fetchTodayScheduleWithLiveStatus() {
    const container = document.getElementById('today-classes-container');
    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        
        // Get today's day name
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayDay = days[new Date().getDay()];
        
        // Get teacher info from token
        let teacherId = '';
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                teacherId = payload.id || payload._id;
            } catch (e) {
                console.error('Error parsing token:', e);
            }
        }
        
        // Fetch teacher's assigned classes with timetable
        const response = await fetch('/api/teachers/assigned-classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        
        // Fetch today's live sessions
        const sessionsResponse = await fetch('/api/live-session/today', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const sessionsResult = await sessionsResponse.json();
        liveSessionsData = sessionsResult.data || [];

        if (!result.success) {
            container.innerHTML = Components.ErrorState(result.message || 'Failed to load schedule');
            return;
        }

        // Extract today's classes from timetables
        const todayClasses = [];
        
        if (result.data && result.data.length > 0) {
            result.data.forEach(classData => {
                if (classData.timetable && classData.timetable.length > 0) {
                    classData.timetable.forEach(slot => {
                        // Include the class only if it's scheduled for today AND assigned to the logged-in teacher
                        if (slot.day && slot.day.toLowerCase() === todayDay) {
                            if (teacherId && slot.teacherId && slot.teacherId.toString() !== teacherId.toString()) {
                                return;
                            }
                            todayClasses.push({
                                classId: classData._id,
                                className: classData.name || classData.class,
                                subjectName: slot.subjectName,
                                subjectCode: slot.subjectCode,
                                startTime: slot.startTime,
                                endTime: slot.endTime,
                                teacherName: slot.teacherName,
                                teacherId: slot.teacherId
                            });
                        }
                    });
                }
            });
        }

        todayScheduleData = todayClasses.sort((a, b) => a.startTime.localeCompare(b.startTime));

        if (todayClasses.length === 0) {
            container.innerHTML = Components.EmptyState('calendar-day', 'No Classes Today', 'You have no scheduled classes for today.');
            return;
        }

        renderTodayClasses(todayClasses);
    } catch (error) {
        console.error('Error fetching today\'s schedule:', error);
        container.innerHTML = Components.ErrorState('Failed to load today\'s schedule');
    }
}

/**
 * Render today's class cards
 */
function renderTodayClasses(classes) {
    const container = document.getElementById('today-classes-container');
    if (!container) return;

    const html = classes.map((cls, index) => {
        // Check if a live session exists for this class
        const existingSession = liveSessionsData.find(s => {
            const sClassId = s.classId && s.classId._id ? s.classId._id.toString() : (s.classId ? s.classId.toString() : '');
            const cClassId = cls.classId ? cls.classId.toString() : '';
            return sClassId === cClassId && 
                   s.subjectName === cls.subjectName &&
                   s.startTime === cls.startTime;
        });

        const hasLiveSession = !!existingSession;
        const isLive = hasLiveSession && existingSession.status === 'live';
        const isEnded = hasLiveSession && existingSession.status === 'ended';

        // Time restriction logic: enable button 10 mins before start up to end time
        let isTimeValid = false;
        let timeMessage = '';

        if (!hasLiveSession) {
            const now = new Date();
            const currentHours = now.getHours();
            const currentMinutes = now.getMinutes();
            const currentTotalMinutes = currentHours * 60 + currentMinutes;

            const [startH, startM] = cls.startTime.split(':').map(Number);
            const startTotalMinutes = startH * 60 + startM;

            const [endH, endM] = cls.endTime.split(':').map(Number);
            const endTotalMinutes = endH * 60 + endM;

            if (currentTotalMinutes >= startTotalMinutes - 10 && currentTotalMinutes <= endTotalMinutes) {
                isTimeValid = true;
            } else if (currentTotalMinutes < startTotalMinutes - 10) {
                timeMessage = 'Starts soon';
            } else {
                timeMessage = 'Missed';
            }
        }

        return `
            <div class="class-card ${isLive ? 'active-session' : ''}" data-index="${index}">
                <div class="class-card-header">
                    <div>
                        <h4 class="class-subject">${escapeHtml(cls.subjectName)}</h4>
                        <p class="class-name">${escapeHtml(cls.className)}</p>
                    </div>
                    <span class="status-badge ${isLive ? 'status-live' : isEnded ? 'status-ended' : 'status-scheduled'}" style="${isEnded ? 'background: #d1fae5; color: #059669;' : ''}">
                        ${isLive ? '🔴 LIVE' : isEnded ? 'Completed' : 'Scheduled'}
                    </span>
                </div>
                <div class="class-time">
                    <i class="fas fa-clock" style="font-size: 13px; color: #94a3b8;"></i>
                    <span>${cls.startTime} - ${cls.endTime}</span>
                </div>
                <div class="class-actions">
                    ${!hasLiveSession ? `
                        <button class="btn-action btn-start-live" onclick="startLiveSession(${index})" ${!isTimeValid ? 'disabled' : ''}>
                            <i class="fas fa-play" style="font-size: 12px;"></i> ${isTimeValid ? 'Start' : timeMessage}
                        </button>
                    ` : isLive ? `
                        <button class="btn-action btn-join-live" onclick="joinSession('${existingSession._id}')">
                            <i class="fas fa-video"></i> Join
                        </button>
                        <button class="btn-notify-sm" onclick="copyMeetingLink('${existingSession.meetingLink}')" title="Copy Link">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn-notify-sm" onclick="openAttendanceModal('${existingSession._id}')" title="Attendance">
                            <i class="fas fa-user-check"></i>
                        </button>
                        <button class="btn-notify-sm" onclick="endLiveSession('${existingSession._id}')" title="End Session" style="color: #dc2626;">
                            <i class="fas fa-stop"></i>
                        </button>
                    ` : hasLiveSession && !isEnded ? `
                        <button class="btn-action btn-join-live" onclick="joinSession('${existingSession._id}')">
                            <i class="fas fa-play"></i> Start
                        </button>
                    ` : `
                        <div class="completed-status" style="width: 100%; text-align: center; padding: 10px; background: #f8fafc; color: #059669; font-weight: 600; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <i class="fas fa-check-circle"></i> Completed
                        </div>
                    `}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * Start a new live session
 */
async function startLiveSession(classIndex) {
    const classData = todayScheduleData[classIndex];
    if (!classData) {
        showToast('Class data not found', 'error');
        return;
    }

    const btn = document.querySelector(`.class-card[data-index="${classIndex}"] .btn-start-live`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
    }

    try {
        const token = localStorage.getItem('token');
        const today = new Date().toISOString().split('T')[0];

        const response = await fetch('/api/live-session/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                classId: classData.classId,
                subjectName: classData.subjectName,
                subjectCode: classData.subjectCode || '',
                scheduledDate: today,
                startTime: classData.startTime,
                endTime: classData.endTime,
                description: `Live class for ${classData.subjectName} - ${classData.className}`
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Live session started successfully!', 'success');
            
            const session = result.data;

            // Mark session as live immediately so students can join
            try {
                await fetch(`/api/live-session/${session._id}/start`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                session.status = 'live'; // Update status for state tracking
            } catch (err) {
                console.error('Error marking session as live:', err);
            }

            if (typeof liveSessionsData !== 'undefined' && liveSessionsData) {
                liveSessionsData.push(session);
            }

            // Update UI Snappily without full page reload
            const classCard = document.querySelector(`.class-card[data-index="${classIndex}"]`);
            if (classCard) {
                classCard.classList.add('active-session');
                
                const statusBadge = classCard.querySelector('.status-badge');
                if (statusBadge) {
                    statusBadge.className = 'status-badge status-live';
                    statusBadge.innerHTML = '🔴 LIVE';
                }

                const actionsDiv = classCard.querySelector('.class-actions');
                if (actionsDiv) {
                    actionsDiv.innerHTML = `
                        <button class="btn-action btn-join-live" onclick="joinSession('${session._id}')">
                            <i class="fas fa-video"></i> Join
                        </button>
                        <button class="btn-notify-sm" onclick="copyMeetingLink('${session.meetingLink}')" title="Copy Link">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn-notify-sm" onclick="openAttendanceModal('${session._id}')" title="Attendance">
                            <i class="fas fa-user-check"></i>
                        </button>
                        <button class="btn-notify-sm" onclick="endLiveSession('${session._id}')" title="End Session" style="color: #dc2626;">
                            <i class="fas fa-stop"></i>
                        </button>
                    `;
                }
            }
        } else {
            showToast(result.message || 'Failed to start live session', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-video"></i> Start Live Session';
            }
        }
    } catch (error) {
        console.error('Error starting live session:', error);
        showToast('Failed to start live session', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-video"></i> Start Live Session';
        }
    }
}

/**
 * Join a live session
 */
async function joinSession(sessionId) {
    try {
        const token = localStorage.getItem('token');
        
        const response = await fetch(`/api/live-session/${sessionId}/join`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (result.success) {
            // Open the meeting link in a new window
            window.open(result.data.meetingLink, '_blank', 'width=1200,height=800');
            
            // If session was scheduled, update it to live
            if (result.data.status === 'scheduled') {
                await fetch(`/api/live-session/${sessionId}/start`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
        } else {
            showToast(result.message || 'Failed to join session', 'error');
        }
    } catch (error) {
        console.error('Error joining session:', error);
        showToast('Failed to join session', 'error');
    }
}

/**
 * End a live session
 */
async function endLiveSession(sessionId) {
    if (!confirm('Are you sure you want to end this live session?')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        
        const response = await fetch(`/api/live-session/${sessionId}/end`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (result.success) {
            showToast('Session ended successfully', 'success');
            await initializeManageLiveClass();
        } else {
            showToast(result.message || 'Failed to end session', 'error');
        }
    } catch (error) {
        console.error('Error ending session:', error);
        showToast('Failed to end session', 'error');
    }
}

/**
 * Copy meeting link to clipboard
 */
function copyMeetingLink(link) {
    navigator.clipboard.writeText(link).then(() => {
        showToast('Meeting link copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy link', 'error');
    });
}

/**
 * Send notification to students
 */
async function sendSessionNotification(sessionId) {
    try {
        const token = localStorage.getItem('token');
        
        const response = await fetch(`/api/live-session/${sessionId}/notify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                message: 'Your live class is starting now! Please join using the meeting link.'
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast(`Notification sent to ${result.data.recipients} students`, 'success');
        } else {
            showToast(result.message || 'Failed to send notification', 'error');
        }
    } catch (error) {
        console.error('Error sending notification:', error);
        showToast('Failed to send notification', 'error');
    }
}

/**
 * Open attendance modal
 */
function openAttendanceModal(sessionId) {
    currentAttendanceSessionId = sessionId;
    // Load session details with students
    loadSessionAttendance(sessionId);
}

/**
 * Close attendance modal
 */
function closeAttendanceModal() {
    const modal = document.getElementById('attendance-modal');
    if (modal) modal.style.display = 'none';
    currentAttendanceSessionId = null;
}

/**
 * Load session attendance
 */
async function loadSessionAttendance(sessionId) {
    try {
        const token = localStorage.getItem('token');
        
        const response = await fetch(`/api/live-session/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (result.success) {
            const session = result.data;
            
            // Get students from the class
            const studentsResponse = await fetch(`/api/teachers/assigned-classes/${session.classId._id}/students`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const studentsResult = await studentsResponse.json();
            
            renderAttendanceModal(session, studentsResult.data || []);
        } else {
            showToast(result.message || 'Failed to load session', 'error');
        }
    } catch (error) {
        console.error('Error loading attendance:', error);
        showToast('Failed to load attendance data', 'error');
    }
}

/**
 * Render attendance modal
 */
function renderAttendanceModal(session, students) {
    const titleEl = document.getElementById('attendance-modal-title');
    const bodyEl = document.getElementById('attendance-modal-body');
    const modal = document.getElementById('attendance-modal');

    if (titleEl) titleEl.textContent = 'Mark Attendance — ' + session.subjectName;

    if (!students || students.length === 0) {
        if (bodyEl) bodyEl.innerHTML = '<div style="padding:32px 24px;text-align:center;color:#94a3b8;"><i class="fas fa-users" style="font-size:36px;margin-bottom:12px;"></i><p>No students found for this class.</p></div>';
        if (modal) modal.style.display = 'flex';
        return;
    }

    // Build attendance map from existing session attendance
    const attendanceMap = {};
    (session.attendance || []).forEach(a => {
        attendanceMap[a.studentId._id || a.studentId] = a.status;
    });

    const rows = students.map(student => {
        const status = attendanceMap[student._id] || 'absent';
        return `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:13px 16px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:34px;height:34px;background:#eff6ff;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <i class="fas fa-user" style="color:#0A66FF;font-size:13px;"></i>
                        </div>
                        <span style="font-weight:500;color:#0f172a;font-size:14px;">${escapeHtml(student.name)}</span>
                    </div>
                </td>
                <td style="padding:13px 16px;color:#64748b;font-size:14px;">${student.rollNo || '—'}</td>
                <td style="padding:13px 16px;">
                    <select class="attendance-status" data-student-id="${student._id}" data-student-name="${escapeHtml(student.name)}"
                        style="padding:7px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#374151;background:#f8fafc;cursor:pointer;outline:none;">
                        <option value="present" ${status === 'present' ? 'selected' : ''}>✅ Present</option>
                        <option value="absent" ${status === 'absent' ? 'selected' : ''}>❌ Absent</option>
                        <option value="late" ${status === 'late' ? 'selected' : ''}>⏰ Late</option>
                    </select>
                </td>
            </tr>
        `;
    }).join('');

    if (bodyEl) bodyEl.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
            <thead>
                <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                    <th style="padding:11px 16px;text-align:left;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Student</th>
                    <th style="padding:11px 16px;text-align:left;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Roll No</th>
                    <th style="padding:11px 16px;text-align:left;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Status</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    if (modal) {
        modal.style.display = 'flex';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(15,23,42,0.45)';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9998';
    }
}

/**
 * Save attendance (called from the footer Save button in the attendance modal)
 */
async function doSaveAttendance() {
    const sessionId = currentAttendanceSessionId;
    if (!sessionId) {
        showToast('No session selected', 'error');
        return;
    }

    const saveBtn = document.getElementById('attendance-save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    const selects = document.querySelectorAll('.attendance-status');
    const attendance = Array.from(selects).map(select => ({
        studentId: select.dataset.studentId,
        studentName: select.dataset.studentName,
        status: select.value
    }));

    try {
        const token = localStorage.getItem('token');

        const response = await fetch(`/api/live-session/${sessionId}/attendance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ attendance })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Attendance saved successfully!', 'success');
            closeAttendanceModal();

            // Auto-refresh: if currently on the attendance page, reload its data
            if (typeof AppState !== 'undefined') {
                const ap = AppState.activePage;
                if (ap === 'attendance' || ap === 'view-attendance' || ap === 'edit-attendance' || ap === 'submit-attendance') {
                    if (typeof loadAttendanceForClass === 'function') {
                        const filter = document.getElementById('attendance-class-filter');
                        loadAttendanceForClass(filter ? filter.value : '');
                    }
                }
                // Also refresh dashboard stats
                if (ap === 'dashboard' && typeof fetchDashboardData === 'function') {
                    fetchDashboardData();
                }
            }
        } else {
            showToast(result.message || 'Failed to save attendance', 'error');
        }
    } catch (error) {
        console.error('Error saving attendance:', error);
        showToast('Failed to save attendance', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Attendance';
        }
    }
}

/**
 * Fetch all live sessions for the teacher
 */
async function fetchLiveSessions() {
    const container = document.getElementById('live-sessions-container');
    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        
        const response = await fetch('/api/live-session/today', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
            renderLiveSessionsList(result.data);
        } else {
            container.innerHTML = Components.EmptyState('video', 'No Live Sessions', 'You haven\'t created any live sessions yet.');
        }
    } catch (error) {
        console.error('Error fetching live sessions:', error);
        container.innerHTML = Components.ErrorState('Failed to load live sessions');
    }
}

/**
 * Render live sessions list
 */
function renderLiveSessionsList(sessions) {
    const container = document.getElementById('live-sessions-container');
    if (!container) return;

    const html = sessions.map(session => {
        const isLive = session.status === 'live';
        const isScheduled = session.status === 'scheduled';
        const isEnded = session.status === 'ended';
        const dateStr = new Date(session.scheduledDate).toLocaleDateString();

        return `
            <div class="session-list-item">
                <div class="session-info">
                    <div class="session-title">${escapeHtml(session.subjectName)} - ${escapeHtml(session.className)}</div>
                    <div class="session-meta">
                        <span class="status-badge ${isLive ? 'status-live' : isScheduled ? 'status-scheduled' : 'status-ended'}">
                            ${isLive ? '🔴 LIVE' : isScheduled ? 'Scheduled' : 'Ended'}
                        </span>
                        <span style="margin-left: 10px;">
                            <i class="fas fa-calendar"></i> ${dateStr} 
                            <i class="fas fa-clock" style="margin-left: 8px;"></i> ${session.startTime} - ${session.endTime}
                        </span>
                    </div>
                </div>
                <div class="session-actions">
                    ${isLive ? `
                        <button class="btn-sm btn-join-live" onclick="joinSession('${session._id}')">
                            <i class="fas fa-sign-in-alt"></i> Join
                        </button>
                        <button class="btn-sm btn-copy-link" onclick="copyMeetingLink('${session.meetingLink}')" title="Copy Link">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn-sm btn-end" onclick="endLiveSession('${session._id}')" title="End">
                            <i class="fas fa-stop"></i>
                        </button>
                    ` : isScheduled ? `
                        <button class="btn-sm btn-join-live" onclick="joinSession('${session._id}')">
                            <i class="fas fa-sign-in-alt"></i> Join
                        </button>
                        <button class="btn-sm btn-copy-link" onclick="copyMeetingLink('${session.meetingLink}')" title="Copy Link">
                            <i class="fas fa-copy"></i>
                        </button>
                    ` : `
                        <!-- No actions for ended sessions -->
                    `}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * Refresh live sessions
 */
async function refreshLiveSessions() {
    const btn = document.querySelector('.btn-primary[onclick="refreshLiveSessions()"]');
    if (btn) {
        const icon = btn.querySelector('i');
        icon.classList.add('fa-spin');
    }
    
    await initializeManageLiveClass();
    
    if (btn) {
        const icon = btn.querySelector('i');
        icon.classList.remove('fa-spin');
    }
    
    showToast('Sessions refreshed', 'success');
}

/**
 * Join live class from form
 */
function joinLiveClass() {
    const meetingInput = document.getElementById('join-meeting-input');
    const passwordInput = document.getElementById('join-password-input');
    
    if (!meetingInput || !meetingInput.value.trim()) {
        showToast('Please enter a meeting ID or link', 'error');
        return;
    }
    
    const input = meetingInput.value.trim();
    let meetingLink = input;
    
    // If input looks like a meeting ID, construct Zoom URL
    if (/^\d+$/.test(input)) {
        meetingLink = `https://zoom.us/j/${input}`;
        if (passwordInput && passwordInput.value.trim()) {
            meetingLink += `?pwd=${passwordInput.value.trim()}`;
        }
    }
    
    window.open(meetingLink, '_blank', 'width=1200,height=800');
}

/**
 * Fetch active sessions for join page
 */
async function fetchActiveSessionsForJoin() {
    const container = document.getElementById('active-sessions-container');
    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        
        const response = await fetch('/api/live-session/my-sessions?status=live,scheduled&limit=10', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
            const activeSessions = result.data.filter(s => s.status === 'live' || s.status === 'scheduled');
            
            if (activeSessions.length === 0) {
                container.innerHTML = Components.EmptyState('broadcast-tower', 'No Active Sessions', 'There are no active or scheduled live sessions right now.');
                return;
            }

            const html = activeSessions.map(session => {
                const isLive = session.status === 'live';
                return `
                    <div class="session-list-item" style="border: 1px solid ${isLive ? '#fee2e2' : '#fef3c7'}; border-radius: 8px; margin-bottom: 12px;">
                        <div class="session-info">
                            <div class="session-title">
                                ${isLive ? '🔴 ' : ''}${escapeHtml(session.subjectName)} - ${escapeHtml(session.className)}
                            </div>
                            <div class="session-meta">
                                <span class="status-badge ${isLive ? 'status-live' : 'status-scheduled'}">
                                    ${isLive ? 'LIVE NOW' : 'Scheduled'}
                                </span>
                                <span style="margin-left: 10px;">
                                    <i class="fas fa-user"></i> ${session.teacherName}
                                </span>
                                <span style="margin-left: 10px;">
                                    <i class="fas fa-clock"></i> ${session.startTime} - ${session.endTime}
                                </span>
                            </div>
                        </div>
                        <div class="session-actions">
                            <button class="btn-sm btn-join-live" onclick="joinSession('${session._id}')">
                                <i class="fas fa-sign-in-alt"></i> ${isLive ? 'Join Now' : 'Start'}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = html;
        } else {
            container.innerHTML = Components.EmptyState('broadcast-tower', 'No Active Sessions', 'There are no active or scheduled live sessions right now.');
        }
    } catch (error) {
        console.error('Error fetching active sessions:', error);
        container.innerHTML = Components.ErrorState('Failed to load active sessions');
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Remove any existing toasts
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${escapeHtml(message)}</span>
        </div>
    `;
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#0A66FF'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 9999;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add animations to document
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

/**
 * Open modal
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

/**
 * Close modal
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}
