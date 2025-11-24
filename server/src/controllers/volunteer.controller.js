import Volunteer from '../models/Volunteer.model.js';
import Student from '../models/Student.model.js';
import Stall from '../models/Stall.model.js';
import CheckInOut from '../models/CheckInOut.model.js';
import QRCodeService from '../services/qrCode.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { successResponse, errorResponse } from '../helpers/response.js';
import { setAuthCookie, clearAuthCookie } from '../helpers/cookie.js';
import { query } from '../config/db.js';

/**
 * Volunteer Controller
 * Handles volunteer authentication, QR code scanning and check-in/out
 */

/**
 * Volunteer login
 * @route POST /api/volunteer/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    const volunteer = await Volunteer.findByEmail(email, query);
    if (!volunteer) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Check if volunteer is active
    if (!volunteer.is_active) {
      return errorResponse(res, 'Account is deactivated. Contact admin.', 403);
    }

    // Verify password using model method
    const isValidPassword = await volunteer.comparePassword(password);
    if (!isValidPassword) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const token = jwt.sign(
      { 
        id: volunteer.id, 
        email: volunteer.email,
        role: volunteer.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set secure HTTP-Only cookie
    setAuthCookie(res, token);

    return successResponse(res, {
      token,
      volunteer: {
        id: volunteer.id,
        email: volunteer.email,
        full_name: volunteer.full_name,
        phone: volunteer.phone,
        assigned_location: volunteer.assigned_location,
        total_scans_performed: volunteer.total_scans_performed
      }
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

/**
 * Volunteer registration
 * @route POST /api/volunteer/register
 */
const register = async (req, res, next) => {
  try {
    const { email, password, full_name, phone, assigned_location } = req.body;

    if (!email || !password || !full_name) {
      return errorResponse(res, 'Email, password, and full name are required', 400);
    }

    // Check if volunteer already exists
    const existingVolunteer = await Volunteer.findByEmail(email, query);
    if (existingVolunteer) {
      return errorResponse(res, 'Email already registered', 409);
    }

    // Create volunteer using model method (handles password hashing)
    const newVolunteer = await Volunteer.create({
      email,
      password,
      full_name,
      phone,
      assigned_location
    }, query);

    // Generate token
    const token = jwt.sign(
      { 
        id: newVolunteer.id, 
        email: newVolunteer.email,
        role: newVolunteer.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set secure HTTP-Only cookie
    setAuthCookie(res, token);

    return successResponse(res, {
      token,
      volunteer: {
        id: newVolunteer.id,
        email: newVolunteer.email,
        full_name: newVolunteer.full_name,
        phone: newVolunteer.phone,
        assigned_location: newVolunteer.assigned_location
      }
    }, 'Registration successful', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Get volunteer profile
 * @route GET /api/volunteer/profile
 */
const getProfile = async (req, res, next) => {
  try {
    const volunteer = await Volunteer.findById(req.user.id, query);
    if (!volunteer) {
      return errorResponse(res, 'Volunteer not found', 404);
    }

    return successResponse(res, {
      id: volunteer.id,
      email: volunteer.email,
      full_name: volunteer.full_name,
      phone: volunteer.phone,
      assigned_location: volunteer.assigned_location,
      is_active: volunteer.is_active,
      total_scans_performed: volunteer.total_scans_performed,
      created_at: volunteer.created_at
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Volunteer logout
 * @route POST /api/volunteer/logout
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
 * Smart scan - Automatically handles check-in OR check-out
 * @route POST /api/volunteer/scan/student
 * @access Protected (Volunteer only - enforced by authorizeRoles middleware)
 * 
 * @description
 * Allows authenticated volunteers to scan ANY student's QR code for entry/exit management.
 * The QR code token contains the student's registration number, which is used to identify
 * and process the check-in/out operation.
 * 
 * Security Model:
 * - JWT token validates the VOLUNTEER role (via middleware)
 * - QR token identifies the STUDENT being scanned
 * - No need to verify volunteer owns the QR code (volunteers scan other people)
 * 
 * Flow:
 * 1. Decode QR token to extract student registration number
 * 2. Find student in database
 * 3. Determine action (ENTRY if outside, EXIT if inside)
 * 4. Process check-in/out and update timestamps
 * 5. Calculate duration for EXIT actions
 * 6. Update volunteer scan count
 * 
 * @param {string} req.body.qr_code_token - JWT token from student's QR code
 * @returns {Object} Student info, action type (ENTRY/EXIT), scan details
 */
const scanStudentQR = async (req, res, next) => {
  try {
    const { qr_code_token } = req.body;

    if (!qr_code_token) {
      return errorResponse(res, 'QR code token is required', 400);
    }

    console.log('🔍 [SCAN] Received QR token (first 50 chars):', qr_code_token.substring(0, 50) + '...');

    // 1️⃣ Verify QR code token (try rotating first, fallback to static)
    let decoded = QRCodeService.verifyRotatingStudentToken(qr_code_token);
    
    // If not a valid rotating token, try static token verification
    if (!decoded.valid && decoded.isStatic) {
      console.log('🔄 [SCAN] Not a rotating token, trying static verification...');
      decoded = await QRCodeService.verifyStudentQRToken(qr_code_token);
    }
    
    if (!decoded || !decoded.valid) {
      console.log('❌ [SCAN] Invalid QR token');
      return errorResponse(res, 'Invalid QR code', 400);
    }

    console.log('✅ [SCAN] QR token verified:', decoded.registration_no);

    // 2️⃣ Find student by registration number
    const student = await Student.findByRegistrationNo(decoded.registration_no, query);
    
    if (!student) {
      console.log('❌ [SCAN] Student not found:', decoded.registration_no);
      
      // Debug: Check if ANY students exist
      const sampleStudents = await query('SELECT registration_no, full_name FROM students LIMIT 5');
      console.log('📊 [DEBUG] Sample students in database:', sampleStudents);
      
      return errorResponse(res, `Student not found. Registration: ${decoded.registration_no}`, 404);
    }

    console.log('✅ [SCAN] Student found:', student.full_name);

    // 3️⃣ Verify volunteer is active (optional check, can be removed if not needed)
    const volunteer = await Volunteer.findById(req.user.id, query);
    if (volunteer && !volunteer.is_active) {
      console.log('⚠️ [SCAN] Inactive volunteer attempted scan:', volunteer.email);
      return errorResponse(res, 'Your volunteer account is inactive. Contact admin.', 403);
    }

    if (volunteer) {
      console.log('✅ [SCAN] Volunteer:', volunteer.full_name, '| Location:', volunteer.assigned_location);
    }

    // 4️⃣ 🎯 SMART LOGIC: Determine action based on current status
    const isCurrentlyInside = student.is_inside_event;
    const action = isCurrentlyInside ? 'EXIT' : 'ENTRY';
    
    console.log(`🎯 [SCAN] Current status: ${isCurrentlyInside ? 'INSIDE' : 'OUTSIDE'}`);
    console.log(`🎯 [SCAN] Action to perform: ${action}`);

    // 5️⃣ Store the check-in time BEFORE updating (for duration calculation)
    const previousCheckInTime = student.last_checkin_at;

    // 6️⃣ Process check-in/out FIRST (toggles is_inside_event automatically and updates timestamps)
    const updatedStudent = await Student.processCheckInOut(student.id, query);

    // 7️⃣ Calculate duration AFTER checkout using the previous check-in time
    let durationMinutes = 0;
    let checkInOutRecord = null;

    if (action === 'ENTRY') {
      // 🔥 FIX: Save check-in record to database
      checkInOutRecord = await CheckInOut.create({
        student_id: student.id,
        volunteer_id: req.user.id,
        scan_type: 'CHECKIN',
        scan_number: updatedStudent.total_scan_count,
        duration_minutes: null
      }, query);
      
      console.log('✅ [DB] Check-in record saved:', checkInOutRecord.id);
      
    } else if (action === 'EXIT' && previousCheckInTime) {
      const checkInTime = new Date(previousCheckInTime);
      const checkOutTime = new Date(updatedStudent.last_checkout_at);
      durationMinutes = Math.floor((checkOutTime - checkInTime) / (1000 * 60));
      
      console.log(`⏱️ [SCAN] Duration: ${durationMinutes} minutes (${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m)`);
      console.log(`⏱️ [SCAN] Check-in: ${checkInTime.toISOString()}, Check-out: ${checkOutTime.toISOString()}`);
      
      // 🔥 FIX: Save check-out record to database
      checkInOutRecord = await CheckInOut.create({
        student_id: student.id,
        volunteer_id: req.user.id,
        scan_type: 'CHECKOUT',
        scan_number: updatedStudent.total_scan_count,
        duration_minutes: durationMinutes
      }, query);
      
      console.log('✅ [DB] Check-out record saved:', checkInOutRecord.id);
      
      // Update total active duration
      await Student.updateActiveDuration(student.id, durationMinutes, query);
    }

    // 8️⃣ Update volunteer's scan count
    await query(
      'UPDATE volunteers SET total_scans_performed = total_scans_performed + 1 WHERE id = $1',
      [req.user.id]
    );

    console.log(`✅ [SCAN] ${action} successful for ${student.full_name}`);

    // 9️⃣ Return different response based on action
    const responseData = {
      student: {
        id: updatedStudent.id,
        full_name: updatedStudent.full_name,
        registration_no: updatedStudent.registration_no,
        school_name: updatedStudent.school_name,
        is_inside_event: updatedStudent.is_inside_event,
        total_scan_count: updatedStudent.total_scan_count
      },
      action: action,
      scan_details: {
        timestamp: new Date().toISOString(),
        volunteer_id: req.user.id,
        volunteer_email: req.user.email
      }
    };

    // Add action-specific fields
    if (action === 'ENTRY') {
      responseData.student.check_in_time = updatedStudent.last_checkin_at;
      responseData.message = `Welcome ${student.full_name}! Enjoy the event.`;
    } else {
      responseData.student.check_out_time = updatedStudent.last_checkout_at;
      responseData.student.duration_minutes = durationMinutes;
      responseData.student.duration_formatted = `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;
      responseData.message = `Goodbye ${student.full_name}! You spent ${responseData.student.duration_formatted} at the event.`;
    }

    return successResponse(
      res, 
      responseData,
      action === 'ENTRY' 
        ? 'Student checked in successfully at entry gate' 
        : 'Student checked out successfully at exit gate',
      action === 'ENTRY' ? 201 : 200
    );

  } catch (error) {
    console.error('❌ [SCAN] Error:', error);
    next(error);
  }
};

/**
 * Scan stall QR code and verify
 * @route POST /api/volunteer/scan/stall
 */
const scanStallQR = async (req, res, next) => {
  try {
    const { qr_code_token } = req.body;

    if (!qr_code_token) {
      return errorResponse(res, 'QR code token is required', 400);
    }

    // Verify QR code token
    const decoded = await QRCodeService.verifyStallQRToken(qr_code_token);
    if (!decoded) {
      return errorResponse(res, 'Invalid QR code', 400);
    }

    // Find stall
    const stall = await Stall.findByQRToken(qr_code_token, query);
    if (!stall) {
      return errorResponse(res, 'Stall not found', 404);
    }

    return successResponse(res, {
      stall: {
        id: stall.id,
        stall_name: stall.stall_name,
        stall_number: stall.stall_number,
        school_name: stall.school_name,
        description: stall.description
      }
    }, 'QR code verified successfully');
  } catch (error) {
    next(error);
  }
};



/**
 * Get volunteer's check-in history
 * @route GET /api/volunteer/history
 */
const getHistory = async (req, res, next) => {
  try {
    // Verify volunteer exists
    const volunteer = await Volunteer.findById(req.user.id, query);
    if (!volunteer) {
      return errorResponse(res, 'Volunteer not found', 404);
    }

    // Get history
    const history = await CheckInOut.findByVolunteerId(req.user.id, query);
    
    return successResponse(res, {
      volunteer_id: req.user.id,
      volunteer_name: volunteer.full_name,
      total_scans: history.length,
      history: history
    });
  } catch (error) {
    next(error);
  }
};

export default {
  login,
  register,
  logout,
  getProfile,
  scanStudentQR,
  scanStallQR,
  getHistory
};
