// src/utils/emailOTP.js
import emailjs from '@emailjs/browser';

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOTPEmail = async (email, otp, userName) => {
  try {
    // Get credentials from environment variables
    const serviceID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    // Check if credentials are set
    if (!serviceID || !templateID || !publicKey) {
      console.error('EmailJS credentials not configured');
      console.log('Falling back to console OTP');
      console.log(`OTP for ${email}: ${otp}`);
      return false;
    }

    // Template parameters (must match your EmailJS template variables)
    const templateParams = {
      to_email: email,
      to_name: userName,
      otp_code: otp,
      from_name: 'Academic Clearance System'
    };

    // Send email
    const response = await emailjs.send(
      serviceID,
      templateID,
      templateParams,
      publicKey
    );

    console.log('✅ Email sent successfully:', response.status, response.text);
    return true;

  } catch (error) {
    console.error('❌ Error sending email:', error);
    // Fallback: show OTP in console for development
    console.log(`Fallback OTP for ${email}: ${otp}`);
    return false;
  }
};