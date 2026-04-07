const mongoose = require("mongoose");

const PublicHolidaySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        date: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: false // Optional, for multi-day entries
        },
        country: {
            type: String,
            default: "Global",
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        type: {
            type: String,
            enum: ["holiday", "event"],
            default: "holiday"
        },
        academicYear: {
            type: String,
            required: true, // e.g., "2025-2026"
            index: true
        }
    },
    { timestamps: true }
);

// Index for efficient searching by academic year and date
PublicHolidaySchema.index({ academicYear: 1, date: 1 });

module.exports = mongoose.model("PublicHoliday", PublicHolidaySchema);
