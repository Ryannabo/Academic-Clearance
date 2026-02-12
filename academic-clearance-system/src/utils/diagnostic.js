// src/utils/diagnostics.js
// Run these commands in browser console to diagnose notification issues

import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

/**
 * Check if current user can read their notifications
 */
export const diagnoseNotificationFetch = async () => {
  console.log('\n🔍 NOTIFICATION FETCH DIAGNOSTIC\n');
  console.log('='.repeat(50));
  
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.error('❌ No user logged in!');
      return { success: false, error: 'Not logged in' };
    }
    
    console.log('\n👤 Current User:');
    console.log('   UID:', currentUser.uid);
    console.log('   Email:', currentUser.email);
    
    // Step 1: Check if user document exists
    console.log('\n📋 Step 1: Checking user document...');
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    
    if (!userDoc.exists()) {
      console.error('   ❌ User document does not exist in Firestore!');
      return { success: false, error: 'User document missing' };
    }
    
    const userData = userDoc.data();
    console.log('   ✅ User document found');
    console.log('   Role:', userData.role);
    console.log('   Department:', userData.department || 'N/A');
    
    // Step 2: Try to fetch notifications
    console.log('\n📬 Step 2: Fetching notifications...');
    console.log('   Query: notifications where userId ==', currentUser.uid);
    
    const notifQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid)
    );
    
    let snapshot;
    try {
      snapshot = await getDocs(notifQuery);
      console.log('   ✅ Query successful!');
      console.log('   Found:', snapshot.size, 'notifications');
    } catch (queryError) {
      console.error('   ❌ Query failed:', queryError.code);
      console.error('   Error:', queryError.message);
      
      if (queryError.code === 'permission-denied') {
        console.error('\n🔒 PERMISSION DENIED!');
        console.error('   This means Firestore security rules are blocking the read.');
        console.error('\n💡 Solution:');
        console.error('   Check firestore.rules and ensure:');
        console.error('   match /notifications/{notificationId} {');
        console.error('     allow read: if request.auth != null && resource.data.userId == request.auth.uid;');
        console.error('   }');
      }
      
      return { success: false, error: queryError.message };
    }
    
    // Step 3: Show notification details
    if (snapshot.size > 0) {
      console.log('\n📄 Step 3: Notification Details:');
      snapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n   [${index + 1}] ID:`, doc.id);
        console.log('       Title:', data.title);
        console.log('       Type:', data.type);
        console.log('       Read:', data.read);
        console.log('       UserID:', data.userId);
        console.log('       UserID Match:', data.userId === currentUser.uid ? '✅' : '❌');
        console.log('       Created:', data.createdAt);
      });
    } else {
      console.log('\n   ℹ️ No notifications found for this user');
      console.log('   This might be normal if:');
      console.log('   - User just signed up');
      console.log('   - No one has sent them notifications yet');
      console.log('   - Notifications were created with wrong userId');
    }
    
    // Step 4: Check all notifications (to see if userId is wrong)
    console.log('\n🔎 Step 4: Checking ALL notifications in database...');
    const allNotifsSnapshot = await getDocs(collection(db, 'notifications'));
    console.log('   Total notifications in DB:', allNotifsSnapshot.size);
    
    if (allNotifsSnapshot.size > 0) {
      const userIds = new Set();
      allNotifsSnapshot.docs.forEach(doc => {
        userIds.add(doc.data().userId);
      });
      
      console.log('   Unique user IDs found:', userIds.size);
      console.log('   User IDs:');
      Array.from(userIds).forEach(uid => {
        const isCurrentUser = uid === currentUser.uid;
        console.log(`     ${isCurrentUser ? '👉' : '  '} ${uid} ${isCurrentUser ? '(YOU)' : ''}`);
      });
      
      // Check if any notifications exist with similar UID
      const similarNotifs = allNotifsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.userId && (
          data.userId.includes(currentUser.uid) || 
          currentUser.uid.includes(data.userId)
        );
      });
      
      if (similarNotifs.length > 0) {
        console.warn('\n⚠️ Found notifications with similar userIds:');
        similarNotifs.forEach(doc => {
          const data = doc.data();
          console.log('   Notification:', data.title);
          console.log('   Has userId:', data.userId);
          console.log('   Your userId:', currentUser.uid);
          console.log('   Match:', data.userId === currentUser.uid ? 'YES' : 'NO');
        });
      }
    }
    
    // Step 5: Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SUMMARY:');
    console.log('   User authenticated:', currentUser ? '✅' : '❌');
    console.log('   User document exists:', userDoc.exists() ? '✅' : '❌');
    console.log('   Can query notifications:', snapshot ? '✅' : '❌');
    console.log('   Notifications found:', snapshot?.size || 0);
    console.log('='.repeat(50) + '\n');
    
    if (snapshot?.size === 0) {
      console.log('💡 NEXT STEPS:');
      console.log('   1. Have someone send you a notification');
      console.log('   2. Or run: sendTestNotification("' + (userData.department || 'library') + '")');
      console.log('   3. Then run this diagnostic again\n');
    }
    
    return {
      success: true,
      userExists: userDoc.exists(),
      canQuery: !!snapshot,
      notificationCount: snapshot?.size || 0,
      userData: userData
    };
    
  } catch (error) {
    console.error('\n❌ DIAGNOSTIC ERROR:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check specific notification by ID
 */
export const checkNotificationById = async (notificationId) => {
  console.log('\n🔍 Checking notification:', notificationId);
  
  try {
    const notifDoc = await getDoc(doc(db, 'notifications', notificationId));
    
    if (!notifDoc.exists()) {
      console.error('❌ Notification not found');
      return null;
    }
    
    const data = notifDoc.data();
    console.log('✅ Notification found:');
    console.log('   Title:', data.title);
    console.log('   Message:', data.message);
    console.log('   Type:', data.type);
    console.log('   UserID:', data.userId);
    console.log('   Read:', data.read);
    console.log('   Created:', data.createdAt);
    
    const currentUser = auth.currentUser;
    if (currentUser) {
      console.log('   Belongs to you:', data.userId === currentUser.uid ? '✅' : '❌');
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Error:', error);
    return null;
  }
};

/**
 * Compare two user IDs to see if they match
 */
export const compareUserIds = (uid1, uid2) => {
  console.log('\n🔍 Comparing User IDs:');
  console.log('   UID 1:', uid1);
  console.log('   UID 2:', uid2);
  console.log('   Match:', uid1 === uid2 ? '✅ YES' : '❌ NO');
  console.log('   UID 1 Length:', uid1?.length);
  console.log('   UID 2 Length:', uid2?.length);
  
  if (uid1 !== uid2) {
    console.log('\n   Character-by-character comparison:');
    const maxLen = Math.max(uid1?.length || 0, uid2?.length || 0);
    for (let i = 0; i < maxLen; i++) {
      const c1 = uid1?.[i] || '�';
      const c2 = uid2?.[i] || '�';
      if (c1 !== c2) {
        console.log(`   Position ${i}: '${c1}' vs '${c2}' ${c1 === c2 ? '✅' : '❌'}`);
      }
    }
  }
  
  return uid1 === uid2;
};

/**
 * Force create a test notification for current user
 */
export const forceCreateTestNotification = async () => {
  console.log('\n🧪 Creating test notification...');
  
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('❌ No user logged in');
      return;
    }
    
    const { createNotification } = await import('./notifications');
    
    await createNotification(
      currentUser.uid,
      'info',
      '🧪 Test Notification',
      'This is a test notification created by the diagnostic tool. If you can see this, notifications are working!',
      { test: true, createdBy: 'diagnostic' }
    );
    
    console.log('✅ Test notification created!');
    console.log('   Check your notification bell icon');
    console.log('   Or run: diagnoseNotificationFetch() to verify');
    
  } catch (error) {
    console.error('❌ Error creating test notification:', error);
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.diagnoseNotificationFetch = diagnoseNotificationFetch;
  window.checkNotificationById = checkNotificationById;
  window.compareUserIds = compareUserIds;
  window.forceCreateTestNotification = forceCreateTestNotification;
  
  console.log('🔧 Diagnostic tools loaded! Run in console:');
  console.log('   - diagnoseNotificationFetch()');
  console.log('   - forceCreateTestNotification()');
  console.log('   - checkNotificationById("NOTIFICATION_ID")');
  console.log('   - compareUserIds("uid1", "uid2")');
}

export { diagnoseNotificationFetch, checkNotificationById, compareUserIds, forceCreateTestNotification };