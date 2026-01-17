// scripts/migrateToSubRoles.js
// Run this ONCE to migrate existing department users to new sub-role system

import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

const departmentMapping = {
  'library': 'dept_library',
  'course_office': 'dept_course_office',
  'guidance': 'dept_guidance',
  'student_council': 'dept_student_council',
  'finance': 'dept_finance',
  'student_government': 'dept_student_government',
  'cashier': 'dept_cashier'
};

async function migrateUsers() {
  try {
    console.log('🔄 Starting user migration to sub-roles...\n');
    
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      // Skip students and admins
      if (userData.role === 'student' || userData.role === 'admin') {
        console.log(`⏭️  Skipping ${userData.role}: ${userData.name}`);
        skippedCount++;
        continue;
      }
      
      // Check if already migrated
      if (userData.role?.startsWith('dept_')) {
        console.log(`✅ Already migrated: ${userData.name}`);
        skippedCount++;
        continue;
      }
      
      // Migrate department user
      const oldRole = userData.role;
      const newRole = departmentMapping[oldRole];
      
      if (!newRole) {
        console.log(`⚠️  Unknown role: ${oldRole} for user ${userData.name}`);
        continue;
      }
      
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        department: oldRole // Keep department field for reference
      });
      
      console.log(`✅ Migrated: ${userData.name}`);
      console.log(`   Old role: ${oldRole} → New role: ${newRole}\n`);
      migratedCount++;
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migratedCount} users`);
    console.log(`   ⏭️  Skipped: ${skippedCount} users`);
    console.log(`   📝 Total: ${usersSnapshot.size} users`);
    console.log('\n✅ Migration complete!');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  }
}

//migrateUsers();

export default migrateUsers;