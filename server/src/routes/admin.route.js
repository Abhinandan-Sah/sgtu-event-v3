import express from 'express';
const router = express.Router();
import adminController from '../controllers/admin.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

/**
 * Admin Routes
 * Security: Router-level middleware for DRY principle
 * All protected routes automatically require ADMIN role
 */

// 🔓 Public routes (no authentication)
router.post('/login', adminController.login);

// 🔒 Apply authentication + ADMIN authorization to all routes below
router.use(authenticateToken);
router.use(authorizeRoles('ADMIN'));

// Protected routes (automatically secured with ADMIN role)
router.post('/logout', adminController.logout);
router.get('/profile', adminController.getProfile);
router.put('/profile', adminController.updateProfile);
router.get('/students', adminController.getAllStudents);
router.get('/volunteers', adminController.getAllVolunteers);
router.get('/stalls', adminController.getAllStalls);
router.get('/stats', adminController.getStats);

// School ranking results (Category 2 - ADMIN ONLY)
router.get('/top-schools', adminController.getTopSchools);
router.get('/top-stalls', adminController.getTopStalls);

export default router;
