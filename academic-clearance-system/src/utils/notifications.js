// src/utils/notifications.js
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Create a notification for a user
 * @param {string} userId - The user ID to notify
 * @param {string} type - Type: 'approved', 'rejected', 'pending', 'info'
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} metadata - Additional data (optional)
 */
export const createNotification = async (userId, type, title, message, metadata = {}) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString(),
      ...metadata
    });
    console.log('✅ Notification created for user:', userId, '- Title:', title);
  } catch (error) {
    console.error('❌ Error creating notification:', error);
  }
};

/**
 * Get all department users for a specific department
 */
const getDepartmentUsers = async (departmentId) => {
  try {
    // Query users collection for users with matching department
    const usersQuery = query(
      collection(db, 'users'),
      where('department', '==', departmentId)
    );
    
    const snapshot = await getDocs(usersQuery);
    const departmentUsers = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));
    
    console.log(`Found ${departmentUsers.length} users for department ${departmentId}`);
    return departmentUsers;
  } catch (error) {
    console.error('Error getting department users:', error);
    return [];
  }
};

/**
 * Notify ALL department users about new student submission
 */
export const notifyDepartmentNewSubmission = async (departmentId, studentName, studentIdNumber, fileCount) => {
  try {
    const departmentNames = {
      library: 'Library',
      course_office: 'Course Office',
      guidance: 'Guidance',
      student_council: 'Student Council',
      finance: 'Finance',
      student_government: 'Student Government',
      cashier: 'Cashier'
    };

    const deptName = departmentNames[departmentId] || departmentId;
    
    // Get all users from this department
    const departmentUsers = await getDepartmentUsers(departmentId);
    
    if (departmentUsers.length === 0) {
      console.warn(`⚠️ No department users found for ${departmentId}`);
      return;
    }
    
    // Create notification for each department user
    const notificationPromises = departmentUsers.map(deptUser => 
      createNotification(
        deptUser.uid,
        'pending',
        '📥 New Clearance Submission',
        `${studentName} (${studentIdNumber}) has uploaded ${fileCount} file(s) for ${deptName} clearance.`,
        { 
          department: departmentId, 
          studentId: studentIdNumber,
          studentName: studentName,
          fileCount: fileCount,
          action: 'new_submission' 
        }
      )
    );
    
    await Promise.all(notificationPromises);
    console.log(`✅ Notified ${departmentUsers.length} department users about new submission`);
    
  } catch (error) {
    console.error('❌ Error notifying department:', error);
  }
};

/**
 * Notify student about clearance status change
 */
export const notifyStudentStatusChange = async (studentId, department, status, reason = null) => {
  const departmentNames = {
    library: 'Library',
    course_office: 'Course Office',
    guidance: 'Guidance',
    student_council: 'Student Council',
    finance: 'Finance',
    student_government: 'Student Government',
    cashier: 'Cashier'
  };

  const deptName = departmentNames[department] || department;

  if (status === 'approved') {
    await createNotification(
      studentId,
      'approved',
      `${deptName} Clearance Approved! ✓`,
      `Your clearance for ${deptName} has been approved. Great job!`,
      { department, status }
    );
  } else if (status === 'rejected') {
    await createNotification(
      studentId,
      'rejected',
      `${deptName} Clearance Rejected`,
      reason || `Your clearance for ${deptName} needs revision. Please check the details and resubmit.`,
      { department, status, reason }
    );
  }
};

/**
 * Notify student about approaching deadline
 */
export const notifyDeadlineReminder = async (studentId, daysLeft) => {
  const urgency = daysLeft <= 1 ? 'urgent' : 'warning';
  
  await createNotification(
    studentId,
    'info',
    `Clearance Deadline Reminder`,
    `You have ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left to complete your clearance. Don't forget to submit all requirements!`,
    { type: urgency, daysLeft }
  );
};

/**
 * Notify admin about system events
 */
export const notifyAdminSystemEvent = async (adminId, event, details) => {
  await createNotification(
    adminId,
    'info',
    `System Event: ${event}`,
    details,
    { event, timestamp: new Date().toISOString() }
  );
};

/**
 * Batch notify department about multiple new submissions
 * Use this for bulk operations
 */
export const notifyDepartmentBatchSubmissions = async (departmentId, studentCount) => {
  try {
    const departmentNames = {
      library: 'Library',
      course_office: 'Course Office',
      guidance: 'Guidance',
      student_council: 'Student Council',
      finance: 'Finance',
      student_government: 'Student Government',
      cashier: 'Cashier'
    };

    const deptName = departmentNames[departmentId] || departmentId;
    const departmentUsers = await getDepartmentUsers(departmentId);
    
    if (departmentUsers.length === 0) {
      console.warn(`⚠️ No department users found for ${departmentId}`);
      return;
    }
    
    const notificationPromises = departmentUsers.map(deptUser => 
      createNotification(
        deptUser.uid,
        'info',
        `📚 ${studentCount} New Submissions`,
        `${studentCount} student${studentCount > 1 ? 's have' : ' has'} uploaded clearance requirements for ${deptName}.`,
        { 
          department: departmentId, 
          studentCount: studentCount,
          action: 'batch_submission' 
        }
      )
    );
    
    await Promise.all(notificationPromises);
    console.log(`✅ Batch notification sent to ${departmentUsers.length} department users`);
    
  } catch (error) {
    console.error('❌ Error sending batch notification:', error);
  }
};