import { collection, getDocs, query, where, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const cleanupDuplicateStudentIds = async () => {
  try {
    console.log('🔍 Scanning for duplicate Student IDs...');
    
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    const studentIdMap = new Map();
    const duplicates = [];
    
    // Find duplicates
    studentsSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const studentId = data.studentId;
      
      if (studentIdMap.has(studentId)) {
        duplicates.push({
          id: docSnap.id,
          studentId: studentId,
          data: data
        });
      } else {
        studentIdMap.set(studentId, {
          id: docSnap.id,
          data: data
        });
      }
    });
    
    console.log(`Found ${duplicates.length} duplicate student records`);
    
    if (duplicates.length > 0) {
      console.log('Duplicates found:', duplicates);
      alert(`Found ${duplicates.length} duplicate Student IDs. Please manually review and delete them in Firebase Console.`);
    } else {
      console.log('✅ No duplicates found!');
      
      // Register all existing Student IDs
      console.log('📝 Registering existing Student IDs...');
      for (const [studentId, record] of studentIdMap) {
        await setDoc(doc(db, 'student_ids', studentId), {
          userId: record.id,
          email: record.data.email,
          registeredAt: new Date().toISOString()
        });
      }
      console.log('✅ All Student IDs registered!');
    }
    
    return duplicates;
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
};