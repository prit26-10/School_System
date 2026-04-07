const { redisClient } = require("../config/redis");

const getCache = async (key) => {
  try {
    return await redisClient.get(key);
  } catch (err) {
    console.warn("Redis GET failed:", err.message);
    return null;
  }
};

const setCache = async (key, value, ttl = 60 * 60 * 12) => {
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch (err) {
    console.warn("Redis SET failed:", err.message);
  }
};

module.exports = {getCache, setCache};