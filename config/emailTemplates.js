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
    },
    
    admission_approved: {
        subject: "Student Application Approved - School System",
        html: (studentName, applicationId, studentEmail, password, rollNo, className, totalFee, appUrl) => `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #4CAF50;">Congratulations!</h2>
              <p>Dear ${studentName},</p>
              <p>Your admission application (ID: ${applicationId}) has been approved.</p>
              <p>Your student account has been created. Here are your login credentials:</p>
              <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Login URL:</strong> <a href="${appUrl}/login">School Portal</a></p>
                <p><strong>Email:</strong> ${studentEmail}</p>
                <p><strong>Password:</strong> ${password}</p>
                <p><strong>Roll Number:</strong> ${rollNo}</p>
                <p><strong>Class:</strong> ${className}</p>
                <p><strong>Total Admission Fees:</strong> ₹${totalFee}</p>
              </div>
              <p style="color: #d97706; font-weight: bold;">Note: You must pay your class fees to access the full student dashboard.</p>
              <div style="text-align: center; margin-top: 25px;">
                <a href="${appUrl}/login" style="display:inline-block; padding: 12px 25px; background-color: #0A66FF; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Pay Fees Now</a>
              </div>
              <p style="margin-top: 25px;">Regards,<br>School Admissions Team</p>
            </div>
        `
    },
    
    payment_successful: {
        subject: "Fees Payment Successful",
        html: (studentName, amount, paymentId, className) => `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #4CAF50;">Payment Successful</h2>
              <p>Dear ${studentName},</p>
              <p>Your fees payment for Rs. ${amount} has been successfully received.</p>
              <p><strong>Payment ID:</strong> ${paymentId}</p>
              <p><strong>Class:</strong> ${className}</p>
              <p>You can now access your full student dashboard.</p>
              <p>Regards,<br>School Administration</p>
            </div>
        `
    },
    
    fees_reminder: {
        subject: "Pending Fees Reminder",
        html: (studentName, className, appUrl) => `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #ef4444;">Pending Fees Reminder</h2>
              <p>Dear ${studentName},</p>
              <p>This is a reminder to pay your pending class fees for ${className}.</p>
              <p>Access to your student dashboard requires your fees to be cleared.</p>
              <a href="${appUrl}/login" style="display:inline-block; padding: 10px 20px; margin-top: 10px; background-color: #0A66FF; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">Pay Now</a>
              <p>Regards,<br>School Administration</p>
            </div>
        `
    }
};

module.exports = emailTemplates;
