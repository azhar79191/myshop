import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import { errorResponse } from '../utils/apiResponse.js';

/**
 * Protect routes - verify JWT token
 */
export const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return errorResponse(res, 'Not authorized to access this route', 401);
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get admin from token
      req.admin = await Admin.findById(decoded.id).select('-password');

      if (!req.admin) {
        return errorResponse(res, 'Admin not found', 401);
      }

      if (!req.admin.isActive) {
        return errorResponse(res, 'Admin account is deactivated', 401);
      }

      next();
    } catch (error) {
      return errorResponse(res, 'Not authorized, token failed', 401);
    }
  } catch (error) {
    return errorResponse(res, 'Server error in authentication', 500);
  }
};

/**
 * Check if admin is superadmin
 */
export const superAdminOnly = (req, res, next) => {
  if (req.admin && req.admin.role === 'superadmin') {
    next();
  } else {
    return errorResponse(res, 'Access denied. Super admin only.', 403);
  }
};

/**
 * Generate JWT token
 */
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};
