// src/components/TwoFactorModal.jsx – SHIELD ICON HIDES BELOW 451px (RESIZE LISTENER)
import React, { useState, useEffect, useRef } from 'react';
import { Shield, AlertCircle, CheckCircle, X, RefreshCw } from 'lucide-react';
import { verifyOTP, sendOTPEmail, generateOTP, storeOTP } from '../utils/Twofactorauth';

export default function TwoFactorModal({
  isOpen,
  onClose,
  onVerified,
  userEmail,
  userId,
  userName
}) {
  // --------------------- LOGIC UNCHANGED ---------------------
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);
  const [trustDevice, setTrustDevice] = useState(false);

  // ✅ NEW: Track screen width to hide shield icon on small screens
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      setIsSmallScreen(window.innerWidth <= 450);
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  useEffect(() => {
    if (isOpen && resendTimer > 0) {
      const timer = setInterval(() => {
        setResendTimer(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isOpen, resendTimer]);

  useEffect(() => {
    if (isOpen && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [isOpen]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');
    if (value && index < 5) inputRefs.current[index + 1].focus();
    if (index === 5 && value) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) handleVerify(fullOtp);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;
    const newOtp = pastedData.split('');
    setOtp([...newOtp, ...Array(6 - newOtp.length).fill('')]);
    if (pastedData.length === 6) handleVerify(pastedData);
  };

  const handleVerify = async (code = null) => {
    const otpCode = code || otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }
    setLoading(true);
    setError('');
    const result = await verifyOTP(userId, otpCode);
    if (result.success) {
      onVerified(trustDevice);
    } else {
      setError(result.message);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0].focus();
    }
    setLoading(false);
  };

  const handleResend = async () => {
    if (!canResend) return;
    setLoading(true);
    setError('');
    setOtp(['', '', '', '', '', '']);
    try {
      const newOtp = generateOTP();
      await storeOTP(userId, userEmail, newOtp);
      await sendOTPEmail(userEmail, newOtp, userName);
      setResendTimer(60);
      setCanResend(false);
      alert('✅ New OTP sent to your email!');
    } catch (error) {
      setError('Failed to resend OTP. Please try again.');
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  // --------------------- UI – SHIELD ICON HIDES WHEN WIDTH ≤ 450px ---------------------
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-3 z-50 transition-opacity duration-300 overflow-x-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-[360px] xs:max-w-sm sm:max-w-md w-full p-4 sm:p-6 transition-colors duration-300 shadow-xl">
        
        {/* HEADER – shield icon conditionally rendered based on screen width */}
        <div className="flex flex-col xs:flex-row xs:items-start gap-3 xs:gap-2 sm:gap-3 mb-4 sm:mb-6">
          
          {/* 🛡️ Shield icon – only shown when screen width > 450px */}
          {!isSmallScreen && (
            <div className="flex-shrink-0 self-center xs:self-start">
              <div className="p-1 xs:p-1.5 sm:p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg inline-block">
                <Shield className="text-indigo-600 dark:text-indigo-400" size={18} />
              </div>
            </div>
          )}
          
          {/* Text – takes remaining space */}
          <div className="min-w-0 flex-1 text-center xs:text-left">
            <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 leading-tight break-words">
              Two-Factor Authentication
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
              Enter the code sent to your email
            </p>
          </div>

          {/* Close button – always visible */}
          <button
            onClick={onClose}
            className="absolute xs:relative top-2 right-2 xs:top-0 xs:right-0 flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 -mt-1 -mr-1 xs:m-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Email notice */}
        <div className="mb-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2 sm:p-3">
            <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-400 break-words">
              📧 We've sent a 6-digit code to <strong className="break-all">{userEmail}</strong>
            </p>
          </div>
        </div>

        {/* OTP Inputs – responsive sizing */}
        <div className="flex gap-1 sm:gap-2 justify-center mb-3 sm:mb-4">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : null}
              className={`w-9 h-11 xs:w-10 xs:h-12 sm:w-12 sm:h-14 text-center text-lg xs:text-xl sm:text-2xl font-bold border-2 rounded-lg transition-all ${
                error
                  ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 dark:focus:border-indigo-400'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
              disabled={loading}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-2 sm:p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg mb-3 sm:mb-4">
            <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={18} />
            <p className="text-xs sm:text-sm text-red-700 dark:text-red-400 break-words">{error}</p>
          </div>
        )}

        {/* Resend and expiry */}
        <div className="flex flex-col xs:flex-row justify-between items-center xs:items-center gap-2 text-xs sm:text-sm mb-4">
          <button
            onClick={handleResend}
            disabled={!canResend || loading}
            className={`flex items-center gap-1 sm:gap-2 ${
              canResend
                ? 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300'
                : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            <RefreshCw size={14} />
            {canResend ? 'Resend Code' : `Resend in ${resendTimer}s`}
          </button>
          <p className="text-gray-500 dark:text-gray-400">Code expires in 10 min</p>
        </div>

        {/* Verify button */}
        <button
          onClick={() => handleVerify()}
          disabled={loading || otp.join('').length !== 6}
          className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-2 sm:py-3 rounded-lg font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
              Verifying...
            </>
          ) : (
            <>
              <CheckCircle size={18} />
              Verify Code
            </>
          )}
        </button>

        {/* Trust device checkbox */}
        <div className="flex items-center gap-2 mt-4">
          <input
            type="checkbox"
            id="trustDevice"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <label htmlFor="trustDevice" className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            Trust this device for 30 days
          </label>
        </div>

        {/* Footer note */}
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
          Didn't receive the code? Check your spam folder or click resend.
        </p>
      </div>
    </div>
  );
}