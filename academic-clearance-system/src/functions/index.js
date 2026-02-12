// functions/index.js
const functions = require('firebase-functions');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(functions.config().sendgrid.key);

exports.sendOTP = functions.https.onCall(async (data, context) => {
  const { email, otp, userName } = data;
  
  const msg = {
    to: email,
    from: 'noreply@yourdomain.com',
    subject: 'Your Academic Clearance OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Email Verification</h2>
        <p>Hello ${userName},</p>
        <p>Your OTP code is:</p>
        <h1 style="background: #F3F4F6; padding: 20px; text-align: center; letter-spacing: 5px;">${otp}</h1>
        <p style="color: #666;">This code will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `
  };
  
  await sgMail.send(msg);
  return { success: true };
});