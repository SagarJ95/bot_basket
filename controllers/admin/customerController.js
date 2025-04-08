import dotenv from 'dotenv';
dotenv.config({ path: `${process.cwd()}/.env` });

// Defaults
import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import { generateSlug, media_url, formatValidationArray } from "../../helpers/slug_helper.js";
import Category from "../../db/models/category.js";
import Product from "../../db/models/products.js";
import Product_images from "../../db/models/product_images.js";
import Products_price_logs from "../../db/models/products_price_logs.js";

import { body, validationResult } from "express-validator";
import { Op, QueryTypes, Sequelize } from "sequelize";
import { compare } from "bcrypt";
import bcrypt from "bcrypt";
import sequelize from "../../config/database.js";
import moment from 'moment';
import db from "../../config/db.js";
import adminLog from '../../helpers/admin_log.js';

import ExcelJS  from "exceljs";
import path  from "path";
import fs  from "fs";
import Customers from '../../db/models/customers.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3848';

/* Category API Start ------------------------------- */

// GET all categories (datatables)
const getCustomers = catchAsync(async (req, res) => {
    try {
        // if (!req.xhr) {
        //     throw new AppError('Bad Request: Only AJAX requests are allowed', 400);
        // }

        // Extract query parameters
        const draw = req.body.draw;
        const start = parseInt(req.body.start);
        const length = parseInt(req.body.length);
        const order_data = req.body.order;

        let column_name = 'cust.id'; // Default column for sorting
        let column_sort_order = 'ASC'; // Default sorting order

        // Check if order_data exists, then extract sorting info
        if (order_data) {
            const column_index = req.body.order[0].column;
            column_name = req.body.columns[column_index].data;
            column_sort_order = req.body.order[0].dir.toUpperCase();
        }

        var where = {};
        where = {
            deleted_at: null,

        };
        // Fetch total records
        const totalRecords = await Customers.count({
            where: where,
        });

        // Search value handling
        const search_value = req.body.search && req.body.search.value ? req.body.search.value.toLowerCase() : '';
        let search_query = ` WHERE cust.deleted_at IS NULL`;

        // if (req.user && req.user.role != 1) {
        //     search_query += ` AND categories.created_by = ${req.user.id}`;
        // }

        const query_params = [];

        if (search_value) {
            search_query += ` AND (
            LOWER(cust.first_name) LIKE $1 OR
            LOWER(cust.last_name) LIKE $1 OR
            LOWER(cust.email) LIKE $1 OR
            LOWER(cust.whatsapp_no) LIKE $1 OR
            LOWER(cust.phone_no) LIKE $1 OR
            LOWER(u1.name) LIKE $1 OR
            LOWER(u2.name) LIKE $1
            )
            `;
            query_params.push(`%${search_value}%`);
        }

        // Filter data count from the database

        const filter_query = `SELECT cust.first_name, cust.last_name, cust.phone_no, cust.whatsapp_no, cust.email,
         CASE
          WHEN cust.profile IS NULL OR cust.profile = '' THEN ''
              ELSE CONCAT('${BASE_URL}', cust.profile)
        END AS profile_pic,
        u1.name AS created_by_name,
        u2.name AS updated_by_name,cust.created_at,cust.updated_at FROM customers as cust
        LEFT JOIN users u1 ON cust.created_by = u1.id
        LEFT JOIN users u2 ON cust.updated_by = u2.id ${search_query}`;
        const filter_result = await db.query(filter_query, query_params);


        let order_query = ` ORDER BY ${column_name} ${column_sort_order}`;
        let limit_query = ``;

        if (length > 0) {
            limit_query = ` OFFSET $${query_params.length + 1} LIMIT $${query_params.length + 2}`;
            query_params.push(start, length);
        }

        // Fetch total records with filtering
        const totalRecordsWithFilter = filter_result.rows.length;

        // Filter data count from the database
        const query = `SELECT cust.id,cust.first_name, cust.last_name, cust.phone_no, cust.whatsapp_no, cust.email,
         CASE
          WHEN cust.profile IS NULL OR cust.profile = '' THEN ''
              ELSE CONCAT('${BASE_URL}', cust.profile)
        END AS profile_pic,
        u1.name AS created_by_name,
        u2.name AS updated_by_name,
        cust.created_at,cust.updated_at
        FROM customers as cust
        LEFT JOIN users u1 ON cust.created_by = u1.id
        LEFT JOIN users u2 ON cust.updated_by = u2.id
        ${search_query} ${order_query} ${limit_query}`;


        const result = await db.query(query, query_params);

        let customers = result.rows;

        // Map data for response
        const data_arr = customers.map((customer, index) => {
            const createdAtFormatted = new Date(customer.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',

            });

            const updatedAtFormatted = new Date(customer.updated_at).toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',

            });

            const created_by = `<div class='created'>
                    <small> `+ customer.created_by_name + `</small>
                    <br/>
                    <small class='text-muted'>`+ createdAtFormatted + `</small>
                    </div>`;

            if (customer.updated_by_name != '' && customer.updated_by_name != null) {
                var updated_by = `<div class='created'>
                    <small > `+ customer.updated_by_name + `</small>
                    <br/>
                    <small class='text-muted'>`+ updatedAtFormatted + `</small>
                    </div>`;
            }
            else {
                var updated_by = '';
            }

            let status = ``;

            if (customer.status == 1) {
                status = `<div class="form-check form-switch form-check-custom form-check-solid">
                                <input class="form-check-input h-20px w-30px" type="checkbox" onchange="return change_status(${customer.id},0)" id="customer_${customer.id}" checked="checked" />
                                <label class="form-check-label text-success" for="customer_${customer.id}">
                                    <span class="badge badge-success">Active</span>
                                </label>
                            </div>`;
            } else {
                status = `<div class="form-check form-switch form-check-custom form-check-solid">
                                <input class="form-check-input h-20px w-30px" type="checkbox" onchange="return change_status(${customer.id},1)" id="customer_${customer.id}" />
                                <label class="form-check-label text-dark" for="customer_${customer.id}">
                                    <span class="badge badge-danger">In-active</span>
                                </label>
                            </div>`;
            }
            var profile_pic = "";
            if (customer.profile_pic != '' && customer.profile_pic != null) {
                var profile_pic = `<div class="text-center">
                            <img src="${customer.profile_pic}" alt="image_preview" class="dbimg rounded">

                        </div>`;
            }

            return {
                id: customer.id,
                phone_no: customer.phone_no,
                whatsapp_no: customer.whatsapp_no,
                email: customer.email,
                profile_pic: profile_pic,
                customer_name: customer.first_name+' '+customer.last_name,
                created_by_name: created_by,
                //createdAt: createdAtFormatted,
                updated_by_name: updated_by,
                //updatedAt: updatedAtFormatted,
                status: status,
                action: `<div class="text-center">
                            <a href="javascript:void(0)" onclick="return edit_data(${customer.id});"
                                class="btn btn-icon btn-bg-light btn-active-color-dark btn-sm me-1 mb-2" data-bs-toggle="tooltip" data-bs-placement="top" title="Edit">
                                <i class="ki-duotone text-dark
                                    ki-pencil fs-1">
                                    <span class="path1"></span>
                                    <span class="path2"></span>
                                </i>
                            </a>
                            <a href="javascript:void(0)" onclick="return delete_data(${customer.id});"
                                class="btn btn-icon btn-bg-light btn-active-color-danger btn-sm me-1 mb-2" data-bs-toggle="tooltip" data-bs-placement="top" title="Delete">
                                <i class="ki-duotone text-dark
                                    ki-trash fs-1">
                                    <span class="path1"></span>
                                    <span class="path2"></span>
                                    <span class="path3"></span>
                                    <span class="path4"></span>
                                    <span class="path5"></span>
                                </i>
                            </a>
                        </div>`
            };
        });

        // Create output
        const output = {
            draw: draw,
            recordsTotal: totalRecords,
            recordsFiltered: totalRecordsWithFilter,
            data: data_arr,
        };

        // Send the output
        return res.json(output);
    } catch (error) {
        throw new AppError(error.message, 400);
    }

});

//exportCustomers
const exportCustomers = catchAsync(async (req, res) => {
    try {
        // Query database
        const query = `
            SELECT
                cust.id,
                CONCAT(cust.first_name, ' ', cust.last_name) as cust_name,
                cust.phone_no,
                cust.whatsapp_no,
                cust.email,
                CASE
                    WHEN cust.profile IS NULL OR cust.profile = '' THEN ''
                    ELSE CONCAT('${BASE_URL}', cust.profile)
                END AS profile_pic,
                cust.created_at,
                cust.updated_at,
                cust.status,
                cust.enable_whatsapp_notification, cust.enable_email_notification
            FROM customers as cust
            WHERE deleted_at IS NULL
        `;

        const result = await db.query(query, []);
        let list = result.rows;

        // Create Excel file
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Customers");

        worksheet.columns = [
            { header: "ID", key: "id", width: 10 },
            { header: "Customer Name", key: "cust_name", width: 25 },
            { header: "Phone Number", key: "phone_no", width: 20 },
            { header: "Whatsapp Number", key: "whatsapp_no", width: 20 },
            { header: "Email", key: "email", width: 25 },
            { header: "Enable whatsapp notification", key: "enable_whatsapp_notification", width: 25 },
            { header: "Enable email notification", key: "enable_email_notification", width: 25 },
            { header: "Status", key: "status", width: 15 }
        ];

        list.forEach((row) => {
            worksheet.addRow({
                id: row.id,
                cust_name: row.cust_name,
                phone_no: row.phone_no,
                whatsapp_no: row.whatsapp_no,
                email: row.email,
                enable_whatsapp_notification: row.enable_whatsapp_notification == 1 ? "Yes" : "No",
                enable_email_notification: row.enable_email_notification == 1 ? "Yes" : "No",
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

export {
    getCustomers,
    exportCustomers
}
