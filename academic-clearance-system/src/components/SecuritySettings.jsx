// src/components/SecuritySettings.jsx – PERFECTLY RESPONSIVE (SHIELD ICONS HIDE @403px)
import React, { useState, useEffect } from 'react';
import { Shield, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  is2FAEnabled, 
  enable2FA, 
  disable2FA,
  generateOTP,
  storeOTP,
  sendOTPEmail,
  verifyOTP 
} from '../utils/Twofactorauth';
import SessionManagement from './SessionManagement';

export default function SecuritySettings({ isOpen, onClose }) {
  const { user, sessionId } = useAuth();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('2fa');
  
  // 2FA Setup states
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [verificationCode, setVerificationCode] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);

  // ✅ Screen width detection – hide shield icons on screens ≤403px
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  useEffect(() => {
    const checkWidth = () => setIsSmallScreen(window.innerWidth <= 403);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  useEffect(() => {
    if (user) {
      loadSecuritySettings();
    }
  }, [user]);

  const loadSecuritySettings = async () => {
    try {
      const enabled = await is2FAEnabled(user.uid);
      setTwoFactorEnabled(enabled);
    } catch (error) {
      console.error('Error loading security settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    setSetupLoading(true);
    setSetupError('');

    try {
      const otp = generateOTP();
      await storeOTP(user.uid, user.email, otp);
      const result = await sendOTPEmail(user.email, otp, user.name);

      if (result.success) {
        setShowSetup2FA(true);
        setSetupStep(2);
      } else {
        setSetupError('Failed to send verification code. Please try again.');
      }
    } catch (error) {
      setSetupError('Error setting up 2FA: ' + error.message);
    } finally {
      setSetupLoading(false);
    }
  };

  const handleVerify2FASetup = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setSetupError('Please enter the 6-digit code');
      return;
    }

    setSetupLoading(true);
    setSetupError('');

    try {
      const result = await verifyOTP(user.uid, verificationCode);

      if (result.success) {
        await enable2FA(user.uid);
        setTwoFactorEnabled(true);
        setShowSetup2FA(false);
        setSetupStep(1);
        setVerificationCode('');
        alert('✅ Two-Factor Authentication enabled successfully!');
      } else {
        setSetupError(result.message);
      }
    } catch (error) {
      setSetupError('Verification failed: ' + error.message);
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm('⚠️ Are you sure you want to disable Two-Factor Authentication?\n\nThis will make your account less secure.')) {
      return;
    }

    setLoading(true);
    try {
      await disable2FA(user.uid);
      setTwoFactorEnabled(false);
      alert('Two-Factor Authentication disabled.');
    } catch (error) {
      alert('Failed to disable 2FA: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // --------------------- RESPONSIVE UI – SHIELD ICONS HIDE ≤403px ---------------------
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-3 sm:p-4 z-50 overflow-x-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-sm sm:max-w-2xl lg:max-w-4xl w-full max-h-[90vh] overflow-y-auto transition-colors duration-300 shadow-xl">
        
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 sm:p-6 z-10">
          <div className="flex flex-col xs:flex-row xs:items-center gap-3 xs:gap-4">
            <div className="flex-shrink-0 self-start xs:self-center">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg inline-block">
                <Lock className="text-indigo-600 dark:text-indigo-400" size={24} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 break-words text-balance">
                Security Settings
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
                Manage your account security
              </p>
            </div>
            <button
              onClick={onClose}
              className="absolute xs:relative top-2 right-2 xs:top-0 xs:right-0 flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 -mt-1 -mr-1 xs:m-0"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab('2fa')}
              className={`pb-2 px-1 whitespace-nowrap border-b-2 transition-colors text-sm sm:text-base ${
                activeTab === '2fa'
                  ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Two-Factor Auth
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`pb-2 px-1 whitespace-nowrap border-b-2 transition-colors text-sm sm:text-base ${
                activeTab === 'sessions'
                  ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Active Sessions
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* 2FA Tab */}
          {activeTab === '2fa' && (
            <div className="space-y-5 sm:space-y-6">
              {/* Main 2FA Card */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  
                  {/* ✅ Header icon + text – perfectly aligned */}
                  <div className="flex items-start gap-3">
                    {/* 🛡️ Shield icon – hidden on screens ≤403px */}
                    {!isSmallScreen && (
                      <div className="flex-shrink-0 self-center">
                        <Shield className={`${
                          twoFactorEnabled 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-gray-400 dark:text-gray-500'
                        }`} size={24} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 break-words">
                        Two-Factor Authentication
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                  </div>
                  
                  {/* Status badge */}
                  <div className="flex-shrink-0 self-start sm:self-center">
                    <span className={`inline-block px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                      twoFactorEnabled
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {!showSetup2FA ? (
                  <>
                    {/* Status message */}
                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4 mb-4">
                      <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-400 break-words">
                        {twoFactorEnabled 
                          ? '✅ Your account is protected with two-factor authentication. You will receive a code via email each time you log in.'
                          : '⚠️ Enable 2FA to protect your account from unauthorized access. You will receive a verification code via email when logging in.'}
                      </p>
                    </div>

                    {/* Action button – shield icon hidden on screens ≤403px */}
                    {twoFactorEnabled ? (
                      <button
                        onClick={handleDisable2FA}
                        disabled={loading}
                        className="w-full bg-red-600 dark:bg-red-500 text-white py-2.5 sm:py-3 px-4 rounded-lg font-semibold hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 transition-colors text-sm sm:text-base"
                      >
                        Disable Two-Factor Authentication
                      </button>
                    ) : (
                      <button
                        onClick={handleEnable2FA}
                        disabled={setupLoading}
                        className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-2.5 sm:py-3 px-4 rounded-lg font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        {setupLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
                            <span>Sending Code...</span>
                          </>
                        ) : (
                          <>
                            {/* 🛡️ Button shield icon – hidden on screens ≤403px */}
                            {!isSmallScreen && <Shield size={18} />}
                            <span>Enable Two-Factor Authentication</span>
                          </>
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  /* Verification step */
                  <div className="space-y-4">
                    <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-4">
                      <p className="text-xs sm:text-sm text-green-800 dark:text-green-400 break-words">
                        📧 We've sent a verification code to <strong className="break-all">{user.email}</strong>
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Enter 6-digit verification code
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => {
                          setVerificationCode(e.target.value.replace(/\D/g, ''));
                          setSetupError('');
                        }}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-center text-xl sm:text-2xl font-mono tracking-widest"
                        placeholder="000000"
                      />
                    </div>

                    {setupError && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                        <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={18} />
                        <p className="text-xs sm:text-sm text-red-700 dark:text-red-400 break-words">{setupError}</p>
                      </div>
                    )}

                    <div className="flex flex-col xs:flex-row gap-3">
                      <button
                        onClick={() => {
                          setShowSetup2FA(false);
                          setSetupStep(1);
                          setVerificationCode('');
                          setSetupError('');
                        }}
                        className="w-full xs:flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2.5 sm:py-3 px-4 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm sm:text-base"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleVerify2FASetup}
                        disabled={setupLoading || verificationCode.length !== 6}
                        className="w-full xs:flex-1 bg-indigo-600 dark:bg-indigo-500 text-white py-2.5 sm:py-3 px-4 rounded-lg font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        {setupLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Verifying...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle size={18} />
                            <span>Verify & Enable</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Additional security info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 sm:p-5">
                <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 text-sm sm:text-base">
                  How it works
                </h4>
                <ul className="space-y-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <li className="break-words">• When enabled, you'll receive a 6-digit code via email when logging in</li>
                  <li className="break-words">• Enter the code to complete your login</li>
                  <li className="break-words">• Codes expire after 10 minutes</li>
                  <li className="break-words">• Maximum 5 attempts per code</li>
                </ul>
              </div>
            </div>
          )}

          {/* Sessions Tab */}
          {activeTab === 'sessions' && (
            <SessionManagement userId={user.uid} currentSessionId={sessionId} />
          )}
        </div>
      </div>
    </div>
  );
}