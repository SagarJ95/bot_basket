import { createTransport } from 'nodemailer';

const sendMail = async (mailConfig) => {
    var transporter = createTransport({
        service: 'gmail',
        auth: {
            user: process.env.MAIL_USERNAME,
            pass: process.env.MAIL_PASSWORD,
            port: process.env.MAIL_PORT,
        }
    });

    var mailOptions = {
        from: process.env.MAIL_FROM_NAME || process.env.MAIL_USERNAME,
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