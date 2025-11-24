// Event Model - Core events with free/paid support, admin approval workflow
import sql from '../config/db.js';

class Event {
  /**
   * Create new event (starts in DRAFT status)
   * @param {Object} eventData - Event details
   * @param {string} managerId - Event manager UUID
   * @returns {Promise<Object>}
   */
  static async create(eventData, managerId) {
    const {
      event_name,
      event_code,
      description,
      event_type, // 'FREE' or 'PAID'
      price = 0,
      currency = 'INR',
      event_category,
      tags = [],
      venue,
      start_date,
      end_date,
      registration_start_date,
      registration_end_date,
      max_capacity = null,
      waitlist_enabled = false,
      refund_policy = null,
      refund_enabled = false,
      banner_image_url = null,
      event_images = [],
      requires_approval = true
    } = eventData;

    // Validation
    if (event_type === 'PAID' && price <= 0) {
      throw new Error('Paid events must have a price greater than 0');
    }

    if (new Date(start_date) >= new Date(end_date)) {
      throw new Error('Start date must be before end date');
    }

    if (new Date(registration_start_date) >= new Date(registration_end_date)) {
      throw new Error('Registration start date must be before end date');
    }

    const result = await sql`
      INSERT INTO events (
        event_name, event_code, description, event_type, price, currency,
        event_category, tags, venue,
        start_date, end_date, registration_start_date, registration_end_date,
        max_capacity, waitlist_enabled,
        refund_policy, refund_enabled,
        banner_image_url, event_images,
        created_by_manager_id,
        requires_approval,
        status
      )
      VALUES (
        ${event_name}, ${event_code}, ${description}, ${event_type}, ${price}, ${currency},
        ${event_category}, ${sql.array(tags)}, ${venue},
        ${start_date}, ${end_date}, ${registration_start_date}, ${registration_end_date},
        ${max_capacity}, ${waitlist_enabled},
        ${refund_policy}, ${refund_enabled},
        ${banner_image_url}, ${sql.array(event_images)},
        ${managerId},
        ${requires_approval},
        ${requires_approval ? 'PENDING_APPROVAL' : 'APPROVED'}
      )
      RETURNING *
    `;

    return result[0];
  }

  /**
   * Find event by ID
   * @param {string} eventId - Event UUID
   * @returns {Promise<Object|null>}
   */
  static async findById(eventId) {
    const result = await sql`
      SELECT 
        e.*,
        em.full_name as manager_name,
        em.email as manager_email,
        a.full_name as approved_by_admin_name
      FROM events e
      LEFT JOIN event_managers em ON e.created_by_manager_id = em.id
      LEFT JOIN admins a ON e.approved_by_admin_id = a.id
      WHERE e.id = ${eventId}
      LIMIT 1
    `;
    return result[0] || null;
  }

  /**
   * Find event by code
   * @param {string} eventCode - Event code (e.g., "TECH-FEST-2025")
   * @returns {Promise<Object|null>}
   */
  static async findByCode(eventCode) {
    const result = await sql`
      SELECT * FROM events 
      WHERE event_code = ${eventCode}
      LIMIT 1
    `;
    return result[0] || null;
  }

  /**
   * Update event
   * @param {string} eventId - Event UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>}
   */
  static async update(eventId, updates) {
    const allowedFields = [
      'event_name', 'description', 'event_type', 'price', 'currency',
      'event_category', 'tags', 'venue',
      'start_date', 'end_date', 'registration_start_date', 'registration_end_date',
      'max_capacity', 'waitlist_enabled', 'is_visible',
      'refund_policy', 'refund_enabled',
      'banner_image_url', 'event_images'
    ];

    const updateFields = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields[field] = updates[field];
      }
    }

    if (Object.keys(updateFields).length === 0) {
      throw new Error('No valid fields to update');
    }

    const result = await sql`
      UPDATE events 
      SET ${sql(updateFields)}, updated_at = NOW()
      WHERE id = ${eventId}
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Event not found');
    }

    return result[0];
  }

  /**
   * Admin approve event
   * @param {string} eventId - Event UUID
   * @param {string} adminId - Admin UUID
   * @returns {Promise<Object>}
   */
  static async approveByAdmin(eventId, adminId) {
    const result = await sql`
      UPDATE events 
      SET 
        status = 'APPROVED',
        approved_by_admin_id = ${adminId},
        admin_approved_at = NOW(),
        admin_rejection_reason = NULL,
        updated_at = NOW()
      WHERE id = ${eventId}
        AND status = 'PENDING_APPROVAL'
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Event not found or not in pending status');
    }

    // Create permission record
    await sql`
      INSERT INTO event_permissions (
        event_id, manager_id, admin_id, permission_type, reason
      )
      SELECT 
        ${eventId},
        created_by_manager_id,
        ${adminId},
        'APPROVED',
        'Event approved by admin'
      FROM events
      WHERE id = ${eventId}
    `;

    return result[0];
  }

  /**
   * Admin reject event
   * @param {string} eventId - Event UUID
   * @param {string} adminId - Admin UUID
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>}
   */
  static async rejectByAdmin(eventId, adminId, reason) {
    const result = await sql`
      UPDATE events 
      SET 
        status = 'CANCELLED',
        approved_by_admin_id = ${adminId},
        admin_rejection_reason = ${reason},
        updated_at = NOW()
      WHERE id = ${eventId}
        AND status = 'PENDING_APPROVAL'
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Event not found or not in pending status');
    }

    // Create permission record
    await sql`
      INSERT INTO event_permissions (
        event_id, manager_id, admin_id, permission_type, reason
      )
      SELECT 
        ${eventId},
        created_by_manager_id,
        ${adminId},
        'REJECTED',
        ${reason}
      FROM events
      WHERE id = ${eventId}
    `;

    return result[0];
  }

  /**
   * Change event status
   * @param {string} eventId - Event UUID
   * @param {string} newStatus - New status
   * @returns {Promise<Object>}
   */
  static async updateStatus(eventId, newStatus) {
    const validStatuses = [
      'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 
      'COMPLETED', 'CANCELLED', 'ARCHIVED'
    ];

    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const result = await sql`
      UPDATE events 
      SET status = ${newStatus}, updated_at = NOW()
      WHERE id = ${eventId}
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Event not found');
    }

    return result[0];
  }

  /**
   * Get all events with filters
   * @param {Object} filters - Filtering options
   * @returns {Promise<Object>}
   */
  static async getAll(filters = {}) {
    const {
      status,
      event_type,
      event_category,
      manager_id,
      is_visible,
      page = 1,
      limit = 20,
      search = '',
      upcoming_only = false,
      active_only = false
    } = filters;

    const offset = (page - 1) * limit;

    let conditions = ['1=1'];
    const params = [];

    if (status) {
      conditions.push(`e.status = $${params.length + 1}`);
      params.push(status);
    }

    if (event_type) {
      conditions.push(`e.event_type = $${params.length + 1}`);
      params.push(event_type);
    }

    if (event_category) {
      conditions.push(`e.event_category = $${params.length + 1}`);
      params.push(event_category);
    }

    if (manager_id) {
      conditions.push(`e.created_by_manager_id = $${params.length + 1}`);
      params.push(manager_id);
    }

    if (is_visible !== undefined) {
      conditions.push(`e.is_visible = $${params.length + 1}`);
      params.push(is_visible);
    }

    if (search) {
      conditions.push(`(e.event_name ILIKE $${params.length + 1} OR e.event_code ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (upcoming_only) {
      conditions.push('e.start_date > NOW()');
    }

    if (active_only) {
      conditions.push('e.status = \'ACTIVE\'');
    }

    const whereClause = conditions.join(' AND ');

    const result = await sql`
      SELECT 
        e.*,
        em.full_name as manager_name,
        em.email as manager_email,
        COUNT(*) OVER() as total_count
      FROM events e
      LEFT JOIN event_managers em ON e.created_by_manager_id = em.id
      WHERE ${sql.unsafe(whereClause)}
      ORDER BY e.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return {
      data: result,
      pagination: {
        page,
        limit,
        total: result[0]?.total_count || 0,
        totalPages: Math.ceil((result[0]?.total_count || 0) / limit)
      }
    };
  }

  /**
   * Get visible events for students (public listing)
   * @param {Object} filters - Filtering options
   * @returns {Promise<Array>}
   */
  static async getVisibleEvents(filters = {}) {
    const {
      event_type,
      event_category,
      page = 1,
      limit = 20,
      search = '',
      upcoming_only = false
    } = filters;

    const offset = (page - 1) * limit;

    let conditions = [
      'e.is_visible = TRUE',
      'e.status IN (\'APPROVED\', \'ACTIVE\')',
      'e.registration_end_date > NOW()'
    ];

    if (event_type) {
      conditions.push(sql`e.event_type = ${event_type}`);
    }

    if (event_category) {
      conditions.push(sql`e.event_category = ${event_category}`);
    }

    if (search) {
      conditions.push(sql`(e.event_name ILIKE ${`%${search}%`} OR e.description ILIKE ${`%${search}%`})`);
    }

    if (upcoming_only) {
      conditions.push(sql`e.start_date > NOW()`);
    }

    const result = await sql`
      SELECT 
        e.id, e.event_name, e.event_code, e.description,
        e.event_type, e.price, e.currency,
        e.event_category, e.tags, e.venue,
        e.start_date, e.end_date,
        e.registration_start_date, e.registration_end_date,
        e.max_capacity, e.current_registrations,
        e.status, e.banner_image_url,
        (e.max_capacity IS NOT NULL AND e.current_registrations >= e.max_capacity) as is_full,
        COUNT(*) OVER() as total_count
      FROM events e
      WHERE ${sql.and(conditions)}
      ORDER BY e.start_date ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return {
      data: result,
      pagination: {
        page,
        limit,
        total: result[0]?.total_count || 0,
        totalPages: Math.ceil((result[0]?.total_count || 0) / limit)
      }
    };
  }

  /**
   * Get pending approval events (for admin)
   * @returns {Promise<Array>}
   */
  static async getPendingApprovals() {
    return await sql`
      SELECT 
        e.*,
        em.full_name as manager_name,
        em.email as manager_email,
        em.organization as manager_organization
      FROM events e
      LEFT JOIN event_managers em ON e.created_by_manager_id = em.id
      WHERE e.status = 'PENDING_APPROVAL'
      ORDER BY e.created_at ASC
    `;
  }

  /**
   * Get event statistics
   * @param {string} eventId - Event UUID
   * @returns {Promise<Object>}
   */
  static async getStats(eventId) {
    const result = await sql`
      SELECT 
        e.*,
        COUNT(DISTINCT er.id) FILTER (WHERE er.registration_status = 'CONFIRMED') as confirmed_registrations,
        COUNT(DISTINCT er.id) FILTER (WHERE er.has_checked_in = TRUE) as total_check_ins,
        COUNT(DISTINCT er.id) FILTER (WHERE er.has_submitted_feedback = TRUE) as total_feedbacks_submitted,
        COUNT(DISTINCT ev.volunteer_id) as volunteers_assigned,
        COUNT(DISTINCT s.id) as total_stalls,
        COALESCE(AVG(f.rating), 0) as average_event_rating
      FROM events e
      LEFT JOIN event_registrations er ON e.id = er.event_id
      LEFT JOIN event_volunteers ev ON e.id = ev.event_id
      LEFT JOIN stalls s ON e.id = s.event_id
      LEFT JOIN feedbacks f ON e.id = f.event_id
      WHERE e.id = ${eventId}
      GROUP BY e.id
    `;

    return result[0] || null;
  }

  /**
   * Delete event (soft delete - mark as cancelled)
   * @param {string} eventId - Event UUID
   * @returns {Promise<boolean>}
   */
  static async delete(eventId) {
    // Check if event has registrations
    const registrations = await sql`
      SELECT COUNT(*) as count 
      FROM event_registrations 
      WHERE event_id = ${eventId}
        AND registration_status = 'CONFIRMED'
    `;

    if (registrations[0].count > 0) {
      throw new Error('Cannot delete event with active registrations. Cancel the event instead.');
    }

    // Soft delete
    await sql`
      UPDATE events 
      SET status = 'CANCELLED', updated_at = NOW()
      WHERE id = ${eventId}
    `;

    return true;
  }

  /**
   * Check if registration is open
   * @param {string} eventId - Event UUID
   * @returns {Promise<Object>}
   */
  static async isRegistrationOpen(eventId) {
    const result = await sql`
      SELECT 
        e.id,
        e.registration_start_date,
        e.registration_end_date,
        e.max_capacity,
        e.current_registrations,
        e.status,
        NOW() BETWEEN e.registration_start_date AND e.registration_end_date as is_open,
        (e.max_capacity IS NULL OR e.current_registrations < e.max_capacity) as has_capacity
      FROM events e
      WHERE e.id = ${eventId}
      LIMIT 1
    `;

    const event = result[0];
    if (!event) return { open: false, reason: 'Event not found' };

    if (event.status !== 'APPROVED' && event.status !== 'ACTIVE') {
      return { open: false, reason: 'Event is not available for registration' };
    }

    if (!event.is_open) {
      return { open: false, reason: 'Registration period is closed' };
    }

    if (!event.has_capacity) {
      return { open: false, reason: 'Event is full' };
    }

    return { open: true };
  }

  /**
   * Get events created by manager
   * @param {string} managerId - Event manager UUID
   * @returns {Promise<Array>}
   */
  static async getByManager(managerId, filters = {}) {
    const { status, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    let query = sql`
      SELECT 
        e.*,
        COUNT(*) OVER() as total_count
      FROM events e
      WHERE e.created_by_manager_id = ${managerId}
    `;

    if (status) {
      query = sql`${query} AND e.status = ${status}`;
    }

    query = sql`
      ${query}
      ORDER BY e.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await query;

    return {
      data: result,
      pagination: {
        page,
        limit,
        total: result[0]?.total_count || 0,
        totalPages: Math.ceil((result[0]?.total_count || 0) / limit)
      }
    };
  }
}

export default Event;
