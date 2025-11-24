// Event Manager Routes - Protected routes for event managers
import express from 'express';
import EventManagerController from '../controllers/eventManager.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { authLimiter, apiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// ============================================================
// PUBLIC ROUTES (Authentication)
// ============================================================

/**
 * @route   POST /api/event-managers/login
 * @desc    Login event manager
 * @access  Public
 * @note    Event managers are created by admins only
 */
router.post('/login', authLimiter, EventManagerController.login);

// ============================================================
// PROTECTED ROUTES (Require authentication + EVENT_MANAGER role)
// ============================================================

// Apply authentication and authorization middleware to all routes below
router.use(authenticateToken);
router.use(authorizeRoles('EVENT_MANAGER'));
router.use(apiLimiter);

/**
 * @route   POST /api/event-managers/logout
 * @desc    Logout event manager
 * @access  Private (EVENT_MANAGER)
 */
router.post('/logout', EventManagerController.logout);

/**
 * @route   GET /api/event-managers/profile
 * @desc    Get event manager profile
 * @access  Private (EVENT_MANAGER)
 */
router.get('/profile', EventManagerController.getProfile);

/**
 * @route   PUT /api/event-managers/profile
 * @desc    Update event manager profile
 * @access  Private (EVENT_MANAGER)
 */
router.put('/profile', EventManagerController.updateProfile);

// ============================================================
// EVENT MANAGEMENT ROUTES
// ============================================================

/**
 * @route   POST /api/event-managers/events
 * @desc    Create new event
 * @access  Private (EVENT_MANAGER)
 */
router.post('/events', EventManagerController.createEvent);

/**
 * @route   GET /api/event-managers/events
 * @desc    Get all events created by manager
 * @access  Private (EVENT_MANAGER)
 */
router.get('/events', EventManagerController.getMyEvents);

/**
 * @route   GET /api/event-managers/events/:eventId
 * @desc    Get single event details
 * @access  Private (EVENT_MANAGER - owner only)
 */
router.get('/events/:eventId', EventManagerController.getEventDetails);

/**
 * @route   PUT /api/event-managers/events/:eventId
 * @desc    Update event
 * @access  Private (EVENT_MANAGER - owner only)
 */
router.put('/events/:eventId', EventManagerController.updateEvent);

/**
 * @route   DELETE /api/event-managers/events/:eventId
 * @desc    Delete event (soft delete - cancel)
 * @access  Private (EVENT_MANAGER - owner only)
 */
router.delete('/events/:eventId', EventManagerController.deleteEvent);

// ============================================================
// VOLUNTEER ASSIGNMENT ROUTES
// ============================================================

/**
 * @route   POST /api/event-managers/events/:eventId/volunteers
 * @desc    Assign volunteer to event
 * @access  Private (EVENT_MANAGER - owner only)
 */
router.post('/events/:eventId/volunteers', EventManagerController.assignVolunteer);

/**
 * @route   GET /api/event-managers/events/:eventId/volunteers
 * @desc    Get volunteers assigned to event
 * @access  Private (EVENT_MANAGER - owner only)
 */
router.get('/events/:eventId/volunteers', EventManagerController.getEventVolunteers);

/**
 * @route   DELETE /api/event-managers/events/:eventId/volunteers/:volunteerId
 * @desc    Remove volunteer from event
 * @access  Private (EVENT_MANAGER - owner only)
 */
router.delete('/events/:eventId/volunteers/:volunteerId', EventManagerController.removeVolunteer);

// ============================================================
// REGISTRATION MANAGEMENT ROUTES
// ============================================================

/**
 * @route   GET /api/event-managers/events/:eventId/registrations
 * @desc    Get event registrations
 * @access  Private (EVENT_MANAGER - owner only)
 */
router.get('/events/:eventId/registrations', EventManagerController.getEventRegistrations);

// ============================================================
// ANALYTICS ROUTES
// ============================================================

/**
 * @route   GET /api/event-managers/events/:eventId/analytics
 * @desc    Get comprehensive event analytics
 * @access  Private (EVENT_MANAGER - owner only)
 */
router.get('/events/:eventId/analytics', EventManagerController.getEventAnalytics);

export default router;
