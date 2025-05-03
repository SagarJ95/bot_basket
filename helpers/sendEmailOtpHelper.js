import nodemailer from "nodemailer";
import moment from "moment";
import customerOtpLog from "../db/models/customer_otp_logs.js";

export async function sendOrderOTP(req, email, customer_name) {
  const otpCode = Math.floor(Math.random() * 900000) + 100000;
  const currentYear = new Date().getFullYear();

  const emailData = {
    email,
    customer_name,
    otpCode,
    currentYear,
  };

  const emailBodyHtml = await new Promise((resolve, reject) => {
    req.app.render("admin/pages/email/emai_otp", emailData, (err, html) => {
      if (err) return reject(err);
      resolve(html);
    });
  });

  const transport = nodemailer.createTransport({
    service: "gmail",
    secure: false,
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  const mailconfig = {
    from: `${process.env.MAIL_USERNAME}`,
    to: email.toLowerCase(),
    subject: "Email Authentication",
    html: emailBodyHtml,
  };

  try {
    // Use await instead of callback
    await transport.sendMail(mailconfig);

    const expiresAt = moment().add(1, "minutes").format("YYYY-MM-DD HH:mm:ss");

    const StoreOtpCode = await customerOtpLog.create({
      otp: otpCode,
      email: email.toLowerCase(),
      expires_at: expiresAt,
      status: 1,
    });

    return { status: true, message: "Email sent successfully" };
  } catch (e) {
    console.error("SendMail/DB Error:", e);
    return { status: false, message: "Email sent unsuccessfully" };
  }
}
