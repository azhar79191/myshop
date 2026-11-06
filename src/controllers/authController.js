import Admin from '../models/Admin.js';
import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { generateToken } from '../middleware/authMiddleware.js';
import { integrationEnvironment } from '../utils/integrationSettings.js';

/**
 * @desc    Login admin
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      !username.trim() ||
      !password ||
      username.length > 50 ||
      Buffer.byteLength(password, 'utf8') > 1024
    ) {
      return errorResponse(res, 'Please provide username and password', 400);
    }

    // Find admin and include password
    const admin = await Admin.findOne({ username: username.trim().toLowerCase() }).select(
      '+password +tokenVersion',
    );

    if (!admin) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Check if admin is active
    if (!admin.isActive) {
      return errorResponse(res, 'Invalid credentials', 401);
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
    const token = generateToken(admin._id, admin.tokenVersion);

    // Return response
    return successResponse(
      res,
      {
        token,
        admin: admin.toSafeObject(),
      },
      'Login successful',
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
 * @desc    Update the current admin's profile details and optional photo
 * @route   PUT /api/auth/profile
 * @access  Private
 */
export const updateProfile = async (req, res) => {
  try {
    const { fullName, email } = req.body;
    if (fullName === undefined && email === undefined && !req.file) {
      return errorResponse(res, 'Provide profile details or a profile image', 400);
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) return errorResponse(res, 'Admin not found', 404);

    if (fullName !== undefined) admin.fullName = fullName;
    if (email !== undefined) admin.email = email;
    if (req.file) admin.profileImage = req.file.path;

    await admin.save();
    return successResponse(res, admin.toSafeObject(), 'Profile updated successfully');
  } catch (error) {
    console.error('Update profile error:', error);
    if (error.code === 11000) {
      return errorResponse(res, 'An admin with this email already exists', 409);
    }
    if (error.name === 'ValidationError') {
      return errorResponse(
        res,
        Object.values(error.errors)
          .map((item) => item.message)
          .join(', '),
        400,
      );
    }
    return errorResponse(res, 'Server error while updating profile', 500);
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

    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      !currentPassword ||
      !newPassword
    ) {
      return errorResponse(res, 'Please provide current and new password', 400);
    }

    if (newPassword.length < 12 || Buffer.byteLength(newPassword, 'utf8') > 72) {
      return errorResponse(res, 'Use at least 12 characters and no more than 72 UTF-8 bytes', 400);
    }

    // Get admin with password
    const admin = await Admin.findById(req.admin._id).select('+password +tokenVersion');

    // Check current password
    const isMatch = await admin.comparePassword(currentPassword);

    if (!isMatch) {
      return errorResponse(res, 'Current password is incorrect', 401);
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    return successResponse(
      res,
      { token: generateToken(admin._id, admin.tokenVersion) },
      'Password updated successfully',
    );
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
    if (
      ![username, email, password, fullName].every(
        (value) => typeof value === 'string' && value.trim(),
      ) ||
      username.length > 50 ||
      email.length > 254 ||
      fullName.length > 100
    ) {
      return errorResponse(res, 'Please provide all required fields', 400);
    }

    if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72)
      return errorResponse(res, 'Use at least 12 characters and no more than 72 UTF-8 bytes', 400);

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
    if (typeof isActive !== 'boolean') return errorResponse(res, 'isActive must be a boolean', 400);

    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    if (String(admin._id) === String(req.admin._id) && !isActive)
      return errorResponse(res, 'You cannot deactivate your own account', 400);
    if (
      admin.role === 'superadmin' &&
      !isActive &&
      (await Admin.countDocuments({ role: 'superadmin', isActive: true })) <= 1
    )
      return errorResponse(res, 'Keep at least one active superadmin', 400);
    admin.isActive = isActive;
    await admin.save();

    return successResponse(res, admin.toSafeObject(), 'Admin status updated');
  } catch (error) {
    console.error('Update admin status error:', error);
    return errorResponse(res, 'Server error', 500);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const environment = integrationEnvironment();
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254) return errorResponse(res, 'Enter your email address', 400);
    if (
      !environment.RESEND_API_KEY ||
      !environment.RECOVERY_FROM_EMAIL ||
      !environment.RECOVERY_SITE_URL
    )
      return errorResponse(
        res,
        'Email recovery is not configured. Contact your site administrator.',
        503,
      );
    const admin = await Admin.findOne({ email, isActive: true });
    if (admin) {
      const token = randomBytes(32).toString('hex');
      admin.resetTokenHash = createHash('sha256').update(token).digest('hex');
      admin.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
      await admin.save();
      const link = new URL('/admin/reset-password', environment.RECOVERY_SITE_URL);
      link.hash = token;
      try {
        const sent = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
          headers: {
            Authorization: `Bearer ${environment.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: environment.RECOVERY_FROM_EMAIL,
            to: admin.email,
            subject: 'Reset your Bismillah admin password',
            text: `Reset your password within 30 minutes: ${link.href}\nIf you did not request this, ignore this email.`,
          }),
        });
        if (!sent.ok) console.error('Password recovery delivery failed:', sent.status);
      } catch {
        console.error('Password recovery email service unavailable');
      }
    }
    return successResponse(
      res,
      null,
      'If an active account matches, a recovery email will arrive shortly.',
    );
  } catch (error) {
    next(error);
  }
};
export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (
      typeof token !== 'string' ||
      !/^[a-f0-9]{64}$/.test(token) ||
      typeof password !== 'string' ||
      password.length < 12 ||
      Buffer.byteLength(password, 'utf8') > 72
    )
      return errorResponse(
        res,
        'Use a valid reset link and a password of at least 12 characters, up to 72 UTF-8 bytes',
        400,
      );
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await Admin.findOneAndUpdate(
      {
        resetTokenHash: createHash('sha256').update(token).digest('hex'),
        resetTokenExpires: { $gt: new Date() },
        isActive: true,
      },
      {
        $set: { password: passwordHash },
        $unset: { resetTokenHash: '', resetTokenExpires: '' },
        $inc: { tokenVersion: 1 },
      },
    );
    if (!admin) return errorResponse(res, 'This reset link is invalid or expired', 400);
    return successResponse(res, null, 'Password reset. Sign in with your new password.');
  } catch (error) {
    next(error);
  }
};
