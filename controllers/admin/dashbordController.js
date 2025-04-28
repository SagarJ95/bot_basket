import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import db from "../../config/db.js";
import Sequelize from "../../config/database.js";
import moment from "moment-timezone";

const dashboardController = async (req, res) => {
  try {
    const date = moment().format("YYYY-MM-DD");

    const getTotalOrder = await db.query(
      "SELECT * FROM orders WHERE created_at::date = $1 AND status = $2",
      [date, "1"]
    );

    const pendingOrder = await db.query(
      `SELECT SUM(order_status) AS pending_order_count FROM orders WHERE created_at::date = $1 AND order_status = $2 AND status = $3`,
      [date, "1", "1"]
    );

    const total_price_result = await db.query(
      `SELECT SUM(price::numeric) AS total_price FROM order_items WHERE created_at::date = $1 AND order_item_status = $2`,
      [date, "1"]
    );

    const get_customers_details = await db.query(
      `select o.id as order_id,o.customer_name,o.order_status,
      SUM(ot.quantity::integer* ot.price::numeric) as total_price,
      CASE
      WHEN o.order_status =1 THEN 'Pending'
      WHEN o.order_status= 2 THEN 'Confirmed'
      WHEN o.order_status= 3 THEN 'Shipped'
      WHEN o.order_status =4 THEN 'Delivered'
      WHEN o.order_status =5 THEN 'Cancelled'
      ELSE ''
      END as order_status
       from orders as o LEFT JOIN order_items as ot
      ON o.id = ot.order_id
      WHERE o.created_at::date =$1 AND o.status= $2 AND ot.order_item_status=$3
      GROUP BY o.id
      `,
      [date, "1", "1"]
    );


    res.status(200).json({
      status: true,
      message: "Dashboard details fetched successfully!",
      data: [
        {
          total_order: getTotalOrder.rowCount,
          total_price: parseInt(total_price_result.rows[0].total_price) || 0,
          pending_order_count:
            parseInt(pendingOrder.rows[0].pending_order_count) || 0,
          order_list: get_customers_details.rows || [],
        },
      ],
    });
  } catch (error) {
    res.status(400).json({
      status: false,
      message: error.message,
    });
  }
};

export { dashboardController };
