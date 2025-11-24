// Event Manager Controller - Event creation, volunteer assignment, analytics
import { query } from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { successResponse, errorResponse, validationErrorResponse } from '../helpers/response.js';
import { setAuthCookie, clearAuthCookie } from '../helpers/cookie.js';

class EventManagerController {
  /**
   * Login event manager
   * POST /api/event-managers/login
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return validationErrorResponse(res, [
          { msg: 'Email and password are required' }
        ]);
      }

      // Find manager
      const manager = await EventManagerModel.findByEmail(email);
      if (!manager) {
        return errorResponse(res, 'Invalid credentials', 401);
      }

      // Check if account is active
      if (!manager.is_active) {
        return errorResponse(res, 'Account is deactivated. Contact admin.', 403);
      }

      // Verify password
      const isValid = await EventManagerModel.verifyPassword(password, manager.password_hash);
      if (!isValid) {
        return errorResponse(res, 'Invalid credentials', 401);
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: manager.id,
          email: manager.email,
          role: manager.role
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      // Set HTTP-only cookie
      setAuthCookie(res, token);

      return successResponse(
        res,
        {
          manager: {
            id: manager.id,
            email: manager.email,
            full_name: manager.full_name,
            organization: manager.organization,
            role: manager.role,
            is_approved_by_admin: manager.is_approved_by_admin,
            total_events_created: manager.total_events_created
          },
          token,
          approval_status: manager.is_approved_by_admin 
            ? 'approved' 
            : 'pending_approval'
        },
        'Login successful'
      );
    } catch (error) {
      console.error('Event manager login error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Logout event manager
   * POST /api/event-managers/logout
   */
  static async logout(req, res) {
    try {
      clearAuthCookie(res);
      return successResponse(res, null, 'Logged out successfully');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get event manager profile
   * GET /api/event-managers/profile
   */
  static async getProfile(req, res) {
    try {
      const managerId = req.user.id;

      const manager = await EventManagerModel.findById(managerId);
      if (!manager) {
        return errorResponse(res, 'Manager not found', 404);
      }

      // Get stats
      const stats = await EventManagerModel.getStats(managerId);

      return successResponse(res, {
        manager: {
          id: manager.id,
          email: manager.email,
          full_name: manager.full_name,
          phone: manager.phone,
          organization: manager.organization,
          role: manager.role,
          is_approved_by_admin: manager.is_approved_by_admin,
          approved_at: manager.approved_at,
          approved_by_admin_name: manager.approved_by_admin_name,
          created_at: manager.created_at
        },
        stats
      });
    } catch (error) {
      console.error('Get profile error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Update event manager profile
   * PUT /api/event-managers/profile
   */
  static async updateProfile(req, res) {
    try {
      const managerId = req.user.id;
      const { full_name, phone, organization, password } = req.body;

      const updates = {};
      if (full_name) updates.full_name = full_name;
      if (phone) updates.phone = phone;
      if (organization) updates.organization = organization;
      if (password) updates.password = password;

      const updated = await EventManagerModel.update(managerId, updates);

      return successResponse(res, { manager: updated }, 'Profile updated successfully');
    } catch (error) {
      console.error('Update profile error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Create new event
   * POST /api/event-managers/events
   */
  static async createEvent(req, res) {
    try {
      const managerId = req.user.id;

      // Check if manager is approved
      const manager = await EventManagerModel.findById(managerId);
      if (!manager.is_approved_by_admin) {
        return errorResponse(
          res,
          'Your account is not approved by admin. You cannot create events yet.',
          403
        );
      }

      const eventData = req.body;

      // Validate required fields
      const required = [
        'event_name', 'event_code', 'event_type',
        'start_date', 'end_date', 'registration_start_date', 'registration_end_date'
      ];

      for (const field of required) {
        if (!eventData[field]) {
          return validationErrorResponse(res, [
            { msg: `${field} is required` }
          ]);
        }
      }

      // Check if event code is unique
      const existing = await EventModel.findByCode(eventData.event_code);
      if (existing) {
        return errorResponse(res, 'Event code already exists', 400);
      }

      // Create event
      const event = await EventModel.create(eventData, managerId);

      return successResponse(
        res,
        { event },
        event.status === 'PENDING_APPROVAL'
          ? 'Event created successfully. Awaiting admin approval.'
          : 'Event created successfully.',
        201
      );
    } catch (error) {
      console.error('Create event error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get all events created by manager
   * GET /api/event-managers/events
   */
  static async getMyEvents(req, res) {
    try {
      const managerId = req.user.id;
      const { status, page, limit } = req.query;

      const result = await EventModel.getByManager(managerId, {
        status,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20
      });

      return successResponse(res, result);
    } catch (error) {
      console.error('Get my events error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get single event details
   * GET /api/event-managers/events/:eventId
   */
  static async getEventDetails(req, res) {
    try {
      const { eventId } = req.params;
      const managerId = req.user.id;

      const event = await EventModel.findById(eventId);
      if (!event) {
        return errorResponse(res, 'Event not found', 404);
      }

      // Check ownership
      if (event.created_by_manager_id !== managerId) {
        return errorResponse(res, 'Unauthorized access to this event', 403);
      }

      // Get event stats
      const stats = await EventModel.getStats(eventId);

      return successResponse(res, { event, stats });
    } catch (error) {
      console.error('Get event details error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Update event
   * PUT /api/event-managers/events/:eventId
   */
  static async updateEvent(req, res) {
    try {
      const { eventId } = req.params;
      const managerId = req.user.id;

      // Check ownership
      const event = await EventModel.findById(eventId);
      if (!event) {
        return errorResponse(res, 'Event not found', 404);
      }

      if (event.created_by_manager_id !== managerId) {
        return errorResponse(res, 'Unauthorized access to this event', 403);
      }

      // Prevent updates if event is active or completed
      if (['ACTIVE', 'COMPLETED', 'ARCHIVED'].includes(event.status)) {
        return errorResponse(
          res,
          'Cannot update event that is active, completed, or archived',
          400
        );
      }

      const updated = await EventModel.update(eventId, req.body);

      return successResponse(res, { event: updated }, 'Event updated successfully');
    } catch (error) {
      console.error('Update event error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Delete event (soft delete)
   * DELETE /api/event-managers/events/:eventId
   */
  static async deleteEvent(req, res) {
    try {
      const { eventId } = req.params;
      const managerId = req.user.id;

      // Check ownership
      const event = await EventModel.findById(eventId);
      if (!event) {
        return errorResponse(res, 'Event not found', 404);
      }

      if (event.created_by_manager_id !== managerId) {
        return errorResponse(res, 'Unauthorized access to this event', 403);
      }

      await EventModel.delete(eventId);

      return successResponse(res, null, 'Event cancelled successfully');
    } catch (error) {
      console.error('Delete event error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Assign volunteer to event
   * POST /api/event-managers/events/:eventId/volunteers
   */
  static async assignVolunteer(req, res) {
    try {
      const { eventId } = req.params;
      const managerId = req.user.id;
      const { volunteer_id, assigned_location, permissions } = req.body;

      // Check ownership
      const event = await EventModel.findById(eventId);
      if (!event) {
        return errorResponse(res, 'Event not found', 404);
      }

      if (event.created_by_manager_id !== managerId) {
        return errorResponse(res, 'Unauthorized access to this event', 403);
      }

      if (!volunteer_id) {
        return validationErrorResponse(res, [{ msg: 'volunteer_id is required' }]);
      }

      const assignment = await EventVolunteerModel.assignVolunteer(
        eventId,
        volunteer_id,
        managerId,
        { assigned_location, permissions }
      );

      return successResponse(
        res,
        { assignment },
        'Volunteer assigned successfully',
        201
      );
    } catch (error) {
      console.error('Assign volunteer error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Remove volunteer from event
   * DELETE /api/event-managers/events/:eventId/volunteers/:volunteerId
   */
  static async removeVolunteer(req, res) {
    try {
      const { eventId, volunteerId } = req.params;
      const managerId = req.user.id;

      // Check ownership
      const event = await EventModel.findById(eventId);
      if (!event) {
        return errorResponse(res, 'Event not found', 404);
      }

      if (event.created_by_manager_id !== managerId) {
        return errorResponse(res, 'Unauthorized access to this event', 403);
      }

      await EventVolunteerModel.removeVolunteer(eventId, volunteerId);

      return successResponse(res, null, 'Volunteer removed successfully');
    } catch (error) {
      console.error('Remove volunteer error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get volunteers assigned to event
   * GET /api/event-managers/events/:eventId/volunteers
   */
  static async getEventVolunteers(req, res) {
    try {
      const { eventId } = req.params;
      const managerId = req.user.id;

      // Check ownership
      const event = await EventModel.findById(eventId);
      if (!event) {
        return errorResponse(res, 'Event not found', 404);
      }

      if (event.created_by_manager_id !== managerId) {
        return errorResponse(res, 'Unauthorized access to this event', 403);
      }

      const volunteers = await EventVolunteerModel.getEventVolunteers(eventId);

      return successResponse(res, { volunteers });
    } catch (error) {
      console.error('Get event volunteers error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get event registrations
   * GET /api/event-managers/events/:eventId/registrations
   */
  static async getEventRegistrations(req, res) {
    try {
      const { eventId } = req.params;
      const managerId = req.user.id;
      const { registration_status, payment_status, page, limit } = req.query;

      // Check ownership
      const event = await EventModel.findById(eventId);
      if (!event) {
        return errorResponse(res, 'Event not found', 404);
      }

      if (event.created_by_manager_id !== managerId) {
        return errorResponse(res, 'Unauthorized access to this event', 403);
      }

      const result = await EventRegistrationModel.getEventRegistrations(eventId, {
        registration_status,
        payment_status,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50
      });

      return successResponse(res, result);
    } catch (error) {
      console.error('Get event registrations error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get event analytics
   * GET /api/event-managers/events/:eventId/analytics
   */
  static async getEventAnalytics(req, res) {
    try {
      const { eventId } = req.params;
      const managerId = req.user.id;

      // Check ownership
      const event = await EventModel.findById(eventId);
      if (!event) {
        return errorResponse(res, 'Event not found', 404);
      }

      if (event.created_by_manager_id !== managerId) {
        return errorResponse(res, 'Unauthorized access to this event', 403);
      }

      // Get comprehensive analytics
      const eventStats = await EventModel.getStats(eventId);
      const registrationStats = await EventRegistrationModel.getStats(eventId);
      const volunteerStats = await EventVolunteerModel.getEventStats(eventId);
      const volunteerPerformance = await EventVolunteerModel.getVolunteerPerformance(eventId);

      return successResponse(res, {
        event: {
          id: event.id,
          event_name: event.event_name,
          event_code: event.event_code,
          status: event.status
        },
        stats: {
          ...eventStats,
          registrations: registrationStats,
          volunteers: volunteerStats
        },
        volunteer_performance: volunteerPerformance
      });
    } catch (error) {
      console.error('Get event analytics error:', error);
      return errorResponse(res, error.message, 500);
    }
  }
}

export default EventManagerController;
