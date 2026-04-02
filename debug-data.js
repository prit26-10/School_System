const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Exam = require('./models/Exam');
const ExamTimetable = require('./models/ExamTimetable');
const User = require('./models/User');

dotenv.config();

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const exams = await Exam.find({});
    console.log('Exams found:', exams.length);
    if (exams.length > 0) {
      console.log('Exam 1:', exams[0].name, 'End Date:', exams[0].endDate);
    }

    const timetable = await ExamTimetable.find({});
    console.log('Timetable entries found:', timetable.length);
    if (timetable.length > 0) {
      console.log('Timetable 1:', 'ExamId:', timetable[0].examId, 'Class:', timetable[0].class);
    }

    const students = await User.find({ role: 'student' });
    console.log('Students found:', students.length);
    if (students.length > 0) {
      console.log('Student 1:', students[0].name, 'Class:', students[0].studentData.class);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
