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
  payment_mode,
  payment_status,
  delivery_address,
  products,
  order_id,
  status,
  cancel_reason,
  download_invoice
) {
 // const totalPrice = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const orderId = `BOT${order_id}`;
  const orderDate = moment().format("YYYY-MM-DD HH:mm");
  const pdfPath = `./public/uploads/order_pdf/order_${Date.now()}.pdf`;
    const statusMessages = {
      2: {
        title: 'Thanks for your purchase! Your order has been confirmed and is being prepared.',
        statusText: 'Confirmed'
      },
      3: {
        title: 'Good news! Your order is on its way.',
        statusText: 'Shipped'
      },
      4: {
        title: 'Your order has been delivered successfully. We hope you enjoy it!',
        statusText: 'Delivered'
      },
      default: {
        title: 'We’re sorry! Your order has been cancelled. For more info, contact support.',
        statusText: 'Cancelled'
      }
    };

    const { title, statusText } = statusMessages[status] || statusMessages.default;

    let titleEmail = title;
    let orderStatus = statusText;

    const emailData = {
      orderId,
      orderDate,
      customer_name,
      payment_mode,
      payment_status,
      delivery_address,
      products,
      order_id,
      status,
      titleEmail,
      cancel_reason,
      //download_invoice
    };
console.log("emailData>>",emailData)

  // // Render separate EJS templates for email body and PDF
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

  // const pdfHtml = await new Promise((resolve, reject) => {
  //   req.app.render(
  //     "admin/pages/email/order_invoice_pdf",
  //     emailData,
  //     (err, html) => {
  //       if (err) return reject(err);
  //       resolve(html);
  //     }
  //   );
  // });

  // // Generate PDF from the detailed invoice template
  // const browser = await puppeteer.launch({
  //   executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  //   headless: true,
  //     args: [
  //       "--no-sandbox",
  //       "--disable-setuid-sandbox",
  //       "--enable-logging", // Enable detailed logs
  //     ],
  // });

  // const page = await browser.newPage();
  // await page.setContent(pdfHtml, { waitUntil: "domcontentloaded" });
  // await page.pdf({ path: pdfPath, format: "A4", printBackground: true });
  // await browser.close();

  // // Configure mail transporter
  // const transport = nodemailer.createTransport({
  //   service: "gmail",
  //   auth: {
  //     user: process.env.MAIL_USERNAME,
  //     pass: process.env.MAIL_PASSWORD,
  //   },
  // });
const transport = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT, // Use port 587 for STARTTLS
    secure: false, // Set to false since STARTTLS is being used
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
    tls: {
      // This is optional but can help avoid some TLS-related issues.
      rejectUnauthorized: false,
    },
  });

  // // Send mail using the simpler email body template
  // const mailOptions = {
  //   from: `"BotBasket" <${process.env.MAIL_USERNAME}>`,
  //   to: 'sjagade84@gmail.com',
  //   subject: `🛒 Your BotBasket Order ${orderStatus}`,
  //   html: emailBodyHtml,
  //   attachments: [
  //     {
  //       filename: `order-${statusText}.${fileExt}`,
  //       path: download_invoice,
  //       contentType: content_Type,
  //     },
  //   ],
  // };

  const mailOptions = {
      from: `"KeepInBasket" <${process.env.MAIL_USERNAME}>`,
      to: email.toLowerCase(),
      subject: `🛒 Your KeepInBasket Order ${orderStatus}`,
      html: emailBodyHtml,
      attachments: [],
    };

    // Check if download_invoice is provided
    if (download_invoice && download_invoice.trim() !== "") {
      const fileUrl = download_invoice;

      const fileName = path.basename(fileUrl);
      const fileExt = fileName.split('.').pop().toLowerCase();

      // Map file extension to MIME type
      const mimeTypes = {
        pdf: "application/pdf",
        css: "text/css",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        txt: "text/plain",
        html: "text/html",
      };

      const contentType = mimeTypes[fileExt] || "application/octet-stream";

      mailOptions.attachments.push({
        filename: `order-${statusText}.${fileExt}`,
        path: download_invoice,
        contentType: contentType,
      });
    }

  try {
    await transport.sendMail(mailOptions);
    //fs.unlinkSync(pdfPath); // Delete temporary PDF file
    return { status: true, message: "Order confirmation email sent!" };
  } catch (err) {
    console.error("Email sending error:", err);
    return { status: false, message: "Failed to send email" };
  }
}
