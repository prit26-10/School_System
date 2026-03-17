const mongoose = require("mongoose");

const MaterialSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: ["PDF", "Video", "Document"],
        required: true
    },
    fileUrl: {
        type: String,
        required: true
    },
    targetClass: {
        type: String,
        required: true
    },
    class_id: {
        type: String,
        required: false,
        index: true
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false // Optional, can be just class-level material
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    uploadDate: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model("Material", MaterialSchema);
