import dotenv from 'dotenv';
dotenv.config({ path: `${process.cwd()}/.env` });

import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import { body, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import moment from 'moment';
import db from "../../config/db.js";
import ExcelJS  from "exceljs";
import path  from "path";
import fs  from "fs";
import Customer from "../../db/models/customers.js";
import customer_address from "../../db/models/customer_address.js";

const BASE_URL = process.env.BASE_URL || 'http://localhost:3848';

/* Category API Start ------------------------------- */

// GET all categories (datatables)
const getCustomers = catchAsync(async (req, res) => {
    try {
        const query_params = [1,1,1];

        const query = `select c.id,CONCAT(c.first_name,' ',c.last_name) as customer_name,
        c.phone_no as contact_no,c.whatsapp_no,COUNT(DISTINCT o.id) as total_order,
        COALESCE(SUM(oi.quantity * oi.price::numeric), 0) AS total_revenue,
        TO_CHAR(MAX(o.created_at), 'FMDDth Month YYYY') AS last_order_date
        from customers as c
        LEFT JOIN orders as o ON c.id = o.customer_id AND o.status = $2
        LEFt JOIN order_items as oi ON o.id = oi.order_id AND o.status = $3
        where c.status = $1
        GROUP BY c.first_name,c.last_name,c.phone_no,c.whatsapp_no,c.id`;

        const result = await db.query(query,query_params)

        return res.status(200).json({
            status: true,
            message: 'Fetch customer details Successfully',
            data:(result.rowCount > 0) ? result.rows : []
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

        const result = await db.query(query, [1,1,1]);
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
            success: true,
            filePath: `${BASE_URL}/uploads/exports/${fileName}`
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
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
        const {customer_id} = req.body;
        const query_params = [customer_id,1,1];

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
                    'id', ca.id,
                    'address', ca.address
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

        const result = await db.query(query,query_params)

        return res.status(200).json({
            status: true,
            message: 'Fetch customer details Successfully',
            data:(result.rowCount > 0) ? result.rows : []
          });
    } catch (error) {
        throw new AppError(error.message, 400);
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
        let addressInfo;
        if (typeof address == 'string') {
          addressInfo = JSON.parse(address);
        }

        const customer_id = req.user.id;

        const getCustomerInfo = await db.query(`
                SELECT password
                FROM customers
                WHERE id = $1 AND status = $2 AND deleted_at IS NULL
            `, [customer_id, "1"]);

        const hashPassword = (password) ? await bcrypt.hash(password, 10) : getCustomerInfo.rows[0].password;

        if(Array.isArray(addressInfo))
        {
          for (const val of addressInfo) {
            if(val.id == ''){
              const Insertquery = `INSERT INTO customer_addresses (customer_id, address, tag,status,created_by) values ($1, $2, $3,$4,$5)`;
                await db.query(Insertquery, [customer_id, val.address, val.tag,1,customer_id])
            }else{
              const updatequery = `Update customer_addresses SET address = $1, tag = $2 Where customer_id = $3 and id = $4 and status = $5`;
              await db.query(updatequery, [val.address, val.tag,customer_id,val.id,1])
            }
          }
        }

        const updateInfo = {
          first_name:first_name,
          last_name:last_name,
          phone_no:contact_number,
          whatsapp_no:whatsapp_no,
          email:email,
          password:hashPassword,
          enable_email_notification:enable_email_notification
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

      }catch(e){
        return res.status(200).json({
            status: false,
            message: "Failed to data",
            errors: error.message
        });
      }
  });

//Add Customer
const add_customer = catchAsync(async (req, res) => {

    await Promise.all([
        body('customer_id').notEmpty().withMessage('Customer Id is required').run(req),
        body('first_name').notEmpty().withMessage('first name is required').run(req),
        body('last_name').notEmpty().withMessage('Last Name is required').run(req),
        body('contact_number').notEmpty().withMessage('Contact Number is required').run(req),
        body('whatsapp_number').notEmpty().withMessage('Whatsapp Number is required').run(req),
        body('email').notEmpty().withMessage('Email is required').run(req),
        body('password').notEmpty().withMessage('Pasword is required').run(req)
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
        let addressInfo;
        if (typeof address == 'string') {
          addressInfo = JSON.parse(address);
        }

        const hashPassword = await bcrypt.hash(password, 10)

        const createInfo = {
          first_name:first_name,
          last_name:last_name,
          phone_no:contact_number,
          whatsapp_no:whatsapp_no,
          email:email,
          password:hashPassword,
          enable_email_notification:1
          };

          const formatPath = (filePath) => {
            return filePath ? filePath.replace(/^public[\\/]/, '/').replace(/\\/g, '/') : null;
        };

        const profile_pic = files.profile && files.profile.length > 0
            ? formatPath(files.profile[0].path)
            : null;

        if (profile_pic) updateInfo.profile = profile_pic;
        const customerInfo = await Customer.create(createInfo);

          if(Array.isArray(addressInfo))
            {
              for (const val of addressInfo) {
                  const Insertquery = `INSERT INTO customer_addresses (customer_id, address, tag,status,created_by) values ($1, $2, $3,$4,$5)`;
                    await db.query(Insertquery, [customerInfo.id, val.address, val.tag,1,customerInfo.id])
              }
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

      }catch(e){
        return res.status(200).json({
            status: false,
            message: "Failed to data",
            errors: error.message
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

    try{

        const {customer_id,status} = req.body;
        const custId = req.user.id;

            const updateStatus = await db.query(`update customers SET status = $1 and updated_by = $2 Where id = $3`,[status,custId,customer_id])

            const data = {
                user_id: req.user.id,
                table_id: updateStatus.id,
                table_name: 'customers',
                action: 'update activation status',
            };

            adminLog(data);

          return res.status(200).json({
            status: true,
            message: (updateStatus.id) ? "update status successfully" : "update status Unsuccessfully"
          });

      }catch(e){
        return res.status(200).json({
            status: false,
            message: "Failed to data",
            errors: error.message
        });
      }
  });

export {
    getCustomers,
    exportCustomers,
    getParticularCustomerInfo,
    update_customer_info,
    add_customer,
    activationStatus
}
