module.exports = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    console.log('Role Auth: No req.user found');
    return res.status(401).json({ message: "Not authenticated" });
  }
  
  // Flatten in case allowedRoles is an array of arrays
  const roles = allowedRoles.flat();
  
  console.log(`Role Auth Check for ${req.originalUrl}:`, {
    userRole: req.user.role,
    allowedRoles: roles,
    match: roles.includes(req.user.role)
  });

  if (roles.includes(req.user.role)) {
    return next();
  }
  
  console.log(`Role Auth: Forbidden for role ${req.user.role}. Required one of: ${roles.join(', ')}`);
  return res.status(403).json({ message: "Forbidden: insufficient privileges" });
};