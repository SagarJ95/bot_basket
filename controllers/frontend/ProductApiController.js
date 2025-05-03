// Defaults
import catchAsync from "../../utils/catchAsync.js";
import db from "../../config/db.js";
import AppError from "../../utils/appError.js";

import Customer from "../../db/models/customers.js";
import addToCart from "../../db/models/add_to_carts.js";
import Orders from "../../db/models/orders.js";
import OrderItem from "../../db/models/order_items.js";
import bcrypt from "bcrypt";
import { body, validationResult } from "express-validator";
import { sendOrderConfirmation } from "../../helpers/orderconformation_mail.js";

const project_name = process.env.APP_NAME;
const BASE_URL = process.env.BASE_URL || "http://localhost:3848";

const recommended_products = catchAsync(async (req, res) => {
  try {
    const customerId = req.user.id;

    const query = `
        WITH customer_products AS (
          SELECT DISTINCT oi.product_id
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE o.customer_id = $1
        ),
        other_orders AS (
          SELECT DISTINCT oi.order_id
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE o.customer_id != $1
          AND oi.product_id IN (SELECT product_id FROM customer_products)
        ),
        recommended AS (
          SELECT oi.product_id, COUNT(*) AS count
          FROM order_items oi
          WHERE oi.order_id IN (SELECT order_id FROM other_orders)
          AND oi.product_id NOT IN (SELECT product_id FROM customer_products)
          GROUP BY oi.product_id
          ORDER BY count DESC
          LIMIT 10
        )
        SELECT * FROM recommended;
      `;
    const result = await db.query(query, [customerId]);

    let getproductlist = [];

    if (result && result.rowCount > 0) {
      for (const val of result.rows) {
        const productquery = `
                  SELECT
                    p.id,
                    p.name AS product_name,
                    p.slug,
                    p.description,
                    p.price,
                    p.minimum_order_place,
                    p.maximum_order_place,
                    COALESCE(q.total_ordered_quantity_today, 0) AS total_ordered_quantity_today,
                    (p.maximum_order_place - COALESCE(q.total_ordered_quantity_today, 0)) AS available_quantity,
                    c.id AS categoryId,
                    c.cat_name AS category_name,
                    JSON_AGG(
                      CONCAT('${BASE_URL}', pi.image_path)
                    ) FILTER (WHERE pi.image_path IS NOT NULL) AS product_images
                  FROM products AS p
                  LEFT JOIN categories AS c ON p.category = c.id
                  LEFT JOIN product_images AS pi ON p.id = pi.product_id
                  LEFT JOIN (
                    SELECT
                      product_id,
                      SUM(quantity) AS total_ordered_quantity_today
                    FROM order_items
                    WHERE order_item_status = $2 AND DATE(created_at) = CURRENT_DATE
                    GROUP BY product_id
                  ) AS q ON p.id = q.product_id
                  WHERE p.id = $3 AND p.status = $1 AND p.deleted_at IS NULL
                  GROUP BY p.id, c.cat_name, c.id, q.total_ordered_quantity_today
          `;

        const productResult = await db.query(productquery, [
          1,
          1,
          val.product_id,
        ]);

        if (productResult && productResult.rowCount > 0) {
          getproductlist.push(productResult.rows[0]);
        }
      }
    }

    return res.status(200).json({
      status: true,
      message: "fetch Product list sucessfully",
      data: getproductlist,
    });
  } catch (e) {
    return res.status(200).json({
      status: false,
      message: "Failed to retrieve data",
      errors: error.message,
    });
  }
});

const product_list = catchAsync(async (req, res) => {
  try {
    const { category_id, search, country_id, price_ranges } = req.body;
    let query_params = [1, 1];
    let searchQuery = "";
    let categories = "";
    let wildcardSearch = "";
    let countryFilter = "";
    let priceFilter = "";

    if (category_id) {
      categories = `and p.category = ANY ($${query_params.length + 1})`;
      query_params.push(category_id);
    }

    if (search) {
      wildcardSearch = `%${search.toLowerCase()}%`;
      searchQuery = `AND lower(p.name) LIKE $${query_params.length + 1}`;
      query_params.push(wildcardSearch);
    }

    if (country_id) {
      countryFilter = `AND p.country_id = ANY ($${query_params.length + 1})`;
      query_params.push(country_id);
    }
    if (price_ranges && price_ranges.length > 0) {
      let priceRangeFilter = "";
      let priceParams = [];

      price_ranges.forEach((range) => {
        priceParams.push(range.min, range.max);
      });

      // Get the starting index of price params in the final array
      const baseIndex = query_params.length + 1;

      price_ranges.forEach((range, i) => {
        const minIndex = baseIndex + i * 2;
        const maxIndex = baseIndex + i * 2 + 1;
        priceRangeFilter += `(pl.price BETWEEN $${minIndex} AND $${maxIndex}) OR `;
      });

      priceFilter = `AND (${priceRangeFilter.slice(0, -4)})`; // remove last OR
      query_params.push(...priceParams);
    }

    // console.log("query_params", query_params);

    const productquery = `
      SELECT  
        p.id,
        p.name AS product_name,
        p.slug,
        p.description,
        pl.price,
        p.minimum_order_place,
        p.maximum_order_place,
        COALESCE(q.total_ordered_quantity_today, 0) AS total_ordered_quantity_today,
        (p.maximum_order_place - COALESCE(q.total_ordered_quantity_today, 0)) AS available_quantity,
        c.id AS categoryId,
        c.cat_name AS category_name,
        cd.id AS country_id,
        cd.country_name,
       
        CONCAT('${BASE_URL}','/images/img-country-flag/', cd.flag) AS country_flag,
        ARRAY[pi.image_path] AS product_images
      FROM products AS p
      LEFT JOIN categories AS c ON p.category = c.id
      LEFT JOIN country_data AS cd ON p.country_id = cd.id 
      LEFT JOIN LATERAL (
        SELECT CONCAT('${BASE_URL}', pi.image_path) AS image_path
        FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.id DESC
        LIMIT 1
      ) AS pi ON true
      LEFT JOIN (
        SELECT
          product_id,
          SUM(quantity) AS total_ordered_quantity_today
        FROM order_items
        WHERE order_item_status = $2 AND DATE(created_at) = CURRENT_DATE
        GROUP BY product_id
      ) AS q ON p.id = q.product_id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id)
          product_id,
          price,
          upload_date
        FROM products_price_logs
        WHERE deleted_at IS NULL
        ORDER BY product_id, upload_date DESC
      ) AS pl ON pl.product_id = p.id
      WHERE p.status = $1 AND p.deleted_at IS NULL
      ${categories} ${searchQuery} ${countryFilter} ${priceFilter}
      GROUP BY p.id, c.cat_name, c.id, q.total_ordered_quantity_today, pi.image_path, pl.price, cd.id, cd.country_name
    `;

    const getproductlist = await db.query(productquery, query_params);

    return res.status(200).json({
      status: true,
      total: getproductlist.rowCount > 0 ? getproductlist.rowCount : 0,
      message: "fetch Product list sucessfully",
      data: getproductlist.rowCount > 0 ? getproductlist.rows : [],
    });
  } catch (e) {
    return res.status(200).json({
      status: false,
      message: "Failed to retrieve data",
      errors: e.message,
    });
  }
});

const add_update_cart = catchAsync(async (req, res) => {
  await Promise.all([
    body("product_id")
      .notEmpty()
      .withMessage("Product id is required")
      .run(req),
    body("qty").notEmpty().withMessage("quantity is required").run(req),
    //body('price').notEmpty().withMessage('Price is required').run(req)
  ]);

  // Handle validation result
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  try {
    const { id, product_id, qty } = req.body;
    if (qty <= 0) {
      return res.status(200).json({
        status: false,
        message: "Quantity should be greater than 0",
      });
    }

    let infoUpdate;
    let CartInfo;

    //if id is empty then product insert into cart otherwise update product qty in add_to_carts table
    if (!id && id == 0) {
      const pervPrice = await db.query(
        `
          SELECT price
          FROM products_price_logs
          WHERE product_id = $1 AND created_at < (CURRENT_DATE - INTERVAL '1 day')
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [product_id]
      );

      const previousPrice = pervPrice.rows[0]?.price || null;

      CartInfo = await addToCart.create({
        product_id,
        qty,
        prevprice: previousPrice,
        created_by: req.user.id,
        status: 1,
      });

      infoUpdate = "Add";
    } else {
      CartInfo = await addToCart.update(
        {
          qty: qty,
        },
        {
          where: {
            id: parseInt(id),
            product_id: product_id,
            status: 1,
            created_by: req.user.id,
          },
        }
      );

      infoUpdate = "Update";
    }

    return res.status(200).json({
      status: true,
      message: CartInfo
        ? `${infoUpdate} Into Cart sucessfully`
        : `${infoUpdate} Into Cart Unsucessfully`,
    });
  } catch (e) {
    return res.status(200).json({
      status: false,
      message: "Failed to retrieve data",
      errors: e.message,
    });
  }
});

const cart_list = catchAsync(async (req, res) => {
  try {
    const customer_id = req.user.id;

    const cartlist = await db.query(
      `
          SELECT DISTINCT ON (atc.id)
            atc.id as cart_id,
            atc.product_id,
            p.name AS product_name,
            p.description,
            COALESCE(atc.pervoius_price::numeric,0) AS pervoius_price,
            CONCAT('${BASE_URL}', pi.image_path) AS product_image,
            atc.qty,
            p.price
          FROM add_to_carts AS atc
          LEFT JOIN products AS p ON atc.product_id = p.id
          LEFT JOIN product_images AS pi ON p.id = pi.product_id
          WHERE atc.status = $1
            AND atc.created_by = $2
            AND atc.deleted_at IS NULL
        `,
      [1, customer_id]
    );

    let cartSum;
    if (cartlist.rowCount > 0) {
      //sum of cart qty and price
      cartSum = cartlist.rows.reduce(
        (acc, item) => {
          acc.qty += parseInt(item.qty);
          acc.price += parseInt(item.price) * parseInt(item.qty);
          return acc;
        },
        { qty: 0, price: 0 }
      );
    }

    return res.status(200).json({
      status: true,
      message: `Fetch Cart list sucessfully`,
      data:
        cartlist.rowCount > 0
          ? [{ list: cartlist.rows, listofsum: cartSum }]
          : [],
    });
  } catch (e) {
    return res.status(200).json({
      status: false,
      message: "Failed to retrieve data",
      errors: error.message,
    });
  }
});

const delete_product_cart = catchAsync(async (req, res) => {
  await Promise.all([
    body("cart_id").notEmpty().withMessage("Cart id is required").run(req),
  ]);

  // Handle validation result
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  try {
    const { cart_id } = req.body;
    const customer_id = req.user.id;

    let CartInfo = await addToCart.update(
      {
        status: 0,
      },
      {
        where: {
          id: parseInt(cart_id),
          created_by: customer_id,
        },
      }
    );

    return res.status(200).json({
      status: true,
      message: CartInfo
        ? `Delete From Cart sucessfully`
        : `Delete From Cart Unsucessfully`,
    });
  } catch (e) {
    return res.status(200).json({
      status: false,
      message: "Failed to retrieve data",
      errors: error.message,
    });
  }
});

/******************* End product  Info ************************ */

export {
  product_list,
  add_update_cart,
  cart_list,
  delete_product_cart,
  recommended_products,
};
