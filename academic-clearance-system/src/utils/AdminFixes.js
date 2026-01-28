// src/utils/adminFixes.js
// Run these from Admin Dashboard console to fix common issues

import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Fix all department users to have the 'department' field
 * This is needed for notifications to work
 */
export const fixDepartmentUsers = async () => {
  console.log('🔧 Fixing department users...');
  
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const departmentRoles = [
      'library', 
      'course_office', 
      'guidance', 
      'student_council', 
      'finance', 
      'student_government', 
      'cashier'
    ];
    
    let fixedCount = 0;
    const updates = [];
    
    usersSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      
      // If user has a department role but no department field
      if (departmentRoles.includes(data.role) && !data.department) {
        console.log(`Fixing user: ${data.email} (${data.role})`);
        updates.push(
          updateDoc(doc(db, 'users', docSnap.id), {
            department: data.role
          })
        );
        fixedCount++;
      }
    });
    
    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`✅ Fixed ${fixedCount} department user(s)`);
      alert(`✅ Successfully updated ${fixedCount} department users!\n\nThey should now receive notifications.`);
    } else {
      console.log('✅ All department users already have department field');
      alert('✅ All department users are already configured correctly!');
    }
    
    return { success: true, fixedCount };
    
  } catch (error) {
    console.error('❌ Error fixing users:', error);
    alert('❌ Error: ' + error.message);
    return { success: false, error: error.message };
  }
};

/**
 * List all users and their roles/departments
 */
export const listAllUsers = async () => {
  console.log('📋 Listing all users...\n');
  
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    const users = {
      admins: [],
      students: [],
      departments: []
    };
    
    usersSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const user = {
        id: docSnap.id,
        email: data.email,
        name: data.name,
        role: data.role,
        department: data.department || '❌ MISSING'
      };
      
      if (data.role === 'admin') {
        users.admins.push(user);
      } else if (data.role === 'student') {
        users.students.push(user);
      } else {
        users.departments.push(user);
      }
    });
    
    console.log('👑 ADMINS:');
    users.admins.forEach(u => {
      console.log(`  ${u.email} (${u.name})`);
    });
    
    console.log('\n🏢 DEPARTMENT USERS:');
    users.departments.forEach(u => {
      console.log(`  ${u.email} - Role: ${u.role} - Dept: ${u.department}`);
    });
    
    console.log('\n👨‍🎓 STUDENTS:');
    console.log(`  Total: ${users.students.length} students`);
    
    return users;
    
  } catch (error) {
    console.error('❌ Error listing users:', error);
    return null;
  }
};

/**
 * Check notification setup for a specific department
 */
export const checkDepartmentNotificationSetup = async (departmentId) => {
  console.log(`\n🔍 Checking notification setup for: ${departmentId}\n`);
  
  try {
    // 1. Find users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const deptUsers = [];
    
    usersSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.department === departmentId) {
        deptUsers.push({
          id: docSnap.id,
          email: data.email,
          name: data.name,
          role: data.role
        });
      }
    });
    
    console.log(`Users in ${departmentId}:`, deptUsers.length);
    deptUsers.forEach(u => {
      console.log(`  ✅ ${u.email} (UID: ${u.id})`);
    });
    
    if (deptUsers.length === 0) {
      console.error(`❌ NO USERS FOUND for department: ${departmentId}`);
      console.log('\n💡 To fix this:');
      console.log('   1. Make sure department users exist in Firestore');
      console.log('   2. Run: fixDepartmentUsers()');
      console.log('   3. Or manually add "department" field to user documents');
      return { success: false, users: [] };
    }
    
    // 2. Check recent notifications
    const notificationsSnapshot = await getDocs(collection(db, 'notifications'));
    const deptNotifications = [];
    
    notificationsSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (deptUsers.some(u => u.id === data.userId)) {
        deptNotifications.push({
          title: data.title,
          created: data.createdAt,
          read: data.read
        });
      }
    });
    
    console.log(`\nNotifications for ${departmentId} users:`, deptNotifications.length);
    if (deptNotifications.length > 0) {
      deptNotifications.slice(0, 5).forEach(n => {
        console.log(`  ${n.read ? '✓' : '○'} ${n.title} (${n.created})`);
      });
    } else {
      console.log('  No notifications found yet');
    }
    
    return { success: true, users: deptUsers, notifications: deptNotifications };
    
  } catch (error) {
    console.error('❌ Error checking setup:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send a test notification to all users of a department
 */
export const sendTestNotification = async (departmentId) => {
  console.log(`📧 Sending test notification to ${departmentId}...`);
  
  try {
    const { notifyDepartmentNewSubmission } = await import('./notifications');
    
    await notifyDepartmentNewSubmission(
      departmentId,
      'Test Student (Admin Test)',
      '9999-99999',
      1
    );
    
    console.log('✅ Test notification sent!');
    alert(`✅ Test notification sent to ${departmentId}!\n\nCheck the department user's notification bell.`);
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error sending test:', error);
    alert('❌ Error: ' + error.message);
    return { success: false, error: error.message };
  }
};

// Make available globally in browser console
if (typeof window !== 'undefined') {
  window.fixDepartmentUsers = fixDepartmentUsers;
  window.listAllUsers = listAllUsers;
  window.checkDepartmentNotificationSetup = checkDepartmentNotificationSetup;
  window.sendTestNotification = sendTestNotification;
  
  console.log('🔧 Admin utilities loaded! Available commands:');
  console.log('  - fixDepartmentUsers()');
  console.log('  - listAllUsers()');
  console.log('  - checkDepartmentNotificationSetup("library")');
  console.log('  - sendTestNotification("library")');
}