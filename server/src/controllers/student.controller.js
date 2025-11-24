import Student from '../models/Student.model.js';
import CheckInOut from '../models/CheckInOut.model.js';
import Stall from '../models/Stall.model.js';
import Feedback from '../models/Feedback.model.js';
import Ranking from '../models/Ranking.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCodeService from '../services/qrCode.js';
import { successResponse, errorResponse } from '../helpers/response.js';
import { setAuthCookie, clearAuthCookie } from '../helpers/cookie.js';
import { query } from '../config/db.js';

/**
 * Student Controller
 * Handles student authentication, profile, and QR code operations
 */

/**
 * Student login
 * @route POST /api/student/login
 */
const login = async (req, res, next) => {
  try {
    const { registration_no, password } = req.body;

    // Registration number and password are required
    if (!registration_no || !password) {
      return errorResponse(res, 'Registration number and password are required', 400);
    }

    // Find student by registration number only
    const student = await Student.findByRegistrationNo(registration_no, query);

    if (!student) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Verify password using model method
    const isValidPassword = await student.comparePassword(password);
    if (!isValidPassword) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Check if password reset is required (first-time login or admin-forced reset)
    if (student.password_reset_required) {
      return successResponse(res, {
        requires_password_reset: true,
        registration_no: student.registration_no,
        message: 'Please reset your password to continue'
      }, 'Password reset required');
    }

    const token = jwt.sign(
      { 
        id: student.id, 
        registration_no: student.registration_no, 
        role: student.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set secure HTTP-Only cookie
    setAuthCookie(res, token);

    return successResponse(res, {
      token,
      student: {
        id: student.id,
        full_name: student.full_name,
        email: student.email,
        registration_no: student.registration_no,
        school_name: student.school_name,
        phone: student.phone,
        program_name: student.program_name,
        batch: student.batch
      }
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

/**
 * Get student profile
 * @route GET /api/student/profile
 */
const getProfile = async (req, res, next) => {
  try {
    const student = await Student.findById(req.user.id, query);
    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    return successResponse(res, {
      id: student.id,
      full_name: student.full_name,
      email: student.email,
      registration_no: student.registration_no,
      school_name: student.school_name,
      phone: student.phone,
      created_at: student.created_at
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Student logout
 * @route POST /api/student/logout
 */
const logout = async (req, res, next) => {
  try {
    clearAuthCookie(res);
    return successResponse(res, null, 'Logout successful');
  } catch (error) {
    next(error);
  }
};

/**
 * Get student QR code
 * @route GET /api/student/qr-code
 */
const getQRCode = async (req, res, next) => {
  try {
    const student = await Student.findById(req.user.id, query);
    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    // Generate rotating token (JWT string ~140 chars)
    const token = QRCodeService.generateRotatingStudentToken(student);
    
    // Generate rotating QR code image (Base64 PNG)
    const qrCodeImage = await QRCodeService.generateRotatingQRCodeImage(student);

    // Calculate rotation metadata for frontend
    const rotationInfo = {
      expires_in_seconds: QRCodeService.getSecondsUntilRotation(),
      rotation_interval: QRCodeService.ROTATION_INTERVAL_SECONDS,
      grace_period_seconds: QRCodeService.GRACE_PERIOD_WINDOWS * QRCodeService.ROTATION_INTERVAL_SECONDS
    };

    return successResponse(res, {
      qr_code: qrCodeImage,
      qr_code_token: token,
      registration_no: student.registration_no,
      rotation_info: rotationInfo
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get student check-in history
 * @route GET /api/student/check-in-history
 */
const getCheckInHistory = async (req, res, next) => {
  try {
    const history = await CheckInOut.findByStudentId(req.user.id, query);
    return successResponse(res, history);
  } catch (error) {
    next(error);
  }
};

/**
 * Update student profile
 * @route PUT /api/student/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const updateData = {};

    if (email) {
      updateData.email = email;
    }

    if (password) {
      const salt = await bcrypt.genSalt(12);
      updateData.password_hash = await bcrypt.hash(password, salt);
    }

    const updatedStudent = await Student.update(req.user.id, updateData, query);
    if (!updatedStudent) {
      return errorResponse(res, 'Student not found', 404);
    }

    return successResponse(res, {
      id: updatedStudent.id,
      full_name: updatedStudent.full_name,
      email: updatedStudent.email,
      registration_no: updatedStudent.registration_no,
      school_name: updatedStudent.school_name
    }, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Scan stall QR code (Student self-service)
 * @route POST /api/student/scan-stall
 */
const scanStall = async (req, res, next) => {
  try {
    const { stall_qr_token } = req.body;

    if (!stall_qr_token) {
      return errorResponse(res, 'Stall QR code is required', 400);
    }

    // Verify stall QR code
    const stallDecoded = QRCodeService.verifyStallQRToken(stall_qr_token);
    if (!stallDecoded || !stallDecoded.valid) {
      return errorResponse(res, 'Invalid stall QR code', 400);
    }

    // Find stall by QR token
    const stall = await Stall.findByQRToken(stall_qr_token, query);
    if (!stall) {
      return errorResponse(res, 'Stall not found', 404);
    }

    // Check if student is inside event
    const student = await Student.findById(req.user.id, query);
    
    
    if (!student) {
      return errorResponse(res, 'Student not found. Please login again.', 404);
    }
    
    if (!student.is_inside_event) {
      return errorResponse(res, 'You must be checked in at the event to scan stalls', 403);
    }

    // Check if student already gave feedback to this stall
    const existingFeedback = await Feedback.findByStudentAndStall(req.user.id, stall.id, query);
    
    return successResponse(res, {
      stall: {
        id: stall.id,
        stall_number: stall.stall_number,
        stall_name: stall.stall_name,
        school_name: stall.school_name,
        description: stall.description,
        location: stall.location
      },
      already_reviewed: !!existingFeedback,
      existing_feedback: existingFeedback ? {
        rating: existingFeedback.rating,
        comment: existingFeedback.comment,
        submitted_at: existingFeedback.submitted_at
      } : null
    }, 'Stall scanned successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Submit feedback for a stall
 * @route POST /api/student/submit-feedback
 */
const submitFeedback = async (req, res, next) => {
  try {
    const { stall_id, rating, comment } = req.body;

    // Validation
    if (!stall_id || !rating) {
      return errorResponse(res, 'Stall ID and rating are required', 400);
    }

    if (rating < 1 || rating > 5) {
      return errorResponse(res, 'Rating must be between 1 and 5', 400);
    }

    // Check if student is inside event
    const student = await Student.findById(req.user.id, query);
    
    // console.log(' [SUBMIT-FEEDBACK] JWT user ID:', req.user.id);
    // console.log('[SUBMIT-FEEDBACK] JWT user data:', req.user);
    // console.log('[SUBMIT-FEEDBACK] Student found:', student ? student.full_name : 'NULL');
    
    if (!student) {
      return errorResponse(res, 'Student not found. Please login again.', 404);
    }
    
    if (!student.is_inside_event) {
      return errorResponse(res, 'You must be checked in at the event to submit feedback', 403);
    }

    // Check feedback limit (max 200 per student)
    const feedbackCount = await Feedback.countByStudent(req.user.id, query);
    if (feedbackCount >= 200) {
      return errorResponse(res, 'You have reached the maximum feedback limit (200)', 403);
    }

    // Check if stall exists
    const stall = await Stall.findById(stall_id, query);
    if (!stall) {
      return errorResponse(res, 'Stall not found', 404);
    }

    // Check if already gave feedback to this stall
    const existingFeedback = await Feedback.findByStudentAndStall(req.user.id, stall_id, query);
    if (existingFeedback) {
      return errorResponse(res, 'You have already submitted feedback for this stall', 409);
    }

    // Create feedback
    const feedback = await Feedback.create({
      student_id: req.user.id,
      stall_id: stall_id,
      rating: rating,
      comment: comment || null
    }, query);

    // Increment student's feedback count
    await Student.incrementFeedbackCount(req.user.id, query);

    // Increment stall's feedback count
    await query(
      'UPDATE stalls SET total_feedback_count = total_feedback_count + 1 WHERE id = $1',
      [stall_id]
    );

    return successResponse(res, {
      feedback: {
        id: feedback.id,
        stall_name: stall.stall_name,
        stall_number: stall.stall_number,
        rating: feedback.rating,
        comment: feedback.comment,
        submitted_at: feedback.submitted_at
      },
      total_feedbacks_given: feedbackCount + 1,
      remaining_feedbacks: 200 - (feedbackCount + 1)
    }, 'Feedback submitted successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Get student's stall visits and feedback history
 * @route GET /api/student/my-visits
 */
const getMyVisits = async (req, res, next) => {
  try {
    const feedbacks = await Feedback.findByStudent(req.user.id, query);
    
    const feedbackCount = feedbacks.length;
    const remainingFeedbacks = 200 - feedbackCount;

    return successResponse(res, {
      total_visits: feedbackCount,
      remaining_feedbacks: remainingFeedbacks,
      visits: feedbacks.map(f => ({
        stall_id: f.stall_id,
        stall_number: f.stall_number,
        stall_name: f.stall_name,
        school_name: f.school_name,
        rating: f.rating,
        comment: f.comment,
        visited_at: f.submitted_at
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get student's school stalls for ranking (Category 2)
 * @route GET /api/student/my-school-stalls
 */
const getMySchoolStalls = async (req, res, next) => {
  try {
    const student = await Student.findById(req.user.id, query);
    
    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    if (student.has_completed_ranking) {
      return errorResponse(res, 'You have already submitted your school stall rankings', 409);
    }

    const queryText = `
      SELECT 
        st.id as stall_id,
        st.stall_number,
        st.stall_name,
        st.description,
        st.location,
        sc.school_name,
        COALESCE(st.total_feedback_count, 0) as total_feedbacks,
        COALESCE(st.rank_1_votes, 0) as rank_1_votes,
        COALESCE(st.rank_2_votes, 0) as rank_2_votes,
        COALESCE(st.rank_3_votes, 0) as rank_3_votes
      FROM stalls st
      LEFT JOIN schools sc ON st.school_id = sc.id
      WHERE st.school_id = $1 AND st.is_active = true
      ORDER BY st.stall_number ASC
    `;

    const stalls = await query(queryText, [student.school_id]);

    if (stalls.length < 3) {
      return errorResponse(res, `Your school has only ${stalls.length} stalls. Minimum 3 required.`, 400);
    }

    return successResponse(res, {
      student_info: {
        id: student.id,
        registration_no: student.registration_no,
        full_name: student.full_name,
        school_name: student.school_name
      },
      stalls: stalls.map(s => ({
        stall_id: s.stall_id,
        stall_number: s.stall_number,
        stall_name: s.stall_name,
        description: s.description,
        location: s.location
      })),
      total_stalls: stalls.length,
      instructions: 'Select top 3 stalls from YOUR SCHOOL ONLY. Ranks: 1 (best), 2 (second), 3 (third). ONE-TIME submission.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit school stall rankings (Category 2 - ONE-TIME only)
 * @route POST /api/student/submit-school-ranking
 */
const submitSchoolRanking = async (req, res, next) => {
  try {
    const { rankings } = req.body; // [{ stall_id, rank }]

    if (!Array.isArray(rankings) || rankings.length !== 3) {
      return errorResponse(res, 'Must provide exactly 3 stall rankings', 400);
    }

    const ranks = rankings.map(r => r.rank).sort();
    if (ranks.join(',') !== '1,2,3') {
      return errorResponse(res, 'Rankings must be exactly 1, 2, and 3 (no duplicates)', 400);
    }

    const stallIds = rankings.map(r => r.stall_id);
    if (new Set(stallIds).size !== 3) {
      return errorResponse(res, 'Must rank 3 different stalls', 400);
    }

    const student = await Student.findById(req.user.id, query);
    
    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    if (student.has_completed_ranking) {
      return errorResponse(res, 'You have already submitted your rankings. This is ONE-TIME only.', 409);
    }

    // Verify ALL stalls belong to student's school
    const stallCheckQuery = `
      SELECT st.id, st.stall_name, st.school_id, sc.school_name
      FROM stalls st
      LEFT JOIN schools sc ON st.school_id = sc.id
      WHERE st.id = ANY($1::uuid[])
    `;
    
    const stallsToRank = await query(stallCheckQuery, [stallIds]);

    if (stallsToRank.length !== 3) {
      return errorResponse(res, 'One or more stalls not found', 404);
    }

    const invalidStalls = stallsToRank.filter(s => s.school_id !== student.school_id);
    if (invalidStalls.length > 0) {
      return errorResponse(res, `You can only rank stalls from YOUR school. Invalid: ${invalidStalls.map(s => s.stall_name).join(', ')}`, 403);
    }

    try {
      await query('BEGIN');

      const rankingData = rankings.map(r => ({
        student_id: req.user.id,
        stall_id: r.stall_id,
        rank: r.rank
      }));

      await Ranking.bulkCreate(rankingData, query);

      await query(
        `UPDATE students 
         SET has_completed_ranking = true,
             selected_category = 'CATEGORY_2',
             updated_at = NOW()
         WHERE id = $1`,
        [req.user.id]
      );

      for (const ranking of rankings) {
        const columnName = ranking.rank === 1 ? 'rank_1_votes' 
                         : ranking.rank === 2 ? 'rank_2_votes' 
                         : 'rank_3_votes';
        
        await query(
          `UPDATE stalls 
           SET ${columnName} = ${columnName} + 1,
               weighted_score = (rank_1_votes * 5) + (rank_2_votes * 3) + (rank_3_votes * 1),
               updated_at = NOW()
           WHERE id = $1`,
          [ranking.stall_id]
        );
      }

      await query('COMMIT');

      const rankedStallsQuery = `
        SELECT r.rank, st.stall_name, st.stall_number
        FROM rankings r
        LEFT JOIN stalls st ON r.stall_id = st.id
        WHERE r.student_id = $1
        ORDER BY r.rank ASC
      `;
      
      const rankedStalls = await query(rankedStallsQuery, [req.user.id]);

      return successResponse(res, {
        message: '🎉 Rankings submitted successfully!',
        submitted_rankings: rankedStalls.map(r => ({
          rank: r.rank,
          stall_name: r.stall_name,
          stall_number: r.stall_number
        })),
        note: 'Your rankings are recorded and cannot be changed.'
      }, 'School rankings submitted', 201);

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    next(error);
  }
};

/**
 * Get student's submitted school ranking (view only)
 * @route GET /api/student/my-school-ranking
 */
const getMySchoolRanking = async (req, res, next) => {
  try {
    const student = await Student.findById(req.user.id, query);
    
    if (!student || !student.has_completed_ranking) {
      return errorResponse(res, 'No rankings submitted yet', 404);
    }

    const queryText = `
      SELECT 
        r.rank,
        r.submitted_at,
        st.stall_name,
        st.stall_number,
        st.description
      FROM rankings r
      LEFT JOIN stalls st ON r.stall_id = st.id
      WHERE r.student_id = $1
      ORDER BY r.rank ASC
    `;

    const rankings = await query(queryText, [req.user.id]);

    return successResponse(res, {
      rankings: rankings.map(r => ({
        rank: r.rank,
        stall_name: r.stall_name,
        stall_number: r.stall_number,
        description: r.description
      })),
      submitted_at: rankings[0].submitted_at,
      note: 'This ranking was ONE-TIME and cannot be changed.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify reset credentials - Step 1 of password reset
 * Validates DOB and pincode before allowing password reset
 * @route POST /api/student/verify-reset-credentials
 */
const verifyResetCredentials = async (req, res, next) => {
  try {
    const { registration_no, date_of_birth, pincode } = req.body;

    // Validate required fields
    if (!registration_no || !date_of_birth || !pincode) {
      return errorResponse(res, 'Registration number, date of birth, and pincode are required', 400);
    }

    // Validate pincode format using model validation method
    if (!Student.isValidPincode(pincode)) {
      return errorResponse(res, 'Pincode must be exactly 6 digits', 400);
    }

    // Validate date of birth format and age using model validation method
    if (!Student.isValidDateOfBirth(date_of_birth)) {
      return errorResponse(res, 'Invalid date of birth format or age requirement not met', 400);
    }

    // Verify credentials match
    const student = await Student.verifyResetCredentials(
      registration_no,
      date_of_birth,
      pincode,
      query
    );

    if (!student) {
      return errorResponse(res, 'Invalid credentials. Please check your details.', 401);
    }

    // Generate temporary reset token (valid for 10 minutes)
    const resetToken = jwt.sign(
      { 
        id: student.id, 
        registration_no: student.registration_no,
        purpose: 'password_reset' 
      },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    return successResponse(res, {
      reset_token: resetToken,
      registration_no: student.registration_no,
      full_name: student.full_name,
      expires_in: '10 minutes'
    }, 'Credentials verified successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password - Step 2 of password reset
 * Updates password using the reset token
 * @route POST /api/student/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { reset_token, new_password, confirm_password } = req.body;

    // Validate required fields
    if (!reset_token || !new_password || !confirm_password) {
      return errorResponse(res, 'Reset token and passwords are required', 400);
    }

    // Validate passwords match
    if (new_password !== confirm_password) {
      return errorResponse(res, 'Passwords do not match', 400);
    }

    // Validate password strength using model validation method
    if (!Student.isValidPassword(new_password)) {
      return errorResponse(res, 'Password must be at least 8 characters with at least one letter and one number', 400);
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(reset_token, process.env.JWT_SECRET);
      
      if (decoded.purpose !== 'password_reset') {
        return errorResponse(res, 'Invalid reset token', 401);
      }
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 'Reset token has expired. Please verify credentials again.', 401);
      }
      return errorResponse(res, 'Invalid reset token', 401);
    }

    // Reset password
    const updatedStudent = await Student.resetPassword(decoded.id, new_password, query);

    if (!updatedStudent) {
      return errorResponse(res, 'Failed to reset password', 500);
    }

    // Generate new auth token
    const authToken = jwt.sign(
      { 
        id: updatedStudent.id, 
        registration_no: updatedStudent.registration_no, 
        email: updatedStudent.email,
        role: updatedStudent.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set secure HTTP-Only cookie
    setAuthCookie(res, authToken);

    return successResponse(res, {
      token: authToken,
      student: {
        id: updatedStudent.id,
        full_name: updatedStudent.full_name,
        registration_no: updatedStudent.registration_no,
        email: updatedStudent.email
      }
    }, 'Password reset successful. You are now logged in.');
  } catch (error) {
    next(error);
  }
};

export default {
  login,
  logout,
  getProfile,
  getQRCode,
  getCheckInHistory,
  updateProfile,
  scanStall,
  submitFeedback,
  getMyVisits,
  getMySchoolStalls,
  submitSchoolRanking,
  getMySchoolRanking,
  verifyResetCredentials,
  resetPassword
};
