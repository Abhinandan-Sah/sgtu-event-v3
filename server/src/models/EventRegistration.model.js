// EventRegistration Model - Student registrations for events (free/paid)
import sql from '../config/db.js';

class EventRegistration {
  /**
   * Create registration for free event
   * @param {string} eventId - Event UUID
   * @param {string} studentId - Student UUID
   * @returns {Promise<Object>}
   */
  static async createFreeRegistration(eventId, studentId) {
    const result = await sql`
      INSERT INTO event_registrations (
        event_id, student_id, registration_type, payment_status
      )
      VALUES (
        ${eventId}, ${studentId}, 'FREE', 'NOT_REQUIRED'
      )
      RETURNING *
    `;

    return result[0];
  }

  /**
   * Create registration for paid event (payment pending)
   * @param {string} eventId - Event UUID
   * @param {string} studentId - Student UUID
   * @param {Object} paymentData - { amount, currency, razorpay_order_id }
   * @returns {Promise<Object>}
   */
  static async createPaidRegistration(eventId, studentId, paymentData) {
    const { amount, currency, razorpay_order_id } = paymentData;

    const result = await sql`
      INSERT INTO event_registrations (
        event_id, student_id, registration_type, payment_status,
        razorpay_order_id, payment_amount, payment_currency
      )
      VALUES (
        ${eventId}, ${studentId}, 'PAID', 'PENDING',
        ${razorpay_order_id}, ${amount}, ${currency}
      )
      RETURNING *
    `;

    return result[0];
  }

  /**
   * Complete payment for registration
   * @param {string} registrationId - Registration UUID
   * @param {Object} paymentData - { razorpay_payment_id, razorpay_signature }
   * @returns {Promise<Object>}
   */
  static async completePayment(registrationId, paymentData) {
    const { razorpay_payment_id, razorpay_signature } = paymentData;

    const result = await sql`
      UPDATE event_registrations 
      SET 
        payment_status = 'COMPLETED',
        razorpay_payment_id = ${razorpay_payment_id},
        razorpay_signature = ${razorpay_signature},
        payment_completed_at = NOW(),
        registration_status = 'CONFIRMED',
        updated_at = NOW()
      WHERE id = ${registrationId}
        AND payment_status = 'PENDING'
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Registration not found or payment already completed');
    }

    return result[0];
  }

  /**
   * Mark payment as failed
   * @param {string} registrationId - Registration UUID
   * @returns {Promise<Object>}
   */
  static async failPayment(registrationId) {
    const result = await sql`
      UPDATE event_registrations 
      SET 
        payment_status = 'FAILED',
        registration_status = 'CANCELLED',
        updated_at = NOW()
      WHERE id = ${registrationId}
      RETURNING *
    `;

    return result[0];
  }

  /**
   * Find registration by ID
   * @param {string} registrationId - Registration UUID
   * @returns {Promise<Object|null>}
   */
  static async findById(registrationId) {
    const result = await sql`
      SELECT 
        er.*,
        s.full_name as student_name,
        s.registration_no as student_registration_no,
        s.email as student_email,
        e.event_name,
        e.event_code,
        e.event_type,
        e.price as event_price
      FROM event_registrations er
      LEFT JOIN students s ON er.student_id = s.id
      LEFT JOIN events e ON er.event_id = e.id
      WHERE er.id = ${registrationId}
      LIMIT 1
    `;

    return result[0] || null;
  }

  /**
   * Find registration by Razorpay order ID
   * @param {string} orderId - Razorpay order ID
   * @returns {Promise<Object|null>}
   */
  static async findByOrderId(orderId) {
    const result = await sql`
      SELECT * FROM event_registrations 
      WHERE razorpay_order_id = ${orderId}
      LIMIT 1
    `;

    return result[0] || null;
  }

  /**
   * Check if student is registered for event
   * @param {string} eventId - Event UUID
   * @param {string} studentId - Student UUID
   * @returns {Promise<Object|null>}
   */
  static async findByEventAndStudent(eventId, studentId) {
    const result = await sql`
      SELECT * FROM event_registrations 
      WHERE event_id = ${eventId} 
        AND student_id = ${studentId}
      LIMIT 1
    `;

    return result[0] || null;
  }

  /**
   * Get student's registered events
   * @param {string} studentId - Student UUID
   * @param {Object} filters - { status, payment_status }
   * @returns {Promise<Array>}
   */
  static async getStudentRegistrations(studentId, filters = {}) {
    const { status, payment_status } = filters;

    let conditions = [sql`er.student_id = ${studentId}`];

    if (status) {
      conditions.push(sql`er.registration_status = ${status}`);
    }

    if (payment_status) {
      conditions.push(sql`er.payment_status = ${payment_status}`);
    }

    return await sql`
      SELECT 
        er.*,
        e.event_name,
        e.event_code,
        e.event_type,
        e.event_category,
        e.venue,
        e.start_date,
        e.end_date,
        e.status as event_status,
        e.banner_image_url
      FROM event_registrations er
      LEFT JOIN events e ON er.event_id = e.id
      WHERE ${sql.and(conditions)}
      ORDER BY er.registered_at DESC
    `;
  }

  /**
   * Get event registrations (for event manager/admin)
   * @param {string} eventId - Event UUID
   * @param {Object} filters - { registration_status, payment_status, page, limit }
   * @returns {Promise<Object>}
   */
  static async getEventRegistrations(eventId, filters = {}) {
    const { registration_status, payment_status, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;

    let conditions = [sql`er.event_id = ${eventId}`];

    if (registration_status) {
      conditions.push(sql`er.registration_status = ${registration_status}`);
    }

    if (payment_status) {
      conditions.push(sql`er.payment_status = ${payment_status}`);
    }

    const result = await sql`
      SELECT 
        er.*,
        s.full_name as student_name,
        s.registration_no as student_registration_no,
        s.email as student_email,
        s.phone as student_phone,
        COUNT(*) OVER() as total_count
      FROM event_registrations er
      LEFT JOIN students s ON er.student_id = s.id
      WHERE ${sql.and(conditions)}
      ORDER BY er.registered_at DESC
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
   * Record check-in for event
   * @param {string} registrationId - Registration UUID
   * @returns {Promise<Object>}
   */
  static async recordCheckIn(registrationId) {
    const result = await sql`
      UPDATE event_registrations 
      SET 
        has_checked_in = TRUE,
        check_in_count = check_in_count + 1,
        last_check_in_at = NOW(),
        updated_at = NOW()
      WHERE id = ${registrationId}
      RETURNING *
    `;

    return result[0];
  }

  /**
   * Record feedback submission
   * @param {string} registrationId - Registration UUID
   * @returns {Promise<Object>}
   */
  static async recordFeedback(registrationId) {
    const result = await sql`
      UPDATE event_registrations 
      SET 
        has_submitted_feedback = TRUE,
        feedback_submitted_at = NOW(),
        updated_at = NOW()
      WHERE id = ${registrationId}
      RETURNING *
    `;

    return result[0];
  }

  /**
   * Update time spent at event
   * @param {string} registrationId - Registration UUID
   * @param {number} minutes - Additional minutes spent
   * @returns {Promise<Object>}
   */
  static async updateTimeSpent(registrationId, minutes) {
    const result = await sql`
      UPDATE event_registrations 
      SET 
        total_time_spent_minutes = total_time_spent_minutes + ${minutes},
        updated_at = NOW()
      WHERE id = ${registrationId}
      RETURNING *
    `;

    return result[0];
  }

  /**
   * Cancel registration
   * @param {string} registrationId - Registration UUID
   * @returns {Promise<Object>}
   */
  static async cancel(registrationId) {
    const result = await sql`
      UPDATE event_registrations 
      SET 
        registration_status = 'CANCELLED',
        updated_at = NOW()
      WHERE id = ${registrationId}
        AND registration_status = 'CONFIRMED'
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Registration not found or already cancelled');
    }

    return result[0];
  }

  /**
   * Process refund
   * @param {string} registrationId - Registration UUID
   * @param {number} refundAmount - Amount to refund
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>}
   */
  static async processRefund(registrationId, refundAmount, reason) {
    const result = await sql`
      UPDATE event_registrations 
      SET 
        payment_status = 'REFUNDED',
        refund_initiated = TRUE,
        refund_amount = ${refundAmount},
        refund_reason = ${reason},
        refunded_at = NOW(),
        registration_status = 'CANCELLED',
        updated_at = NOW()
      WHERE id = ${registrationId}
        AND payment_status = 'COMPLETED'
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Registration not found or payment not completed');
    }

    return result[0];
  }

  /**
   * Get registration statistics for event
   * @param {string} eventId - Event UUID
   * @returns {Promise<Object>}
   */
  static async getStats(eventId) {
    const result = await sql`
      SELECT 
        COUNT(*) as total_registrations,
        COUNT(*) FILTER (WHERE registration_type = 'FREE') as free_registrations,
        COUNT(*) FILTER (WHERE registration_type = 'PAID') as paid_registrations,
        COUNT(*) FILTER (WHERE payment_status = 'COMPLETED') as completed_payments,
        COUNT(*) FILTER (WHERE payment_status = 'PENDING') as pending_payments,
        COUNT(*) FILTER (WHERE has_checked_in = TRUE) as total_check_ins,
        COALESCE(SUM(payment_amount) FILTER (WHERE payment_status = 'COMPLETED'), 0) as total_revenue,
        COALESCE(AVG(total_time_spent_minutes) FILTER (WHERE has_checked_in = TRUE), 0) as avg_time_spent
      FROM event_registrations
      WHERE event_id = ${eventId}
    `;

    return result[0] || null;
  }

  /**
   * Delete registration (hard delete - for cleanup only)
   * @param {string} registrationId - Registration UUID
   * @returns {Promise<boolean>}
   */
  static async delete(registrationId) {
    await sql`
      DELETE FROM event_registrations 
      WHERE id = ${registrationId}
    `;
    return true;
  }
}

export default EventRegistration;
