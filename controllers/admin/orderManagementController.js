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
        body('status').notEmpty().withMessage('status is required').run(req)
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;
        throw new AppError(error_message, 200, errors);
    }

    try {
        const {status} = req.body
        const query_params = [status,1];

        //get total count
        const totalCount = await db.query(`select COUNT(id) FROM orders WHERE status = $1`,[status])

        const query = `select o.id as order_id,o.order_ref_id,o.customer_name,TO_CHAR(o.created_at,'FMDDth Month YYYY') as order_date,
        o.status,SUM(oi.quantity * oi.price::numeric) as total_price,
        TO_CHAR(o.delivery_date,'FMDDth Month YYYY') as delivery_date
        from orders as o
        LEFt JOIN order_items as oi ON o.id = oi.order_id AND o.status = $2
        where o.status = $1
        GROUP BY o.id,o.order_ref_id,o.customer_name,o.created_at`;

        const result = await db.query(query,query_params)

        return res.status(200).json({
            status: true,
            total:(totalCount) ? totalCount.rowCount : 0,
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

        const query = `update orders SET status = $1 WHERE id = $2`;
        const result = await db.query(query,query_params)

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
                            TO_CHAR(o.perferred_delivery_date, 'FMDDth Month YYYY') AS perferred_delivery_date,
                            TO_CHAR(o.created_at, 'FMDDth Month YYYY') AS order_date,
                            ca.address as address,
                            o.address as address_id
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
                            ) AS product_images
                            FROM order_items AS oi
                            LEFT JOIN products AS p ON oi.product_id = p.id
                            WHERE oi.order_id = $1 And oi.order_item_status = $2
                            GROUP BY oi.id,p.description,p.id`,[order_id,1]);

                            let Sumoflist;
                            if(order_item.rowCount > 0){
                                Sumoflist = order_item.rows.reduce((acc, item) => {
                                    acc.qty += parseInt(item.product_quantity);
                                    acc.price += parseInt(item.total_price);
                                    return acc;
                                    }, { qty: 0, price: 0 });
                                }

        return res.status(200).json({
            status: true,
            message: 'Fetch Order details Successfully',
            data:(result.rowCount > 0) ? {
                ...result.rows[0],
              order_items: order_item.rows,Sumoflist:Sumoflist} : [],

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
        body('status').notEmpty().withMessage('status is required').run(req)
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;
        throw new AppError(error_message, 200, errors);
    }

    try {

        const {order_id,status,payment_status,payment_mode} = req.body;
        const files = req.files || {};
        //status 4 means delivered. Need to Update delivery date in orders table
        let deliverDate = '';

        if(status == 4){
            deliverDate = new Date()
        }

        const updateInfo = {
            status:status,
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