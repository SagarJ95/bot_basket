import dotenv from 'dotenv';
dotenv.config({ path: `${process.cwd()}/.env` });

import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import bcrypt from "bcrypt";
import moment from 'moment';
import db from "../../config/db.js";
import ExcelJS  from "exceljs";
import path  from "path";
import fs  from "fs";
import { body, validationResult } from "express-validator";
import Customer from "../../db/models/customers.js";
import Orders from "../../db/models/orders.js";
import customer_address from "../../db/models/customer_address.js";

const BASE_URL = process.env.BASE_URL || 'http://localhost:3848';

//get Order list
const getOrderlist = catchAsync(async (req, res) => {

    await Promise.all([
        body('order_status').notEmpty().withMessage('status is required').run(req)
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;
        throw new AppError(error_message, 200, errors);
    }

    try {
        const {order_status, page , search,filter_date} = req.body
        const query_params = [order_status,1,1];
        const total_query_params = [order_status,1,1];
        let pageCountQuery = '';
        let searchQuery = '';
        let dateCondition='';

        if (filter_date && filter_date.includes(" - ")) {
            const [startDateStr, endDateStr] = filter_date.split(" - ");
            const startDate = new Date(startDateStr.split("-").reverse().join("-"));
            const endDate = new Date(endDateStr.split("-").reverse().join("-"));

            if (!isNaN(startDate) && !isNaN(endDate)) {
                dateCondition = `AND o.created_at BETWEEN $${
                query_params.length + 1
                } AND $${query_params.length + 2}`;
                query_params.push(startDate, endDate);
                total_query_params.push(startDate, endDate)
            }
        }

         if (search) {
            searchQuery = `AND (lower(o.customer_name) ILIKE $${query_params.length + 1} OR lower(o.order_ref_id) LIKE $${query_params.length + 1})`;
            query_params.push(`%${search.toLowerCase()}%`);
            total_query_params.push(`%${search.toLowerCase()}%`)
        }

        if(page){
            let pageCount = (page - 1) * 10;
            pageCountQuery = `LIMIT $${query_params.length + 1} OFFSET $${query_params.length + 2}`
            query_params.push(10,pageCount)
         }



        const totalPageCount = await db.query(`select o.id as order_id,o.order_ref_id,o.customer_name,TO_CHAR(o.created_at,'FMDDth FMMonth YYYY') as order_date,
        o.order_status,SUM(oi.quantity * oi.price::numeric) as total_price,
        SUM(oi.quantity * oi.price::numeric) as grand_total,
        CASE
            WHEN o.status = 1 THEN 'Pending'
            WHEN o.status = 2 THEN 'Confirmed'
            WHEN o.status = 3 THEN 'Shipped'
            WHEN o.status = 4 THEN 'Delivered'
            WHEN o.status = 5 THEN 'Cancelled'
            ELSE ''
        END AS status_name,
        TO_CHAR(o.delivery_date,'FMDDth FMMonth YYYY') as delivery_date,
        TO_CHAR(o.created_at,'FMDDth FMMonth YYYY') as created_at
        from orders AS o
        LEFT JOIN order_items as oi ON o.id = oi.order_id AND oi.order_item_status = $2
        where o.order_status = $1 and o.status = $3 ${dateCondition} ${searchQuery}
        GROUP BY o.id,o.order_ref_id,o.customer_name,o.created_at, o.order_status, o.delivery_date`,total_query_params)

        const query = `select o.id as order_id,o.order_ref_id,o.customer_name,TO_CHAR(o.created_at,'FMDDth FMMonth YYYY') as order_date,
        o.order_status,SUM(oi.quantity * oi.price::numeric) as total_price,
        SUM(oi.quantity * oi.price::numeric) as grand_total,
        CASE
            WHEN o.status = 1 THEN 'Pending'
            WHEN o.status = 2 THEN 'Confirmed'
            WHEN o.status = 3 THEN 'Shipped'
            WHEN o.status = 4 THEN 'Delivered'
            WHEN o.status = 5 THEN 'Cancelled'
            ELSE ''
        END AS status_name,
        TO_CHAR(o.delivery_date,'FMDDth FMMonth YYYY') as delivery_date,
        TO_CHAR(o.excepted_delivery_date,'FMDDth FMMonth YYYY') as excepted_delivery_date,
        TO_CHAR(o.shipped_date,'FMDDth FMMonth YYYY') as shipped_date,
        TO_CHAR(o.cancelled_date,'FMDDth FMMonth YYYY') as cancelled_date,
        TO_CHAR(o.created_at,'FMDDth FMMonth YYYY') as created_at
        from orders AS o
        LEFT JOIN order_items as oi ON o.id = oi.order_id AND oi.order_item_status = $2
        where o.order_status = $1 and o.status = $3 ${dateCondition} ${searchQuery}
        GROUP BY o.id,o.order_ref_id,o.customer_name,o.created_at, o.order_status, o.delivery_date
        ${pageCountQuery}`;

        const result = await db.query(query,query_params)

        return res.status(200).json({
            status: true,
            total:(totalPageCount.rowCount > 0) ? parseInt(totalPageCount.rowCount) : 0,
            message: 'Fetch Order details Successfully',
            data:(result.rowCount > 0) ? result.rows : []
          });
    } catch (error) {
        throw new AppError(error.message, 400);
    }

});

//Change status for order
const changeStatus = catchAsync(async (req, res) => {

    await Promise.all([
        body('order_id').notEmpty().withMessage('Order Id is required').run(req),
        body('status').notEmpty().withMessage('status is required').run(req)
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;
        throw new AppError(error_message, 200, errors);
    }

    try {
        const {status,order_id} = req.body
        const query_params = [status,order_id];

        const query = `update orders SET order_status = $1 WHERE id = $2`;
        const result = await db.query(query,query_params)

        //update order_status wise date in delivery_date,cancelled date
        const dateFields = {
                    "2": "excepted_delivery_date",
                    "3": "shipped_date",
                    "4": "delivery_date",
                    "5": "cancelled_date"
                };

        if (dateFields[status]) {
            await db.query(`UPDATE orders SET ${dateFields[status]} = $1 WHERE id = $2`, [today, order_id]);
        }

        return res.status(200).json({
            status: true,
            message: 'update Order status Successfully'
          });

    } catch (error) {
        throw new AppError(error.message, 400);
    }

});

//order View
const orderViewDetails = catchAsync(async (req, res) => {

    await Promise.all([
        body('order_id').notEmpty().withMessage('Order Id is required').run(req)
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;
        throw new AppError(error_message, 200, errors);
    }

    try {
        const {order_id} = req.body
        const result = await db.query(`SELECT
                            o.id,
                            o.customer_id,
                            o.customer_name,
                            o.whatsapp_number,
                            o.email,
                            o.special_instruction,
                            o.order_ref_id,
                            o.payment_mode,
                            o.payment_status,
                            TO_CHAR(o.perferred_delivery_date, 'FMDDth FMMonth YYYY') AS perferred_delivery_date,
                            TO_CHAR(o.created_at, 'FMDDth FMMonth YYYY') AS order_date,
                            CONCAT(ca.address1,' ',ca.address2) as address,
                            o.address as address_id,
                            o.order_status as order_status
                            FROM orders AS o
                            LEFT JOIN customer_addresses as ca ON o.address = ca.id
                            WHERE o.id = $1 `,[order_id]);

            //fetch order_item table fetch order item list based on order_id
            const order_item = await db.query(`SELECT
                            oi.id,
                            oi.order_id,
                            oi.product_id,
                            oi.product_name AS product_name,
                            p.description,
                            oi.price AS product_price,
                            oi.quantity AS product_quantity,
                            SUM(oi.quantity * oi.price::numeric) As total_price,
                            (
                                SELECT JSON_AGG(DISTINCT CONCAT('${BASE_URL}', pi.image_path))
                                FROM product_images pi
                                WHERE pi.product_id = p.id AND pi.image_path IS NOT NULL
                            ) AS product_images,
                             CONCAT('${BASE_URL}', p.thumbnail_product_image) as thumbnail_product_image,
                             CONCAT('${BASE_URL}/images/img-country-flag/',cd.flag) as country_flag,
                            c.cat_name as category_name
                            FROM order_items AS oi
                            LEFT JOIN products AS p ON oi.product_id = p.id
                            LEFT JOIN categories as c ON p.category = c.id
                            LEFT JOIN country_data as cd ON p.country_id = cd.id
                            WHERE oi.order_id = $1 And oi.order_item_status = $2
                            GROUP BY oi.id,p.description,p.id,cd.flag,c.cat_name`,[order_id,1]);

                            let Sumoflist;
                            if(order_item.rowCount > 0){
                                Sumoflist = order_item.rows.reduce((acc, item) => {
                                    acc.qty += parseFloat(item.product_quantity) || 0;
                                    acc.price += parseFloat(item.total_price) || 0;
                                    return acc;
                                    }, { qty: 0, price: 0 });

                                    Sumoflist.price = parseFloat(Sumoflist.price.toFixed(2));
                                }

        return res.status(200).json({
            status: true,
            message: 'Fetch Order details Successfully',
            data:(result.rowCount > 0) ? [{
                ...result.rows[0],
              order_items: order_item.rows,Sumoflist:Sumoflist}] : [],

          });
    } catch (error) {
        throw new AppError(error.message, 400);
    }

});

//order Edit
const orderEditDetails = catchAsync(async (req, res) => {

    await Promise.all([
        body('order_id').notEmpty().withMessage('order Id is required').run(req),
        body('payment_mode').notEmpty().withMessage('Payment mode is required').run(req),
        body('payment_status').notEmpty().withMessage('Payment status is required').run(req),
        body('order_status').notEmpty().withMessage('order status is required').run(req)
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;
        throw new AppError(error_message, 200, errors);
    }

    try {

        const {order_id,order_status,payment_status,payment_mode} = req.body;
        const files = req.files || {};
        //order_status 4 means delivered. Need to Update delivery date in orders table
        let deliverDate = '';

        if(order_status == 4){
            deliverDate = new Date()
        }

        const updateInfo = {
            order_status:order_status,
            payment_status:payment_status,
            payment_mode:payment_mode,
            delivery_date:(deliverDate) ? deliverDate :null
        };

        const formatPath = (filePath) => {
            return filePath ? filePath.replace(/^public[\\/]/, '/').replace(/\\/g, '/') : null;
        };

        const invoicePath = files.invoice && files.invoice.length > 0
            ? formatPath(files.invoice[0].path)
            : null;

        if (invoicePath) updateInfo.invoice_path = invoicePath;
        const updateOrderDetails = await Orders.update(updateInfo,{
            where:{
                id:order_id
                }
            });

        return res.status(200).json({
            status: true,
            message: (updateOrderDetails) ?  'Update Order details Successfully' : 'Update Order details Unsuccessfully'
          });
    } catch (error) {
        throw new AppError(error.message, 400);
    }

});

export {
    getOrderlist,
    changeStatus,
    orderViewDetails,
    orderEditDetails
}