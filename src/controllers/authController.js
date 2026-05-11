import Admin from '../models/Admin.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { generateToken } from '../middleware/authMiddleware.js';

/**
 * @desc    Login admin
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return errorResponse(res, 'Please provide username and password', 400);
    }

    // Find admin and include password
    const admin = await Admin.findOne({ username }).select('+password');

    if (!admin) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Check if admin is active
    if (!admin.isActive) {
      return errorResponse(res, 'Account is deactivated', 401);
    }

    // Check password
    const isPasswordMatch = await admin.comparePassword(password);

    if (!isPasswordMatch) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate token
    const token = generateToken(admin._id);

    // Return response
    return successResponse(
      res,
      {
        token,
        admin: admin.toSafeObject(),
      },
      'Login successful'
    );
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(res, 'Server error during login', 500);
  }
};

/**
 * @desc    Get current logged in admin
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    return successResponse(res, admin, 'Admin profile retrieved');
  } catch (error) {
    console.error('Get me error:', error);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @desc    Update admin password
 * @route   PUT /api/auth/password
 * @access  Private
 */
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return errorResponse(res, 'Please provide current and new password', 400);
    }

    if (newPassword.length < 6) {
      return errorResponse(res, 'New password must be at least 6 characters', 400);
    }

    // Get admin with password
    const admin = await Admin.findById(req.admin._id).select('+password');

    // Check current password
    const isMatch = await admin.comparePassword(currentPassword);

    if (!isMatch) {
      return errorResponse(res, 'Current password is incorrect', 401);
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    return successResponse(res, null, 'Password updated successfully');
  } catch (error) {
    console.error('Update password error:', error);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @desc    Create new admin (superadmin only)
 * @route   POST /api/auth/admin
 * @access  Private/SuperAdmin
 */
export const createAdmin = async (req, res) => {
  try {
    const { username, email, password, fullName, role } = req.body;

    // Validate input
    if (!username || !email || !password || !fullName) {
      return errorResponse(res, 'Please provide all required fields', 400);
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ username }, { email }],
    });

    if (existingAdmin) {
      return errorResponse(res, 'Admin with this username or email already exists', 400);
    }

    // Create admin
    const admin = await Admin.create({
      username,
      email,
      password,
      fullName,
      role: role || 'admin',
    });

    return successResponse(res, admin.toSafeObject(), 'Admin created successfully', 201);
  } catch (error) {
    console.error('Create admin error:', error);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @desc    Get all admins (superadmin only)
 * @route   GET /api/auth/admins
 * @access  Private/SuperAdmin
 */
export const getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find().select('-password');
    return successResponse(res, admins, 'Admins retrieved successfully');
  } catch (error) {
    console.error('Get admins error:', error);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @desc    Update admin status (superadmin only)
 * @route   PUT /api/auth/admin/:id/status
 * @access  Private/SuperAdmin
 */
export const updateAdminStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    admin.isActive = isActive;
    await admin.save();

    return successResponse(res, admin.toSafeObject(), 'Admin status updated');
  } catch (error) {
    console.error('Update admin status error:', error);
    return errorResponse(res, 'Server error', 500);
  }
};
