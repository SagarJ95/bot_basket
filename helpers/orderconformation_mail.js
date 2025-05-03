import nodemailer from "nodemailer";
// import puppeteer from "puppeteer";
import fs from "fs";
import moment from "moment";
import path from "path";
import puppeteer from "puppeteer-core";


export async function sendOrderConfirmation(
  req,
  email,
  customer_name,
  delivery_address,
  products = [],
  order_id
) {
  const totalPrice = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const orderId = `BOT${order_id}`;
  const orderDate = moment().format("YYYY-MM-DD HH:mm");
  const pdfPath = `./order_${Date.now()}.pdf`;

  // Prepare data for the EjS template
  const emailData = {
    orderId,
    orderDate,
    customer_name,
    delivery_address,
    products,
    totalPrice,
  };

  // Render separate EJS templates for email body and PDF
  const emailBodyHtml = await new Promise((resolve, reject) => {
    req.app.render(
      "admin/pages/email/order_summary_email",
      emailData,
      (err, html) => {
        if (err) return reject(err);
        resolve(html);
      }
    );
  });

  const pdfHtml = await new Promise((resolve, reject) => {
    req.app.render(
      "admin/pages/email/order_invoice_pdf",
      emailData,
      (err, html) => {
        if (err) return reject(err);
        resolve(html);
      }
    );
  });

  // Generate PDF from the detailed invoice template
  const browser = await puppeteer.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", // Adjust if needed
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(pdfHtml, { waitUntil: "domcontentloaded" });
  await page.pdf({ path: pdfPath, format: "A4", printBackground: true });
  await browser.close();

  // Configure mail transporter
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  // Send mail using the simpler email body template
  const mailOptions = {
    from: `"BotBasket" <${process.env.MAIL_USERNAME}>`,
    to: email.toLowerCase(),
    subject: "🛒 Your BotBasket Order Confirmation",
    html: emailBodyHtml,
    attachments: [
      {
        filename: "order-confirmation.pdf",
        path: pdfPath,
        contentType: "application/pdf",
      },
    ],
  };

  try {
    await transport.sendMail(mailOptions);
    fs.unlinkSync(pdfPath); // Delete temporary PDF file
    return { status: true, message: "Order confirmation email sent!" };
  } catch (err) {
    console.error("Email sending error:", err);
    return { status: false, message: "Failed to send email" };
  }
}
