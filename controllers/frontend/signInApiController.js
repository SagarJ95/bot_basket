// Defaults
import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import db from "../../config/db.js";

import sequelize from "../../config/database.js";
import { generateToken } from "../../helpers/jwt_helper.js";
// Models
// import Customer from "../../db/models/customer.js";
// import customer_log from "../../db/models/customer_logs.js"
import { body, validationResult } from "express-validator";
import { Op, QueryTypes,Sequelize } from "sequelize";
import { compare } from "bcrypt";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import os from "os";
import customerOtpLog from '../../db/models/customer_otp_log.js'
import pkg from 'jsonwebtoken';


const project_name = process.env.APP_NAME;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3847';

const getServerIP = () => {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
      for (const iface of interfaces[interfaceName]) {
          if (!iface.internal && iface.family === 'IPv4') {
              return iface.address;
          }
      }
  }
  return req.headers["x-forwarded-for"] || req.connection.remoteAddress;
};

// POST Customer login
const SignUp = catchAsync(async (req, res) => {

    // Apply validation rules
  await Promise.all([
        body('first_name').notEmpty().withMessage('First Name is required').run(req),
        body('last_name').notEmpty().withMessage('Last Name is required').run(req),
        body('email').notEmpty().withMessage('Email is required').isEmail().withMessage("Invalid email format").custom(async (value) => {
            // Check if the email already exists in the database
            if(value){
            const existingEmail = await Customer.findOne({ where: { email: value } });
            if (existingEmail) {
                //throw new AppError('Email Id already exists',200);
                return res.status(200).json({status:false,message:"Email Id already exists",errors:{}})
            }
          }
        }).run(req),
        body('phone_no').notEmpty().withMessage('Phone Number is required').isLength({ min: 10, max: 10 }).withMessage('Phone number must be exactly 10 digits.')
        .isNumeric().withMessage('Phone number must contain only digits.').run(req),
        body('password').notEmpty().withMessage('Password is required').run(req),
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;
        throw new AppError(error_message, 200, errors);
    }

    const { first_name, last_name, phone_no , email, password,category_id,browser_Name,device_Type } = req.body;

    let creation = null;
      try {
        const hashPassword = await bcrypt.hash(password, 10);

        creation = await Customer.create({
          first_name: first_name,
          last_name: last_name,
          phone_no: phone_no,
          email: email.toLowerCase(),
          status: "1",
          password: hashPassword
        });


        if (creation) {
          const token = generateToken({
            id: creation.id,
          });
          // Store JWT token in session
          req.session.token = token;
          req.session.user_id = creation.id;

          return res.status(200).json({
            status: true,
            message: "User created successfully",
            data: [
              {
                token: token,
                name: `${first_name} ${last_name}`,
                customer_id: (creation) ? creation.id : '',
              }
            ],
            planInfo:[planInfo]
          });
        } else {
          return res.status(200).json({
            status: false,
            message: "User Not created successfully",
            data: [],
            planInfo:[]
          });
        }
      } catch (err) {
        // Handle errors
        throw new AppError(err.message, 200, errors);
      }
});

// POST Customer login
const Login = catchAsync(async (req, res) => {
    const { email, password,browser_Name,device_Type } = req.body;

    if (!email || !password) {
      //throw AppError("Please provide email and password", 200);
      return res.status(200).json({
        status: false,
        message: "Please provide email and password",
        token: [],
        planInfo:[]
      });
    } else {
      const result = await Customer.findOne({ where: { email: email.toLowerCase() } });

      //res.json(result);

      if (!result || !(await compare(password, result.password))) {
        //throw new AppError("Invalid Credentials", 200);
        return res.status(200).json({
          status: false,
          message: "Invalid Credentials",
          token: [],
          planInfo:[]
        });
      } else {
        if (result.status != 1) {
          //throw new AppError("Sorry, Customer is Inactivated", 200);
          return res.status(200).json({
            status: false,
            message: "Sorry, Customer is Inactivated",
            token: [],
            planInfo:[]
          });
        }

        const token = generateToken({
          id: result.id
        });

        // Store JWT token in session
        req.session.token = token;
        req.session.user_id =  result.id;

        // Get customer's IP address
        // const ipAddress =
        //     req.headers["x-forwarded-for"] || req.connection.remoteAddress;

        const ipAddress = getServerIP();

          // Get browser information
           const browserName = (browser_Name) ? browser_Name : '';
           const deviceType = (device_Type) ? device_Type : '';

          //Log the user's login info
          await sequelize.query(
            `INSERT INTO customer_logs (customer_id, login_time, browers,device, ip_address, token, created_at, updated_at) VALUES (:customerId, :loginIn, :browser,:device, :ipAddress, :token,:created_at,:updated_at)`,
            {
              type: QueryTypes.INSERT,
              replacements: {
                customerId: result.id,
                loginIn: new Date(),
                browser: browserName,
                device:deviceType,
                ipAddress: ipAddress,
                token:token,
                created_at:new Date(),
                updated_at:new Date()
              },
            }
          );

         //get plan info
         const planInfo = {
          plan_Name: 'Basic',
          plan_expire_date:'',
          status : 1 // 0 - default , 1 - sign in , 2 - subscriber
        }

        return res.status(200).json({
          status: true,
          message: "Logged in successfully",
          data: [
            {
              token: token,
              name: result ? `${result.first_name} ${result.last_name}` : "",
              customer_id: result ? result.id : "",
            }
          ],
          planInfo: [planInfo],
        });

      }
    }
  });

  // GET Customer logout


  /*********************Forget Password *******************************/

  const forgetPassword = catchAsync(async (req, res, next) => {
    await Promise.all([
      body("email")
        .notEmpty()
        .withMessage("Email is required")
        .isEmail().withMessage("Invalid email format")
        .custom(async (value) => {
          // Check if the email is not  exists in the database
          const existingEmail = await Customer.findOne({
            where: {
              email: value.toLowerCase(),
            },
          });

          if (!existingEmail) {
            throw new AppError("Email doesn't exists",200);
          }
        })
        .run(req),
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error_message = errors.array()[0].msg;
      throw new AppError(error_message, 200, errors);
    }

    try {

      const {email} = req.body;

      //check email in user table and get id of user
      const customerInfo = await Customer.findOne({
        where: {
          email: email.toLowerCase()
          }
        });

        const customer_name = `${customerInfo.first_name}  ${customerInfo.last_name}`;

        //generate random otp
        const otpCode = Math.floor(Math.random() * 900000) + 100000;

        //Send Email
        const currentYear = new Date().getFullYear();
        const transport = nodemailer.createTransport({
            service: "gmail",
            secure: false,
            auth: {
              user: process.env.MAIL_USERNAME,
              pass: process.env.MAIL_PASSWORD,
            },
          });
          // const transport = nodemailer.createTransport({
          //   host: process.env.MAIL_HOST,
          //   port: process.env.MAIL_PORT, // Use port 587 for STARTTLS
          //   secure: false, // Set to false since STARTTLS is being used
          //   auth: {
          //     user: process.env.MAIL_USERNAME,
          //     pass: process.env.MAIL_PASSWORD,
          //   },
          //   tls: {
          //     // This is optional but can help avoid some TLS-related issues.
          //     rejectUnauthorized: false,
          //   },
          // });
          const mailconfig = {
            from: `${process.env.MAIL_USERNAME}`,
            to: email.toLowerCase(),
            subject: "Email Authetication",
            html: `<!DOCTYPE html
                        PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
                      <html xmlns="http://www.w3.org/1999/xhtml">

                      <head>
                        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
                        <!--[if !mso]><!-->
                        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
                        <!--<![endif]-->
                        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                        <title>New Enquiry</title>
                        <style type="text/css">
                         .container {
                          max-width: 600px;
                          margin: auto;
                          background: white;
                          padding: 20px;
                          border-radius: 8px;
                          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                      }

                          body {
                            font-family: "Open sans", Arial, sans-serif
                          }

                          .ReadMsgBody {
                            width: 100%;
                            background-color: #fff
                          }

                          .ExternalClass {
                            width: 100%;
                            background-color: #fff
                          }

                          .ExternalClass,
                          .ExternalClass p,
                          .ExternalClass span,
                          .ExternalClass font,
                          .ExternalClass td,
                          .ExternalClass div {
                            line-height: 100%
                          }



                          html {
                            width: 100%
                          }

                           body {
                          font-family: Arial, sans-serif;
                          background-color: #f7f7f7;
                          margin: 0;
                          padding: 20px;
                      }

                          table {
                            border-spacing: 0;
                            table-layout: auto;
                            margin: 0 auto
                          }

                          img {
                            display: block !important;
                            overflow: hidden !important
                          }

                          .yshortcuts a {
                            border-bottom: none !important
                          }

                          img:hover {
                            opacity: .9 !important
                          }

                          .footer-link a {
                            color: #666;
                            text-decoration: none;
                            transition: .5s all
                          }

                          .footer-link a:hover {
                            color: #0895d3;
                            text-decoration: none;
                            transition: .5s all
                          }

                          .textbutton a {
                            font-family: "open sans", arial, sans-serif !important
                          }

                          .btn-link a {
                            color: #ffffff !important
                          }

                          li {
                            margin: 0 !important
                          }

                          .submitted p {
                            font-size: 16px;
                            margin-top: 5px;
                            margin-bottom: 7px;
                            color: #000;
                            line-height: 1.4
                          }

                          /* .submitted p b {
                            display: block;
                          } */

                          .btn {
                            background: #000;
                            padding: 10px;
                            color: #fff;
                            margin-top: 40px;
                            font-size: 15px
                          }

                          .btn:hover {
                            background: #1d1d1d;
                            padding: 10px;
                            color: #fff;
                            margin-top: 40px
                          }

                          .thankyou {
                            font-weight: 900;
                            color: #194693;
                            font-size: 23px;
                            font-family: "Open sans", Arial, sans-serif
                          }

                          .intro {
                            color: #1d1d1d;
                            font-size: 16px
                          }

                          .best-regard {
                            margin-top: 20px !important
                          }

                          .footer-link {
                            color: #666;
                            font-size: 12px;
                            letter-spacing: 1px
                          }

                          .copyright {
                            font-size: 10px;
                            text-align: center;
                            margin: 0
                          }

                          .mt-mb {
                            margin-top: 40px !important;
                            margin-bottom: 20px !important
                          }

                          p.support {
                            font-size: 15px;
                            margin-top: 20px !important
                          }

                          .mb-0 {
                            margin-bottom: 0 !important
                          }

                          @media only screen and (max-width:640px) {
                            body {
                              margin: 0;
                              width: auto !important;
                              font-family: "Open Sans", Arial, Sans-serif !important
                            }

                            .table-inner {
                              width: 90% !important;
                              max-width: 90% !important
                            }

                            .table-full {
                              width: 100% !important;
                              max-width: 100% !important;
                              text-align: left !important
                            }
                          }

                          @media only screen and (max-width:479px) {
                            body {
                              width: auto !important;
                              font-family: "Open Sans", Arial, Sans-serif !important
                            }

                            .table-inner {
                              width: 90% !important;
                              text-align: center !important
                            }

                            .table-full {
                              width: 100% !important;
                              max-width: 100% !important;
                              text-align: left !important
                            }

                            u+.body .full {
                              width: 100% !important;
                              width: 100vw !important
                            }
                          }
                        </style>
                      </head>

                      <body >
                      <div class="container">
                      <table class="full" width="100%" border="0" align="center" cellpadding="0" cellspacing="0" bgcolor="#eceff3">
                          <tr>
                            <td align="center">
                              <table width="580" class="table-inner" style="max-width:580px" align="center" border="0" cellpadding="0"
                                cellspacing="0">
                                <tr>
                                  <td height="100"></td>
                                </tr>
                                <tr>
                                  <td align="center" bgcolor="#fff"
                                    style="border-bottom:5px solid #194693;background-position:top;background-size:cover;background-repeat:no-repeat">
                                    <table width="90%" align="center" border="0" cellpadding="0" cellspacing="0">
                                      <tr>
                                        <td height="5"></td>
                                      </tr>
                                      <tr>
                                        <td align="center" style="line-height:0"><img
                                            src="${BASE_URL}/media/logos/ft_logo.png" style="width:120px;height:90px" alt="Logo"
                                            style="display:block;line-height:0;font-size:0;border:0;width:100px;padding-top:1rem" /></td>

                                      </tr>
                                      <tr>
                                        <td height="10"></td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td height="15" bgcolor="#FFFFFF"></td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        <table class="full" align="center" bgcolor="#eceff3" width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            <td align="center">
                              <table width="580" class="table-inner" style="max-width:580px" align="center" border="0" cellpadding="0"
                                cellspacing="0">
                                <tr>
                                  <td bgcolor="#FFFFFF" align="center">
                                    <table width="500" class="table-inner" align="center" border="0" cellpadding="0" cellspacing="0">
                                      <tr>
                                        <td>
                                          <table align="left" class="table-full" width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                              <td class="intro" align="left"></td>
                                            </tr>
                                            <tr>
                                              <td class="thankyou" align="center">Email Verification </td>
                                            </tr>
                                          </table>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        <table class="full" align="center" bgcolor="#eceff3" width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            <td align="center">
                              <table width="580" class="table-inner" style="max-width:580px;height:0" align="center" border="0"
                                cellpadding="0" cellspacing="0">
                                <tr>
                                  <td bgcolor="#FFFFFF" align="center">
                                    <table width="500" class="table-inner" align="center" border="0" cellpadding="0" cellspacing="0">
                                      <tr>
                                        <td>
                                          <table align="left" class="table-full" width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                              <td class="intro" align="left"></td>
                                            </tr>
                                            <tr>
                                              <td class="submitted ">
                                              <p>Hello ${(customer_name) ? customer_name:''},</p>
                                  <p>We received a request to verify your account. Use the following otp to complete your update Password process:</p>
                                  <p class="otp-code" style="margin-bottom: 20px;"><b>${otpCode}</b></p>
                                  <p>Please do not share this OTP with anyone. </p>
                                  <p style="margin-bottom: 31px;">If you did not request this, please ignore this email or contact support.</p>
                                              </td>
                                            </tr>
                                          </table>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        <table class="full" align="center" bgcolor="#eceff3" width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            <td align="center">
                              <table width="580" class="table-inner" style="max-width:580px" align="center" border="0" cellpadding="0"
                                cellspacing="0">
                                <tr>
                                  <td bgcolor="#FFFFFF" align="center">
                                    <table width="580" class="table-inner" align="center" border="0" cellpadding="0" cellspacing="0">
                                      <tr>
                                        <td align="center" bgcolor="#f2f2f2">
                                          <table width="90%" border="0" align="center" cellpadding="0" cellspacing="0">
                                            <tr>
                                              <td height="5"></td>
                                            </tr>
                                            <tr>
                                              <td height="30" class="footer-link" align="center">
                                                <p class="copyright" style="color:#333"><a href="javascript:void(0)" style="color:#333">
                                                    </a> &copy; ${currentYear}. All Rights.All
                                                  Rights Reserved. Powered by<a target="_blank" href="https://onerooftech.com/"
                                                    style="color:#333"> OneRoof
                                                    Technologies LLP</a></p>
                                              </td>
                                            </tr>
                                            <tr>
                                              <td height="5"></td>
                                            </tr>
                                          </table>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr>
                            <td height="100"></td>
                          </tr>
                        </table>
                        </div>
                      </body>
                      </html>
              `,
          };
          transport.sendMail(mailconfig, async function (err, info) {
            if (err) {
              res.status(200).json({
                status: false,
                message: "Email sent Unsuccessfully",
                data:[]
              });
            } else {

              //store otp in  customer_otp_log
              const StoreOtpCode= await customerOtpLog.create({
                otp: otpCode,
                customer_id: customerInfo.id,
                customer_email: email.toLowerCase(),
                status:1
              });


              res.status(200).json({
                status: true,
                message: "Email sent successfully",
                data:[]
              });
            }
          });
    } catch (error) {
      throw new AppError(error.message, 200);
    }
  });

  const updatePassword = catchAsync(async (req, res, next) => {

    await Promise.all([
      body("otp")
        .notEmpty()
        .withMessage("otp is required")
        .run(req),
        body("new_password")
        .notEmpty()
        .withMessage("New Password is required")
        .run(req),
        body("confirm_password")
        .notEmpty()
        .withMessage("Confirm Password is required")
        .run(req),
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error_message = errors.array()[0].msg;
      throw new AppError(error_message, 200, errors);
    }

    try {

      const { otp, new_password, confirm_password } = req.body;

     // const id = {iv:iv,encryptedData:encryptedData};
     //check otp from customer_otp_logs table
     const checkotpstatus = await db.query(`select * from customer_otp_logs where otp = ${otp} and status = 1 and deleted_at IS NULL`)

     if(checkotpstatus.rowCount <= 0){
      //throw new AppError("OTP doesn't match", 200);
      return res.status(200).json({
        status: false,
        message: "OTP doesn't match",
      });
     }

      //check the new password and confirm password is match or not
      if (new_password !== confirm_password) {
        //throw new AppError("New Password and Confirm Password is not match", 200);
        return res.status(200).json({
          status: false,
          message: "New Password and Confirm Password is not match",
        });
        }

      //decypt id using crypto package
      //const decryptCustomerId = encryptionData("node_decryption", id);
      const hashPassword = await bcrypt.hash(confirm_password, 10);
      const updateInfo = {
        password: hashPassword,
      }

      //update customer password in Customer Table
      const updateCustomerPassword = await Customer.update(updateInfo, {
          where: {
            id:checkotpstatus.rows[0].customer_id
            },
          });

        if(updateCustomerPassword){

          //update otp status in customer_otp_logs
          const updateOtpStatus = await db.query(`update customer_otp_logs set status = 0 where id = ${checkotpstatus.rows[0].id} and status =1 and deleted_at IS NUll`);

          return res
          .status(200)
          .json({ status: true, message: "Password Update successfully",data:[] });
        }else{
          return res
          .status(200)
          .json({ status: false, message: "Password Update Unsuccessfully",data:[]});
        }

    } catch (error) {
      throw new AppError(error.message, 200);
    }
  });
  /******************* End Forget password************************ */

export {
    SignUp,
    Login,
    forgetPassword,
    updatePassword,
}


