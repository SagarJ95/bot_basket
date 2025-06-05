import dotenv from 'dotenv';
dotenv.config({ path: `${process.cwd()}/.env` });

import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import { body, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import moment from 'moment';
import db from "../../config/db.js";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import Customer from "../../db/models/customers.js";
import adminLog from '../../helpers/admin_log.js';
import customer_address from "../../db/models/customer_address.js";

const BASE_URL = process.env.BASE_URL || 'http://localhost:3848';

/* Customer API Start ------------------------------- */

// GET all customer (datatables)
const getCustomers = catchAsync(async (req, res) => {
    try {
        const { page, search } = req.body

        const query_params = [1, 1];
        const total_query_params = [1,1];

        let pageCountQuery = '';
        let searchQuery = ``;

         if (search) {
            searchQuery = `AND CONCAT(c.first_name, ' ', c.last_name) ILIKE $${query_params.length + 1}`;
            query_params.push(`%${search}%`);
            total_query_params.push(`%${search}%`)
        }

        if (page) {
            let pageCount = (page - 1) * 10;
            pageCountQuery = `LIMIT $${query_params.length + 1} OFFSET $${query_params.length + 2}`
            query_params.push(10, pageCount)
        }

        //get total number of products
        const totalCountQuery = `select c.id,CONCAT(c.first_name,' ',c.last_name) as customer_name,
                    c.phone_no as contact_no,c.whatsapp_no,COUNT(DISTINCT o.id) as total_order,
                    COALESCE(SUM(oi.quantity * oi.price::numeric), 0) AS total_revenue,
                    TO_CHAR(MAX(o.created_at), 'FMDDth FMMonth YYYY') AS last_order_date,
                    c.status as visibilty_status
                    from customers as c
                    LEFT JOIN orders as o ON c.id = o.customer_id AND o.status = $1
                    LEFT JOIN order_items as oi ON o.id = oi.order_id AND o.status = $2
                    where c.deleted_at IS NULL ${searchQuery}
                    GROUP BY c.first_name,c.last_name,c.phone_no,c.whatsapp_no,c.id
                    order By c.id desc
        `;

        const totalCustomer = await db.query(totalCountQuery, total_query_params);

        const query = `select c.id,CONCAT(c.first_name,' ',c.last_name) as customer_name,
        c.phone_no as contact_no,c.whatsapp_no,COUNT(DISTINCT o.id) as total_order,
        COALESCE(SUM(oi.quantity * oi.price::numeric), 0) AS total_revenue,
        TO_CHAR(MAX(o.created_at), 'FMDDth FMMonth YYYY') AS last_order_date,
        c.status as visibilty_status
        from customers as c
        LEFT JOIN orders as o ON c.id = o.customer_id AND o.status = $1
        LEFT JOIN order_items as oi ON o.id = oi.order_id AND o.status = $2
        where c.deleted_at IS NULL ${searchQuery}
        GROUP BY c.first_name,c.last_name,c.phone_no,c.whatsapp_no,c.id
        order By c.id desc ${pageCountQuery}`;

        const result = await db.query(query, query_params)

        return res.status(200).json({
            status: true,
            total: (totalCustomer.rowCount > 0) ? totalCustomer.rowCount : 0,
            message: 'Fetch customer details Successfully',
            data: (result.rowCount > 0) ? result.rows : []
        });
    } catch (error) {
        throw new AppError(error.message, 400);
    }

});

//exportCustomers
const exportCustomers = catchAsync(async (req, res) => {
    try {
        // Query database
        const query = `
            select c.id, CONCAT(c.first_name,' ',c.last_name) as customer_name,
        c.phone_no as contact_no,c.whatsapp_no,COUNT(DISTINCT o.id) as total_order,
        COALESCE(SUM(oi.quantity * oi.price::numeric), 0) AS total_revenue,
        TO_CHAR(MAX(o.created_at), 'FMDDth Month YYYY') AS last_order_date,
        c.status
        from customers as c
        LEFT JOIN orders as o ON c.id = o.customer_id AND o.status = $2
        LEFt JOIN order_items as oi ON o.id = oi.order_id AND o.status = $3
        where c.status = $1
        GROUP BY c.id,c.first_name,c.last_name,c.phone_no,c.whatsapp_no,c.status
        `;

        const result = await db.query(query, [1, 1, 1]);
        let list = result.rows;

        // Create Excel file
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Customers");

        worksheet.columns = [
            { header: "ID", key: "id", width: 10 },
            { header: "Customer Name", key: "customer_name", width: 25 },
            { header: "Phone Number", key: "contact_no", width: 20 },
            { header: "Whatsapp Number", key: "whatsapp_no", width: 20 },
            { header: "Total Order", key: "total_order", width: 25 },
            { header: "Total Revenue", key: "total_revenue", width: 25 },
            { header: "Last Order Date", key: "last_order_date", width: 25 },
            { header: "Status", key: "status", width: 25 }
        ];

        list.forEach((row) => {
            worksheet.addRow({
                id: row.id,
                cust_name: row.customer_name,
                phone_no: row.contact_no,
                whatsapp_no: row.whatsapp_no,
                total_order: row.total_order,
                total_revenue: row.total_revenue,
                last_order_date: row.last_order_date,
                status: row.status == 1 ? "Active" : "Inactive",
            });
        });

        // File name and path
        const fileName = `customer_list.xlsx`;
        const filePath = path.join(process.cwd(), "public/uploads/exports", fileName);

        // Ensure directory exists
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        // Save Excel file
        await workbook.xlsx.writeFile(filePath);

        // Return response
        return res.status(200).json({
            status: true,
            filePath: `${BASE_URL}/uploads/exports/${fileName}`
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
});

//getParticularCustomerInfo
const getParticularCustomerInfo = catchAsync(async (req, res) => {

    await Promise.all([
        body('customer_id').notEmpty().withMessage('Customer Id is required').run(req)
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;
        throw new AppError(error_message, 200, errors);
    }

    try {
        const { customer_id } = req.body;
        const query_params = [customer_id, 1, 1];

        const query = `SELECT
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
                    'address_id', ca.id,
                    'full_name', ca.full_name,
                    'mobile_no', ca.mobile_number,
                    'address', ca.address1,
                    'zipcode', ca.zip_code,
                    'country', ca.country,
                    'state', ca.state,
                    'city', ca.city
                )
            ) FILTER (WHERE ca.id IS NOT NULL AND ca.status = $3),
            '[]'
        ) AS addresses
        FROM customers AS c
        LEFT JOIN customer_addresses AS ca
            ON c.id = ca.customer_id
        WHERE c.id = $1 and c.status = $2
          AND c.deleted_at IS NULL
        GROUP BY c.id`;

        const result = await db.query(query, query_params)

        return res.status(200).json({
            status: true,
            message: 'Fetch customer details Successfully',
            data: (result.rowCount > 0) ? result.rows : []
        });
    } catch (error) {
        throw new AppError(error.message, 400);
    }

});
//Add Customer
const add_customer = catchAsync(async (req, res) => {

    await Promise.all([
        body('first_name').notEmpty().withMessage('first name is required').run(req),
        body('last_name').notEmpty().withMessage('Last Name is required').run(req),
        body('contact_number').notEmpty().withMessage('Contact Number is required').run(req),
        body('whatsapp_number').notEmpty().withMessage('Whatsapp Number is required').run(req),
        body('email').notEmpty().withMessage('Email is required').isEmail().withMessage("Invalid email format").custom(async (value) => {
            // Check if the email already exists in the database
            if (value) {
                const existingEmail = await Customer.findOne({ where: { email: value } });
                if (existingEmail) {
                    //return res.status(200).json({ status: false, message: "Email Id already exists", errors: {} })
                    throw new Error('Email Id already exists');
                }
            }
        }).run(req),
        body('address').notEmpty().withMessage('Address is required').run(req),
        body('password').notEmpty().withMessage('Pasword is required').run(req),
        body('zipcode').notEmpty().withMessage('ZipCode is required').run(req),
        body('country').notEmpty().withMessage('Country is required').run(req),
        body('state').notEmpty().withMessage('state is required').run(req),
        body('city').notEmpty().withMessage('city is required').run(req),
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;
        throw new AppError(error_message, 200, errors);
    }

    try {
        const { first_name, last_name, contact_number, whatsapp_number, email, password,address,zipcode,country,state,city } = req.body;

        const files = req.files || {};

        const hashPassword = await bcrypt.hash(password, 10)

        const createInfo = {
            first_name: first_name,
            last_name: last_name,
            phone_no: contact_number,
            whatsapp_no: whatsapp_number,
            email: email,
            password: hashPassword,
            enable_email_notification: 1,
            status: 1
        };

        const formatPath = (filePath) => {
            return filePath ? filePath.replace(/^public[\\/]/, '/').replace(/\\/g, '/') : null;
        };

        const profile_pic = files.profile && files.profile.length > 0
            ? formatPath(files.profile[0].path)
            : null;

        if (profile_pic) createInfo.profile = profile_pic;
        const customerInfo = await Customer.create(createInfo);

        if (customerInfo.id) {
                const full_name = `${first_name} ${last_name}`
                const Insertquery = `INSERT INTO customer_addresses (customer_id, full_name,mobile_number,address1, zip_code,country,state,city,status,created_by) values ($1, $2, $3,$4,$5,$6,$7,$8,$9,$10)`;
                await db.query(Insertquery, [customerInfo.id, full_name,contact_number,address,zipcode,country,state,city ,1, req.user.id])
        }
        const data = {
            user_id: req.user.id,
            table_id: customerInfo.id,
            table_name: 'customer',
            action: 'insert',
        };

        adminLog(data);

        return res.status(200).json({
            status: true,
            message: (customerInfo) ? "Customer create sucessfully" : "Customer create Unsucessfully",
        });

    } catch (e) {
        return res.status(200).json({
            status: false,
            message: "Failed to data",
            errors: e.message
        });
    }
});

//update customer info
const update_customer_info = catchAsync(async (req, res) => {

    await Promise.all([
        body('customer_id').notEmpty().withMessage('Customer Id is required').run(req),
        body('first_name').notEmpty().withMessage('first name is required').run(req),
        body('last_name').notEmpty().withMessage('Last Name is required').run(req),
        body('contact_number').notEmpty().withMessage('Contact Number is required').run(req),
        body('whatsapp_number').notEmpty().withMessage('Whatsapp Number is required').run(req),
       // body('email').notEmpty().withMessage('Email is required').run(req)
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;
        throw new AppError(error_message, 200, errors);
    }

    try {

        const { first_name, last_name, contact_number, whatsapp_number,customer_id,email,password } = req.body;
        const files = req.files || {};
        let customerProfile;
        let updatePassword;

        // Check if customer exists
        const existing = await db.query(`SELECT * FROM customers WHERE id = $1`, [customer_id]);

        // Get old flag if no new file uploaded
        if (files && files.profile && files.profile.length > 0) {
            const formatPath = (filePath) => {
                    return filePath ? filePath.replace(/^public[\\/]/, '/').replace(/\\/g, '/') : null;
                };

            const profile_pic = files.profile && files.profile.length > 0
                ? formatPath(files.profile[0].path)
                : null;

            customerProfile = profile_pic;
        } else {
            customerProfile = existing.rows[0].profile;
        }

        if(password == ''){
            updatePassword = existing.rows[0].password
        }else{
            const hashPassword = await bcrypt.hash(password, 10)
            updatePassword = hashPassword;
        }

        const updateInfo = {
            first_name: first_name,
            last_name: last_name,
            phone_no: contact_number,
            whatsapp_no: whatsapp_number,
            email:email,
            profile:customerProfile,
            password:updatePassword
        };

        const updateCustomerPassword = await Customer.update(updateInfo, {
            where: {
                id: customer_id
            }
        });

        const data = {
            user_id: req.user.id,
            table_id: customer_id,
            table_name: 'customer',
            action: 'update',
        };

        adminLog(data);

        return res.status(200).json({
            status: true,
            message: (updateCustomerPassword.length > 0) ? "update customer info sucessfully" : "update customer info Unsucessfully",
        });

    } catch (e) {
        return res.status(200).json({
            status: false,
            message: "Failed to data",
            errors: e.message
        });
    }
});

//update customer address
const update_customer_address = catchAsync(async (req, res) => {

    await Promise.all([
        body('customer_id').notEmpty().withMessage('Customer Id is required').run(req),
        body('address_id').notEmpty().withMessage('Address Id is required').run(req),
        body('full_name').notEmpty().withMessage('first name is required').run(req),
        body('mobile_no').notEmpty().withMessage('Mobile Number is required').run(req),
        body('address').notEmpty().withMessage('address is required').run(req),
        body('zipcode').notEmpty().withMessage('zipcode is required').run(req),
        body('country').notEmpty().withMessage('country is required').run(req),
        body('state').notEmpty().withMessage('state is required').run(req),
        body('city').notEmpty().withMessage('City is required').run(req),
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;
        throw new AppError(error_message, 200, errors);
    }

    try {

        const { address_id,full_name, mobile_no, address, zipcode,country,state,city,customer_id } = req.body;


        const getCustomerInfo = await db.query(`
                SELECT *
                FROM customer_addresses
                WHERE id = $1 AND customer_id= $2 and status = $3 AND deleted_at IS NULL
            `, [address_id,customer_id, "1"]);


            if(getCustomerInfo.rowCount == 0){
                return res.status(200).json({
                    status: true,
                    message: "address Not Found"
                });
            }

            const updateInfo = {
                full_name: full_name,
                mobile_number: mobile_no,
                address1: address,
                zip_code: zipcode,
                country:country,
                state:state,
                city:city
            };

            const updateCustomerPassword = await customer_address.update(updateInfo, {
                where: {
                    customer_id: customer_id,
                    id:address_id
                }
            });

            const data = {
                user_id: req.user.id,
                table_id: customer_id,
                table_name: 'customer_address',
                action: 'update',
            };

            adminLog(data);

        return res.status(200).json({
            status: true,
            message: (updateCustomerPassword.length > 0) ? "update customer address info sucessfully" : "update customer address Unsucessfully",
        });

    } catch (e) {
        return res.status(200).json({
            status: false,
            message: "Failed to data",
            errors: e.message
        });
    }
});

//activation and deactivation
const activationStatus = catchAsync(async (req, res) => {

    await Promise.all([
        body('customer_id').notEmpty().withMessage('Customer Id is required').run(req),
        body('status').notEmpty().withMessage('status is required').run(req)
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;
        throw new AppError(error_message, 200, errors);
    }

    try {

        const { customer_id, status } = req.body;
        const custId = customer_id;

        const updateStatus = await db.query(`update customers SET status = $1 , updated_by = $2 Where id = $3`, [status, req.user.id, custId])

        const data = {
            user_id: customer_id,
            table_id: updateStatus.id,
            table_name: 'customers',
            action: 'update activation status',
        };

        adminLog(data);

        return res.status(200).json({
            status: true,
            message: (updateStatus.id) ? "update status successfully" : "update status Unsuccessfully"
        });

    } catch (e) {
        return res.status(200).json({
            status: false,
            message: "Failed to data",
            errors: error.message
        });
    }
});

//delete customer address
const delete_customer_address = catchAsync(async (req, res) => {

    await Promise.all([
        body('customer_id').notEmpty().withMessage('customer Id is required').run(req),
        body('address_id').notEmpty().withMessage('address Id is required').run(req),
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;
        throw new AppError(error_message, 200, errors);
    }

    try {

        const { address_id,customer_id } = req.body;

        const updateStatus = await db.query(`update customer_addresses SET status = $1 , updated_by = $2, deleted_at = NOW() Where customer_id = $3 and id = $4`, [0, req.user.id,customer_id,address_id])
        const updatedId = updateStatus.rows[0]?.id;
        const data = {
            user_id: customer_id,
            table_id: updateStatus.id,
            table_name: 'customers_address',
            action: 'delete customer',
        };

        adminLog(data);

        return res.status(200).json({
            status: true,
            message: (updatedId) ? "delete customer successfully" : "delete customer Unsuccessfully"
        });

    } catch (e) {
        return res.status(200).json({
            status: false,
            message: "Failed to data",
            errors: e.message
        });
    }
});

const addCustomerAddress = catchAsync(async (req, res) => {
  await Promise.all([
    body("customer_id").notEmpty().withMessage("Customer Id is required").run(req),
    body("full_name").notEmpty().withMessage("Full Name is required").run(req),
    body("address").notEmpty().withMessage("Address is required").run(req),
    body("zip_code").notEmpty().withMessage("Zip Code is required").run(req),
    body("country").notEmpty().withMessage("Country is required").run(req),
    body("state").notEmpty().withMessage("State is required").run(req),
    body("city").notEmpty().withMessage("City is required").run(req),
  ]);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  const {
    full_name,
    mobile_number,
    address,
    zip_code,
    country,
    city,
    state,
    customer_id,
  } = req.body;

  try {

      const add_address = await db.query(
        `INSERT INTO customer_addresses
         (customer_id, full_name, mobile_number, address1, zip_code, country, city, state,created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          customer_id,
          full_name,
          mobile_number,
          address,
          zip_code,
          country,
          city,
          state,
          req.user.id
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
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

export {
    getCustomers,
    exportCustomers,
    getParticularCustomerInfo,
    update_customer_info,
    add_customer,
    activationStatus,
    update_customer_address,
    delete_customer_address,
    addCustomerAddress
}
