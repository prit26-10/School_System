const { parseDDMMYYYY, ensureFutureDateTime } = require("../../utils/dateParser");

exports.validateHoliday = (req, res, next) => {
  const { startDate, endDate, reason } = req.body;
  const errors = [];

  if (!startDate) errors.push("startDate is required");
  if (!endDate) errors.push("endDate is required");
  if (!reason) errors.push("reason is required");

  let parsedStartDate, parsedEndDate;

  try {
    parsedStartDate = parseDDMMYYYY(startDate);
    ensureFutureDateTime(parsedStartDate, "startDate");
  } catch (e) {
    errors.push(e.message);
  }

  try {
    parsedEndDate = parseDDMMYYYY(endDate);
    ensureFutureDateTime(parsedEndDate, "endDate");
  } catch (e) {
    errors.push(e.message);
  }

  if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
    errors.push("endDate cannot be before startDate");
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  req.parsedStartDate = parsedStartDate;
  req.parsedEndDate = parsedEndDate;
  next();
};
