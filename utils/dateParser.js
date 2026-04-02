exports.parseDDMMYYYY = (dateStr) => {
  const parts = dateStr.split("-");

  if (parts.length !== 3) {
    throw new Error("Date format must be dd-mm-yyyy");
  }

  const [day, month, year] = parts;
  const date = new Date(`${year}-${month}-${day}`);

  if (isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  return date;
};

exports.parseDDMMYYYYWithTime = (dateTimeStr) => {
  const [datePart, timePart] = dateTimeStr.split("T");

  if (!datePart || !timePart) {
    throw new Error("Datetime format must be dd-mm-yyyyTHH:mm:ss");
  }

  const [day, month, year] = datePart.split("-");
  const date = new Date(`${year}-${month}-${day}T${timePart}`);

  if (isNaN(date.getTime())) {
    throw new Error("Invalid datetime");
  }

  return date;
};

exports.ensureFutureDateTime = (date, label = "datetime") => {
  const now = new Date();

  if (date < now) {
    throw new Error(`${label} must be current or future time`);
  }
};

exports.parseTimeToMinutes = (timeStr) => {
  if (!timeStr) {
    throw new Error("time is required");
  }
  const lower = timeStr.toLowerCase();

  if (lower.includes("am") || lower.includes("pm")) {
    throw new Error("time must be in 24-hour format (HH:mm)");
  }
  const parts = timeStr.split(":");

  if (parts.length !== 2) {
    throw new Error("time must be in HH:mm format");
  }

  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59 ) {
    throw new Error("invalid time value");
  }
  return hour * 60 + minute;
};
