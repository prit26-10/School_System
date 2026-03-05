const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis");
dotenv.config();
connectDB();
connectRedis();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/admission", require("./routes/admissionRoutes"));
app.use("/api/students", require("./routes/studentRoutes"));
app.use("/api/teachers", require("./routes/teacherRoutes"));
app.use("/uploads", express.static("uploads"));

app.use("/api/quizzes", require("./routes/quizRoutes"));
app.use("/api/teacher-availability", require("./routes/teacherAvailabilityRoutes"));
app.use("/api/sessions", require("./routes/sessionRoutes"));
app.use("/api/teacher-applications", require("./routes/teacherApplicationRoutes"));
app.use("/api/admin", require("./routes/adminManageRoutes"));
app.use("/api/class-subjects", require("./routes/classSubjectRoutes"));
app.use("/api/assign", require("./routes/assignRoutes"));

app.use("/api/academic-year", require("./routes/academicYearRoutes"));

// Landing page routes
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/landing/html/index.html")));
app.get("/student-admission", (req, res) => res.sendFile(path.join(__dirname, "public/landing/html/student-admission.html")));
app.get("/job-application", (req, res) => res.sendFile(path.join(__dirname, "public/landing/html/job-application.html")));
app.get("/landing/application-success", (req, res) => res.sendFile(path.join(__dirname, "public/landing/html/application-success.html")));

// Legacy route for old index.html (login page)
app.get("/old", (req, res) => res.sendFile(path.join(__dirname, "public/login.html")));

// Login page
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public/login.html")));

// Admin dashboard route
app.get("/admin/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public/admin/dashboard.html")));

// 404 Handler for API routes
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: `API endpoint not found: ${req.originalUrl}`
    });
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
