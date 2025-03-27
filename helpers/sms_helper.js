import { get } from 'axios';
import { query } from "../config/db";

const sendSms = async (mobileNumber, type) => {
    const otp = Math.floor(100000 + Math.random() * 900000);
    let message = '';

    switch (type) {
        case 'signup':
            message = `Your OTP for registration is ${otp}. Use this password to verify your mobile number. - Smarkerz`;
            break;
        case 'login':
            message = `Your OTP for login is ${otp}. Do not share it with anyone. - Smarkerz`;
            break;
        case 'resetpassword':
            message = `Your OTP to reset password is ${otp}. Do not share it with anyone. - Smarkerz`;
            break;
        default:
            throw new Error("Invalid type provided");
    }

    const senderId = process.env.SMS_SENDER_ID;
    const apiKey = process.env.SMS_API_KEY;
    const clientId = process.env.SMS_CLIENT_ID;

    const url = "http://65.2.162.85//api/v2/SendSMS";

    const params = {
        ApiKey: apiKey,
        ClientId: clientId,
        SenderId: senderId,
        Message: message,
        MobileNumbers: '91' + mobileNumber,
        Is_Unicode: false,
        Is_Flash: false,
    };

    try {
        const response = await get(url, { params: params });

        if (response.data) {

            //console.log(response);            

            // Inactive all previous OTPs
            await query(`UPDATE otps SET status = '0' WHERE contact = '${mobileNumber}'`);

            // Save OTP to the database
            await query(`INSERT INTO otps(contact, otp, status) VALUES ('${mobileNumber}', '${otp}', '1')`);

            return {
                status: true,
                message: otp,
            };
        } else {
            return {
                status: false,
                message: "Failed to send OTP",
            };
        }
    } catch (error) {
        console.error('Caught exception:', error.message);
        return {
            status: false,
            message: error.message
        };
    }
};

export default sendSms;