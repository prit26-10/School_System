const mongoose = require("mongoose");

const DayAvailabilitySchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    required: true
  },
  startTime: { type: String, required: true }, 
  endTime: { type: String, required: true }   
});

const HolidaySchema = new mongoose.Schema({
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, enum: ["personal", "public"], required: true},
  note: { type: String, default: "" }
});

const TeacherAvailabilitySchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    weeklyAvailability: [DayAvailabilitySchema],
    holidays: [HolidaySchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("TeacherAvailability", TeacherAvailabilitySchema);
