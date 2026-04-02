const { parseTimeToMinutes } = require("../../utils/dateParser");

exports.validateWeeklyAvailability = (req, res, next) => {
  const { weeklyAvailability } = req.body;
  const errors = [];

  // ✅ Allow empty array (all days "Not set")
  if (!Array.isArray(weeklyAvailability)) {
    return res.status(400).json({
      errors: ["weeklyAvailability must be an array"]
    });
  }

  // NOTE: If you only want Monday-Saturday, remove Sunday
  const validDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  // ✅ Validate only days that have times (sent in payload)
  weeklyAvailability.forEach((slot, index) => {
    const { day, startTime, endTime } = slot;

    if (!validDays.includes(day)) {
      errors.push(`Row ${index + 1}: Invalid day (${day})`);
      return;
    }

    // Validate startTime format (HH:mm)
    try {
      parseTimeToMinutes(startTime);
    } catch (e) {
      errors.push(`Row ${index + 1}: startTime ${e.message}`);
      return;
    }

    // Validate endTime format (HH:mm)
    try {
      parseTimeToMinutes(endTime);
    } catch (e) {
      errors.push(`Row ${index + 1}: endTime ${e.message}`);
      return;
    }

    // ✅ Validate only: startTime < endTime
    try {
      const start = parseTimeToMinutes(startTime);
      const end = parseTimeToMinutes(endTime);

      if (start >= end) {
        errors.push(`Row ${index + 1}: startTime must be before endTime`);
      }
    } catch {
      errors.push(`Row ${index + 1}: Invalid time values`);
    }
  });

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
};



exports.validateHoliday = (req, res, next) => {
    const { startDate, endDate, reason } = req.body;
    const errors = [];

    if (!startDate) errors.push("startDate is required");
    if (!endDate) errors.push("endDate is required");
    if (!reason) errors.push("reason is required");

    let parsedStartDate, parsedEndDate;

    try {
        parsedStartDate = new Date(startDate);
    } catch (e) {
        errors.push("Invalid startDate format");
    }

    try {
        parsedEndDate = new Date(endDate);
    } catch (e) {
        errors.push("Invalid endDate format");
    }

    // Validate dates
    if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
        errors.push("endDate cannot be before startDate");
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    // Attach parsed dates to request for controller to use
    req.parsedStartDate = parsedStartDate;
    req.parsedEndDate = parsedEndDate;
    next();
};
