
// Defaults
import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import db from "../../config/db.js";
import Customer from "../../db/models/customers.js";
import customer_address from "../../db/models/customer_address.js";
import bcrypt from "bcrypt";
import { body, validationResult } from "express-validator";
import axios from "axios";
const project_name = process.env.APP_NAME;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3848';

  /*******************  Profile Info ************************ */

const fetch_profile = catchAsync(async (req, res) => {
    try{
      const customer_id = req.user.id;

      const getCustomerInfo = await db.query(`
        SELECT
            c.id,
            c.first_name,
            c.last_name,
            c.phone_no,
            c.whatsapp_no,
            c.email,
            CASE
                WHEN c.profile IS NULL OR c.profile = '' THEN ''
                ELSE CONCAT('${BASE_URL}', c.profile)
            END AS profile_pic,
            COALESCE(
            json_agg(
                json_build_object(
                    'id', ca.id,
                    'full_name',ca.full_name,
                    'mobile_number',ca.mobile_number,
                    'zip_code',ca.zip_code,
                    'country',ca.country,
                    'city',ca.city,
                    'state',ca.state,
                    'address_1', ca.address1,
                    'address_2', ca.address2


                )
            ) FILTER (WHERE ca.id IS NOT NULL AND ca.status = $3),
            '[]'
        ) AS addresses
        FROM customers AS c
        LEFT JOIN customer_addresses AS ca
            ON c.id = ca.customer_id
        WHERE c.id = $1
          AND c.status = $2
          AND c.deleted_at IS NULL
        GROUP BY c.id
    `, [customer_id, "1", 1]);

    return res.status(200).json({
      status: true,
      message: "fetch customer info sucessfully",
      data: getCustomerInfo.rowCount > 0 ? getCustomerInfo.rows : [],
    });
  } catch (e) {
    return res.status(200).json({
      status: false,
      message: "Failed to retrieve data",
      errors: error.message,
    });
  }
});

const update_customer_profile = catchAsync(async (req, res) => {
  await Promise.all([
        body('customer_id').notEmpty().withMessage('Customer Id is required').run(req),
        body('first_name').notEmpty().withMessage('first name is required').run(req),
        body('last_name').notEmpty().withMessage('Last Name is required').run(req),
        body('contact_number').notEmpty().withMessage('Contact Number is required').run(req),
        body('whatsapp_number').notEmpty().withMessage('Whatsapp Number is required').run(req),
        body('email').notEmpty().withMessage('Email is required').run(req)
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;
        throw new AppError(error_message, 200, errors);
    }

    try{

        const {first_name,last_name,contact_number,whatsapp_no,email,password,enable_email_notification,address} = req.body;
        const files = req.files || {};
        //let addressInfo;
        //if (typeof address == 'string') {
        //  addressInfo = JSON.parse(address);
        //}

        const customer_id = req.user.id;

        const getCustomerInfo = await db.query(`
                SELECT password
                FROM customers
                WHERE id = $1 AND status = $2 AND deleted_at IS NULL
            `, [customer_id, "1"]);

        const hashPassword = (password) ? await bcrypt.hash(password, 10) : getCustomerInfo.rows[0].password;

    // if (Array.isArray(addressInfo)) {
    //   for (const val of addressInfo) {
    //     if (val.id == "") {
    //       const Insertquery = `INSERT INTO customer_addresses (customer_id, address, tag,status,created_by) values ($1, $2, $3,$4,$5)`;
    //       await db.query(Insertquery, [
    //         customer_id,
    //         val.address,
    //         val.tag,
    //         1,
    //         customer_id,
    //       ]);
    //     } else {
    //       const updatequery = `Update customer_addresses SET address = $1, tag = $2 Where customer_id = $3 and id = $4 and status = $5`;
    //       await db.query(updatequery, [
    //         val.address,
    //         val.tag,
    //         customer_id,
    //         val.id,
    //         1,
    //       ]);
    //     }
    //   }
    // }

    const updateInfo = {
      first_name: first_name,
      last_name: last_name,
      phone_no: contact_number,
      whatsapp_no: whatsapp_number,
      email: email,
      password: hashPassword,
      enable_email_notification: enable_email_notification,
    };


          const formatPath = (filePath) => {
            return filePath ? filePath.replace(/^public[\\/]/, '/').replace(/\\/g, '/') : null;
        };

        const profile_pic = files.profile && files.profile.length > 0
            ? formatPath(files.profile[0].path)
            : null;

        if (profile_pic) updateInfo.profile = profile_pic;
        const updateCustomerPassword = await Customer.update(updateInfo,{
            where:{
              id:customer_id
              }
          });

          return res.status(200).json({
            status: true,
            message: (updateCustomerPassword.length > 0) ? "update customer info sucessfully" : "update customer info Unsucessfully",
          });

      }catch(e){
        return res.status(200).json({
            status: false,
            message: "Failed to data",
            errors: error.message
        });
      }
  });

const getAddressList = catchAsync(async (req, res) => {
    try{
      const customer_id = req.user.id;

    const result = await db.query(
      `SELECT id, full_name, mobile_number, address1, address2, zip_code, country, city, state
       FROM customer_addresses
       WHERE customer_id = $1`,
      [customer_id]
    );

    res.status(200).json({
      status: true,
      message: "Address list fetched successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching address list:", error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

const addAddress = catchAsync(async (req, res) => {
  await Promise.all([
    body("address1").notEmpty().withMessage("Address is required").run(req),
  ]);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  const {
    id,
    full_name,
    mobile_number,
    address1,
    address2,
    zip_code,
    country,
    city,
    state,
  } = req.body;

  const customer_id = req.user.id;

  try {
    if (id && id != 0) {
      const existing = await db.query(
        `SELECT id FROM customer_addresses WHERE id = $1 AND customer_id = $2`,
        [id, customer_id]
      );

      if (existing.rowCount === 0) {
        return res.status(404).json({
          status: false,
          message: "Address not found or unauthorized",
        });
      }

      const update_address = await db.query(
        `UPDATE customer_addresses
         SET customer_id=$1, full_name=$2, mobile_number=$3, address1=$4,
             address2=$5, zip_code=$6, country=$7, city=$8, state=$9
         WHERE id=$10`,
        [
          customer_id,
          full_name,
          mobile_number,
          address1,
          address2,
          zip_code,
          country,
          city,
          state,
          id,
        ]
      );

      res.status(200).json({
        status: true,
        message: "Address updated successfully!",
      });
    } else {
      console.log("insert address");

      const add_address = await db.query(
        `INSERT INTO customer_addresses
         (customer_id, full_name, mobile_number, address1, address2, zip_code, country, city, state)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          customer_id,
          full_name,
          mobile_number,
          address1,
          address2,
          zip_code,
          country,
          city,
          state,
        ]
      );

      if (add_address.rowCount > 0) {
        res.status(200).json({
          status: true,
          message: "Address added successfully!",
        });
      } else {
        res.status(400).json({
          status: false,
          message: "Something went wrong",
        });
      }
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

const deleteAddress = catchAsync(async (req, res) => {
  const { id } = req.body;

  if (!id) {
    throw new AppError("Address ID is required", 400);
  }

  try {
    const result = await db.query(
      `DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2`,
      [id, req.user.id]
    );

    if (result.rowCount > 0) {
      res.status(200).json({
        status: true,
        message: "Address deleted successfully!",
      });
    } else {
      res.status(404).json({
        status: false,
        message: "Address not found or unauthorized",
      });
    }
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

const getLocationByZip = catchAsync(async (req, res) => {
  const { country_code, zip_code } = req.body;

  if (!country_code || !zip_code) {
    return res.status(400).json({
      status: false,
      message: "Country code and ZIP code are required",
    });
  }

  try {
    const apiUrl = `https://api.zippopotam.us/${country_code}/${zip_code}`;

    const response = await axios.get(apiUrl);

    const place = response.data.places[0];

    res.status(200).json({
      status: true,
      message: "Location found",
      data: {
        country: response.data.country,
        state: place["state"],
        city: place["place name"],
        zip_code: response.data["post code"],
      },
      place: place,
    });
  } catch (error) {
    console.error("ZIP API error:", error.response?.data || error.message);
    res.status(404).json({
      status: false,
      message: "Location not found for this ZIP code",
    });
  }
});

/******************* End  Profile Info ************************ */

export {
  fetch_profile,
  update_customer_profile,
  getAddressList,
  addAddress,
  deleteAddress,
  getLocationByZip,
};
