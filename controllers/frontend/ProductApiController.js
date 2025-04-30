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

/*******************  Category list ************************ */

const category_list = catchAsync(async (req, res) => {
  try {
    const getCategorieslist = await db.query(
      `select
        id,cat_name,slug from categories where status = $1 and deleted_at IS NULL`,
      [1]
    );

    return res.status(200).json({
      status: true,
      message: "fetch Categories sucessfully",
      data: getCategorieslist.rowCount > 0 ? getCategorieslist.rows : [],
    });
  } catch (e) {
    return res.status(200).json({
      status: false,
      message: "Failed to retrieve data",
      errors: error.message,
    });
  }
});

/******************     Country           *************************************** */

const country_list = catchAsync(async (req, res) => {
  try {
    const getCountryList = await db.query(
      `select id,country_name from country_data ORDER BY id ASC `
    );

    if (getCountryList.rowCount > 0) {
      return res.status(200).json({
        status: true,
        message: "county get successfully!",
        data: getCountryList.rows,
      });
    } else {
      return res.status(200).json({
        status: false,
        message: "country not found",
      });
    }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

/*******************     price             *********************************/
const get_price = catchAsync(async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        MIN(price::numeric) AS min_price, 
        MAX(price::numeric) AS max_price 
      FROM products_price_logs 
      WHERE deleted_at IS NULL
    `);

    if (
      result.rowCount === 0 ||
      !result.rows[0].min_price ||
      !result.rows[0].max_price
    ) {
      return res.status(400).json({
        status: false,
        message: "Price data not found!",
      });
    }

    const min = parseFloat(result.rows[0].min_price);
    const max = parseFloat(result.rows[0].max_price);
    const range = (max - min) / 4;

    // Create 4 price ranges
    const priceRanges = [
      { min: min.toFixed(2), max: (min + range).toFixed(2) },
      { min: (min + range).toFixed(2), max: (min + 2 * range).toFixed(2) },
      { min: (min + 2 * range).toFixed(2), max: (min + 3 * range).toFixed(2) },
      { min: (min + 3 * range).toFixed(2), max: max.toFixed(2) },
    ];

    res.status(200).json({
      status: true,
      message: "Price ranges fetched successfully!",
      data: priceRanges,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

/*******************          getprice        **********************************************/

/******************* category  Info ************************ */

/******************* product  Info ************************ */

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

    console.log("query_params", query_params);

    // const productquery = `select
    //     p.id,p.name as product_name,p.slug,p.description,p.price,p.minimum_order_place,p.maximum_order_place,
    //     COALESCE(q.total_ordered_quantity_today, 0) AS total_ordered_quantity_today,
    //     (p.maximum_order_place - COALESCE(q.total_ordered_quantity_today, 0)) AS available_quantity,c.id as categoryId,c.cat_name as category_name,
    //      JSON_AGG(
    //         CONCAT('${BASE_URL}', pi.image_path)
    //     ) FILTER (WHERE pi.image_path IS NOT NULL) AS product_images
    //      from products as p
    //     left join categories as c ON p.category = c.id
    //     left join product_images as pi ON p.id = pi.product_id
    //     LEFT JOIN (
    //     SELECT
    //       product_id,
    //       SUM(quantity) AS total_ordered_quantity_today
    //     FROM order_items
    //     WHERE order_item_status = $2 AND DATE(created_at) = CURRENT_DATE
    //     GROUP BY product_id
    //   ) AS q ON p.id = q.product_id
    //     where p.status = $1 and p.deleted_at IS NULL ${categories} ${searchQuery}
    //     GROUP BY p.id,c.cat_name,c.id,q.total_ordered_quantity_today`;

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
      errors: error.message,
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

/******************* Start Order creation Flow ************************ */
//place order
const create_order = catchAsync(async (req, res) => {
  await Promise.all([
    body("name").notEmpty().withMessage("Name is required").run(req),
    body("whatsapp_number")
      .notEmpty()
      .withMessage("Whatsapp Number is required")
      .run(req),
    body("email").notEmpty().withMessage("Email is required").run(req),
    body("perferred_delivery_date")
      .notEmpty()
      .withMessage("Perferred delivery date is required")
      .run(req),
    body("address").notEmpty().withMessage("Address is required").run(req),
    body("order_item")
      .isArray({ min: 1 })
      .withMessage("At least one order item is required")
      .run(req),
  ]);

  // Handle validation result
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  try {
    const customer_id = req.user.id;
    const {
      name,
      whatsapp_number,
      email,
      perferred_delivery_date,
      address,
      instruction,
      order_item,
      delivery_option_id,
    } = req.body;

    //get order id from order table
    const getorderid = await db.query(`select id from orders order by id desc`);
    const orderidInc = getorderid.rowCount > 0 ? getorderid.rows[0].id + 1 : 1;
    const orderrefid = `Order_ID_${orderidInc}`;

    const order_id = await Orders.create({
      customer_id: customer_id,
      order_ref_id: orderrefid,
      customer_name: name,
      whatsapp_number: whatsapp_number,
      email: email,
      perferred_delivery_date: perferred_delivery_date,
      address: address,
      special_instruction: instruction,
      delivery_option_id: delivery_option_id,
      status: 1,
      order_status: 1,
      created_by: customer_id,
    });

    if (order_id.id && order_item) {
      for (let item of order_item) {
        const order_item_id = await OrderItem.create({
          order_id: order_id.id,
          customer_id: customer_id,
          cart_id: item.cart_id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          order_item_status: 1,
          item_delivery_status: 1,
          created_by: customer_id,
        });

        //Deactive status in cart_list
        const cart_id = item.cart_id;
        const cart = await addToCart.update(
          { status: 0 },
          { where: { id: cart_id } }
        );
      }
    }
    let getaddres;
    let final_address = "";

    if (delivery_option_id == 1) {
      getaddres = await db.query(
        `select CONCAT(address1,' ',address2) as address from customer_addresses where customer_id=$1 AND id=$2 AND status=$3 `,
        [customer_id, address, "1"]
      );
      final_address = getaddres.rows[0]?.address || "";
      console.log("final_address", final_address);
    } else if (delivery_option_id == 2) {
      getaddres = await db.query(
        `select store_address from store_self_locations where status=$1 `,
        ["1"]
      );
      final_address = getaddres.rows[0]?.store_address || "";
      console.log("final_address", final_address);
    }

    // send conformation mail with pdf attach invoice
    await sendOrderConfirmation(
      req,
      email,
      name,
      final_address,
      order_item.map((item) => ({
        name: item.product_name,
        quantity: item.quantity,
        price: item.price,
      })),
      order_id.id
    );

    return res.status(200).json({
      status: true,
      message: "Order Placed Successfully",
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Failed to retrieve data",
      errors: error.message,
    });
  }
});

const order_history = catchAsync(async (req, res) => {
  await Promise.all([
    body("status").notEmpty().withMessage("Status is required").run(req),
  ]);

  // Handle validation result
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  try {
    const customer_id = req.user.id;
    const { status } = req.body;

    const result = await db.query(
      `
        SELECT
          o.id AS order_id,
          TO_CHAR(o.perferred_delivery_date, 'FMDDth Month YYYY') AS delivery_date,
          SUM(oi.quantity * oi.price::numeric) AS total_price,
                JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'product_id', p.id,
                    'product_name', p.name,
                    'description', p.description,
                    'product_images', (
                      SELECT JSON_AGG(DISTINCT CONCAT('${BASE_URL}', pi.image_path))
                      FROM product_images pi
                      WHERE pi.product_id = p.id AND pi.image_path IS NOT NULL
                    )
                  )
                ) AS products
              FROM orders o
              LEFT JOIN order_items oi ON o.id = oi.order_id
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE o.customer_id = $1
                AND o.order_status = $2
                AND oi.order_item_status = $3
                AND o.status = $4
              GROUP BY o.id, o.perferred_delivery_date
      `,
      [customer_id, status, 1, 1]
    );

    return res.status(200).json({
      status: true,
      message: "Fetch Order History Successfully",
      data: result.rowCount > 0 ? result.rows : [],
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Failed to retrieve data",
      errors: error.message,
    });
  }
});

const view_order = catchAsync(async (req, res) => {
  await Promise.all([
    body("order_id").notEmpty().withMessage("Order Id is required").run(req),
  ]);

  // Handle validation result
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  try {
    const customer_id = req.user.id;
    const { order_id } = req.body;

    const result = await db.query(
      `SELECT
    o.id,
    o.customer_id,
    o.customer_name,
    o.whatsapp_number,
    o.email,
    o.special_instruction,
    TO_CHAR(o.perferred_delivery_date, 'FMDDth Month YYYY') AS delivery_date,
    ca.address1 as address_1,
    ca.address2 as address_2,
    o.address as orders_address_id
    FROM orders AS o
    LEFT JOIN customer_addresses as ca ON o.address = ca.id
    WHERE o.customer_id = $1`,
      [customer_id]
    );

    //fetch order_item table fetch order item list based on order_id
    const order_item = await db.query(
      `SELECT
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
      GROUP BY oi.id,p.id,p.description`,
      [order_id, 1]
    );

    let Sumoflist;
    if (order_item.rowCount > 0) {
      Sumoflist = order_item.rows.reduce(
        (acc, item) => {
          acc.qty += parseFloat(item.product_quantity) || 0;
          acc.price += parseFloat(item.total_price) || 0;
          return acc;
        },
        { qty: 0, price: 0 }
      );
    }

    return res.status(200).json({
      status: true,
      message: "Fetch Order Details Successfully",
      data:
        result.rowCount > 0
          ? [
              {
                ...result.rows[0],
                order_items: order_item.rows,
                Sumoflist: Sumoflist ? Sumoflist : "",
              },
            ]
          : [],
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Failed to retrieve data",
      errors: error.message,
    });
  }
});

// repeat order
const repeat_order = catchAsync(async (req, res) => {
  try {
    const customer_id = req.user.id;
    const { order_id } = req.body;

    const getoder = await db.query(
      `select ot.order_id,ot.product_id,ot.quantity,ot.price as previous_price,p.price as current_price from order_items as ot
        LEFT JOIN products as p ON ot.product_id = p.id
       where ot.order_id=$1 AND ot.order_item_status=$2 AND p.product_stock_status=$3 AND p.status=$4 AND p.price != ${0}`,
      [order_id, "1", "1", "1"]
    );

    if (getoder.rowCount == 0) {
      return res.status(200).json({
        status: false,
        message: "Product not available",
      });
    }

    const items = getoder.rows;

    for (const item of items) {
      await db.query(
        `INSERT INTO add_to_carts (product_id,qty,price,pervoius_price,created_at,updated_at,created_by,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          item.product_id,
          item.quantity,
          item.current_price,
          item.previous_price,
          new Date(),
          new Date(),
          customer_id,

          "1",
        ]
      );
    }
    return res.status(200).json({
      status: true,
      message: "Order fetched and added to cart successfully!",
    });
  } catch (error) {
    res.status(400).json({
      status: false,
      message: error.message,
    });
  }
});

/******************* End Order creation Flow ************************ */

export {
  category_list,
  product_list,
  add_update_cart,
  cart_list,
  delete_product_cart,

  /** order creation */
  recommended_products,
  create_order,
  order_history,
  view_order,
  repeat_order,
  country_list,
  get_price,
};
