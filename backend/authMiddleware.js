// backend/authMiddleware.js
import { verifyToken } from './auth.js';

// Middleware to protect routes
export const authenticateToken = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'NO_TOKEN'
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    // Attach userId and role to request object
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Optional middleware - allows both authenticated and anonymous access
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        req.userId = decoded.userId;
        req.userRole = decoded.role;
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
};

// NEW: Middleware to check if user has a specific role
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NO_ROLE'
      });
    }

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

// NEW: Middleware to check if user is a mechanic
export const requireMechanic = (req, res, next) => {
  if (req.userRole !== 'mechanic') {
    return res.status(403).json({
      error: 'This action is only available to mechanics',
      code: 'MECHANIC_ONLY'
    });
  }
  next();
};