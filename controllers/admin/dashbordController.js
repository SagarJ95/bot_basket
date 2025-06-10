import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import db from "../../config/db.js";
import Sequelize from "../../config/database.js";
import moment from "moment-timezone";

const dashboardController = async (req, res) => {
  try {
    const { page, search } = req.body;

    const date = moment().format("YYYY-MM-DD");
    const query_params = [date, "1", "1"];
    const total_query_params = [date, "1", "1"];
    let pageCountQuery = "";
    let searchQuery = "";

    const getTotalOrder = await db.query(
      "SELECT * FROM orders WHERE deleted_at IS NULL AND created_at::date = $1 AND status = $2",
      [date, "1"]
    );

    const pendingOrder = await db.query(
      `SELECT SUM(order_status) AS pending_order_count FROM orders WHERE deleted_at IS NULL AND  created_at::date = $1 AND order_status = $2 AND status = $3`,
      [date, "1", "1"]
    );

    const total_price_result = await db.query(
      `SELECT TO_CHAR(SUM(price::numeric * quantity::numeric), 'FM999999999.00') AS total_price FROM order_items WHERE deleted_at IS NULL AND created_at::date = $1 AND order_item_status = $2`,
      [date, "1"]
    );

    if (search) {
      searchQuery = `AND (lower(o.customer_name) ILIKE $${
        query_params.length + 1
      } OR lower(o.order_ref_id) LIKE $${query_params.length + 1})`;
      query_params.push(`%${search.toLowerCase()}%`);
      total_query_params.push(`%${search.toLowerCase()}%`);
    }

    if (page) {
      let pageCount = (page - 1) * 10;
      pageCountQuery = `LIMIT $${query_params.length + 1} OFFSET $${
        query_params.length + 2
      }`;
      query_params.push(10, pageCount);
    }

    const total_customers_details = await db.query(
      `select o.id as order_id,o.order_ref_id,o.customer_name,o.order_status,
      SUM(ot.quantity::integer* ot.price::numeric) as total_price,
      TO_CHAR(o.created_at,'FMDDth FMMonth YYYY') as created_at,
      CASE
      WHEN o.order_status =1 THEN 'Pending'
      WHEN o.order_status= 2 THEN 'Confirmed'
      WHEN o.order_status= 3 THEN 'Shipped'
      WHEN o.order_status =4 THEN 'Delivered'
      WHEN o.order_status =5 THEN 'Cancelled'
      ELSE ''
      END as order_status
       from orders as o
       LEFT JOIN order_items as ot ON o.id = ot.order_id AND ot.order_item_status = $3
      WHERE o.deleted_at IS NULL AND o.created_at::date =$1 AND o.status= $2 ${searchQuery}
      GROUP BY o.id
      `,
      total_query_params
    );

    const get_customers_details = await db.query(
      `select o.id as order_id,o.customer_name,o.order_status,
      SUM(ot.quantity::integer* ot.price::numeric) as total_price,
      TO_CHAR(o.created_at,'FMDDth FMMonth YYYY') as created_at,
      CASE
      WHEN o.order_status =1 THEN 'Pending'
      WHEN o.order_status= 2 THEN 'Confirmed'
      WHEN o.order_status= 3 THEN 'Shipped'
      WHEN o.order_status =4 THEN 'Delivered'
      WHEN o.order_status =5 THEN 'Cancelled'
      ELSE ''
      END as order_status
       from orders as o
       LEFT JOIN order_items as ot ON o.id = ot.order_id AND ot.order_item_status = $3
      WHERE o.deleted_at IS NULL AND o.created_at::date =$1 AND o.status= $2 ${searchQuery}
      GROUP BY o.id ${pageCountQuery}
      `,
      query_params
    );

    const graphCountDelivery = await db.query(
      `select COUNT(*) as count_delivery from orders   WHERE deleted_at IS NULL And created_at::date = $1 AND order_status = 4`,
      [date]
    );
    const graphCountPending = await db.query(
      `select COUNT(*) as count_pending from orders WHERE deleted_at IS NULL And created_at::date = $1 AND order_status = 1`,
      [date]
    );
    const graphCountConfirmed = await db.query(
      `select COUNT(*) as count_confirm from orders WHERE deleted_at IS NULL And created_at::date = $1 AND order_status = 2`,
      [date]
    );

    res.status(200).json({
      status: true,
      total:
        total_customers_details.rowCount > 0
          ? total_customers_details.rowCount
          : 0,
      message: "Dashboard details fetched successfully!",
      data: [
        {
          total_order: getTotalOrder.rowCount,
          total_price: total_price_result.rows[0].total_price || 0,
          pending_order_count:
            parseInt(pendingOrder.rows[0].pending_order_count) || 0,
          order_list: get_customers_details.rows || [],
          graphCount: [
            {
              delivery: parseInt(graphCountDelivery.rows[0].count_delivery),
              pending: parseInt(graphCountPending.rows[0].count_pending),
              confirm: parseInt(graphCountConfirmed.rows[0].count_confirm),
            },
          ],
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
