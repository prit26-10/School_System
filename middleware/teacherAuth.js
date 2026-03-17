const jwt = require("jsonwebtoken");
const User = require("../models/User");

const teacherAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    console.log("TeacherAuth: Received token:", token ? "Yes" : "No");
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Access denied. No token provided." 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("TeacherAuth: Decoded ID:", decoded.id);
    
    // Find the user and verify it's a teacher
    const user = await User.findById(decoded.id).select("-password");
    
    if (!user) {
      console.log("TeacherAuth: User not found for ID:", decoded.id);
      return res.status(401).json({ 
        success: false,
        message: "Invalid token. User not found." 
      });
    }

    if (user.role !== "teacher") {
      console.log("TeacherAuth: User is not a teacher. Role:", user.role);
      return res.status(403).json({ 
        success: false,
        message: "Access denied. Only teachers can access this resource." 
      });
    }

    // Attach user info to request
    req.user = user;
    console.log("TeacherAuth: Auth successful for:", user.name);
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ 
        success: false,
        message: "Invalid token." 
      });
    }
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false,
        message: "Token expired." 
      });
    }
    
    console.error("Auth middleware error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Server error in authentication." 
    });
  }
};

module.exports = teacherAuth;
