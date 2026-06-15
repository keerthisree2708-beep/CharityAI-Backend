const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // Transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Message object
  const message = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    html: options.html || options.message,
  };

  // Send email
  try {
    const info = await transporter.sendMail(message);
    console.log(`[INFO] Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[ERROR] Email failed to send:`, error);
    return false;
  }
};

module.exports = sendEmail;
