// Defaults
import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import db from "../../config/db.js";

import sequelize from "../../config/database.js";
import { generateToken } from "../../helpers/jwt_helper.js";
// Models
import Customer from "../../db/models/customers.js";
import customer_log from "../../db/models/customer_otp_logs.js";
import { body, validationResult } from "express-validator";
import { Op, QueryTypes, Sequelize } from "sequelize";
import { compare } from "bcrypt";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import moment from "moment";
import customerOtpLog from "../../db/models/customer_otp_logs.js";
import pkg from "jsonwebtoken";
import { dirname } from "path";
import ejs from 'ejs'
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import path from "path";
import sendMail from '../../helpers/mail_helper.js'
const project_name = process.env.APP_NAME;
const BASE_URL = process.env.BASE_URL || "http://localhost:3848";

// POST Customer login
const SignUp = catchAsync(async (req, res) => {
  // Apply validation rules
  await Promise.all([
    body("first_name")
      .notEmpty()
      .withMessage("First Name is required")
      .run(req),
    body("last_name").notEmpty().withMessage("Last Name is required").run(req),
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Invalid email format")
      .custom(async (value) => {
        // Check if the email already exists in the database
        if (value) {
          const existingEmail = await Customer.findOne({
            where: { email: value },
          });
          // console.log(`existingEmail ${existingEmail.status} `);
          if (existingEmail && existingEmail.status == "1") {
            return res.status(200).json({
              status: false,
              message: "Email Id already exists",
              errors: {},
            });
          }
        }
      })
      .run(req),
    body("phone_no")
      .notEmpty()
      .withMessage("Phone Number is required")
      .isLength({ min: 10, max: 10 })
      .withMessage("Phone number must be exactly 10 digits.")
      .isNumeric()
      .withMessage("Phone number must contain only digits.")
      .run(req),
    body("password").notEmpty().withMessage("Password is required").run(req),
  ]);

  // Handle validation result
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  const { first_name, last_name, phone_no, email, password, confirm_password,phone_country_code } =
    req.body;

  let creation = null;
  try {
    if (password != confirm_password) {
      return res.status(400).json({
        status: false,
        message: "Password and Confirm Password do not match",
      });
    }
    const hashPassword = await bcrypt.hash(password, 10);

    creation = await Customer.create({
      first_name: first_name,
      last_name: last_name,
      phone_no: phone_no,
      email: email.toLowerCase(),
      status: "1",
      password: hashPassword,
      phone_country_code:phone_country_code
    });

    if (creation) {
      const token = generateToken({
        id: creation.id,
      });

      //Log the user's login info
      await sequelize.query(
        `INSERT INTO customer_logs (customer_id, login_time, token, created_at, updated_at) VALUES (:customerId, :loginIn, :token,:created_at,:updated_at)`,
        {
          type: QueryTypes.INSERT,
          replacements: {
            customerId: creation.id,
            loginIn: new Date(),
            token: token,
            created_at: new Date(),
            updated_at: new Date(),
          },
        }
      );

      //send email
      const dataInfo = {
            name: `${first_name} ${last_name}`,
            logo: `${BASE_URL}/media/logos/email_logo.png`,
            image: `${BASE_URL}/media/img/user-account.png`,
            currentYear: new Date().getFullYear(),
        };
        // Render the EJS template
        const htmlContent = await ejs.renderFile(path.join(__dirname,'..','..', 'views/admin/pages/email/registeration_successful.ejs'), dataInfo);

        const mailConfig = {
          from: `"KeepInBasket" <${process.env.MAIL_USERNAME}>`,
          to: email.toLowerCase(),
          subject: "Welcome to KeepInBasket – Registration Successful!",
          html: htmlContent,
        };

        await sendMail(mailConfig);

      return res.status(200).json({
        status: true,
        message: "login successfully",
        data: [
          {
            token: token,
            name: `${first_name} ${last_name}`,
            customer_id: creation ? creation.id : "",
          },
        ],
      });
    } else {
      return res.status(200).json({
        status: false,
        message: "Account Not created successfully",
      });
    }
  } catch (err) {
    // Handle errors
    throw new AppError(err.message, 200, errors);
  }
});

// POST Customer login
const Login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(200).json({
      status: false,
      message: "Please provide email and password",
    });
  } else {
    const result = await Customer.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!result || !(await compare(password, result.password))) {
      return res.status(200).json({
        status: false,
        message: "Invalid Credentials",
      });
    } else {
      if (result.status != 1) {
        return res.status(200).json({
          status: false,
          message: "Customer account is deactivated.",
        });
      }

      const token = generateToken({
        id: result.id,
      });

      //Log the user's login info
      await sequelize.query(
        `INSERT INTO customer_logs (customer_id, login_time, token, created_at, updated_at) VALUES (:customerId, :loginIn, :token,:created_at,:updated_at)`,
        {
          type: QueryTypes.INSERT,
          replacements: {
            customerId: result.id,
            loginIn: new Date(),
            token: token,
            created_at: new Date(),
            updated_at: new Date(),
          },
        }
      );

      return res.status(200).json({
        status: true,
        message: "Logged in successfully",
        data: [
          {
            token: token,
            name: result ? `${result.first_name} ${result.last_name}` : "",
            customer_id: result ? result.id : "",
          },
        ],
      });
    }
  }
});

//set new password
const resetpassword = catchAsync(async (req, res) => {
  await Promise.all([
    body("old_password")
      .notEmpty()
      .withMessage("Old Password is required")
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

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  try {
    const { old_password, new_password, confirm_password } = req.body;
    const userEmail = req.user?.email;

    // console.log(req.user.password);

    if (!userEmail) {
      return res.status(200).json({
        status: false,
        message: "Unauthorized access. Please login again.",
      });
    }

    const customer = await Customer.findOne({
      where: { email: userEmail.toLowerCase() },
    });

    if (!customer) {
      throw new AppError("Customer not found", 200);
    }
    console.log(customer.password);
    const isPasswordCorrect = await bcrypt.compare(
      old_password,
      customer.password
    );

    if (!isPasswordCorrect) {
      return res.status(200).json({
        status: false,
        message: "Old password is incorrect",
      });
    }

    const isPasswordmatch = await bcrypt.compare(
      new_password,
      customer.password
    );
    if (isPasswordmatch) {
      return res.status(200).json({
        status: false,
        message: "New password must be different from the old password",
      });
    }

    if (new_password !== confirm_password) {
      return res.status(200).json({
        status: false,
        message: "New Password and Confirm Password do not match",
      });
    }

    const confirmPassword = await bcrypt.hash(confirm_password, 10);

    await Customer.update(
      { password: confirmPassword },
      { where: { email: customer.email } }
    );

    return res.status(200).json({
      status: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    throw new AppError(error.message, 200);
  }
});

//delete account

const deleteCustomer = catchAsync(async (req, res) => {
  try {
    const softDeleteCustomer = await db.query(
      `UPDATE customers SET status=$1,deleted_at=$2 Where id=$3`,
      [0, new Date(), req.user.id]
    );

    if (softDeleteCustomer.rowCount == 0) {
      return res.status(500).json({
        status: false,
        message: "Something went wrong",
      });
    }
    res.status(200).json({
      status: true,
      message: "Customer deleted successfully!",
    });
  } catch (error) {
    // console.log(`error ${error.message}`)
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

/*********************Forget Password *******************************/

// used for sign_up and forget password api
const resend_otp = catchAsync(async (req, res, next) => {
  await Promise.all([
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Invalid email format")
      .run(req),
    body("status").notEmpty().withMessage("status is required").run(req),
  ]);

  // Handle validation result
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  try {
    const { first_name, last_name, email, status } = req.body;
    let customer_name;

    // 1 means sign up and 2 means forget password( need to check email id exits or not)
    if (status == 2) {
      const existingEmail = await Customer.findOne({
        where: {
          email: email.toLowerCase(),
        },
      });

      if (!existingEmail) {
        throw new AppError("Email doesn't exists", 200);
      }

      //check email in user table and get id of user
      const customerInfo = await Customer.findOne({
        where: {
          email: email.toLowerCase(),
        },
      });
      customer_name = `${customerInfo.first_name}  ${customerInfo.last_name}`;
    } else {
      const existingEmail = await Customer.findOne({
        where: {
          email: email.toLowerCase(),
        },
      });

      if (existingEmail) {
        throw new AppError("Email already exists", 400);
      }
      customer_name = `${first_name ? first_name : "New"}  ${
        last_name ? last_name : "Customer"
      }`;
    }

    const checkOtpResponse = await sendEmail(email, customer_name,status);

    if (!checkOtpResponse.status) {
      return res.status(200).json({
        status: false,
        message: checkOtpResponse.message,
      });
    }

    return res.status(200).json({
      status: true,
      message: checkOtpResponse.message,
    });
  } catch (error) {
    throw new AppError(error.message, 200);
  }
});

//update password (Forget password)
const updatePassword = catchAsync(async (req, res, next) => {
  await Promise.all([
    body("email").notEmpty().withMessage("email is required").run(req),
  ]);

  // Handle validation result
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  try {
    const { email, new_password, confirm_password } = req.body;

    if (new_password != "") {
      const checkCutomerInfo = await Customer.findOne({
        where: {
          email: email.toLowerCase(),
        },
      });

      if (!checkCutomerInfo) {
        throw new AppError("Email doesn't exists", 200);
      }
      let customer_name = `${checkCutomerInfo.first_name}  ${checkCutomerInfo.last_name}`;
    } else if (new_password != "" || confirm_password != "") {
      return res.status(200).json({
        status: false,
        message: "Please Fill all fields",
      });
    }

    //check otp expire and invalid, incorrect functionlity
    // const getOtpexpireStatus = await otpexpire(email.toLowerCase(), otp);

    // if (!getOtpexpireStatus.status) {
    //   return res.status(200).json({
    //     status: false,
    //     message: getOtpexpireStatus.message,
    //   });
    // }

    // //check otp from customer_otp_logs table
    // const checkotpstatus = await db.query(`select * from customer_otp_logs where otp = ${otp} and status = $1 and deleted_at IS NULL`, ["1"])

    // if (checkotpstatus.rowCount <= 0) {
    //   return res.status(200).json({
    //     status: false,
    //     message: "OTP doesn't match",
    //   });
    // }

    //check the new password and confirm password is match or not
    if (new_password !== confirm_password) {
      return res.status(200).json({
        status: false,
        message: "New Password and Confirm Password is not match",
      });
    }

    const hashPassword = await bcrypt.hash(confirm_password, 10);
    const updateInfo = {
      password: hashPassword,
    };

    //update customer password in Customer Table
    const updateCustomerPassword = await Customer.update(updateInfo, {
      where: {
        //email: checkotpstatus.rows[0].email
        email: email.toLowerCase(),
      },
    });

    if (updateCustomerPassword) {
      //update otp status in customer_otp_logs
      //const updateOtpStatus = await db.query(`update customer_otp_logs set status = "0" where id = ${checkotpstatus.rows[0].id} and status =1 and deleted_at IS NUll`);
      //await db.query("DELETE FROM customer_otp_logs WHERE id = $1", [checkotpstatus.rows[0].id]);

      return res.status(200).json({
        status: true,
        message: "Password Update successfully",
        data: [],
      });
    } else {
      return res.status(200).json({
        status: false,
        message: "Password Update Unsuccessfully",
        data: [],
      });
    }
  } catch (error) {
    throw new AppError(error.message, 200);
  }
});

//check otp getting expire
async function otpexpire(email, otp, res) {
  const checkCustomerOtp = await db.query(
    "SELECT * FROM customer_otp_logs WHERE email = $1 ORDER BY created_at DESC LIMIT 1",
    [email]
  );

  if (checkCustomerOtp.rowCount == 0) {
    return { status: false, message: "OTP expired or invalid" };
  }

  const otpRecord = checkCustomerOtp.rows[0];

  // Check expiration
  if (moment().utc().isAfter(moment(otpRecord.expires_at).utc())) {
    return { status: false, message: "OTP has expired" };
  }

  if (otpRecord.otp !== parseInt(otp)) {
    return { status: false, message: "Incorrect OTP" };
  }

  return { status: true, message: "", data: otpRecord.id };
}

//send email
async function sendEmail(email, customer_name,status) {
  //generate random otp
  const otpCode = Math.floor(Math.random() * 900000) + 100000;

  //Send Email
  const currentYear = new Date().getFullYear();
  // const transport = nodemailer.createTransport({
  //   service: "gmail",
  //   secure: false,
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

   let subject;
   let title;
  if(status == 1){
    subject = `Email Authetication`
    title = `Email Verification`
  }else{
    subject = `Password Reset Request`;
    title = `Reset your password`
  }

   const variables = {
        customer_name: (customer_name) ? customer_name :'',
        otpCode: otpCode,
        currentYear: currentYear,
        logo: `${BASE_URL}/media/logos/email_logo.png`,
        imgae: `${BASE_URL}/media/img/user-reset-password.png`
    };
    // Render the EJS template
    const htmlContent = await ejs.renderFile(path.join(__dirname,'..','..', 'views/admin/pages/email/otp_login.ejs'), variables);

    const mailconfig = {
      from: `"KeepInBasket" <${process.env.MAIL_USERNAME}>`,
      to: email.toLowerCase(),
      subject: subject,
      html: htmlContent,
    };

  try {
    transport.sendMail(mailconfig, async function (err, info) {
      console.log("err>>",err)
      if (err) {
        return { status: false, message: "Email sent Unsuccessfully" };
      } else {
        const expiresAt = moment()
          .add(1, "minutes")
          .format("YYYY-MM-DD HH:mm:ss");

        //store otp in  customer_otp_log
        const StoreOtpCode = await customerOtpLog.create({
          otp: otpCode,
          email: email.toLowerCase(),
          expires_at: expiresAt,
          status: 1,
        });
      }
    });

    return { status: true, message: "Email sent successfully" };
  } catch (e) {
    return { status: false, message: "Email sent Unsuccessfully" };
  }
}

//verify otp
const verifyOtp = catchAsync(async (req, res) => {
  // Apply validation rules
  await Promise.all([
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Invalid email format")
      .run(req),
    body("otp").notEmpty().withMessage("OTP is required").run(req),
  ]);

  // Handle validation result
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  const { otp, email } = req.body;

  try {
    //check otp expire and invalid, incorrect functionlity
    const getOtpexpireStatus = await otpexpire(email.toLowerCase(), otp);

    if (!getOtpexpireStatus.status) {
      return res.status(200).json({
        status: false,
        message: getOtpexpireStatus.message,
      });
    }

    const checkotpstatus = await db.query(
      `select * from customer_otp_logs where otp = ${otp} and status = $1 and deleted_at IS NULL`,
      ["1"]
    );

    if (checkotpstatus.rowCount <= 0) {
      return res.status(200).json({
        status: false,
        message: "OTP doesn't match",
      });
    }

    // OTP is valid, delete it after verification
    await db.query("DELETE FROM customer_otp_logs WHERE id = $1", [
      getOtpexpireStatus.id,
    ]);

    return res.status(200).json({
      status: true,
      message: "OTP verified successfully",
    });
  } catch (err) {
    // Handle errors
    throw new AppError(err.message, 200, errors);
  }
});
/******************* End Forget password************************ */

export {
  SignUp,
  Login,
  resend_otp,
  updatePassword,
  resetpassword,
  verifyOtp,
  deleteCustomer,
};
