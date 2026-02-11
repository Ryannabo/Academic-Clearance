// src/components/TwoFactorModal.jsx - 2FA VERIFICATION MODAL
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
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);
  const [trustDevice, setTrustDevice] = useState(false);

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

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }

    // Auto-verify when all filled
    if (index === 5 && value) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerify(fullOtp);
      }
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

    if (pastedData.length === 6) {
      handleVerify(pastedData);
    }
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
      onVerified(trustDevice); // ✅ pass flag
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 transition-colors duration-300">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Shield className="text-indigo-600 dark:text-indigo-400" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Enter the code sent to your email</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-400">
              📧 We've sent a 6-digit code to <strong>{userEmail}</strong>
            </p>
          </div>

          <div className="flex gap-2 justify-center mb-4">
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
                className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg transition-all ${error
                  ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 dark:focus:border-indigo-400'
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                disabled={loading}
              />
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg mb-4">
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex justify-between items-center text-sm">
            <button
              onClick={handleResend}
              disabled={!canResend || loading}
              className={`flex items-center gap-2 ${canResend
                ? 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300'
                : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                }`}
            >
              <RefreshCw size={16} />
              {canResend ? 'Resend Code' : `Resend in ${resendTimer}s`}
            </button>
            <p className="text-gray-500 dark:text-gray-400">Code expires in 10 min</p>
          </div>
        </div>

        <button
          onClick={() => handleVerify()}
          disabled={loading || otp.join('').length !== 6}
          className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Verifying...
            </>
          ) : (
            <>
              <CheckCircle size={20} />
              Verify Code
            </>
          )}
        </button>

        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="trustDevice"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <label htmlFor="trustDevice" className="text-sm text-gray-700 dark:text-gray-300">
            Trust this device for 30 days
          </label>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
          Didn't receive the code? Check your spam folder or click resend.
        </p>
      </div>
    </div>
  );
}