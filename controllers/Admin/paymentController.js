const StudentPayment = require("../../models/StudentPayment");
const ClassFees = require("../../models/ClassFees");
const User = require("../../models/User");
const ClassSubject = require("../../models/ClassSubject");

// @desc    Get all students with payment data
// @route   GET /api/payments/students
// @access  Admin
exports.getStudentsWithPayments = async (req, res) => {
  try {
    const { class_id, status } = req.query;
    
    // Get classes that have fees defined (filter out null classId references)
    const classesWithFees = await ClassFees.find({ classId: { $ne: null } }).populate('classId');
    const classIdsWithFees = classesWithFees
      .filter(cf => cf.classId && cf.classId._id)
      .map(cf => cf.classId._id.toString());
    
    // Get all students
    const students = await User.find({ role: "student" }).sort({ name: 1 });
    
    // Get class information for each student
    const studentsWithClassInfo = [];
    for (const student of students) {
      if (student.class) {
        // Try to match student class with available classes
        let classSubject = null;
        
        // Handle different naming conventions
        if (student.class === '10th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 10' });
        } else if (student.class === '11th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 11' });
        } else if (student.class === '12th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 12' });
        } else if (student.class === '9th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 9' });
        } else if (student.class === '8th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 8' });
        } else if (student.class === '7th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 7' });
        } else if (student.class === '6th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 6' });
        } else if (student.class === '5th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 5' });
        } else if (student.class === '4th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 4' });
        } else if (student.class === '3rd' || student.class === '3th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 3' });
        } else if (student.class === '2nd' || student.class === '2th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 2' });
        } else if (student.class === '1st' || student.class === '1th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 1' });
        } else {
          // Try direct match first
          classSubject = await ClassSubject.findOne({ name: student.class });
          
          // If not found, try to extract class number
          if (!classSubject) {
            const classMatch = student.class.match(/\d+/);
            if (classMatch) {
              const classNum = classMatch[0];
              classSubject = await ClassSubject.findOne({ name: `Class ${classNum}` });
            }
          }
        }
        
        // Only include students whose class has fees defined
        if (classSubject && classIdsWithFees.includes(classSubject._id.toString())) {
          studentsWithClassInfo.push({
            ...student.toObject(),
            classInfo: classSubject
          });
        }
      }
    }
    
    // Filter by class if specified
    let filteredStudents = studentsWithClassInfo;
    if (class_id) {
      filteredStudents = studentsWithClassInfo.filter(s => 
        s.classInfo && s.classInfo._id.toString() === class_id
      );
    }
    
    // Get payment records for these students
    const studentIds = filteredStudents.map(s => s._id);
    const payments = await StudentPayment.find({ studentId: { $in: studentIds } });
    
    // Create payment map
    const paymentMap = new Map();
    payments.forEach(payment => {
      paymentMap.set(payment.studentId.toString(), payment);
    });
    
    const result = [];
    
    for (const student of filteredStudents) {
      // Get class fees
      let totalFees = 0;
      const classFee = await ClassFees.findOne({ classId: student.classInfo._id });
      if (classFee) {
        totalFees = classFee.totalFee;
      }
      
      // Get payment record
      const payment = paymentMap.get(student._id.toString());
      
      let paymentStatus = "pending";
      let paidAmount = 0;
      let dueDate = new Date(new Date().setMonth(new Date().getMonth() + 1));
      
      if (payment) {
        paymentStatus = payment.paymentStatus;
        paidAmount = payment.paidAmount;
        dueDate = payment.dueDate;
      }
      
      result.push({
        student_id: student._id,
        student_name: student.name,
        class_name: student.classInfo.name,
        total_fees: totalFees,
        paid_amount: paidAmount,
        status: paymentStatus,
        due_date: dueDate,
        class_id: student.classInfo._id
      });
    }
    
    // Filter by status if specified
    if (status && status !== 'all') {
      return res.status(200).json({
        success: true,
        data: result.filter(r => r.status === status),
      });
    }
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Error in getStudentsWithPayments:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get fees collection overview
// @route   GET /api/payments/collection-overview
// @access  Admin
exports.getFeesCollectionOverview = async (req, res) => {
  try {
    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get all students with payment data
    const studentsWithPayments = await getStudentsWithPaymentsData();
    
    // Calculate totals
    let totalExpected = 0;
    let totalCollected = 0;
    let totalPending = 0;
    
    for (const student of studentsWithPayments) {
      totalExpected += student.total_fees;
      totalCollected += student.paid_amount;
      totalPending += (student.total_fees - student.paid_amount);
    }
    
    // Calculate collection rate
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
    
    // Get monthly breakdown
    const monthlyData = await getMonthlyCollectionData(currentYear);
    
    res.status(200).json({
      success: true,
      data: {
        totalExpected,
        totalCollected,
        totalPending,
        collectionRate,
        currentMonth: now.toLocaleString('default', { month: 'long' }),
        monthlyData
      }
    });
  } catch (err) {
    console.error('Error in getFeesCollectionOverview:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Helper function to get students with payment data
async function getStudentsWithPaymentsData() {
  // Get classes that have fees defined (filter out null classId references)
  const classesWithFees = await ClassFees.find({ classId: { $ne: null } }).populate('classId');
  const classIdsWithFees = classesWithFees
    .filter(cf => cf.classId && cf.classId._id)
    .map(cf => cf.classId._id.toString());
  
  // Get all students
  const students = await User.find({ role: "student" }).sort({ name: 1 });
  
  // Get class information for each student
  const studentsWithClassInfo = [];
  for (const student of students) {
    if (student.class) {
      // Try to match student class with available classes
      let classSubject = null;
      
      // Handle different naming conventions
      if (student.class === '10th') {
        classSubject = await ClassSubject.findOne({ name: 'Class 10' });
      } else if (student.class === '11th') {
        classSubject = await ClassSubject.findOne({ name: 'Class 11' });
      } else if (student.class === '12th') {
        classSubject = await ClassSubject.findOne({ name: 'Class 12' });
      } else if (student.class === '9th') {
        classSubject = await ClassSubject.findOne({ name: 'Class 9' });
      } else if (student.class === '8th') {
        classSubject = await ClassSubject.findOne({ name: 'Class 8' });
      } else if (student.class === '7th') {
        classSubject = await ClassSubject.findOne({ name: 'Class 7' });
      } else if (student.class === '6th') {
        classSubject = await ClassSubject.findOne({ name: 'Class 6' });
      } else if (student.class === '5th') {
        classSubject = await ClassSubject.findOne({ name: 'Class 5' });
      } else if (student.class === '4th') {
        classSubject = await ClassSubject.findOne({ name: 'Class 4' });
      } else if (student.class === '3rd' || student.class === '3th') {
        classSubject = await ClassSubject.findOne({ name: 'Class 3' });
      } else if (student.class === '2nd' || student.class === '2th') {
        classSubject = await ClassSubject.findOne({ name: 'Class 2' });
      } else if (student.class === '1st' || student.class === '1th') {
        classSubject = await ClassSubject.findOne({ name: 'Class 1' });
      } else {
        // Try direct match first
        classSubject = await ClassSubject.findOne({ name: student.class });
        
        // If not found, try to extract class number
        if (!classSubject) {
          const classMatch = student.class.match(/\d+/);
          if (classMatch) {
            const classNum = classMatch[0];
            classSubject = await ClassSubject.findOne({ name: `Class ${classNum}` });
          }
        }
      }
      
      // Only include students whose class has fees defined
      if (classSubject && classIdsWithFees.includes(classSubject._id.toString())) {
        studentsWithClassInfo.push({
          ...student.toObject(),
          classInfo: classSubject
        });
      }
    }
  }
  
  // Get payment records for these students
  const studentIds = studentsWithClassInfo.map(s => s._id);
  const payments = await StudentPayment.find({ studentId: { $in: studentIds } });
  
  // Create payment map
  const paymentMap = new Map();
  payments.forEach(payment => {
    paymentMap.set(payment.studentId.toString(), payment);
  });
  
  const result = [];
  
  for (const student of studentsWithClassInfo) {
    // Get class fees
    let totalFees = 0;
    const classFee = await ClassFees.findOne({ classId: student.classInfo._id });
    if (classFee) {
      totalFees = classFee.totalFee;
    }
    
    // Get payment record
    const payment = paymentMap.get(student._id.toString());
    
    let paidAmount = 0;
    
    if (payment) {
      paidAmount = payment.paidAmount;
    }
    
    result.push({
      student_id: student._id,
      total_fees: totalFees,
      paid_amount: paidAmount
    });
  }
  
  return result;
}

// Helper function to get monthly collection data
async function getMonthlyCollectionData(year) {
  const monthlyData = [];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  for (let i = 0; i < 12; i++) {
    // Get payments for this month
    const startDate = new Date(year, i, 1);
    const endDate = new Date(year, i + 1, 0, 23, 59, 59);
    
    const payments = await StudentPayment.find({
      'paymentHistory.paymentDate': {
        $gte: startDate,
        $lte: endDate
      }
    });
    
    let monthlyCollected = 0;
    payments.forEach(payment => {
      payment.paymentHistory.forEach(history => {
        const paymentDate = new Date(history.paymentDate);
        if (paymentDate >= startDate && paymentDate <= endDate) {
          monthlyCollected += history.amount;
        }
      });
    });
    
    monthlyData.push({
      month: months[i],
      collected: monthlyCollected
    });
  }
  
  return monthlyData;
}

// @desc    Debug endpoint to check data
// @route   GET /api/payments/debug
// @access  Admin
exports.debugData = async (req, res) => {
  try {
    const students = await User.find({ role: "student" }).limit(5);
    const classes = await ClassSubject.find().limit(5);
    
    res.status(200).json({
      success: true,
      data: {
        students: students.map(s => ({ name: s.name, class: s.class, _id: s._id })),
        classes: classes.map(c => ({ name: c.name, class: c.class, _id: c._id }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update student payment
// @route   POST /api/payments/update-student-payment
// @access  Admin
exports.updateStudentPayment = async (req, res) => {
  try {
    const { studentId } = req.body;
    
    // Find or create payment record
    let payment = await StudentPayment.findOne({ studentId });
    
    // Get student and class info
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    
    // Find class info
    let classSubject = null;
    if (student.class === '10th') {
      classSubject = await ClassSubject.findOne({ name: 'Class 10' });
    } else if (student.class === '11th') {
      classSubject = await ClassSubject.findOne({ name: 'Class 11' });
    } else if (student.class === '12th') {
      classSubject = await ClassSubject.findOne({ name: 'Class 12' });
    } else {
      classSubject = await ClassSubject.findOne({ name: student.class });
    }
    
    if (!classSubject) {
      return res.status(400).json({ success: false, message: "Student class not found" });
    }
    
    // Get class fees
    let totalFees = 0;
    const classFee = await ClassFees.findOne({ classId: classSubject._id });
    if (classFee) {
      totalFees = classFee.totalFee;
    }
    
    if (!payment) {
      // Create new payment record with full payment
      payment = new StudentPayment({
        studentId,
        classId: classSubject._id,
        totalFees,
        paidAmount: totalFees, // Full payment
        dueAmount: 0, // No due amount
        paymentStatus: "paid", // Mark as paid
        dueDate: new Date(),
        academicYear: new Date().getFullYear().toString(),
        paymentHistory: [{
          amount: totalFees,
          paymentDate: new Date(),
          paymentMethod: 'online',
          receiptNumber: `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          notes: 'Full payment processed',
        }]
      });
    } else {
      // Update existing payment to full payment
      payment.paidAmount = totalFees;
      payment.dueAmount = 0;
      payment.paymentStatus = "paid";
      payment.paymentHistory.push({
        amount: totalFees,
        paymentDate: new Date(),
        paymentMethod: 'online',
        receiptNumber: `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        notes: 'Full payment processed',
      });
    }
    
    // Save payment
    await payment.save();
    
    res.status(200).json({
      success: true,
      message: "Payment marked as paid successfully",
      data: payment,
    });
  } catch (err) {
    console.error('Error in updateStudentPayment:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all student payments with filters
// @route   GET /api/payments/student-payments
// @access  Admin
exports.getAllStudentPayments = async (req, res) => {
  try {
    const { classId, status } = req.query;
    
    // Build query
    let query = { role: "student" };
    
    // If class filter is applied (class is a string field in User model)
    if (classId) {
      // Find class subject to get name
      const classSubject = await ClassSubject.findById(classId);
      if (classSubject) {
        query.class = classSubject.name;
      }
    }
    
    // Get all students with their payments
    const students = await User.find(query).sort({ name: 1 });
    
    // Get class information for each student
    const studentsWithClassInfo = [];
    for (const student of students) {
      if (student.class) {
        // Try to match student class with available classes
        let classSubject = null;
        
        // Handle different naming conventions
        if (student.class === '10th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 10' });
        } else if (student.class === '11th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 11' });
        } else if (student.class === '12th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 12' });
        } else if (student.class === '9th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 9' });
        } else if (student.class === '8th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 8' });
        } else if (student.class === '7th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 7' });
        } else if (student.class === '6th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 6' });
        } else if (student.class === '5th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 5' });
        } else if (student.class === '4th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 4' });
        } else if (student.class === '3rd' || student.class === '3th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 3' });
        } else if (student.class === '2nd' || student.class === '2th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 2' });
        } else if (student.class === '1st' || student.class === '1th') {
          classSubject = await ClassSubject.findOne({ name: 'Class 1' });
        } else {
          // Try direct match first
          classSubject = await ClassSubject.findOne({ name: student.class });
          
          // If not found, try to extract class number
          if (!classSubject) {
            const classMatch = student.class.match(/\d+/);
            if (classMatch) {
              const classNum = classMatch[0];
              classSubject = await ClassSubject.findOne({ name: `Class ${classNum}` });
            }
          }
        }
        
        studentsWithClassInfo.push({
          ...student.toObject(),
          classInfo: classSubject
        });
      } else {
        studentsWithClassInfo.push({
          ...student.toObject(),
          classInfo: null
        });
      }
    }
    
    // Sort by class
    studentsWithClassInfo.sort((a, b) => {
      const classA = a.classInfo?.class || 999;
      const classB = b.classInfo?.class || 999;
      return classA - classB;
    });
    
    // Get payments for these students
    const studentIds = studentsWithClassInfo.map(s => s._id);
    let paymentsQuery = { studentId: { $in: studentIds } };
    
    if (status && status !== 'all') {
      paymentsQuery.paymentStatus = status;
    }
    
    const payments = await StudentPayment.find(paymentsQuery)
      .populate('studentId', 'name email')
      .populate('classId', 'name class')
      .sort({ 'classId.class': 1, 'studentId.name': 1 });
    
    // Create payment records for students who don't have payments yet
    const paymentMap = new Map();
    payments.forEach(payment => {
      paymentMap.set(payment.studentId._id.toString(), payment);
    });
    
    const result = [];
    const currentYear = new Date().getFullYear().toString();
    
    for (const student of studentsWithClassInfo) {
      let payment = paymentMap.get(student._id.toString());
      
      // If no payment record exists, create one
      if (!payment) {
        // For now, skip creating payment records to avoid the pre-save hook error
        // This will be fixed later, but let's first get the matching working
        continue;
      }
      
      result.push({
        _id: payment._id,
        studentName: student.name,
        studentEmail: student.email,
        class: student.classInfo?.name || student.class || 'N/A',
        class: student.classInfo?.class || 'N/A',
        totalFees: payment.totalFees,
        paidAmount: payment.paidAmount,
        dueAmount: payment.dueAmount,
        paymentStatus: payment.paymentStatus,
        dueDate: payment.dueDate,
        lastPaymentDate: payment.lastPaymentDate,
        paymentHistory: payment.paymentHistory,
        academicYear: payment.academicYear,
        classId: student.classInfo?._id,
      });
    }
    
    // Apply status filter if needed
    if (status && status !== 'all') {
      return res.status(200).json({
        success: true,
        data: result.filter(r => r.paymentStatus === status),
      });
    }
    
    res.status(200).json({
      success: true,
      data: result,
      message: result.length === 0 ? 'No students found with class assignments. Please ensure students are assigned to classes and class fees are defined.' : null
    });
  } catch (err) {
    console.error('Error in getAllStudentPayments:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update student payment
// @route   PUT /api/payments/update-payment/:paymentId
// @access  Admin
exports.updatePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, paymentMethod, notes } = req.body;
    
    const payment = await StudentPayment.findById(paymentId)
      .populate('studentId', 'name')
      .populate('classId', 'name class');
    
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }
    
    // Generate receipt number
    const receiptNumber = `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Add to payment history
    payment.paymentHistory.push({
      amount: Number(amount),
      paymentDate: new Date(),
      paymentMethod: paymentMethod || 'online',
      receiptNumber,
      notes: notes || '',
    });
    
    // Update paid amount
    payment.paidAmount += Number(amount);
    
    await payment.save();
    
    res.status(200).json({
      success: true,
      message: "Payment updated successfully",
      data: payment,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Generate receipt PDF
// @route   GET /api/payments/receipt/:paymentId
// @access  Admin
exports.generateReceipt = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await StudentPayment.findById(paymentId)
      .populate('studentId', 'name email')
      .populate('classId', 'name class');
    
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }
    
    // Get the latest payment
    const latestPayment = payment.paymentHistory[payment.paymentHistory.length - 1];
    
    if (!latestPayment) {
      return res.status(400).json({ success: false, message: "No payment found for receipt" });
    }
    
    const receiptData = {
      schoolName: "Smart School System",
      studentName: payment.studentId.name,
      studentEmail: payment.studentId.email,
      className: payment.classId.name,
      class: payment.classId.class,
      totalFees: payment.totalFees,
      paidAmount: latestPayment.amount,
      dueAmount: payment.dueAmount,
      paymentDate: latestPayment.paymentDate,
      receiptNumber: latestPayment.receiptNumber,
      paymentMethod: latestPayment.paymentMethod,
      academicYear: payment.academicYear,
    };
    
    res.status(200).json({
      success: true,
      data: receiptData,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Generate bulk receipts for filtered students
// @route   POST /api/payments/bulk-receipts
// @access  Admin
exports.generateBulkReceipts = async (req, res) => {
  try {
    const { studentIds } = req.body;
    
    const payments = await StudentPayment.find({ 
      studentId: { $in: studentIds },
      paymentHistory: { $exists: true, $ne: [] }
    })
      .populate('studentId', 'name email')
      .populate('classId', 'name class');
    
    const receipts = payments.map(payment => {
      const latestPayment = payment.paymentHistory[payment.paymentHistory.length - 1];
      return {
        schoolName: "Smart School System",
        studentName: payment.studentId.name,
        studentEmail: payment.studentId.email,
        className: payment.classId.name,
        class: payment.classId.class,
        totalFees: payment.totalFees,
        paidAmount: latestPayment.amount,
        dueAmount: payment.dueAmount,
        paymentDate: latestPayment.paymentDate,
        receiptNumber: latestPayment.receiptNumber,
        paymentMethod: latestPayment.paymentMethod,
        academicYear: payment.academicYear,
      };
    });
    
    res.status(200).json({
      success: true,
      data: receipts,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
