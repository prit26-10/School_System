const mongoose = require('mongoose');
const { generateTimetable } = require('./controllers/Admin/examController');

async function testGeneration() {
  try {
    await mongoose.connect('mongodb://localhost:27017/smart-school');
    
    // Test payload
    const req = {
      body: {
        examId: '69cb9af59b7676f1410e03da',
        timeSlots: [
          { start: "09:30", end: "12:30" },
          { start: "14:30", end: "17:30" }
        ]
      }
    };
    
    // Mock response object
    const res = {
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.data = data; return this; }
    };

    await generateTimetable(req, res);
    
    console.log(JSON.stringify(res.data, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Test Failed:', error);
    process.exit(1);
  }
}

testGeneration();
