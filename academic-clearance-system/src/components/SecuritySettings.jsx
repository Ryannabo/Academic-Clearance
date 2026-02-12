// src/components/SecuritySettings.jsx - SECURITY SETTINGS PANEL
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
      // Generate and send OTP
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto transition-colors duration-300">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Lock className="text-indigo-600 dark:text-indigo-400" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Security Settings</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Manage your account security</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('2fa')}
              className={`pb-2 px-1 border-b-2 transition-colors ${
                activeTab === '2fa'
                  ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Two-Factor Auth
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`pb-2 px-1 border-b-2 transition-colors ${
                activeTab === 'sessions'
                  ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Active Sessions
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* 2FA Tab */}
          {activeTab === '2fa' && (
            <div className="space-y-6">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <Shield className={`flex-shrink-0 ${
                      twoFactorEnabled 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-gray-400 dark:text-gray-500'
                    }`} size={24} />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        Two-Factor Authentication
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
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
                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                      <p className="text-sm text-blue-800 dark:text-blue-400">
                        {twoFactorEnabled 
                          ? '✅ Your account is protected with two-factor authentication. You will receive a code via email each time you log in.'
                          : '⚠️ Enable 2FA to protect your account from unauthorized access. You will receive a verification code via email when logging in.'}
                      </p>
                    </div>

                    {twoFactorEnabled ? (
                      <button
                        onClick={handleDisable2FA}
                        disabled={loading}
                        className="w-full bg-red-600 dark:bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        Disable Two-Factor Authentication
                      </button>
                    ) : (
                      <button
                        onClick={handleEnable2FA}
                        disabled={setupLoading}
                        className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {setupLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Sending Code...
                          </>
                        ) : (
                          <>
                            <Shield size={20} />
                            Enable Two-Factor Authentication
                          </>
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <p className="text-sm text-green-800 dark:text-green-400">
                        📧 We've sent a verification code to <strong>{user.email}</strong>
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-center text-2xl font-mono tracking-widest"
                        placeholder="000000"
                      />
                    </div>

                    {setupError && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                        <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
                        <p className="text-sm text-red-700 dark:text-red-400">{setupError}</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowSetup2FA(false);
                          setSetupStep(1);
                          setVerificationCode('');
                          setSetupError('');
                        }}
                        className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleVerify2FASetup}
                        disabled={setupLoading || verificationCode.length !== 6}
                        className="flex-1 bg-indigo-600 dark:bg-indigo-500 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {setupLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Verifying...
                          </>
                        ) : (
                          <>
                            <CheckCircle size={20} />
                            Verify & Enable
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Additional security info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">How it works</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>• When enabled, you'll receive a 6-digit code via email when logging in</li>
                  <li>• Enter the code to complete your login</li>
                  <li>• Codes expire after 10 minutes</li>
                  <li>• Maximum 5 attempts per code</li>
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