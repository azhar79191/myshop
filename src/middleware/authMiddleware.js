import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import { errorResponse } from '../utils/apiResponse.js';

/**
 * Protect routes - verify JWT token
 */
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return errorResponse(res, 'Not authorized to access this route', 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return errorResponse(res, 'Not authorized, token failed', 401);
    }
    return next(error);
  }

  try {
    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) return errorResponse(res, 'Admin not found', 401);
    if (!admin.isActive) return errorResponse(res, 'Admin account is deactivated', 401);

    req.admin = admin;
    return next();
  } catch (error) {
    return next(error);
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
