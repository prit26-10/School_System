const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis");
const { autoSeedClasses } = require("./controllers/Admin/classSubjectController");

dotenv.config();

// Connect to Database
connectDB();
connectRedis();

// Auto-seed classes on server startup
(async () => {
    try {
        // Wait a bit for DB connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 2000));
        const result = await autoSeedClasses();
        console.log('[Server] Auto-seed result:', result);
    } catch (error) {
        console.error('[Server] Auto-seed failed:', error.message);
    }
})();

const app = express();

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use((req, res, next) => {
    if (req.url.includes('notices')) {
        console.log(`[DEBUG-NOTICE] ${req.method} ${req.url}`);
    }
    next();
});

// API Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/admission", require("./routes/admissionRoutes"));
app.use("/api/students", require("./routes/studentRoutes"));
app.use("/api/teachers", require("./routes/teacherRoutes"));
app.use("/api/quizzes", require("./routes/quizRoutes"));
app.use("/api/teacher-availability", require("./routes/teacherAvailabilityRoutes"));
app.use("/api/sessions", require("./routes/sessionRoutes"));
app.use("/api/teacher-applications", require("./routes/teacherApplicationRoutes"));
app.use("/api/admin", require("./routes/adminManageRoutes"));
app.use("/api/class-subjects", require("./routes/classSubjectRoutes"));
app.use("/api/fees", require("./routes/feesRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/assign", require("./routes/assignRoutes"));
app.use("/api/academic-year", require("./routes/academicYearRoutes"));
app.use("/api/assignments", require("./routes/assignmentRoutes"));
//app.use("/api/live-session", require("./routes/liveSessionRoutes"));

// Static Files
app.use("/uploads", express.static("uploads"));
app.use(express.static(path.join(__dirname, "public")));

// Page Routes (HTML)
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/landing/html/index.html")));
app.get("/student-admission", (req, res) => res.sendFile(path.join(__dirname, "public/landing/html/student-admission.html")));
app.get("/job-application", (req, res) => res.sendFile(path.join(__dirname, "public/landing/html/job-application.html")));
app.get("/landing/application-success", (req, res) => res.sendFile(path.join(__dirname, "public/landing/html/application-success.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public/login/html/login.html")));
app.get("/admin/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public/admin/html/dashboard.html")));
app.get("/student/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public/student/html/studentDashboard.html")));
app.get("/teacher/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public/teacher/html/teacherdashboard.html")));

// Catch-all API 404
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: `API endpoint not found: ${req.originalUrl}`
    });
});

// Global 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, "public/login/html/login.html"));
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

module.exports = app;
