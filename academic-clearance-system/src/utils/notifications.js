// src/utils/notifications.js
import { collection, addDoc } from 'firebase/firestore';
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
    console.log('✅ Notification created:', title);
  } catch (error) {
    console.error('❌ Error creating notification:', error);
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
 * Notify department about new submission
 */
export const notifyDepartmentNewSubmission = async (departmentUserId, studentName, studentId) => {
  await createNotification(
    departmentUserId,
    'pending',
    'New Clearance Submission',
    `${studentName} (${studentId}) has submitted clearance requirements for review.`,
    { studentId, action: 'new_submission' }
  );
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