/**
 * Online Exam Environment - Unified Proctoring & Question Logic
 */

const examState = {
    timetableId: null,
    examData: null,
    questions: [],
    currentQuestionIndex: 0,
    answers: {}, // { questionId: answerText }
    timeLeft: 0, // in seconds
    timerInterval: null,
    stream: null,
    isExamStarted: false,
    isSubmitting: false,
    violationCount: 0
};

// ────────────────────────────────────────────────
// INITIALIZATION
// ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    examState.timetableId = urlParams.get('id');

    if (!examState.timetableId) {
        alert("Invalid exam session. Redirecting to dashboard...");
        window.location.href = "/student/html/studentDashboard.html";
        return;
    }

    await loadExamMetadata();
    setupInstructionListeners();
});

async function loadExamMetadata() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/exams/student/csv-exam-paper/${examState.timetableId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            examState.examData = result.data;
            examState.questions = result.data.questions || [];
            examState.timeLeft = (result.data.duration || 60) * 60;
            
            // Update UI
            document.getElementById('header-subject-name').textContent = result.data.subjectName;
            document.getElementById('header-exam-name').textContent = result.data.examName || "Online Examination";
            document.getElementById('exam-duration-text').textContent = result.data.duration || "--";
            
            initializeCamera();
        } else {
            alert(result.message || "Failed to load exam details.");
            window.location.href = "/student/html/studentDashboard.html";
        }
    } catch (error) {
        console.error("Error loading exam metadata:", error);
        alert("Connection error. Please check your internet.");
    }
}

// ────────────────────────────────────────────────
// CAMERA PROCTORING
// ────────────────────────────────────────────────

async function initializeCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        examState.stream = stream;
        
        const video = document.getElementById('pre-exam-video');
        video.srcObject = stream;
        
        document.getElementById('camera-loader').style.display = 'none';
        video.style.display = 'block';
        document.getElementById('btn-start-test').disabled = false;
        
        // Start periodic camera check
        startCameraMonitoring();
    } catch (err) {
        console.error("Camera access failed:", err);
        document.getElementById('camera-loader').style.display = 'none';
        document.getElementById('camera-denied').style.display = 'block';
    }
}

function startCameraMonitoring() {
    setInterval(() => {
        if (!examState.isExamStarted) return;
        
        const tracks = examState.stream.getVideoTracks();
        const isCameraOn = tracks.some(t => t.enabled && t.readyState === 'live');
        
        const blurOverlay = document.getElementById('camera-blur-overlay');
        blurOverlay.style.display = isCameraOn ? 'none' : 'flex';
    }, 2000);
}

// ────────────────────────────────────────────────
// PHASE TRANSITION: START EXAM
// ────────────────────────────────────────────────

function setupInstructionListeners() {
    document.getElementById('btn-start-test').addEventListener('click', startExamSession);
}

async function startExamSession() {
    try {
        // Enforce Full-Screen
        if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
        }

        examState.isExamStarted = true;
        
        // Switch UI Phase
        document.getElementById('phase-instructions').style.display = 'none';
        document.getElementById('phase-exam').style.display = 'flex';
        
        // Initialize Arena
        document.getElementById('arena-subject').textContent = examState.examData.subjectName;
        document.getElementById('arena-exam-title').textContent = examState.examData.examName;
        
        renderQuestionGrid();
        renderCurrentQuestion();
        startTimer();
        setupSecurityListeners();
        setupArenaListeners();

    } catch (err) {
        console.error("Failed to start full-screen:", err);
        alert("Full-screen is required to start the exam. Please allow and try again.");
    }
}

// ────────────────────────────────────────────────
// EXAM ARENA LOGIC
// ────────────────────────────────────────────────

function renderQuestionGrid() {
    const grid = document.getElementById('question-grid');
    grid.innerHTML = examState.questions.map((q, index) => `
        <div class="q-number ${index === 0 ? 'active' : ''}" id="nav-q-${index}" onclick="jumpToQuestion(${index})">
            ${index + 1}
        </div>
    `).join('');
}

function renderCurrentQuestion() {
    const q = examState.questions[examState.currentQuestionIndex];
    const container = document.getElementById('current-question-container');
    const existingAnswer = examState.answers[q._id] || "";

    // Determine type (normalize)
    const rawType = (q.questionType || '').toUpperCase();
    let type = 'DESCRIPTIVE';
    if (rawType === 'MCQ') type = 'MCQ';
    else if (rawType === 'TF' || rawType === 'TRUEFALSE') type = 'TF';

    // Build type label for badge
    const typeLabels = { MCQ: 'Multiple Choice', TF: 'True / False', DESCRIPTIVE: 'Descriptive' };
    const typeLabel = typeLabels[type] || type;

    // Build options for MCQ
    let options = q.options || [];
    // Handle pipe-separated legacy format
    if (type === 'MCQ' && options.length === 1 && options[0].includes('|')) {
        options = options[0].split('|').map(o => o.trim()).filter(Boolean);
    }
    // Handle comma-separated legacy format  
    if (type === 'MCQ' && options.length === 1 && options[0].includes(',')) {
        options = options[0].split(',').map(o => o.trim()).filter(Boolean);
    }

    const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

    let inputHtml = '';

    if (type === 'MCQ') {
        inputHtml = `<div class="mcq-options">` +
            options.map((opt, i) => {
                const letter = optionLetters[i] || (i + 1);
                const isSelected = existingAnswer === opt;
                const escapedOpt = opt.replace(/'/g, "\\'");
                return `
                    <label class="option-card ${isSelected ? 'selected' : ''}" id="opt-${q._id}-${i}">
                        <input type="radio" name="q-${q._id}" value="${opt}" 
                            ${isSelected ? 'checked' : ''} 
                            onchange="selectOption('${q._id}', '${escapedOpt}', ${i}, ${options.length})">
                        <span class="option-letter">${letter}</span>
                        <span class="option-text">${opt}</span>
                        <span class="option-check"><i class="fas fa-check"></i></span>
                    </label>`;
            }).join('') +
            `</div>`;
    } else if (type === 'TF') {
        const isTrue = existingAnswer === 'True';
        const isFalse = existingAnswer === 'False';
        inputHtml = `
            <div class="tf-options">
                <label class="option-card tf-card ${isTrue ? 'selected' : ''}">
                    <input type="radio" name="q-${q._id}" value="True" 
                        ${isTrue ? 'checked' : ''} 
                        onchange="selectTF('${q._id}', 'True')">
                    <span class="tf-icon true-icon"><i class="fas fa-check-circle"></i></span>
                    <span class="option-text">True</span>
                    <span class="option-check"><i class="fas fa-check"></i></span>
                </label>
                <label class="option-card tf-card ${isFalse ? 'selected' : ''}">
                    <input type="radio" name="q-${q._id}" value="False" 
                        ${isFalse ? 'checked' : ''} 
                        onchange="selectTF('${q._id}', 'False')">
                    <span class="tf-icon false-icon"><i class="fas fa-times-circle"></i></span>
                    <span class="option-text">False</span>
                    <span class="option-check"><i class="fas fa-check"></i></span>
                </label>
            </div>`;
    } else {
        inputHtml = `
            <div class="descriptive-wrapper">
                <label class="desc-label"><i class="fas fa-pen-fancy"></i> Write your answer below</label>
                <textarea class="descriptive-input" placeholder="Type your answer here..." 
                    oninput="saveAnswer('${q._id}', this.value)">${existingAnswer}</textarea>
                <div class="desc-footer">
                    <span class="char-count">${existingAnswer.length} characters</span>
                </div>
            </div>`;
    }

    container.innerHTML = `
        <div class="question-card">
            <div class="question-card-header">
                <div class="q-badges">
                    <span class="q-number-badge">Q${examState.currentQuestionIndex + 1}</span>
                    <span class="q-type-badge type-${type.toLowerCase()}">${typeLabel}</span>
                </div>
                <span class="q-marks-badge"><i class="fas fa-star"></i> ${q.maxMarks} Marks</span>
            </div>
            <div class="question-text">${q.questionText}</div>
            <div class="question-divider"></div>
            <div class="question-input">${inputHtml}</div>
        </div>
    `;

    // Update char count in real-time for descriptive
    if (type === 'DESCRIPTIVE') {
        const textarea = container.querySelector('.descriptive-input');
        if (textarea) {
            textarea.addEventListener('input', function() {
                const counter = container.querySelector('.char-count');
                if (counter) counter.textContent = this.value.length + ' characters';
            });
        }
    }

    document.getElementById('question-progress').textContent = `Question ${examState.currentQuestionIndex + 1} of ${examState.questions.length}`;
    updateNavSelection();
}

// Option selection handlers with visual feedback
function selectOption(qId, value, selectedIdx, totalOpts) {
    saveAnswer(qId, value);
    for (let i = 0; i < totalOpts; i++) {
        const el = document.getElementById(`opt-${qId}-${i}`);
        if (el) el.classList.toggle('selected', i === selectedIdx);
    }
}

function selectTF(qId, value) {
    saveAnswer(qId, value);
    // Re-render to update visual state
    renderCurrentQuestion();
}


function saveAnswer(qId, value) {
    examState.answers[qId] = value;
    const navItem = document.getElementById(`nav-q-${examState.currentQuestionIndex}`);
    if (value) navItem.classList.add('answered');
    else navItem.classList.remove('answered');
}

function jumpToQuestion(index) {
    examState.currentQuestionIndex = index;
    renderCurrentQuestion();
}

function setupArenaListeners() {
    document.getElementById('btn-next').onclick = () => {
        if (examState.currentQuestionIndex < examState.questions.length - 1) {
            examState.currentQuestionIndex++;
            renderCurrentQuestion();
        }
    };
    document.getElementById('btn-prev').onclick = () => {
        if (examState.currentQuestionIndex > 0) {
            examState.currentQuestionIndex--;
            renderCurrentQuestion();
        }
    };
    document.getElementById('btn-finish-exam').onclick = () => {
        if (confirm("Are you sure you want to finish the exam? This cannot be undone.")) {
            submitExamAutomated("MANUAL");
        }
    };
}

function updateNavSelection() {
    document.querySelectorAll('.q-number').forEach((el, idx) => {
        el.classList.toggle('active', idx === examState.currentQuestionIndex);
    });
}

// ────────────────────────────────────────────────
// TIMER & SECURITY
// ────────────────────────────────────────────────

function startTimer() {
    const display = document.getElementById('timer-countdown');
    
    examState.timerInterval = setInterval(() => {
        if (examState.timeLeft <= 0) {
            clearInterval(examState.timerInterval);
            submitExamAutomated("AUTO_TIMEOUT", "Time expired");
            return;
        }

        examState.timeLeft--;
        const h = Math.floor(examState.timeLeft / 3600);
        const m = Math.floor((examState.timeLeft % 3600) / 60);
        const s = examState.timeLeft % 60;
        
        display.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        
        if (examState.timeLeft < 300) display.style.color = '#ef4444'; // Red at 5 mins
    }, 1000);
}

function setupSecurityListeners() {
    // 1. Full-screen surveillance
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && examState.isExamStarted && !examState.isSubmitting) {
            handleSecurityViolation("Exited full-screen mode");
        }
    });

    // 2. Tab-switch surveillance
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && examState.isExamStarted && !examState.isSubmitting) {
            handleSecurityViolation("Tab switching detected");
        }
    });

    // 3. Prevent Right Click & Key Shortcuts
    window.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
        if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'r' || e.key === 'f' || e.key === 't')) {
            e.preventDefault();
        }
    });
}

function handleSecurityViolation(reason) {
    const overlay = document.getElementById('security-overlay');
    const msg = document.getElementById('security-msg');
    const countdownEl = document.getElementById('violation-countdown');
    
    msg.textContent = `${reason}. Auto-submitting the exam...`;
    overlay.style.display = 'flex';
    
    let countdown = 5;
    const timer = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(timer);
            submitExamAutomated("AUTO_PROCTOR", reason);
        }
    }, 1000);
}

// ────────────────────────────────────────────────
// FINAL SUBMISSION
// ────────────────────────────────────────────────

async function submitExamAutomated(type, reason = "") {
    if (examState.isSubmitting) return;
    examState.isSubmitting = true;
    
    clearInterval(examState.timerInterval);
    
    const token = localStorage.getItem('token');
    const payload = {
        answers: Object.entries(examState.answers).map(([qId, ans]) => ({
            questionId: qId,
            studentAnswer: ans
        })),
        isAutoSubmission: type !== "MANUAL",
        submissionReason: reason
    };

    try {
        const response = await fetch(`/api/exams/student/csv-submit-exam/${examState.timetableId}`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert("Exam submitted successfully!");
            // Exit Fullscreen
            if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
            window.location.href = "/student/html/studentDashboard.html";
        } else {
            alert("Submission error: " + result.message);
        }
    } catch (error) {
        console.error("Critical error during submission:", error);
        alert("Submission failed. Please contact your administrator.");
    }
}
