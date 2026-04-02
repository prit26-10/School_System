const PublicHoliday = require("../../models/PublicHoliday");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

// Helper to validate date format (YYYY-MM-DD)
const isValidDate = (dateString) => {
    const regEx = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateString.match(regEx)) return false; // Invalid format
    const d = new Date(dateString);
    const dNum = d.getTime();
    if (!dNum && dNum !== 0) return false; // NaN value, Invalid date
    return d.toISOString().slice(0, 10) === dateString;
};

const getHolidays = async (req, res) => {
    console.log('academicYearController.getHolidays called');
    try {
        const { academicYear } = req.query;
        if (!academicYear) {
            return res.status(400).json({ success: false, message: "Academic Year is required" });
        }

        const holidays = await PublicHoliday.find({ academicYear }).sort({ date: 1 });
        res.json({ success: true, data: holidays });
    } catch (error) {
        console.error("Error fetching holidays:", error);
        res.status(500).json({ success: false, message: "Server Error while fetching holidays" });
    }
};

const uploadHolidays = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const { academicYear } = req.body;
        if (!academicYear) {
            return res.status(400).json({ success: false, message: "Academic Year is required" });
        }

        const results = [];
        const filePath = req.file.path;

        fs.createReadStream(filePath)
            .pipe(csv())
            .on("data", (data) => results.push(data))
            .on("end", async () => {
                const holidaysToInsert = [];
                const errors = [];

                for (let i = 0; i < results.length; i++) {
                    const row = results[i];
                    const { name, date, endDate, type, country, description } = row;

                    if (!name || !date) {
                        errors.push(`Row ${i + 1}: Missing name or date`);
                        continue;
                    }

                    if (!isValidDate(date)) {
                        errors.push(`Row ${i + 1}: Invalid date format (${date}). Use YYYY-MM-DD.`);
                        continue;
                    }

                    const holidayData = {
                        name: name,
                        date: new Date(date),
                        type: (type || "holiday").toLowerCase(),
                        country: country || "Global",
                        description: description || "",
                        academicYear
                    };

                    if (endDate && isValidDate(endDate)) {
                        holidayData.endDate = new Date(endDate);
                    }

                    holidaysToInsert.push(holidayData);
                }

                if (holidaysToInsert.length > 0) {
                    // Extract types present in the new batch to only clear those
                    const typesInBatch = [...new Set(holidaysToInsert.map(h => h.type))];

                    // Clear existing records for this year only for the types being uploaded
                    await PublicHoliday.deleteMany({
                        academicYear,
                        type: { $in: typesInBatch }
                    });

                    await PublicHoliday.insertMany(holidaysToInsert);
                }

                // Delete the uploaded file
                fs.unlinkSync(filePath);

                res.json({
                    success: true,
                    message: `Successfully imported ${holidaysToInsert.length} items for ${academicYear}.`,
                    errors: errors.length > 0 ? errors : null
                });
            });
    } catch (error) {
        console.error("Error uploading holidays:", error);
        res.status(500).json({ success: false, message: "Server Error while uploading holidays" });
    }
};

// Download Sample CSV
const downloadSampleCSV = (req, res) => {
    const type = req.query.type; // "holiday" or "event"
    const currentYear = new Date().getFullYear();
    // Header should match what uploadHolidays expects: name,date,endDate,type,country,description
    let content = "name,date,endDate,type,country,description\n";

    if (type === "holiday") {
        content += `Republic Day,${currentYear}-01-26,,holiday,India,National holiday celebrating the Constitution of India\n`;
        content += `Holi,${currentYear}-03-04,${currentYear}-03-05,holiday,India,Festival of Colors\n`;
        content += `Eid-ul-Fitr,${currentYear}-03-20,2026-03-21,holiday,India,End of Ramadan\n`;
        content += `Independence Day,${currentYear}-08-15,,holiday,India,Celebrating the nation's independence\n`;
        content += `Gandhi Jayanti,${currentYear}-10-02,,holiday,India,Mahatma Gandhi's Birthday\n`;
        content += `Diwali,${currentYear}-11-01,,holiday,India,Festival of Lights\n`;
        content += `Christmas Day,${currentYear}-12-25,,holiday,Global,Birth of Jesus Christ\n`;
    } else {
        content += `Annual Sports Meet,${currentYear}-01-20,${currentYear}-01-22,event,Global,Three-day sports festival\n`;
        content += `Science Fair,${currentYear}-02-10,,event,Global,Students showcasing science projects\n`;
        content += `Parent-Teacher Interaction,${currentYear}-03-15,,event,Global,Meeting to discuss student progress\n`;
        content += `Cultural Fest,${currentYear}-04-12,${currentYear}-04-14,event,Global,Showcasing cultural talents\n`;
        content += `Annual Prize Distribution,${currentYear}-05-20,,event,Global,Celebrating academic achievements\n`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=sample_${type}s.csv`);
    res.status(200).send(content);
};

const clearAllAcademicData = async (req, res) => {
    try {
        await PublicHoliday.deleteMany({});
        res.json({ success: true, message: "All academic data cleared successfully" });
    } catch (error) {
        console.error("Error clearing academic data:", error);
        res.status(500).json({ success: false, message: "Server Error while clearing data" });
    }
};

module.exports = {
    getHolidays,
    uploadHolidays,
    downloadSampleCSV,
    clearAllAcademicData
};
