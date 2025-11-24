// Admin Seeder - Seeds admin users
import { query } from '../config/db.js';
import bcrypt from 'bcryptjs';

const admins = [
  {
    email: 'admin@sgtu.ac.in',
    password: 'admin123',
    full_name: 'Super Admin',
    role: 'SUPER_ADMIN'
  },
  {
    email: 'event.coordinator@sgtu.ac.in',
    password: 'coordinator123',
    full_name: 'Event Coordinator',
    role: 'ADMIN'
  },
  {
    email: 'manager@sgtu.ac.in',
    password: 'manager123',
    full_name: 'Event Manager',
    role: 'ADMIN'
  }
];

export async function seedAdmins() {
  console.log('👑 Seeding admins...');
  
  let created = 0;
  let skipped = 0;

  for (const admin of admins) {
    try {
      const hashedPassword = await bcrypt.hash(admin.password, 12);
      
      const insertQuery = `
        INSERT INTO admins (email, password_hash, full_name, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO NOTHING
        RETURNING id, email, full_name, role
      `;
      
      const result = await query(insertQuery, [
        admin.email,
        hashedPassword,
        admin.full_name,
        admin.role
      ]);
      
      if (result.length > 0) {
        console.log(`   ✓ Created: ${admin.full_name} (${admin.email}) - ${admin.role}`);
        created++;
      } else {
        skipped++;
        console.log(`   ⏭  Skipped: ${admin.email} (already exists)`);
      }
    } catch (error) {
      console.error(`   ✗ Failed: ${admin.email} - ${error.message}`);
    }
  }

  console.log(`   ✅ Admins: ${created} created, ${skipped} skipped\n`);
}

export default seedAdmins;
