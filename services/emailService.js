// services/emailService.js — Email sending via Nodemailer
const nodemailer = require('nodemailer');
require('dotenv').config();

// Create reusable transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS  // Use App Password for Gmail
  }
});

/**
 * Send a password reset email with the reset link.
 * @param {string} toEmail - Recipient email address
 * @param {string} resetToken - The unique reset token
 * @returns {Promise<boolean>} - Whether the email was sent successfully
 */
async function sendPasswordResetEmail(toEmail, resetToken) {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"🍽️ AI Food Order" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Password Reset - AI Food Ordering System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
        <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#6c63ff 0%,#48c6ef 100%);padding:36px 30px;text-align:center;">
            <div style="font-size:42px;margin-bottom:8px;">🍽️</div>
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;letter-spacing:0.5px;">Password Reset Request</h1>
          </div>

          <!-- Body -->
          <div style="padding:32px 30px;">
            <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 20px;">
              Hello,
            </p>
            <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 20px;">
              We received a request to reset the password for your <strong>AI Food Order</strong> account associated with <strong>${toEmail}</strong>.
            </p>
            <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 28px;">
              Click the button below to set a new password:
            </p>
            
            <!-- CTA Button -->
            <div style="text-align:center;margin:0 0 28px;">
              <a href="${resetLink}" 
                 style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#6c63ff,#48c6ef);color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(108,99,255,0.35);">
                Reset My Password
              </a>
            </div>

            <!-- Expiry Notice -->
            <div style="background:#fff8e1;border-left:4px solid #ffc107;padding:12px 16px;border-radius:4px;margin:0 0 24px;">
              <p style="color:#856404;font-size:13px;margin:0;line-height:1.5;">
                ⏰ This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, please ignore this email.
              </p>
            </div>

            <!-- Fallback Link -->
            <p style="color:#999;font-size:12px;line-height:1.5;margin:0;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetLink}" style="color:#6c63ff;word-break:break-all;">${resetLink}</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#f8f9fa;padding:20px 30px;text-align:center;border-top:1px solid #eee;">
            <p style="color:#aaa;font-size:12px;margin:0;">
              &copy; ${new Date().getFullYear()} AI Food Ordering System. All rights reserved.
            </p>
          </div>

        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${toEmail} (Message ID: ${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send email to ${toEmail}:`, err.message);
    return false;
  }
}

module.exports = { sendPasswordResetEmail };
