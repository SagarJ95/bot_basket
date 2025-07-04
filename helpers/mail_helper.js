import nodemailer from 'nodemailer';

const sendMail = async (mailConfig) => {
    const transporter = nodemailer.createTransport({
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

        var mailOptions = {
            from: mailConfig.from,
            to: mailConfig.to,
            subject: mailConfig.subject || 'Sending Email using Node.js',
            html: mailConfig.html || '<p>this is a test mail</p>',
            attachments: mailConfig.attachments || []
        };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            return {
                status: false,
                message: "Mail Not Sent",
            };
        } else {
            return {
                status: true,
                message: "Mail Sent " + info.response,
            };
        }
    });
}

export default sendMail;