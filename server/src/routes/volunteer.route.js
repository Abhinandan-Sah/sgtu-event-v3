import express from 'express';
const router = express.Router();
import volunteerController from '../controllers/volunteer.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

/**
 * Volunteer Routes
 * Security: Router-level middleware for DRY principle
 * All protected routes automatically require VOLUNTEER role
 */

// 🔓 Public routes (no authentication)
router.post('/login', volunteerController.login);
router.post('/register', volunteerController.register);

// 🔒 Apply authentication + VOLUNTEER authorization to all routes below
router.use(authenticateToken);
router.use(authorizeRoles('VOLUNTEER'));

// Protected routes (automatically secured with VOLUNTEER role)
router.post('/logout', volunteerController.logout);
router.get('/profile', volunteerController.getProfile);

// ✨ Smart QR scanning - Auto-detects entry/exit
router.post('/scan/student', volunteerController.scanStudentQR);
// router.post('/scan/stall', volunteerController.scanStallQR);

// Totel Number of Scan by Volunteer History route
router.get('/history', volunteerController.getHistory);

// ============================================================
// EVENT ASSIGNMENT ROUTES (Multi-Event Support)
// ============================================================

/**
 * @route   GET /api/volunteer/assigned-events
 * @desc    Get events assigned to volunteer
 * @access  Private (VOLUNTEER)
 * @note    Volunteers can see which events they're assigned to
 */
router.get('/assigned-events', volunteerController.getAssignedEvents);

/**
 * @note    UNIVERSAL SCANNER: /scan/student handles ALL scenarios
 *          - Original check-in/check-out (legacy single event)
 *          - Multi-event scenarios (automatically validates registration)
 *          - No need for separate event-specific scan endpoints
 */

export default router;
