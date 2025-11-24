// Volunteer Model - Authorized staff to scan student QR codes
import bcrypt from 'bcryptjs';

class VolunteerModel {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.password_hash = data.password_hash;
    this.full_name = data.full_name;
    this.phone = data.phone;
    this.role = data.role;
    this.assigned_location = data.assigned_location;
    this.is_active = data.is_active;
    this.total_scans_performed = data.total_scans_performed;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async hashPassword(password) {
    return await bcrypt.hash(password, 12);
  }

  async comparePassword(password) {
    return await bcrypt.compare(password, this.password_hash);
  }

  static async findById(id, sql) {
    const query = `SELECT * FROM volunteers WHERE id = $1 LIMIT 1`;
    const results = await sql(query, [id]);
    return results.length > 0 ? new VolunteerModel(results[0]) : null;
  }

  static async findByEmail(email, sql) {
    const query = `SELECT * FROM volunteers WHERE email = $1 LIMIT 1`;
    const results = await sql(query, [email]);
    return results.length > 0 ? new VolunteerModel(results[0]) : null;
  }

  static async create(data, sql) {
    const hashedPassword = await VolunteerModel.hashPassword(data.password);
    const query = `
      INSERT INTO volunteers (
        email, password_hash, full_name, phone, role,
        assigned_location, is_active, total_scans_performed,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'VOLUNTEER', $5, true, 0, NOW(), NOW())
      RETURNING *
    `;
    const results = await sql(query, [
      data.email,
      hashedPassword,
      data.full_name,
      data.phone || null,
      data.assigned_location || null
    ]);
    return new VolunteerModel(results[0]);
  }

  static async update(id, data, sql) {
    const query = `
      UPDATE volunteers
      SET full_name = COALESCE($1, full_name),
          email = COALESCE($2, email),
          phone = COALESCE($3, phone),
          assigned_location = COALESCE($4, assigned_location),
          is_active = COALESCE($5, is_active),
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;
    const results = await sql(query, [
      data.full_name,
      data.email,
      data.phone,
      data.assigned_location,
      data.is_active,
      id
    ]);
    return results.length > 0 ? new VolunteerModel(results[0]) : null;
  }

  // Increment scan count when volunteer scans a student QR
  static async incrementScanCount(id, sql) {
    const query = `
      UPDATE volunteers
      SET total_scans_performed = total_scans_performed + 1,
          updated_at = NOW()
      WHERE id = $1
      RETURNING total_scans_performed
    `;
    const results = await sql(query, [id]);
    return results[0]?.total_scans_performed || 0;
  }

  static async findAllActive(sql) {
    const query = `
      SELECT * FROM volunteers 
      WHERE is_active = true
      ORDER BY full_name ASC
    `;
    const results = await sql(query);
    return results.map(row => new VolunteerModel(row));
  }

  static async findAll(sql) {
    const query = `SELECT * FROM volunteers ORDER BY created_at DESC`;
    const results = await sql(query);
    return results.map(row => new VolunteerModel(row));
  }

  static async getStats(sql) {
    const query = `
      SELECT 
        COUNT(*) as total_volunteers,
        COUNT(*) FILTER (WHERE is_active = true) as active_volunteers,
        SUM(total_scans_performed) as total_scans,
        AVG(total_scans_performed) as avg_scans_per_volunteer
      FROM volunteers
    `;
    const results = await sql(query);
    return results[0];
  }
}

export default VolunteerModel;
