import express from 'express';
const router = express.Router();
import studentController from '../controllers/student.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

/**
 * Student Routes
 * Security: Router-level middleware for DRY principle
 * All protected routes automatically require STUDENT role
 */

// 🔓 Public routes (no authentication)
router.post('/login', studentController.login);
router.post('/verify-reset-credentials', studentController.verifyResetCredentials);
router.post('/reset-password', studentController.resetPassword);

// 🔒 Apply authentication + STUDENT authorization to all routes below
router.use(authenticateToken);
router.use(authorizeRoles('STUDENT'));

// Protected routes (automatically secured with STUDENT role)
router.post('/logout', studentController.logout);
router.get('/profile', studentController.getProfile);
router.put('/profile', studentController.updateProfile);
router.get('/qr-code', studentController.getQRCode);
router.get('/check-in-history', studentController.getCheckInHistory);

// Stall interaction routes (self-service inside event)(Category 1 - student scan and submit feedback)
router.post('/scan-stall', studentController.scanStall);
router.post('/submit-feedback', studentController.submitFeedback);
router.get('/my-visits', studentController.getMyVisits);

// School ranking routes (Category 2 - students rank their own school's stalls)
router.get('/my-school-stalls', studentController.getMySchoolStalls);
router.post('/submit-school-ranking', studentController.submitSchoolRanking);
router.get('/my-submitted-rank', studentController.getMySchoolRanking);

export default router;
