# Academic Clearance System

A comprehensive web-based clearance management system built with React, Firebase, and Tailwind CSS. This system streamlines the academic clearance process for students, department staff, and administrators.

## 🌟 Features

### **For Students**
- **Clearance Submission**: Upload documents for multiple departments (PDF, JPG, PNG, WEBP)
- **Real-time Status Tracking**: Monitor approval status across all departments
- **Progress Dashboard**: Visual progress indicators and completion statistics
- **PDF Certificate Export**: Generate professional clearance certificates with approver details
- **File Preview**: Built-in file viewer for uploaded documents
- **Rejection Notifications**: Receive detailed feedback when documents are rejected
- **Dark Mode Support**: Toggle between light and dark themes

### **For Department Staff**
- **Bulk Operations**: Approve or reject multiple submissions simultaneously
- **Advanced Filtering**: Search and filter by student name, ID, course, year level, semester
- **File Management**: Preview, download, and review student submissions
- **Detailed Student Profiles**: View complete student information and submission history
- **Real-time Updates**: Live notifications for new submissions
- **Status Management**: Approve, reject, or request resubmission with custom messages

### **For Administrators**
- **Complete System Control**: Manage all users, departments, and clearances
- **Access Token Management**: Generate and revoke department access tokens
- **Requirement Templates**: Create and edit clearance requirements per department
- **Audit Trail**: Track all system actions with detailed logs
- **Student Status Overview**: Monitor all students' clearance progress
- **Backup & Recovery**: Export/import database collections
- **Quota Monitoring**: Real-time countdown to daily Firebase quota reset

### **Security Features**
- ✅ **Two-Factor Authentication (2FA)**: Email-based OTP verification
- 🔐 **Device Trust**: "Remember this device" for 30 days
- 🛡️ **Session Management**: Multi-device session tracking with activity monitoring
- 🚫 **File Security**: Blocks dangerous file types (executables, scripts)
- 📊 **Audit Logging**: Complete activity trail for compliance
- ⏱️ **Auto Session Timeout**: 30-minute inactivity logout

---

## 🏗️ Architecture

### **Tech Stack**
- **Frontend**: React 18+ with Vite
- **Styling**: Tailwind CSS with dark mode support
- **Backend**: Firebase (Authentication, Firestore)
- **Email Service**: EmailJS for OTP delivery
- **PDF Generation**: jsPDF + jsPDF-AutoTable
- **Icons**: Lucide React

### **Project Structure**
```
src/
├── components/
│   ├── AdminDashboard.jsx         # Admin control panel
│   ├── DepartmentDashboard.jsx    # Department staff interface
│   ├── StudentDashboard.jsx       # Student portal
│   ├── Login.jsx                  # Authentication & signup
│   ├── TwoFactorModal.jsx         # 2FA verification dialog
│   ├── SecuritySettings.jsx       # 2FA & session management
│   ├── SessionManagement.jsx      # Active sessions viewer
│   ├── ProfileView.jsx            # User profile editor
│   ├── NotificationPanel.jsx      # Real-time notifications
│   └── DarkModeToggle.jsx         # Theme switcher
├── context/
│   ├── AuthContext.jsx            # Authentication state management
│   └── ThemeContext.jsx           # Dark mode state
├── utils/
│   ├── Twofactorauth.js           # 2FA logic (OTP generation/verification)
│   ├── sessionManager.js          # Session lifecycle management
│   ├── deviceTrust.js             # Trusted device handling
│   ├── notifications.js           # Notification system
│   └── diagnostics.js             # Debugging tools
├── firebase/
│   └── config.js                  # Firebase initialization
├── App.jsx                        # Main app component
└── main.jsx                       # Entry point
```

---

## 🚀 Installation & Setup

### **Prerequisites**
- Node.js 16+ and npm
- Firebase project with Firestore enabled
- EmailJS account (for OTP emails)

### **1. Clone Repository**
```bash
git clone https://github.com/Ryannabo/Academic-Clearance.git
cd academic-clearance-system
```

### **2. Install Dependencies**
```bash
npm install
```

### **3. Environment Configuration**

Create `.env` file in project root:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY="AIzaSyCf7Mkqvaf4pBSoerW8hREn8biSsvi8cX4"
VITE_FIREBASE_AUTH_DOMAIN="academic-clearance.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="academic-clearance"
VITE_FIREBASE_STORAGE_BUCKET="academic-clearance.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="679171519026"
VITE_FIREBASE_APP_ID="1:679171519026:web:ba701da888324c2f15822b"


# EmailJS Configuration (for OTP emails)
VITE_EMAILJS_SERVICE_ID=service_wqfpk9k
VITE_EMAILJS_TEMPLATE_ID=template_npgf824
VITE_EMAILJS_PUBLIC_KEY=vBQxZ_dv3-mZzSw8M
REACT_APP_EMAILJS_2FA_TEMPLATE_ID=template_e0jozr4
```

### **4. Firebase Setup**

#### **Firestore Security Rules** (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
  
  	// ============================================================================
    // 🚀 ADMIN SUPER‑ACCESS – MUST BE FIRST
    // ============================================================================
    match /{document=**} {
      allow read, write: if isAdmin();
    }
    
    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================
    
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    
    function isAdmin() {
      return isSignedIn() && 
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    function isDepartment() {
      return isSignedIn()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
           in [
             'library',
             'course_office',
             'guidance',
             'student_council',
             'finance',
             'student_government',
             'cashier'
           ];
    }
    
    function isSpecificDepartment(department) {
      return isSignedIn()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == department;
    }
    
    function isStudent() {
      return isSignedIn() && 
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'student';
    }
    
    // ============================================================================
    // USERS COLLECTION
    // ============================================================================
    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if isOwner(userId) || isAdmin();
      allow delete: if isAdmin();
    }
    
    // ============================================================================
    // STUDENTS COLLECTION
    // ============================================================================
    match /students/{studentId} {
      allow read: if isSignedIn();
      allow create: if request.auth != null && request.auth.uid == studentId;
      allow update: if isOwner(studentId) || isAdmin() || isDepartment();
      allow delete: if isAdmin();
    }
    
    // ============================================================================
    // STUDENT ID REGISTRY
    // ============================================================================
    match /student_ids/{studentId} {
      allow read: if true; // Anyone can check if ID exists
      allow create: if true; // Allow registration check
      allow update: if isSignedIn();
      allow delete: if isAdmin();
    }
    
    // ============================================================================
    // CLEARANCES COLLECTION
    // ============================================================================
    match /clearances/{clearanceId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update: if isSignedIn();
      allow delete: if isAdmin();
    }
    
    // ============================================================================
    // CLEARANCE REQUIREMENTS (Department Subcollections)
    // ============================================================================
    match /clearance_requirements/{department}/students/{studentId} {
      allow read: if isSignedIn() && (
        isOwner(studentId) || 
        isAdmin() || 
        isSpecificDepartment(department)
      );
      
      allow create: if isSignedIn() && isOwner(studentId);
      
      allow update: if isSignedIn() && (
        isOwner(studentId) || 
        isAdmin() || 
        isSpecificDepartment(department)
      );
      
      allow delete: if isAdmin();
    }
    
    // ============================================================================
    // DEPARTMENT TOKENS
    // ============================================================================
    match /department_tokens/{tokenId} {
      allow read: if true; // Anyone can verify tokens during signup
      allow create: if isAdmin();
      allow update: if isSignedIn(); // Allow marking as used
      allow delete: if isAdmin();
    }
    
    // ============================================================================
    // REQUIREMENTS TEMPLATES
    // ============================================================================
    match /requirements_templates/{templateId} {
      allow read: if isSignedIn();
      allow create: if isAdmin() || isDepartment();
      allow update: if isAdmin() || isDepartment();
      allow delete: if isAdmin();
    }
    
    // ============================================================================
    // PENDING VERIFICATIONS (Signup OTP)
    // ============================================================================
    match /pending_verifications/{email} {
      allow create: if true; // Allow OTP creation during signup
      allow read: if true; // Allow OTP verification
      allow update: if true; // Allow OTP updates
      allow delete: if true; // Allow cleanup
    }
    
    // ============================================================================
    // NOTIFICATIONS
    // ============================================================================
    match /notifications/{notificationId} {
      allow read: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn();
      allow update: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow delete: if isSignedIn() && resource.data.userId == request.auth.uid;
    }
    
    // ============================================================================
    // OTP CODES (2FA System)
    // ============================================================================
    match /otp_codes/{userId} {
      allow read: if isOwner(userId); // Only owner can read their OTP
      allow create: if isSignedIn(); // Allow OTP generation
      allow update: if isOwner(userId); // Allow verification attempt updates
      allow delete: if isOwner(userId) || isAdmin(); // Allow cleanup
    }
    
    // Trusted devices subcollection
    match /users/{userId}/trusted_devices/{deviceId} {
      allow read, write: if isOwner(userId);
    }
    
    // ============================================================================
    // SESSIONS
    // ============================================================================
    match /sessions/{sessionId} {
      allow read: if isSignedIn() && 
                    resource.data.userId == request.auth.uid;

      allow create: if isSignedIn();

      allow update: if isSignedIn() && 
                      resource.data.userId == request.auth.uid;

      allow delete: if isSignedIn() && (
                      resource.data.userId == request.auth.uid || 
                      isAdmin()
                    );

      // 🆕 Allow admins to list all sessions for cleanup
      allow list: if isAdmin();
    }
    
    // ============================================================================
    // AUDIT LOGS (Admin Actions)
    // ============================================================================
    match /audit_logs/{logId} {
      allow read: if isAdmin(); // Only admins can read audit logs
      allow create: if isAdmin(); // Only admins can create logs
      allow update: if false; // Logs are immutable
      allow delete: if false; // Logs cannot be deleted
    }
  }
}
```

#### **Firestore Indexes**
Create these composite indexes in Firebase Console:

1. **Notifications Collection**
   - `userId` (Ascending) + `createdAt` (Descending)

2. **Sessions Collection**
   - `userId` (Ascending) + `active` (Ascending)

3. **Audit Logs Collection**
   - `timestamp` (Descending)

### **5. EmailJS Configuration**

1. Create account at [emailjs.com](https://emailjs.com)
2. Add email service (Gmail/Outlook/etc.)
3. Create 2FA email template with variables:
   - `{{to_email}}` - Recipient email
   - `{{to_name}}` - Recipient name
   - `{{otp_code}}` - 6-digit OTP
   - `{{expiry_minutes}}` - Expiry time
   - `{{app_name}}` - Application name

**Hardcoded Override (Development)**:  
If environment variables fail, edit `src/utils/Twofactorauth.js`:
```javascript
const serviceId = 'service_wqfpk9k';        // ← Your service ID
const templateId = 'template_e0jozr4';      // ← Your template ID
const publicKey = 'vBQxZ_dv3-mZzSw8M';      // ← Your public key
```

### **6. Run Development Server**
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173)

### **7. Build for Production**
```bash
npm run build
npm run preview  # Test production build
```

---

## 👥 User Roles & Permissions

### **Student**
- Submit clearance documents
- View submission status
- Download clearance certificate
- Edit profile (limited)

### **Department Staff**
- Review submissions
- Approve/reject clearances
- Bulk processing
- View student details
- Cannot access other departments' data

### **Admin**
- Full system access
- Generate department tokens
- Manage requirements
- View all clearances
- Export/import data
- Audit trail access

---

## 🔐 Security Implementation

### **Two-Factor Authentication Flow**
1. User enters email/password
2. System checks if 2FA enabled
3. If enabled → Check if device is trusted
4. If not trusted → Generate OTP → Send email
5. User enters 6-digit code
6. Optional: Trust device for 30 days
7. Create session → Login complete

### **Session Management**
- **Max sessions per user**: 3 concurrent devices
- **Session timeout**: 30 minutes inactivity
- **Activity tracking**: Updates every 5 minutes (throttled)
- **Automatic cleanup**: Expired sessions deleted hourly

### **File Security**
- **Allowed types**: PDF, JPG, PNG, WEBP only
- **Max file size**: 5MB per file
- **Blocked extensions**: `.exe`, `.bat`, `.js`, `.vbs`, `.sh`, etc.
- **Extension validation**: Prevents double-extension attacks
- **MIME type check**: Validates content matches extension

### **Firestore Quota Management**
- **Free tier**: 20,000 writes/day, 50,000 reads/day
- **Throttled operations**: Session updates, backup/restore, cleanup
- **Batch processing**: Deletes in batches of 20-100 with delays
- **Quota timer**: Shows countdown to daily reset (midnight Pacific)

---

## 📋 Department Workflow

### **Available Departments**
1. 📚 **Library** - No pending books/materials
2. 🎓 **Course Office** - Academic records clearance
3. 🧭 **Guidance** - Counseling/behavioral clearance
4. 👥 **Student Council** - Student organization clearance
5. 💰 **Finance** - Financial obligations clearance
6. 🏛️ **Student Government** - Leadership clearance
7. 💳 **Cashier** - Payment verification

### **Clearance Process**
1. **Student uploads** documents for each department
2. **Department receives** notification
3. **Staff reviews** files (preview/download)
4. **Decision**: Approve ✅ or Reject ❌ with reason
5. **Student notified** of status change
6. **If rejected**: Student resubmits corrected documents
7. **All approved**: Student exports PDF certificate

---

## 🎨 Dark Mode

The system supports automatic dark mode with:
- System preference detection
- Manual toggle control
- Persistent user preference
- Smooth color transitions
- All components themed

**Toggle locations**: Top-right corner of every page

---

## 📱 Responsive Design

Fully responsive on:
- 📱 Mobile (320px+)
- 📱 Tablet (768px+)
- 💻 Desktop (1024px+)
- 🖥️ Large displays (1920px+)

Optimized layouts:
- Collapsible navigation
- Stacked forms on mobile
- Grid-to-column layouts
- Touch-friendly controls

---

## 🐛 Debugging Tools

Built-in diagnostics (run in browser console):

```javascript
// Check notification permissions
diagnoseNotificationFetch()

// Test notification creation
forceCreateTestNotification()

// Verify specific notification
checkNotificationById('notification_id_here')

// Compare user IDs
compareUserIds('uid1', 'uid2')
```

**Enable diagnostics**: Automatically loaded in development mode

---

## 📦 Dependencies

### **Core**
- `react` ^18.3.1
- `react-dom` ^18.3.1
- `firebase` ^11.1.0
- `lucide-react` ^0.469.0

### **PDF & Email**
- `jspdf` ^2.5.2
- `jspdf-autotable` ^3.8.4
- `@emailjs/browser` ^4.4.1

### **Styling**
- `tailwindcss` ^3.4.17
- `autoprefixer` ^10.4.20
- `postcss` ^8.4.49

### **Build Tools**
- `vite` ^6.0.5
- `@vitejs/plugin-react` ^4.3.4
- `eslint` ^9.17.0

---

## 🚧 Known Limitations

### **Firebase Spark Plan (Free Tier)**
- **Reads**: 50,000/day
- **Writes**: 20,000/day
- **Deletes**: 20,000/day
- **Storage**: 1 GB

**Recommendations**:
- Use backup sparingly
- Avoid frequent cleanups
- Upgrade to Blaze plan for production

### **File Storage**
- Files stored as Base64 in Firestore (counts against quota)
- Consider Firebase Storage for large-scale deployment

### **Email OTP**
- Relies on EmailJS (free tier: 200 emails/month)
- Upgrade or use alternative service for production

---

## 🛠️ Troubleshooting

### **OTP Emails Not Sending**
1. Check EmailJS credentials in `.env`
2. Verify template ID matches
3. Check spam folder
4. Check EmailJS dashboard for errors
5. Use fallback hardcoded config (development only)

### **Session Timeout Issues**
1. Check browser storage for `sessionId`
2. Verify Firestore rules allow session reads
3. Check console for quota errors
4. Clear browser cache/storage

### **Dark Mode Not Persisting**
1. Check localStorage for `darkMode` key
2. Verify ThemeProvider wraps entire app
3. Clear browser cache

### **File Upload Failing**
1. Check file type (PDF/JPG/PNG/WEBP only)
2. Verify file size < 5MB
3. Check Firestore write quota
4. Review browser console for errors

---

## 🚀 Deployment

### **Firebase Hosting**
```bash
npm run build
firebase deploy --only hosting
```

### **Vercel/Netlify**
1. Connect GitHub repository
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables
5. Deploy

---

## 📄 License

MIT License - feel free to use for educational/commercial purposes

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📞 Support

For issues or questions:
- 📧 Email: kimryannabo@gmail.com
- 🐛 GitHub Issues: [github.com/Academic-Clearance/issues](https://github.com)
- 📖 Documentation: [docs.example.com](https://example.com)

---

## ✨ Credits

**Developed by**: Kim Ryan R. Nabo 
**Icons**: Lucide React  
**PDF Generation**: jsPDF  
**Email Service**: EmailJS  
**Backend**: Firebase by Google  

---

## 🗺️ Roadmap

- [ ] SMS OTP alternative to email
- [ ] Firebase Storage integration
- [ ] Automated deadline reminders
- [ ] Analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Batch student import (CSV/Excel)
- [ ] QR code verification
- [ ] Digital signatures

---

**Last Updated**: February 2026  
**Version**: 1.0.0
