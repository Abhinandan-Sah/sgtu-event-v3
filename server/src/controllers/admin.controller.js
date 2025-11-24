import Admin from '../models/Admin.model.js';
import Student from '../models/Student.model.js';
import Volunteer from '../models/Volunteer.model.js';
import Stall from '../models/Stall.model.js';
import CheckInOut from '../models/CheckInOut.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { successResponse, errorResponse } from '../helpers/response.js';
import { setAuthCookie, clearAuthCookie } from '../helpers/cookie.js';
import { query } from '../config/db.js';

/**
 * Admin Controller
 * Handles admin authentication and management operations
 */

/**
 * Admin login
 * @route POST /api/admin/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    const admin = await Admin.findByEmail(email, query);
    if (!admin) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const isValidPassword = await admin.comparePassword(password);
    if (!isValidPassword) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set secure HTTP-Only cookie
    setAuthCookie(res, token);

    return successResponse(res, {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role
      }
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

/**
 * Get admin profile
 * @route GET /api/admin/profile
 */
const getProfile = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.user.id, query);
    if (!admin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    return successResponse(res, {
      id: admin.id,
      email: admin.email,
      full_name: admin.full_name,
      role: admin.role,
      created_at: admin.created_at
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin logout
 * @route POST /api/admin/logout
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
 * Update admin profile
 * @route PUT /api/admin/profile
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

    const updatedAdmin = await Admin.update(req.user.id, updateData, query);
    if (!updatedAdmin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    return successResponse(res, {
      id: updatedAdmin.id,
      email: updatedAdmin.email,
      full_name: updatedAdmin.full_name
    }, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get all students (admin view)
 * @route GET /api/admin/students
 */
const getAllStudents = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const students = await Student.findAll(limit, offset, query);
    return successResponse(res, students);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all volunteers (admin view)
 * @route GET /api/admin/volunteers
 */
const getAllVolunteers = async (req, res, next) => {
  try {
    const volunteers = await Volunteer.findAllActive(query);
    return successResponse(res, volunteers);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all stalls (admin view)
 * @route GET /api/admin/stalls
 */
const getAllStalls = async (req, res, next) => {
  try {
    const stalls = await Stall.findAll(query);
    return successResponse(res, stalls);
  } catch (error) {
    next(error);
  }
};

/**
 * Get system statistics
 * @route GET /api/admin/stats
 */
const getStats = async (req, res, next) => {
  try {
    const [students, volunteers, stalls] = await Promise.all([
      Student.findAll(100, 0, query),
      Volunteer.findAllActive(query),
      Stall.findAll(query)
    ]);

    return successResponse(res, {
      totalStudents: students.length,
      totalVolunteers: volunteers.length,
      totalStalls: stalls.length,
      activeCheckIns: 0 // TODO: Implement check-in counting
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get top schools based on student rankings (Category 2 - ADMIN ONLY)
 * @route GET /api/admin/top-schools
 */
const getTopSchools = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const queryText = `
      SELECT 
        sc.id as school_id,
        sc.school_name,
        COUNT(DISTINCT s.id) as total_students_ranked,
        SUM(CASE WHEN st.school_id = sc.id THEN 
          CASE r.rank
            WHEN 1 THEN 5
            WHEN 2 THEN 3
            WHEN 3 THEN 1
            ELSE 0
          END
        ELSE 0 END) as school_score,
        SUM(CASE WHEN st.school_id = sc.id AND r.rank = 1 THEN 1 ELSE 0 END) as rank_1_count,
        SUM(CASE WHEN st.school_id = sc.id AND r.rank = 2 THEN 1 ELSE 0 END) as rank_2_count,
        SUM(CASE WHEN st.school_id = sc.id AND r.rank = 3 THEN 1 ELSE 0 END) as rank_3_count,
        COUNT(DISTINCT CASE WHEN st.school_id = sc.id THEN st.id END) as ranked_stalls_count
      FROM schools sc
      LEFT JOIN students s ON s.school_id = sc.id AND s.has_completed_ranking = true
      LEFT JOIN rankings r ON r.student_id = s.id
      LEFT JOIN stalls st ON r.stall_id = st.id
      WHERE s.has_completed_ranking = true
      GROUP BY sc.id, sc.school_name
      HAVING SUM(CASE WHEN st.school_id = sc.id THEN 
        CASE r.rank
          WHEN 1 THEN 5
          WHEN 2 THEN 3
          WHEN 3 THEN 1
          ELSE 0
        END
      ELSE 0 END) > 0
      ORDER BY school_score DESC, total_students_ranked DESC
      LIMIT $1
    `;

    const topSchools = await query(queryText, [limit]);

    // Get overall stats
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT s.id) as total_students_participated,
        COUNT(DISTINCT sc.id) as total_schools_participated,
        COUNT(DISTINCT st.id) as total_stalls_ranked
      FROM students s
      LEFT JOIN rankings r ON r.student_id = s.id
      LEFT JOIN stalls st ON r.stall_id = st.id
      LEFT JOIN schools sc ON s.school_id = sc.id
      WHERE s.has_completed_ranking = true
    `;

    const stats = await query(statsQuery);

    return successResponse(res, {
      top_schools: topSchools.map((school, index) => ({
        position: index + 1,
        school_id: school.school_id,
        school_name: school.school_name,
        total_score: parseInt(school.school_score),
        breakdown: {
          rank_1_votes: parseInt(school.rank_1_count),
          rank_2_votes: parseInt(school.rank_2_count),
          rank_3_votes: parseInt(school.rank_3_count)
        },
        students_participated: parseInt(school.total_students_ranked),
        stalls_ranked: parseInt(school.ranked_stalls_count)
      })),
      scoring_system: {
        rank_1: '5 points',
        rank_2: '3 points',
        rank_3: '1 point',
        description: 'Schools earn points when their stalls are ranked by students from their own school'
      },
      overall_stats: {
        total_students_participated: parseInt(stats[0].total_students_participated),
        total_schools_participated: parseInt(stats[0].total_schools_participated),
        total_stalls_ranked: parseInt(stats[0].total_stalls_ranked)
      }
    }, 'Top schools retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get top-ranked stalls (Category 2 - ADMIN ONLY)
 * @route GET /api/admin/top-stalls
 */
const getTopStalls = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const queryText = `
      SELECT 
        st.id as stall_id,
        st.stall_number,
        st.stall_name,
        st.description,
        st.location,
        sc.id as school_id,
        sc.school_name,
        st.rank_1_votes,
        st.rank_2_votes,
        st.rank_3_votes,
        st.weighted_score,
        (st.rank_1_votes + st.rank_2_votes + st.rank_3_votes) as total_votes
      FROM stalls st
      LEFT JOIN schools sc ON st.school_id = sc.id
      WHERE (st.rank_1_votes + st.rank_2_votes + st.rank_3_votes) > 0
      ORDER BY st.weighted_score DESC, st.rank_1_votes DESC, st.stall_number ASC
      LIMIT $1
    `;

    const topStalls = await query(queryText, [limit]);

    // Get overall ranking stats
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT stall_id) as total_stalls_ranked,
        SUM(CASE WHEN rank = 1 THEN 1 ELSE 0 END) as total_rank_1_votes,
        SUM(CASE WHEN rank = 2 THEN 1 ELSE 0 END) as total_rank_2_votes,
        SUM(CASE WHEN rank = 3 THEN 1 ELSE 0 END) as total_rank_3_votes,
        COUNT(DISTINCT student_id) as total_students_voted
      FROM rankings
    `;

    const stats = await query(statsQuery);

    return successResponse(res, {
      top_stalls: topStalls.map((stall, index) => ({
        position: index + 1,
        stall_id: stall.stall_id,
        stall_number: stall.stall_number,
        stall_name: stall.stall_name,
        description: stall.description,
        location: stall.location,
        school: {
          school_id: stall.school_id,
          school_name: stall.school_name
        },
        ranking_stats: {
          rank_1_votes: parseInt(stall.rank_1_votes),
          rank_2_votes: parseInt(stall.rank_2_votes),
          rank_3_votes: parseInt(stall.rank_3_votes),
          total_votes: parseInt(stall.total_votes),
          weighted_score: parseInt(stall.weighted_score)
        }
      })),
      scoring_system: {
        rank_1: '5 points',
        rank_2: '3 points',
        rank_3: '1 point',
        formula: 'weighted_score = (rank_1_votes × 5) + (rank_2_votes × 3) + (rank_3_votes × 1)'
      },
      overall_stats: {
        total_stalls_ranked: parseInt(stats[0].total_stalls_ranked),
        total_students_voted: parseInt(stats[0].total_students_voted),
        breakdown: {
          rank_1_votes: parseInt(stats[0].total_rank_1_votes),
          rank_2_votes: parseInt(stats[0].total_rank_2_votes),
          rank_3_votes: parseInt(stats[0].total_rank_3_votes)
        }
      }
    }, 'Top stalls retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export default {
  login,
  logout,
  getProfile,
  updateProfile,
  getAllStudents,
  getAllVolunteers,
  getAllStalls,
  getStats,
  getTopSchools,
  getTopStalls
};
