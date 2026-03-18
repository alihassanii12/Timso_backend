import nodemailer from 'nodemailer';

/* ─────────────────────────────────────────────
   Transporter — with validation
───────────────────────────────────────────── */
// Validate required env vars
const requiredEnvVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP connection failed:', error.message);
    console.log('📧 Email will not work until SMTP is configured correctly');
  } else {
    console.log('✅ SMTP server is ready to send emails');
  }
});

// Rest of your code remains the same...
/* ─────────────────────────────────────────────
   Shared HTML builder — dono emails ka template
───────────────────────────────────────────── */
const buildOtpHtml = ({ title, greeting, bodyText, otp, expiryText, footerNote }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8f7f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7f4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="max-width:480px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.07);">

          <!-- Header -->
          <tr>
            <td style="background:#0f0e0c;padding:26px 36px;">
              <span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">
                timso<span style="display:inline-block;width:8px;height:8px;border-radius:50%;border:2px solid #f97316;margin-left:3px;vertical-align:middle;"></span>
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 0;">
              <p style="font-size:13px;color:#9e9b94;margin:0 0 8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${title}</p>
              <h1 style="font-size:22px;font-weight:800;color:#0f0e0c;margin:0 0 14px;letter-spacing:-0.5px;">${greeting}</h1>
              <p style="font-size:15px;color:#6b6860;line-height:1.7;margin:0 0 28px;">${bodyText}</p>
            </td>
          </tr>

          <!-- OTP Box -->
          <tr>
            <td style="padding:0 36px 28px;">
              <div style="background:#f8f7f4;border-radius:16px;padding:28px 20px;text-align:center;border:2px dashed rgba(249,115,22,.35);">
                <p style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9e9b94;margin:0 0 14px;">
                  Your one-time code
                </p>
                <div style="font-size:44px;font-weight:900;letter-spacing:14px;color:#0f0e0c;font-family:'Courier New',monospace;padding-left:14px;">
                  ${otp}
                </div>
                <p style="font-size:12px;color:#c8c5be;margin:14px 0 0;">
                  ⏰ ${expiryText}
                </p>
              </div>
            </td>
          </tr>

          <!-- Security tip -->
          <tr>
            <td style="padding:0 36px 28px;">
              <div style="background:#fff8f2;border-left:3px solid #f97316;border-radius:0 8px 8px 0;padding:13px 16px;">
                <p style="font-size:13px;color:#6b6860;margin:0;line-height:1.6;">
                  🔒 <strong>Never share this code</strong> with anyone. Timso will never ask for this code via phone or chat.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f7f4;padding:22px 36px;border-top:1px solid rgba(0,0,0,.06);">
              <p style="font-size:12px;color:#c8c5be;margin:0;line-height:1.7;">${footerNote}</p>
              <p style="font-size:11px;color:#d1cfc9;margin:8px 0 0;">
                &copy; 2025 Timso Inc. &nbsp;·&nbsp;
                <a href="${process.env.FRONTEND_URL}/privacy" style="color:#b0adab;text-decoration:none;">Privacy</a>
                &nbsp;·&nbsp;
                <a href="${process.env.FRONTEND_URL}/terms" style="color:#b0adab;text-decoration:none;">Terms</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/* ─────────────────────────────────────────────
   sendVerificationEmail
   Pehle: token link bhejta tha
   Ab:    6-digit OTP bhejta hai (10 min expiry)

   Usage:
     await sendVerificationEmail(email, otp, name);
───────────────────────────────────────────── */
export const sendVerificationEmail = async (email, otp, name = '') => {
  const displayName = name || email.split('@')[0];

  const mailOptions = {
    from:    `"Timso" <${process.env.EMAIL_FROM}>`,
    to:      email,
    subject: `${otp} — Verify your Timso account`,
    html: buildOtpHtml({
      title:      'Email Verification',
      greeting:   `Hi ${displayName} 👋`,
      bodyText:   'Welcome to Timso! Enter the code below to verify your email address and activate your account.',
      otp,
      expiryText: 'This code expires in <strong style="color:#f97316;">10 minutes</strong>',
      footerNote: "If you didn&rsquo;t create a Timso account, you can safely ignore this email.",
    }),
    text: `Your Timso verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't sign up, ignore this email.`,
  };

  await transporter.sendMail(mailOptions);
};

/* ─────────────────────────────────────────────
   sendPasswordResetEmail
   Pehle: reset link bhejta tha (1 hour expiry)
   Ab:    6-digit OTP bhejta hai (10 min expiry)

   Usage:
     await sendPasswordResetEmail(email, otp, name);
───────────────────────────────────────────── */
export const sendPasswordResetEmail = async (email, otp, name = '') => {
  const displayName = name || email.split('@')[0];

  const mailOptions = {
    from:    `"Timso" <${process.env.EMAIL_FROM}>`,
    to:      email,
    subject: `${otp} — Reset your Timso password`,
    html: buildOtpHtml({
      title:      'Password Reset',
      greeting:   `Hi ${displayName},`,
      bodyText:   'You requested a password reset. Enter the code below on the reset page. If you didn\'t request this, you can safely ignore this email.',
      otp,
      expiryText: 'This code expires in <strong style="color:#f97316;">10 minutes</strong>',
      footerNote: "If you didn&rsquo;t request a password reset, no action is needed. Your password remains unchanged.",
    }),
    text: `Your Timso password reset code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
  };

  await transporter.sendMail(mailOptions);
};