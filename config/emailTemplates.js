const emailTemplates = {
    student_added: {
        teacher: {
            subject: "Student Added Successfully",
            html: (teacherName, studentName, studentEmail) => `
                <h2>Hello ${teacherName},</h2>
                <p>You have successfully added a new student to your dashboard:</p>
                <p><b>Student Name:</b> ${studentName}</p>
                <p><b>Student Email:</b> ${studentEmail}</p>
                <p>The student can now log in and book sessions with you.</p>
                <br/>
                <p>Best regards,<br/>School System Team</p>
            `
        },
        student: {
            subject: "Welcome to the School System",
            html: (studentName, teacherName) => `
                <h2>Welcome ${studentName}!</h2>
                <p>Your account has been created by your teacher: <b>${teacherName}</b></p>
                <p>You can now log in to your dashboard and book available sessions.</p>
                <br/>
                <p>Best regards,<br/>School System Team</p>
            `
        }
    },
    
    session_assigned: {
        subject: "Session Slot Assigned",
        html: (studentName, sessionTitle, date, startTime, endTime, timezone, teacherName) => `
            <h2>Hello ${studentName},</h2>
            <p>Your session slot has been <b>successfully assigned</b>.</p>
            <p><b>Session:</b> ${sessionTitle}</p>
            <p><b>Date:</b> ${date}</p>
            <p><b>Time:</b> ${startTime} - ${endTime} (${timezone})</p>
            <p>Please log in to your dashboard to view details.</p>
            <br/>
            <p>Best regards,<br/>Your Teacher: ${teacherName}</p>
        `
    },
    
    session_cancelled: {
        subject: "Session Slot Cancelled",
        html: (studentName, sessionTitle, date, time, teacherName) => `
            <h2>Hello ${studentName},</h2>
            <p>Your session slot has been <b>cancelled</b> by your teacher.</p>
            <p><b>Session:</b> ${sessionTitle}</p>
            <p><b>Date:</b> ${date}</p>
            <p><b>Time:</b> ${time}</p>
            <p>Please log in to your dashboard to book a new session.</p>
            <br/>
            <p>Best regards,<br/>Your Teacher: ${teacherName}</p>
        `
    },

    personal_session_created: {
        subject: "New Personal Session Created",
        html: (studentName, sessionTitle, date, duration, totalSlots) => `
            <h2>Hello ${studentName}</h2>
            <p>Your personal session has been created.</p>
            <p><b>Session:</b> ${sessionTitle}</p>
            <p><b>Date:</b> ${date}</p>
            <p><b>Duration:</b> ${duration} minutes</p>
            <p><b>Total slots:</b> ${totalSlots}</p>
            <p>Please login to view your available slots.</p>
            <br/>
            <p>Best regards,<br/>School System Team</p>
        `
    }
};

module.exports = emailTemplates;
