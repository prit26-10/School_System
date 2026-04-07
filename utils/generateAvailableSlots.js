const moment = require("moment-timezone");
const { getCache, setCache } = require("./redisCache");

const generateAvailableSlots = async (
  teacherDates = {
    date: null,
    availability: null,
    sessionId: null,
    teacherId: null,
    studentId: null
  },
  sessionData = {
    Duration: 0,
    breakDuration: 0,
    teacherTimezone: "Asia/Kolkata",
    studentTimezone: null
  },
  bookedSlots = []
) => {
  const { date, availability, sessionId, teacherId, studentId } = teacherDates;
  const { Duration, breakDuration, teacherTimezone, studentTimezone } = sessionData;

  if (!date || !availability) {
    throw new Error("Missing date or availability in generateAvailableSlots");
  }

  if (!teacherId || !sessionId) {
    throw new Error("Missing teacherId or sessionId in generateAvailableSlots");
  }

  const redisDate = moment(date).format("YYYY-MM-DD");
  const outputTimezone = studentTimezone || teacherTimezone;

  // ✅ teacher cache always base slots (ALL)
  const teacherRedisKey = `slots:teacher:${teacherId}:${sessionId}:${redisDate}:${availability.startTime}-${availability.endTime}`;

  // ✅ student cache already converted for timezone
  const studentRedisKey = studentId
    ? `slots:student:${studentId}:${sessionId}:${redisDate}:${availability.startTime}-${availability.endTime}:${outputTimezone}`
    : null;

  // ✅ 1) student cache
  if (studentRedisKey) {
    const cached = await getCache(studentRedisKey);
    if (cached) return JSON.parse(cached);
  }

  // ✅ 2) base slots get/generate
  let baseSlots = [];
  const teacherCached = await getCache(teacherRedisKey);

  if (teacherCached) {
    baseSlots = JSON.parse(teacherCached);
  } else {
    let currentTeacher = moment.tz(
      `${redisDate} ${availability.startTime}`,
      "YYYY-MM-DD HH:mm",
      teacherTimezone
    );

    const endTeacher = moment.tz(
      `${redisDate} ${availability.endTime}`,
      "YYYY-MM-DD HH:mm",
      teacherTimezone
    );

    while (currentTeacher.clone().add(Duration, "minutes").isSameOrBefore(endTeacher)) {
      const slotEndTeacher = currentTeacher.clone().add(Duration, "minutes");

      baseSlots.push({
        startTime: currentTeacher.format("HH:mm"),
        endTime: slotEndTeacher.format("HH:mm")
      });

      currentTeacher.add(Duration + breakDuration, "minutes");
    }

    await setCache(teacherRedisKey, baseSlots);
  }

  // ✅ 3) remove booked slots runtime (but keep slots booked by current student)
  const availableSlots = baseSlots.filter(slot => {
    const startTeacher = moment.tz(
      `${redisDate} ${slot.startTime}`,
      "YYYY-MM-DD HH:mm",
      teacherTimezone
    );

    const endTeacher = moment.tz(
      `${redisDate} ${slot.endTime}`,
      "YYYY-MM-DD HH:mm",
      teacherTimezone
    );

    const slotStartUTC = startTeacher.clone().utc();
    const slotEndUTC = endTeacher.clone().utc();

    // Check if slot is booked by another student
    const isBookedByOtherStudent = (bookedSlots || []).some(b => {
      const isOverlap = slotStartUTC.isBefore(moment(b.endTime)) &&
                       slotEndUTC.isAfter(moment(b.startTime));
      // If there's an overlap and it's not booked by the current student, exclude it
      return isOverlap && String(b.bookedBy) !== String(studentId);
    });

    return !isBookedByOtherStudent;
  });

  // ✅ 4) convert output timezone + add UTC values
  const converted = availableSlots.map(slot => {
    const startTeacher = moment.tz(
      `${redisDate} ${slot.startTime}`,
      "YYYY-MM-DD HH:mm",
      teacherTimezone
    );

    const endTeacher = moment.tz(
      `${redisDate} ${slot.endTime}`,
      "YYYY-MM-DD HH:mm",
      teacherTimezone
    );

    return {
      startTime: startTeacher.clone().tz(outputTimezone).format("HH:mm"),
      endTime: endTeacher.clone().tz(outputTimezone).format("HH:mm"),
      startTimeUTC: startTeacher.clone().utc().startOf('minute').toISOString(),
      endTimeUTC: endTeacher.clone().utc().startOf('minute').toISOString()
    };
  });

  if (studentRedisKey) {
    await setCache(studentRedisKey, converted);
  }

  return converted;
};

module.exports = generateAvailableSlots;
