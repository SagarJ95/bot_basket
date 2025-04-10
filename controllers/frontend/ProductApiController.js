// Defaults
import catchAsync from "../../utils/catchAsync.js";
import db from "../../config/db.js";
import Customer from "../../db/models/customers.js";
import addToCart from "../../db/models/add_to_carts.js";
import Orders from "../../db/models/orders.js";
import OrderItem from "../../db/models/order_items.js";
import bcrypt from "bcrypt";
import { body, validationResult } from "express-validator";
import AppError from "../../utils/appError.js";
// import { now } from "moment";
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
/******************* category  Info ************************ */

/******************* product  Info ************************ */

const recommended_products = catchAsync(async (req, res) => {
  try {
    const getproductlist = await db.query(
      `select
      p.id,p.name as product_name,p.slug,p.description,p.price,c.cat_name as category_name,
       JSON_AGG(
          CONCAT('${BASE_URL}', pi.image_path)
      ) FILTER (WHERE pi.image_path IS NOT NULL) AS product_images
       from products as p
      left join categories as c ON p.category = c.id
      left join product_images as pi ON p.id = pi.product_id
      where p.status = $1 and p.deleted_at IS NULL
      GROUP BY p.id,c.cat_name`,
      [1]
    );

    return res.status(200).json({
      status: true,
      message: "fetch Product list sucessfully",
      data: getproductlist.rowCount > 0 ? getproductlist.rows : [],
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
    const { category_id, search } = req.body;
    let query_params = [1];
    let searchQuery = "";
    let categories = "";
    let wildcardSearch = "";

    if (category_id) {
      categories = `and p.category = $${query_params.length + 1}`;
      query_params.push(category_id);
    }

    if (search) {
      wildcardSearch = `%${search.toLowerCase()}%`;
      searchQuery = `AND lower(p.name) LIKE $${query_params.length + 1}`;
      query_params.push(wildcardSearch);
    }

    const productquery = `select
        p.id,p.name as product_name,p.slug,p.description,p.price,c.id as categoryId,c.cat_name as category_name,
         JSON_AGG(
            CONCAT('${BASE_URL}', pi.image_path)
        ) FILTER (WHERE pi.image_path IS NOT NULL) AS product_images
         from products as p
        left join categories as c ON p.category = c.id
        left join product_images as pi ON p.id = pi.product_id
        where p.status = $1 and p.deleted_at IS NULL ${categories} ${searchQuery}
        GROUP BY p.id,c.cat_name,c.id`;

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
      errors: error.message,
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
    body("price").notEmpty().withMessage("Price is required").run(req),
  ]);

  // Handle validation result
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  try {
    const { id, product_id, qty, price } = req.body;

    let infoUpdate;
    let CartInfo;
    //if id is empty then product insert into cart otherwise update product qty in add_to_carts table
    if (!id && id == 0) {
      CartInfo = await addToCart.create({
        product_id,
        qty,
        price,
        created_by: req.user.id,
        status: 1,
      });

      infoUpdate = "Add";
    } else {
      CartInfo = await addToCart.update(
        {
          qty: qty,
          price: price,
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
    } = req.body;

    const order_id = await Orders.create({
      customer_id: customer_id,
      order_ref_id: "00001",
      customer_name: name,
      whatsapp_number: whatsapp_number,
      email: email,
      perferred_delivery_date: perferred_delivery_date,
      address: address,
      special_instruction: instruction,
      status: 1,
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
      `SELECT
    o.id,
    oi.product_id,
    TO_CHAR(o.perferred_delivery_date, 'FMDDth Month YYYY') AS delivery_date,
    p.name AS product_name,
    p.description,
    (
      SELECT JSON_AGG(DISTINCT CONCAT('${BASE_URL}', pi.image_path))
      FROM product_images pi
      WHERE pi.product_id = p.id AND pi.image_path IS NOT NULL
    ) AS product_images,
    SUM(oi.quantity * oi.price::numeric) AS total_price
    FROM orders AS o
    LEFT JOIN order_items AS oi ON o.id = oi.order_id
    LEFT JOIN products AS p ON oi.product_id = p.id
    WHERE o.customer_id = $1 AND o.status = $2 and oi.order_item_status = $3
    GROUP BY p.id,o.id, oi.product_id, o.perferred_delivery_date, p.name, p.description`,
      [customer_id, status, 1]
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
      data: items,
    });

    // if (getoder.rowCount.length > 0) {
    // res.status(200).json({
    //   status: true,
    //   message: "order fatch successfully!",
    //   data: getoder.rows,
    // });
    // }
  } catch (error) {
    res.status(400).json({
      status: false,
      message: error.message,
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
    ca.address as address,
    o.address as address_id
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

    return res.status(200).json({
      status: true,
      message: "Fetch Order Details Successfully",
      data:
        result.rowCount > 0
          ? {
              ...result.rows[0],
              order_items: order_item.rows,
            }
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
};
