// Defaults
import catchAsync from "../../utils/catchAsync.js";
import db from "../../config/db.js";

import Customer from "../../db/models/customers.js";
import addToCart from "../../db/models/add_to_carts.js";
import Orders from "../../db/models/orders.js";
import OrderItem from "../../db/models/order_items.js";
import bcrypt from "bcrypt";
import { body, validationResult } from "express-validator";
import { sendOrderConfirmation } from "../../helpers/orderconformation_mail.js";
import AppError from "../../utils/appError.js";
import pkg from "jsonwebtoken";
const { verify } = pkg;
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
    const {
      category_id,
      search,
      country_id,
      price_ranges,
      page,
      sort_by_price,
      pageSize = 10,
    } = req.body;
    let query_params = [1, 1];
    let query_params_count = [1, 1];
    let searchQuery = "";
    let categories = "";
    let wildcardSearch = "";
    let countryFilter = "";
    let priceFilter = "";
    let limitQuery = "";
    let orderByClause = "";

    if (category_id && category_id.length > 0) {
      categories = `AND p.category = ANY ($${query_params.length + 1})`;
      query_params.push(category_id);
      query_params_count.push(category_id)
    }

    if (search) {
      wildcardSearch = `%${search.toLowerCase()}%`;
      searchQuery = `AND lower(p.name) LIKE $${query_params.length + 1}`;
      query_params.push(wildcardSearch);
      query_params_count.push(wildcardSearch)
    }

    if (country_id && country_id.length > 0) {
      countryFilter = `AND p.country_id = ANY ($${query_params.length + 1})`;
      query_params.push(country_id);
      query_params_count.push(country_id)
    }

    if (price_ranges && price_ranges.length > 0) {
      let priceRangeFilter = "";
      let priceParams = [];
      price_ranges.forEach((range) => {
        priceParams.push(range.min, range.max);

      });

      const baseIndex = query_params.length + 1;

      price_ranges.forEach((range, i) => {
        const minIndex = baseIndex + i * 2;
        const maxIndex = baseIndex + i * 2 + 1;
        priceRangeFilter += `(pl.price BETWEEN $${minIndex} AND $${maxIndex}) OR `;
      });

      priceFilter = `AND (${priceRangeFilter.slice(0, -4)})`;
      query_params.push(...priceParams);
      query_params_count.push(...priceParams)
    }

    if (sort_by_price === "low_to_high") {
      orderByClause = `ORDER BY pl.price ASC`;
    } else if (sort_by_price === "high_to_low") {
      orderByClause = `ORDER BY pl.price DESC`;
    }

    // Soft Authentication
    const authHeader = req.headers.authorization;
    let customer;
    if (authHeader?.startsWith("Bearer")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = verify(token, process.env.JWT_SECRET_KEY);
        customer = await Customer.findByPk(decoded.id);
      } catch (_) {
        customer = null;
      }
    }
    const customerId = customer ? customer.id : null;

    let cartJoin = "";
    let cartgroupjoin = "";
    let cartqtyandid = "";
    if (customerId) {
      cartJoin = `
        LEFT JOIN (
          SELECT
            atc.id AS cart_id,
            atc.product_id,
            atc.qty,
            atc.price
          FROM add_to_carts atc
          WHERE atc.created_by = $${query_params.length + 1}
            AND atc.status = 1
            AND atc.deleted_at IS NULL
        ) AS cart ON cart.product_id = p.id
      `;
      query_params.push(customerId);
      query_params_count.push(customerId)
      cartgroupjoin = ", cart.cart_id, cart.qty";
      cartqtyandid = `, COALESCE(cart.cart_id, 0) AS cart_id, COALESCE(cart.qty, 0) AS cart_qty`;
    }

    // Pagination

    if (page && page != 0) {
      const offset = (page - 1) * pageSize;
      limitQuery = ` LIMIT $${query_params.length + 1} OFFSET $${
        query_params.length + 2
      }`;
      query_params.push(pageSize, offset);
    }

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
        CONCAT('${BASE_URL}', '/images/img-country-flag/', cd.flag) AS country_flag,
        ARRAY[pi.image_path] AS product_images
        ${cartqtyandid}
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
      ${cartJoin}
      WHERE p.status = $1 AND p.deleted_at IS NULL
      ${categories} ${searchQuery} ${countryFilter} ${priceFilter}
      GROUP BY p.id, c.cat_name, c.id, q.total_ordered_quantity_today, pi.image_path, pl.price, cd.id, cd.country_name ${cartgroupjoin}
      ${orderByClause}
      ${limitQuery}
    `;

    const getproductlist = await db.query(productquery, query_params);

    const overallproductcountquery = `
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
        CONCAT('${BASE_URL}', '/images/img-country-flag/', cd.flag) AS country_flag,
        ARRAY[pi.image_path] AS product_images
        ${cartqtyandid}
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
      ${cartJoin}
      WHERE p.status = $1 AND p.deleted_at IS NULL
      ${categories} ${searchQuery} ${countryFilter} ${priceFilter}
      GROUP BY p.id, c.cat_name, c.id, q.total_ordered_quantity_today, pi.image_path, pl.price, cd.id, cd.country_name ${cartgroupjoin}
      ${orderByClause}
    `;


    const getoverallproductlistCount = await db.query(overallproductcountquery, query_params_count);


    let cartListLength = 0;
    if (customerId) {
      const cartCountResult = await db.query(
        `SELECT COALESCE(SUM(qty), 0) AS cart_count
         FROM add_to_carts
         WHERE created_by = $1
         AND status = 1
         AND deleted_at IS NULL`,
        [customerId]
      );
      cartListLength = parseInt(cartCountResult.rows[0].cart_count) || 0;
    }

   const totalCount = parseInt(getproductlist.rowCount || 0);
    const totalPages = page ? Math.ceil(getoverallproductlistCount.rowCount / 10) : 1;
    const hasNextPage = page ? page < totalPages : false;

    return res.status(200).json({
      status: true,
      total: getproductlist.rowCount,
      message: "fetch Product list successfully",
      cartListLength: cartListLength,
      overallProductCount:getoverallproductlistCount.rowCount,
      data: getproductlist.rows,
      pagination: page
        ? {
            total_count: totalCount,
            total_pages: totalPages,
            current_page: parseInt(page),
            has_next_page: hasNextPage,
          }
        : null,
    });
  } catch (e) {
    return res.status(500).json({
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

    const existingCartItem = await addToCart.findOne({
      where: {
        product_id: product_id,
        created_by: req.user.id,
        status: 1,
      },
    });

    if (id == 0 && existingCartItem) {
      return res.status(200).json({
        status: false,
        message: "Product already exists in cart",
      });
    }

    if (qty <= 0) {
      const [updated] = await addToCart.update(
        {
          status: 0,
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

      return res.status(200).json({
        status: updated > 0,
        message:
          updated > 0 ? "Item deactivated successfully" : "Deactivation failed",
      });
    }

    let infoUpdate;
    let CartInfo;

    //if id is empty then product insert into cart otherwise update product qty in add_to_carts table
    if (!id || id == 0) {
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
          COALESCE(atc.pervoius_price::numeric, 0) AS pervoius_price,
         ARRAY[CONCAT('${BASE_URL}', pi.image_path)] AS product_image,
          atc.qty,
          p.price,
        c.cat_name AS category_name,
        cd.id AS country_id,
        cd.country_name,
        CONCAT('${BASE_URL}', '/images/img-country-flag/', cd.flag) AS country_flag
        FROM add_to_carts AS atc
        LEFT JOIN products AS p ON atc.product_id = p.id
        LEFT JOIN categories AS c ON p.category = c.id
        LEFT JOIN country_data AS cd ON p.country_id = cd.id
        LEFT JOIN LATERAL (
          SELECT image_path
          FROM product_images
          WHERE product_id = p.id
          ORDER BY id DESC
          LIMIT 1
        ) pi ON true
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
          acc.price += parseFloat(item.price) * parseInt(item.qty);
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
      errors: e.message,
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
      errors: e.message,
    });
  }
});

/******************* End product  Info ************************ */

/******************* Start Order creation Flow ************************ */
//place order
const create_order_bkp = catchAsync(async (req, res) => {
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
    // body("order_item")
    //   .isArray({ min: 1 })
    //   .withMessage("At least one order item is required")
    //   .run(req),
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

    let order_items = await db.query(
              `SELECT DISTINCT ON (atc.id)
                  atc.id as cart_id,
                  atc.product_id,
                  p.name AS product_name,
                  atc.qty,
                  p.price
                FROM add_to_carts AS atc
                LEFT JOIN products AS p ON atc.product_id = p.id
                LEFT JOIN categories AS c ON p.category = c.id
                LEFT JOIN country_data AS cd ON p.country_id = cd.id
                LEFT JOIN LATERAL (
                  SELECT image_path
                  FROM product_images
                  WHERE product_id = p.id
                  ORDER BY id DESC
                  LIMIT 1
                ) pi ON true
                WHERE atc.status = $1
                  AND atc.created_by = $2
                  AND atc.deleted_at IS NULL
              `,
          [1, customer_id]
        );

    if(order_items.rowCount == 0){
        return res.status(200).json({
        status: false,
        message: "There are no items in your cart yet.",
      });
    }

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

    if (order_id.id) {
      for (let item of order_items.rows) {
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
      // console.log("final_address", final_address);
    } else if (delivery_option_id == 2) {
      getaddres = await db.query(
        `select store_address from store_self_locations where status=$1 `,
        ["1"]
      );
      final_address = getaddres.rows[0]?.store_address || "";
      // console.log("final_address", final_address);
    }

    // send conformation mail with pdf attach invoice
    await sendOrderConfirmation(
      req,
      email,
      name,
      final_address,
      order_items.rows.map((item) => ({
        name: item.product_name,
        quantity: item.qty,
        price: item.price,
      })),
      order_id.id
    );

    return res.status(200).json({
      status: true,
      message: "Order Place Successfully",
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Failed to retrieve data",
      errors: error.message,
    });
  }
});

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
    // body("order_item")
    //   .isArray({ min: 1 })
    //   .withMessage("At least one order item is required")
    //   .run(req),
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
      // console.log("final_address", final_address);
    } else if (delivery_option_id == 2) {
      getaddres = await db.query(
        `select store_address from store_self_locations where status=$1 `,
        ["1"]
      );
      final_address = getaddres.rows[0]?.store_address || "";
      // console.log("final_address", final_address);
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
      message: "Order Place Successfully",
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

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  try {
    const customer_id = req.user.id;
    const { status, filter_date, sort_by_price, page, search } = req.body;

    let queryParams = [customer_id, 1, 1];
    let countParams = [...queryParams];
    let statusCondition = "";
    let dateCondition = "";
    let orderByClause = "";
    let paginationClause = "";
    let wildcardSearch = "";
    let searchQuery = "";

    if (parseInt(status) !== 0) {
      statusCondition = `AND o.order_status = $${queryParams.length + 1}`;
      queryParams.push(status);
      countParams.push(status);
    }

    if (filter_date && filter_date.includes(" - ")) {
      const [startDateStr, endDateStr] = filter_date.split(" - ");
      const startDate = new Date(startDateStr.split("-").reverse().join("-"));
      const endDate = new Date(endDateStr.split("-").reverse().join("-"));

      if (!isNaN(startDate) && !isNaN(endDate)) {
        dateCondition = `AND o.perferred_delivery_date BETWEEN $${
          queryParams.length + 1
        } AND $${queryParams.length + 2}`;
        queryParams.push(startDate, endDate);
        countParams.push(startDate, endDate);
      }
    }

    if (sort_by_price === "low_to_high") {
      orderByClause = `SUM(oi.quantity * oi.price::numeric) ASC`;
    } else if (sort_by_price === "high_to_low") {
      orderByClause = `SUM(oi.quantity * oi.price::numeric) DESC`;
    }

    const pageNum = parseInt(page);
    const isPaginationEnabled = pageNum && pageNum > 0;
    const limit = 10;
    const offset = (pageNum - 1) * limit;

    if (isPaginationEnabled) {
      paginationClause = `LIMIT $${queryParams.length + 1} OFFSET $${
        queryParams.length + 2
      }`;
      queryParams.push(limit, offset);
    }

    if (search) {
      wildcardSearch = `%${search.toLowerCase()}%`;
      searchQuery = `AND lower(p.name) LIKE $${queryParams.length + 1}`;
      queryParams.push(wildcardSearch);
    }

    const result = await db.query(
      `
      SELECT
        o.id AS order_id,
        o.order_ref_id AS order_number,
        TO_CHAR(o.perferred_delivery_date, 'FMDDth FMMonth YYYY') AS expected_date,
        SUM(oi.quantity * oi.price::numeric) AS total_price,
        TO_CHAR(o.created_at, 'FMDDth FMMonth YYYY') AS order_placed,
        SUM(oi.quantity) AS total_item,
        TO_CHAR(o.cancelled_date, 'DD/MM/YYYY') AS cancelled_date,
        o.order_status,
        o.delivery_date AS delivery_date,
        CASE o.order_status
          WHEN 1 THEN 'Pending'
          WHEN 2 THEN 'Confirmed'
          WHEN 3 THEN 'Shipped'
          WHEN 4 THEN 'Delivered'
          WHEN 5 THEN 'Cancelled'
          ELSE 'Unknown'
        END AS order_status_text,
        CASE o.delivery_option_id
          WHEN 1 THEN CONCAT(ca.address1, ca.address2)
          WHEN 2 THEN sl.store_address
        END AS address,
    CASE o.delivery_option_id WHEN 1 THEN ca.address1 ELSE sl.store_address END AS address_1,
    CASE o.delivery_option_id WHEN 1 THEN ca.address2 ELSE NULL END AS address_2,
    CASE o.delivery_option_id WHEN 1 THEN ca.full_name ELSE sl.store_name END AS full_name,
    CASE o.delivery_option_id WHEN 1 THEN ca.mobile_number ELSE '988765533' END AS mobile_number,
    CASE o.delivery_option_id
      WHEN 1 THEN ca.zip_code
      WHEN 2 THEN sl.store_pincode
    END AS zip_code,
    CASE o.delivery_option_id
      WHEN 1 THEN ca.country
      WHEN 2 THEN 'India'
    END AS country,
    CASE o.delivery_option_id
      WHEN 1 THEN ca.city
      WHEN 2 THEN 'Mumbai'
    END AS city,
    CASE o.delivery_option_id
      WHEN 1 THEN ca.state
      WHEN 2 THEN 'Maharashtra'
    END AS state,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'product_id', p.id,
            'product_name', p.name,
            'description', p.description,
            'category', c.cat_name,
            'quantity', oi.quantity,
            'price', oi.price,
            'total_price', oi.quantity * oi.price,
            'product_image', (
              SELECT CONCAT('${BASE_URL}', pi.image_path)
              FROM product_images pi
              WHERE pi.product_id = p.id AND pi.image_path IS NOT NULL
              ORDER BY pi.created_at DESC NULLS LAST
              LIMIT 1
            )
          )
        ) AS products
      FROM orders o
      LEFT JOIN customer_addresses ca ON o.address = ca.id
      LEFT JOIN store_self_locations sl ON o.address = sl.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category = c.id
      WHERE o.customer_id = $1
        ${statusCondition}
        AND oi.order_item_status = $2
        AND o.status = $3
        ${dateCondition}
        ${searchQuery}
      GROUP BY o.id, o.perferred_delivery_date, ca.address1, ca.address2,
               ca.full_name, ca.mobile_number, ca.zip_code, ca.country,
               ca.city, ca.state,
               sl.store_address, sl.store_pincode,sl.store_name
      ORDER BY ${orderByClause ? ` ${orderByClause}` : 'o.id DESC'}
      ${paginationClause}
      `,
      queryParams
    );

    // Get total count for pagination
    const countResult = isPaginationEnabled
      ? await db.query(
          `
          SELECT COUNT(DISTINCT o.id) AS total_count
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.customer_id = $1
            ${statusCondition}
            AND oi.order_item_status = $2
            AND o.status = $3
            ${dateCondition}
          `,
          countParams
        )
      : { rows: [{ total_count: result.rowCount }] };

    const totalCount = parseInt(countResult.rows[0]?.total_count || 0);
    const totalPages = isPaginationEnabled ? Math.ceil(totalCount / limit) : 1;
    const hasNextPage = isPaginationEnabled ? pageNum < totalPages : false;

    return res.status(200).json({
      status: true,
      message: "Fetch Order History Successfully",
      data: result.rowCount > 0 ? result.rows : [],
      pagination: isPaginationEnabled
        ? {
            total_count: totalCount,
            total_pages: totalPages,
            current_page: pageNum,
            has_next_page: hasNextPage,
          }
        : null,
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
    TO_CHAR(o.perferred_delivery_date, 'FMDDth FMMonth YYYY') AS delivery_date,
     CASE o.delivery_option_id
          WHEN 1 THEN CONCAT(ca.address1,' ', ca.address2)
          WHEN 2 THEN sl.store_address
        END AS address,
    CASE o.delivery_option_id WHEN 1 THEN ca.address1 ELSE sl.store_address END AS address_1,
    CASE o.delivery_option_id WHEN 1 THEN ca.address2 ELSE NULL END AS address_2,
    CASE o.delivery_option_id WHEN 1 THEN ca.full_name ELSE sl.store_name END AS full_name,
    CASE o.delivery_option_id WHEN 1 THEN ca.mobile_number ELSE '988765533' END AS mobile_number,
    CASE o.delivery_option_id
      WHEN 1 THEN ca.zip_code
      WHEN 2 THEN sl.store_pincode
    END AS zip_code,
    CASE o.delivery_option_id
      WHEN 1 THEN ca.country
      WHEN 2 THEN 'India'
    END AS country,
    CASE o.delivery_option_id
      WHEN 1 THEN ca.city
      WHEN 2 THEN 'Mumbai'
    END AS city,
    CASE o.delivery_option_id
      WHEN 1 THEN ca.state
      WHEN 2 THEN 'Maharashtra'
    END AS state,
    o.address as orders_address_id
    FROM orders AS o
    LEFT JOIN customer_addresses as ca ON o.address = ca.id
    LEFT JOIN store_self_locations sl ON o.address = sl.id
    WHERE o.customer_id = $1 AND o.id=$2`,
      [customer_id, order_id]
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
  SELECT CONCAT('${BASE_URL}', pi.image_path)
  FROM product_images pi
  WHERE pi.product_id = p.id AND pi.image_path IS NOT NULL
  ORDER BY pi.id DESC
  LIMIT 1
) AS product_image

      FROM order_items AS oi
      LEFT JOIN products AS p ON oi.product_id = p.id
      WHERE oi.order_id = $1 And oi.order_item_status = $2 AND oi.customer_id=$3
      GROUP BY oi.id,p.id,p.description`,
      [order_id, 1, req.user.id]
    );

    let Sumoflist;
    if (order_item.rowCount > 0) {
      if (order_item.rowCount > 0) {
        Sumoflist = order_item.rows.reduce(
          (acc, item) => {
            acc.qty += parseFloat(item.product_quantity) || 0;
            acc.price += parseFloat(item.total_price) || 0;
            return acc;
          },
          { qty: 0, price: 0 }
        );

        // Keep 2 decimal places and convert back to number
        Sumoflist.price = parseFloat(Sumoflist.price.toFixed(2));
      }
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

const get_categories_based_product = catchAsync(async (req, res) => {

  try {
    const result = await db.query(
      `SELECT
    c.id AS cat_id,
        c.cat_name AS category_name,
        c.slug,
        COALESCE(c.description, '') AS description,
        COUNT(p.id) AS no_of_products
    FROM categories AS c
    LEFT JOIN products AS p ON c.id = p.category
    WHERE c.status = $1 AND c.deleted_at IS NULL
    GROUP BY c.id, c.cat_name, c.slug, c.description
    ORDER BY no_of_products DESC LIMIT 4
    `,[1]
    );

    return res.status(200).json({
      status: true,
      message: "Fetch category based product Details Successfully",
      data:(result.rowCount) > 0 ? result.rows : [],
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Failed to retrieve data",
      errors: error.message,
    });
  }
});

const get_country_based_product = catchAsync(async (req, res) => {

  try {
    const result = await db.query(
      `SELECT
        c.id AS country_id,
        c.country_name AS country_name,
        COUNT(p.id) AS no_of_products
    FROM country_data AS c
    LEFT JOIN products AS p ON c.id = p.country_id
    WHERE c.status = $1 AND c.deleted_at IS NULL
    GROUP BY c.id, c.country_name
    ORDER BY no_of_products DESC
      LIMIT 4
  `,[1]
    );

     return res.status(200).json({
      status: true,
      message: "Fetch country based product Details Successfully",
      data:(result.rowCount) > 0 ? result.rows : [],
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Failed to retrieve data",
      errors: error.message,
    });
  }
});

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
//  footer
  get_categories_based_product,
  get_country_based_product
};
