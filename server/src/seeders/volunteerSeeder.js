// Volunteer Seeder - Seeds volunteer staff
import { query } from '../config/db.js';
import bcrypt from 'bcryptjs';

const volunteers = [
  {
    email: 'volunteer1@sgtu.ac.in',
    password: 'volunteer123',
    full_name: 'Rajesh Kumar',
    phone: '9876543301',
    assigned_location: 'Main Entrance Gate'
  },
  {
    email: 'volunteer2@sgtu.ac.in',
    password: 'volunteer123',
    full_name: 'Priya Sharma',
    phone: '9876543302',
    assigned_location: 'Block A - Ground Floor'
  },
  {
    email: 'volunteer3@sgtu.ac.in',
    password: 'volunteer123',
    full_name: 'Amit Singh',
    phone: '9876543303',
    assigned_location: 'Block B - Ground Floor'
  },
  {
    email: 'volunteer4@sgtu.ac.in',
    password: 'volunteer123',
    full_name: 'Sneha Gupta',
    phone: '9876543304',
    assigned_location: 'Block A - First Floor'
  },
  {
    email: 'volunteer5@sgtu.ac.in',
    password: 'volunteer123',
    full_name: 'Vikram Patel',
    phone: '9876543305',
    assigned_location: 'Block B - Second Floor'
  },
  {
    email: 'volunteer.test@sgtu.ac.in',
    password: 'volunteer123',
    full_name: 'Test Volunteer',
    phone: '9999999998',
    assigned_location: 'Test Location'
  }
];

export async function seedVolunteers() {
  console.log('🎫 Seeding volunteers...');
  
  let created = 0;
  let skipped = 0;

  for (const volunteer of volunteers) {
    try {
      const hashedPassword = await bcrypt.hash(volunteer.password, 12);
      
      const insertQuery = `
        INSERT INTO volunteers (email, password_hash, full_name, phone, assigned_location, is_active, total_scans_performed)
        VALUES ($1, $2, $3, $4, $5, true, 0)
        ON CONFLICT (email) DO NOTHING
        RETURNING id, email, full_name, assigned_location
      `;
      
      const result = await query(insertQuery, [
        volunteer.email,
        hashedPassword,
        volunteer.full_name,
        volunteer.phone,
        volunteer.assigned_location
      ]);
      
      if (result.length > 0) {
        console.log(`   ✓ Created: ${volunteer.full_name} at ${volunteer.assigned_location}`);
        created++;
      } else {
        skipped++;
        console.log(`   ⏭  Skipped: ${volunteer.email} (already exists)`);
      }
    } catch (error) {
      console.error(`   ✗ Failed: ${volunteer.email} - ${error.message}`);
    }
  }

  console.log(`   ✅ Volunteers: ${created} created, ${skipped} skipped\n`);
}

export default seedVolunteers;
