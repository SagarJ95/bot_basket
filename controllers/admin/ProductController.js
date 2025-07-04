import dotenv from "dotenv";
dotenv.config({ path: `${process.cwd()}/.env` });

// Defaults
import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import {
  generateSlug,
  media_url,
  formatValidationArray,
} from "../../helpers/slug_helper.js";
import Category from "../../db/models/category.js";
import Product from "../../db/models/products.js";
import Product_images from "../../db/models/product_images.js";
import Products_price_logs from "../../db/models/products_price_logs.js";

import { body, validationResult } from "express-validator";
import { Op, QueryTypes, Sequelize } from "sequelize";
import { compare } from "bcrypt";
import bcrypt from "bcrypt";
import sequelize from "../../config/database.js";
import moment from "moment";
import db from "../../config/db.js";
import adminLog from "../../helpers/admin_log.js";
import csvjson from "csvjson";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { format } from "fast-csv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import XLSX from "xlsx";
import axios from "axios";
const BASE_URL = process.env.BASE_URL || "http://localhost:3848";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IMAGE_FOLDER = "public/uploads/product_images";
const FALLBACK_IMAGE = "uploads/product_images/default.png";

/* Product API Start ------------------------------- */
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

const getProductlist = catchAsync(async (req, res) => {
  try {
    const { category_id, country_id, page, search } = req.body;
    const query_params = [];
    const total_query_params = [];

    let categories = "";
    let countries = "";
    let pageCountQuery = "";
    let searchQuery = ``;

    if (category_id) {
      categories = `and p.category = $${query_params.length + 1}`;
      query_params.push(category_id);
      total_query_params.push(category_id);
    }

    if (country_id) {
      countries = `and p.country_id = $${query_params.length + 1}`;
      query_params.push(country_id);
      total_query_params.push(country_id);
    }

    if (search) {
      searchQuery = `and p.name ILIKE $${query_params.length + 1}`;
      query_params.push(`%${search}%`);
      total_query_params.push(`%${search}%`);
    }

    if (page) {
      let pageCount = (page - 1) * 10;
      pageCountQuery = `LIMIT $${query_params.length + 1} OFFSET $${
        query_params.length + 2
      }`;
      query_params.push(10, pageCount);
    }

    //get total number of products
    const totalCountQuery = `
            SELECT COUNT(*) AS total
            FROM products AS p
            LEFT JOIN categories AS c ON p.category = c.id
            LEFT JOIN country_data AS ca ON p.country_id = ca.id
            WHERE  p.deleted_at IS NULL
            ${categories}
            ${countries}
            ${searchQuery}
        `;

    const totalProducts = await db.query(totalCountQuery, total_query_params);

    //get get product list
    const query = `SELECT
                           p.id AS product_id,
                           p.name AS product_name,
                           c.cat_name AS category_name,
                           p.price AS current_price,
                           CONCAT('${BASE_URL}/images/img-country-flag/', ca.flag) AS country_flag,
                           p.category AS category_id,
                           p.country_id AS country_id,
                           ca.country_name,
                           TO_CHAR(ppl.upload_date, 'FMDD FMMonth YYYY') AS last_updated_date,
                           p.product_stock_status,
                           p.status
                       FROM products AS p
                       LEFT JOIN categories AS c ON p.category = c.id
                       LEFT JOIN country_data AS ca ON p.country_id = ca.id
                       LEFT JOIN (
                           SELECT DISTINCT ON (product_id) product_id, upload_date
                           FROM products_price_logs
                           ORDER BY product_id, upload_date DESC
                       ) AS ppl ON p.id = ppl.product_id

                       WHERE p.deleted_at IS NULL ${categories} ${countries} ${searchQuery} ORDER BY p.id desc ${pageCountQuery}`;

    const getProductslist = await db.query(query, query_params);

    return res.status(200).json({
      status: true,
      total:
        totalProducts.rowCount > 0 ? parseInt(totalProducts.rows[0].total) : 0,
      message: "Fetch Product Successfully",
      data: getProductslist.rowCount > 0 ? getProductslist.rows : [],
    });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

const countries = catchAsync(async (req, res) => {
  try {
    const query = `select c.id,c.country_name,c.code1 as code,CONCAT('${BASE_URL}/images/img-country-flag/',c.flag) from country_data as c where c.status = 1`;

    const getCountrylist = await db.query(query, []);

    return res.status(200).json({
      status: true,
      message: "Fetch Countries Successfully",
      data: getCountrylist.rowCount > 0 ? getCountrylist.rows : [],
    });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

const createProduct = catchAsync(async (req, res) => {
  // Apply validation rules
  await Promise.all([
    body("name").notEmpty().withMessage("Name is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("category").notEmpty().withMessage("Category is required"),
    body("countryId").notEmpty().withMessage("Country is required"),
    body("minimum_order_place")
      .notEmpty()
      .withMessage("minimum order is required"),
    body("maximum_order_place")
      .notEmpty()
      .withMessage("maximum order is required"),
    body("price").notEmpty().withMessage("Price is required"),
    body("thumbnail_product_image")
      .notEmpty()
      .withMessage("Thumbnail image is required"),
  ]);

  // Handle validation result
  const errors = validationResult(req);
  try {
    const body = req.body;
    const files = req.files;

    if (
      !files ||
      !files.thumbnail_product_image ||
      files.thumbnail_product_image.length === 0
    ) {
      errors.errors.push({
        msg: "Please upload thumbnail product image",
        path: "thumbnail_product_image",
      });
    }

    if (!files || !files.product_images || files.product_images.length === 0) {
      errors.errors.push({
        msg: "Please upload product image",
        path: "product_images",
      });
    }

    // After validationResult()
    const existing = await Product.findOne({
      where: {
        name: req.body.name,
        category: req.body.category,
        deleted_at: null,
      },
    });

    if (existing) {
      errors.errors.push({
        msg: "A product with the same name and category already exists",
        path: "name",
      });
    }

    if (!errors.isEmpty()) {
      const formattedErrors = await formatValidationArray(errors);
      return res.status(200).json({ status: false, errors: formattedErrors });
    }

    let OrderingId = 0;
    // Get the current highest ordering
    const getCountOrdering = await db.query(
      "SELECT * FROM products where deleted_at IS NULL ORDER BY ordering DESC LIMIT 1"
    );

    if (getCountOrdering.rows.length > 0) {
      OrderingId = getCountOrdering.rows[0].ordering;
    }

    //insert thumbnail product image
    const thumbnail_images =
      files && files.thumbnail_product_image
        ? files.thumbnail_product_image
        : [];

    const product = await Product.create({
      name: capitalizeFirstLetter(body.name?.trim() || ""),
      slug: generateSlug(body.name),
      description: body.description,
      minimum_order_place: body.minimum_order_place,
      maximum_order_place: body.maximum_order_place,
      price: body.price,
      country_id: body.countryId,
      thumbnail_product_image:
        thumbnail_images.length > 0
          ? media_url(thumbnail_images[0]?.path)
          : null,
      category: body.category,
      created_by: req.user.id,
      ordering: OrderingId ? parseInt(OrderingId) + 1 : 1,
      status: 1,
    });

    const product_id = product.id;

    if (!product) {
      return res
        .status(200)
        .json({ status: false, message: "Product created unsuccessfully" });
    }

    const images = files && files.product_images ? files.product_images : [];

    if (images.length > 0) {
      for (const img of images) {
        await Product_images.create({
          product_id: product_id,
          image_path: media_url(img.path),
        });
      }
    }

    //get country name
    const countryName = await db.query(
      `select id from country_data where id = ${body.countryId}`
    );

    //product price list log
    await db.query(
      `INSERT INTO products_price_logs (product_id,price,country_id,country_name,upload_date,maximum_quantity
        ,created_by,created_at,updated_by,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        product_id,
        body.price,
        body.countryId,
        countryName?.rows[0].id,
        moment(new Date()).format("YYYY-MM-DD"),
        body.maximum_order_place,
        req.user.id,
        new Date(),
        req.user.id,
        new Date(),
      ]
    );

    const data = {
      user_id: req.user.id,
      table_id: product.id,
      table_name: "products",
      action: "insert",
    };

    adminLog(data);

    return res
      .status(200)
      .json({ status: true, message: "Product created successfully" });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Product not created",
      error: error.message,
    });
  }
});

const updateProduct = catchAsync(async (req, res) => {
  // Apply validation rules
  await Promise.all([
    body("name").notEmpty().withMessage("Name is required").run(req),
    body("category").notEmpty().withMessage("Category is required").run(req),
    body("countryId").notEmpty().withMessage("Country is required"),
    body("minimum_order_place")
      .notEmpty()
      .withMessage("minimum order is required"),
    body("maximum_order_place")
      .notEmpty()
      .withMessage("maximum order is required"),
    body("thumbnail_product_image")
      .notEmpty()
      .withMessage("Thumbnail image is required"),
  ]);

  const errors = validationResult(req);

  try {
    const productId = req.body.product_id;
    const body = req.body;
    const files = req.files;

    const product = await Product.findOne({
      where: { id: productId, deleted_at: null },
    });

    if (
      !files ||
      !files.thumbnail_product_image ||
      files.thumbnail_product_image.length === 0
    ) {
      errors.errors.push({
        msg: "Please upload thumbnail product image",
        path: "thumbnail_product_image",
      });
    }

    if (!product) {
      return res
        .status(404)
        .json({ status: false, message: "Product not found" });
    }

    const existing = await Product.findOne({
      where: {
        name: req.body.name,
        category: req.body.category,
        deleted_at: null,
        id: { [Op.ne]: productId }, // Exclude current product
      },
    });

    if (existing) {
      return res.status(200).json({ status: false, message: "A product with the same name and category already exists" });
      // errors.errors.push({
      //   msg: "A product with the same name and category already exists",
      //   path: "name",
      // });
    }

    if (!errors.isEmpty()) {
      const formattedErrors = await formatValidationArray(errors);
      return res.status(200).json({ status: false, errors: formattedErrors });
    }

    const thumbnail_images =
      files && files.thumbnail_product_image
        ? files.thumbnail_product_image
        : [];

    // Update product fields
    await Product.update(
      {
        name: capitalizeFirstLetter(body.name?.trim() || ""),
        slug: generateSlug(body.name),
        minimum_order_place: body.minimum_order_place,
        maximum_order_place: body.maximum_order_place,
        price: body.price,
        description: body.description,
        country_id: body.countryId,
        thumbnail_product_image:
          thumbnail_images.length > 0
            ? media_url(thumbnail_images[0]?.path)
            : null,
        category: body.category,
        updated_by: req.user.id,
      },
      {
        where: { id: productId },
      }
    );

    // Handle product images
    const images = files && files.product_images ? files.product_images : [];

    if (images.length > 0) {
      // Optional: delete old images first (if you want to replace them)
      await Product_images.destroy({ where: { product_id: productId } });

      // Then add new images
      for (const img of images) {
        await Product_images.create({
          product_id: productId,
          image_path: media_url(img.path),
        });
      }
    }

    //update log price change
    await db.query(
      `UPDATE products_price_logs SET maximum_quantity = $1 , price = $2, updated_by = $3 , updated_at = $4
            WHERE product_id = $5 AND upload_date = $6`,
      [
        body.maximum_order_place,
        body.price,
        req.user.id,
        new Date(),
        productId,
        moment(new Date()).format("YYYY-MM-DD"),
      ]
    );

    // Optional: log price change
    // if (product.price != body.price) {
    //     await Products_price_logs.create({
    //         product_id: productId,
    //         price: body.price,
    //         created_by: req.user.id,
    //         updated_by: req.user.id
    //     });
    // }
    // Log admin action
    const data = {
      user_id: req.user.id,
      table_id: product.id,
      table_name: "products",
      action: "update",
    };

    adminLog(data);

    return res
      .status(200)
      .json({ status: true, message: "Product updated successfully" });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Product updated unsuccessfully",
      error: error.message,
    });
  }
});

const getProductById = catchAsync(async (req, res) => {
  await Promise.all([
    body("id").notEmpty().withMessage("Product ID is required").run(req),
  ]);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // const formattedErrors = await formatValidationArray(errors);
    // return res.status(200).json({ status: false, errors: formattedErrors });
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  try {
    const productId = parseInt(req.body.id);

    if (isNaN(productId)) {
      return res
        .status(200)
        .json({ status: false, message: "Invalid Product ID", error: "" });
    }

    const query = `
            SELECT
                p.id,
                p.name,
                p.slug,
                p.description,
                p.category,
                p.status,
                p.country_id,
                p.minimum_order_place,
                p.maximum_order_place,
                p.price,
                COALESCE(
                    JSON_AGG(
                        CASE
                            WHEN pi.image_path IS NOT NULL THEN CONCAT('${BASE_URL}', pi.image_path)
                        END
                    ) FILTER (WHERE pi.image_path IS NOT NULL),
                    '[]'
                ) AS product_images,
                 CONCAT('${BASE_URL}', p.thumbnail_product_image) as thumbnail_product_image
            FROM products p
            LEFT JOIN product_images pi ON pi.product_id = p.id  And pi.deleted_at IS NULL
            WHERE p.deleted_at IS NULL AND p.id = $1
            GROUP BY p.id
        `;

    const result = await db.query(query, [productId]);

    if (result.rowCount <= 0) {
      return res
        .status(200)
        .json({ status: false, message: "Fetch product info unsuccessfully", error: "" });
    }

    return res.status(200).json({
      status: true,
      message: "Fetch product info successful",
      data: result.rows,
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Product Not Found",
      error: error.message,
    });
  }
});

const deleteProductById = catchAsync(async (req, res) => {
  await Promise.all([
    body("id").notEmpty().withMessage("Product ID is required").run(req),
  ]);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = await formatValidationArray(errors);
    return res.status(200).json({ status: false, errors: formattedErrors });
  }

  try {
    const productId = parseInt(req.body.id);

    if (isNaN(productId)) {
      return res
        .status(200)
        .json({ status: false, message: "Invalid Product ID", error: "" });
    }

    const result = await Product.findByPk(productId);

    if (!result) {
      return res
        .status(200)
        .json({ status: false, message: "Product deleted unsuccessfully", error: "" });
    }

    await result.destroy(); // uses Sequelize's soft delete (paranoid)

    const data = {
      user_id: req.user.id,
      table_id: productId,
      table_name: "products",
      action: "delete",
    };

    adminLog(data);

    return res
      .status(200)
      .json({ status: true, message: "Product deleted successfully" });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Product not deleted",
      error: error.message,
    });
  }
});

const updateProductStatusById = catchAsync(async (req, res) => {
  await Promise.all([
    body("id").notEmpty().withMessage("Product ID is required").run(req),
    body("status").notEmpty().withMessage("status is required").run(req),
  ]);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  try {
    const productId = parseInt(req.body.id);
    const status = parseInt(req.body.status);

    if (isNaN(productId) || isNaN(status)) {
      return res.status(200).json({
        status: false,
        message: "Invalid Product ID or Status",
        error: "",
      });
    }

    const updated = await Product.update(
      {
        status: status,
        updated_by: req.user.id,
      },
      {
        where: { id: productId },
      }
    );

    if (!updated || updated[0] === 0) {
      return res.status(200).json({
        status: false,
        message: "Product status updated unsuccessfully",
        error: "",
      });
    }

    const data = {
      user_id: req.user.id,
      table_id: productId,
      table_name: "products",
      action: "status to " + status,
    };

    adminLog(data);

    return res
      .status(200)
      .json({ status: true, message: "Product status updated successfully" });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Product status updated unsuccessfully",
      error: error.message,
    });
  }
});

const changeProductStockStatus = catchAsync(async (req, res) => {
  try {
    await Promise.all([
      body("product_id")
        .notEmpty()
        .withMessage("Product ID is required")
        .run(req),
      body("product_stock_status")
        .notEmpty()
        .withMessage("Product stock status is required")
        .run(req),
    ]);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = await formatValidationArray(errors);
      return res.status(200).json({ status: false, errors: formattedErrors });
    }

    const productId = parseInt(req.body.product_id);
    const product_stock_status = parseInt(req.body.product_stock_status);

    if (isNaN(productId) || isNaN(product_stock_status)) {
      return res.status(200).json({
        status: false,
        message: "Invalid Product ID or Stock Status",
        error: "",
      });
    }

    const updated = await Product.update(
      {
        product_stock_status: product_stock_status,
        updated_by: req.user.id,
      },
      {
        where: { id: productId },
      }
    );

    if (!updated || updated[0] === 0) {
      return res.status(200).json({
        status: false,
        message: "Product Stock status not updated",
        error: "",
      });
    }

    const data = {
      user_id: req.user.id,
      table_id: productId,
      table_name: "products",
      action: "stock status to " + product_stock_status,
    };

    adminLog(data);

    return res.status(200).json({
      status: true,
      message: "Product stock status updated successfully",
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Product stock status not updated",
      error: error.message,
    });
  }
});

//excel export products
const excelExportProducts = catchAsync(async (req, res) => {
  try {
    const { category_id } = req.body;

    // Query database
    let query = `SELECT
                p.id,
                p.name,
                p.slug,
                p.description,
                p.minimum_order_place,
                p.maximum_order_place,
                p.price,
                ci.cat_name as category,
                p.status,
                c.country_name,
                CONCAT('${BASE_URL}',p.thumbnail_product_image) as thumbnail_product_image,
                COALESCE(
                    JSON_AGG(
                        CASE
                            WHEN pi.image_path IS NOT NULL THEN CONCAT('${BASE_URL}', pi.image_path)
                        END
                    ) FILTER (WHERE pi.image_path IS NOT NULL),
                    '[]'
                ) AS product_images
            FROM products p
            LEFT JOIN product_images pi ON pi.product_id = p.id
            LEFT JOIN categories ci ON p.category = ci.id
            LEFT JOIN country_data as c ON p.country_id = c.id
            WHERE p.deleted_at IS NULL
        `;

    const values = [];

    // Add category filter if category_id is provided and not empty
    if (category_id) {
      query += ` AND p.category = $1`;
      values.push(category_id);
    }

    query += ` GROUP BY p.id, ci.cat_name, c.country_name ORDER BY p.id ASC`;

    const result = await db.query(query, values);
    let list = result.rows;

    // Create Excel file
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Products");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Product Name", key: "name", width: 25 },
      { header: "Slug", key: "slug", width: 25 },
      { header: "Description", key: "description", width: 40 },
      { header: "Minimum_order", key: "minimum_order_place", width: 40 },
      { header: "Maximum_order", key: "maximum_order_place", width: 40 },
      { header: "Price", key: "price", width: 40 },
      { header: "Thumbnail Image", key: "thumbnail_product_image", width: 40 },
      { header: "Images", key: "product_images", width: 40 },
      { header: "Category", key: "category", width: 15 },
      { header: "Country Name", key: "country_name", width: 20 },
      { header: "Status", key: "status", width: 10 },
    ];

    list.forEach((row) => {
      worksheet.addRow({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        minimum_order_place: row.minimum_order_place,
        maximum_order_place: row.maximum_order_place,
        price: row.price,
        thumbnail_product_image: row.thumbnail_product_image,
        description: row.description,
        country_name: row.country_name,
        category: row.category,
        status: row.status == 1 ? "Active" : "Inactive",
        product_images: (row.product_images || []).join(", "),
      });
    });

    // Generate file name and path
    const dateTime = moment().tz("Asia/Kolkata").format("YYYY-MM-DD_HH-mm-ss");
    const fileName = `product_list_${dateTime}.xlsx`;
    const filePath = path.join(
      process.cwd(),
      "public/uploads/exports",
      fileName
    );

    // Ensure directory exists
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    // Save Excel file
    await workbook.xlsx.writeFile(filePath);

    // Send file path as response
    return res.json({
      status: true,
      message:"Export Products list successfully",
      data: BASE_URL + `/uploads/exports/${fileName}`,
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

/*****************************************  Export and Import product for change price *********************/

//export product list for update price change
const excelExportProductsInfo = catchAsync(async (req, res) => {
  try {
    const query = `
      SELECT
        p.id,
        p.name,
        c.id as country_id,
        c.country_name,
        p.price,
        p.maximum_order_place
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id
      LEFT JOIN country_data as c ON p.country_id = c.id
      WHERE p.status = $1 AND p.deleted_at IS NULL
      GROUP BY p.id, c.id, p.maximum_order_place
      ORDER BY p.id ASC
    `;

    const result = await db.query(query, [1]);
    const list = result?.rows ?? [];

    const dateFormat = moment().format("YYYY-MM-DD_HH-mm-ss");
    const fileName = `price_change_product_list_${dateFormat}.csv`;
    const exportDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "exports_product"
    );
    const filePath = path.join(exportDir, fileName);

    // Ensure export directory exists
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(filePath);
    const csvStream = format({ headers: true });

    csvStream.pipe(writeStream);

    list.forEach(({ id, name, country_name, maximum_order_place, price }) => {
      csvStream.write({
        Product_Id: id,
        Product_Name: name,
        Country_Name: country_name,
        Max_Quantity: maximum_order_place,
        Price: price,
      });
    });

    csvStream.end();

    writeStream.on("finish", () => {
      res.json({
        status: true,
        message:"Export excel successfully",
        data: `${BASE_URL}/uploads/exports_product/${fileName}`,
      });
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

//import product list for update price and store product log
const importProductListwithPrice = catchAsync(async (req, res) => {
  try {
    const uploadedFile = req.files["csv_file"]?.[0];
    if (!uploadedFile) {
      return res
        .status(400)
        .json({ status: false, message: "No file uploaded" });
    }

    const data = fs.readFileSync(uploadedFile.path, { encoding: "utf8" });
    const csvData = csvjson.toObject(data);

    const expectedHeaders = [
      "Product_Id",
      "Product_Name",
      "Country_Name",
      "Max_Quantity",
      "Price",
    ];

    if (csvData.length === 0) {
      return res.status(200).json({
        code: 2,
        status: false,
        msg: "Data Not Available in CSV",
      });
    }

    const actualHeaders = Object.keys(csvData[0] || {});
    const isValidFile = expectedHeaders.every((header) =>
      actualHeaders.includes(header)
    );

    if (!isValidFile) {
      return res.status(200).json({
        status: false,
        msg:
          "Invalid CSV format. Expected headers: " + expectedHeaders.join(", "),
      });
    }

    for (const record of csvData) {
      const product_id = record["Product_Id"];
      const max_quantity = record["Max_Quantity"] ? record["Max_Quantity"] : 0;
      const price = record["Price"] ? record["Price"] : 0;

      //update the price and maximum quantity in products table
      await db.query(
        `UPDATE products SET maximum_order_place = $1, price = $2, updated_by = $3, updated_at = $4 WHERE id = $5`,
        [max_quantity, price, req.user.id, new Date(), product_id]
      );

      //check country_name from table country_data
      const country_name = record["Country_Name"];
      const country_data = await db.query(
        `SELECT * FROM country_data WHERE country_name = $1`,
        [country_name]
      );
      const getCountryId =
        country_data.rowCount > 0 ? country_data.rows[0].id : "";

      //insert or update product_id,price,country_id,price,upload_date,maximum_quantity,upload_date
      const storeProductId = product_id ? parseInt(product_id) : 0;
      const storePrice = price ? parseInt(price) : 0;
      const storeCountryId = getCountryId ? parseInt(getCountryId) : null;
      const storeCountryName = country_name ? country_name : null;
      const storeMaxQuantity = max_quantity ? parseInt(max_quantity) : 0;
      const currentDate = moment(new Date()).format("YYYY-MM-DD");

      const checkProductAvailbleInProductLog = await db.query(
        `SELECT * FROM products_price_logs WHERE product_id = $1  AND upload_date = $2`,
        [storeProductId, currentDate]
      );

      if (checkProductAvailbleInProductLog.rowCount > 0) {
        //update the price and quantity in product_price_logs
        await db.query(
          `UPDATE products_price_logs SET maximum_quantity = $1 , price = $2, updated_by = $3 , updated_at = $4
                    WHERE product_id = $5 AND upload_date = $6`,
          [
            storeMaxQuantity,
            storePrice,
            req.user.id,
            new Date(),
            storeProductId,
            moment(new Date()).format("YYYY-MM-DD"),
          ]
        );
      } else {
        //Insert the price and quantity in product_price_logs
        await db.query(
          `INSERT INTO products_price_logs (product_id,price,country_id,country_name,upload_date,maximum_quantity
                ,created_by,created_at,updated_by,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            storeProductId,
            storePrice,
            storeCountryId,
            storeCountryName,
            moment(new Date()).format("YYYY-MM-DD"),
            storeMaxQuantity,
            req.user.id,
            new Date(),
            req.user.id,
            new Date(),
          ]
        );
      }
    }

    return res.status(200).json({
      status: true,
      msg: "Product list updated successfully",
    });

    // console.log("importData>>",csvData)
  } catch (e) {
    return res.status(200).json({
      status: false,
      message: "Internal Server Error",
      error: e.message,
    });
  }
});

/***************************************** End  Export product for change price *********************/

const getChangePriceProductlist = catchAsync(async (req, res) => {
  try {
    const { category_id, page, search, country_id } = req.body;
    const query_params = [1];
    const total_query_params = [1];
    let categories = "";
    let countries = "";
    let pageCountQuery = "";
    let searchQuery = ``;

    if (category_id) {
      categories = `and p.category = $${query_params.length + 1}`;
      query_params.push(category_id);
      total_query_params.push(category_id);
    }

    if (country_id) {
      countries = `and p.country_id = $${query_params.length + 1}`;
      query_params.push(country_id);
      total_query_params.push(country_id);
    }

    if (search) {
      searchQuery = `and p.name ILIKE $${query_params.length + 1}`;
      query_params.push(`%${search}%`);
      total_query_params.push(`%${search}%`);
    }

    if (page) {
      let pageCount = (page - 1) * 10;
      pageCountQuery = `LIMIT $${query_params.length + 1} OFFSET $${
        query_params.length + 2
      }`;
      query_params.push(10, pageCount);
    }

    const totalCountQuery = `
            SELECT
                            p.id,
                            p.name AS product_name,
                            c.id AS category_id,
                            c.cat_name AS category_name,
                            p.price AS current_price,
                            COALESCE(pp.price, 0) AS previous_price,
                            CONCAT('${BASE_URL}',p.thumbnail_product_image) as product_image,
                            CONCAT('${BASE_URL}/images/img-country-flag/',ca.flag) as country_flag,
                            CONCAT(ca.country_name,' (',ca.code1,') ') as country_name
                        FROM
                            products AS p
                        LEFT JOIN
                            categories AS c ON p.category = c.id
                        LEFT JOIN
                        country_data AS ca ON p.country_id = ca.id
                        LEFT JOIN LATERAL (
                            SELECT price
                            FROM products_price_logs
                            WHERE product_id = p.id
                            AND upload_date < CURRENT_DATE
                            ORDER BY upload_date DESC
                            LIMIT 1
                        ) AS pp ON true
                        WHERE
                            p.status = $1 And p.deleted_at IS NULL ${categories} ${countries} ${searchQuery}
                        ORDER BY
                            p.id ASC
        `;

    const totalProducts = await db.query(totalCountQuery, total_query_params);

    const query = `
                    SELECT
                            p.id,
                            p.name AS product_name,
                            c.id AS category_id,
                            c.cat_name AS category_name,
                            p.price AS current_price,
                            COALESCE(pp.price, 0) AS previous_price,
                            CONCAT('${BASE_URL}',p.thumbnail_product_image) as product_image,
                            CONCAT('${BASE_URL}/images/img-country-flag/',ca.flag) as country_flag,
                            CONCAT(ca.country_name,' (',ca.code1,') ') as country_name,
                            pp.upload_date as price_update_date
                        FROM
                            products AS p
                        LEFT JOIN
                            categories AS c ON p.category = c.id
                        LEFT JOIN
                        country_data AS ca ON p.country_id = ca.id
                        LEFT JOIN LATERAL (
                            SELECT price,upload_date
                            FROM products_price_logs
                            WHERE product_id = p.id
                            AND upload_date < CURRENT_DATE
                            ORDER BY upload_date DESC
                            LIMIT 1
                        ) AS pp ON true
                        WHERE
                            p.status = $1 And p.deleted_at IS NULL ${categories} ${countries} ${searchQuery}
                        ORDER BY
                            p.id ASC ${pageCountQuery}
            `;

    const result = await db.query(query, query_params);

    return res.status(200).json({
      status: true,
      total: totalProducts.rowCount > 0 ? parseInt(totalProducts.rowCount) : 0,
      message: "Fetch Change Price details successfully",
      data: result.rowCount > 0 ? result.rows : [],
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

const changeProductPrice = catchAsync(async (req, res) => {
  await Promise.all([
    body("product_id")
      .notEmpty()
      .withMessage("Product ID is required")
      .run(req),
    body("price").notEmpty().withMessage("Price is required").run(req),
  ]);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = await formatValidationArray(errors);
    return res.status(200).json({ status: false, errors: formattedErrors });
  }

  try {
    const productId = req.body.product_id;
    const price = req.body.price;

    //convert into array
    const arrayProductId = productId.split(",").map((id) => parseInt(id));

    const update_product = await db.query(
      `UPDATE products SET price= $1,updated_by=$2
          WHERE id =ANY($3)`,
      [price, req.user.id, arrayProductId]
    );

    for (const id of arrayProductId) {
      const isexistid = await db.query(
        `select * from products_price_logs where upload_date::date= $1 AND product_id=$2`,
        [moment(new Date()).format("YYYY-MM-DD"), id]
      );

      if (isexistid.rowCount > 0) {
        await db.query(
          `UPDATE products_price_logs SET price=$1,updated_by=$2,updated_at=$4
              WHERE product_id=$3 and upload_date::date= $5`,
          [price, req.user.id, id, new Date(),moment(new Date()).format("YYYY-MM-DD")]
        );
      } else {
        const getCountryId = await db.query(
          `select p.country_id,cd.country_name from products as p
              LEFT JOIN country_data as cd ON p.country_id=cd.id WHERE p.id=$1`,
          [id]
        );
        await db.query(
          `INSERT INTO products_price_logs
            (product_id,price,created_by,updated_by,created_at,updated_at,
            country_id,country_name,maximum_quantity,upload_date)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            id,
            price,
            req.user.id,
            req.user.id,
            new Date(),
            new Date(),
            getCountryId.rows[0].country_id || null,
            getCountryId.rows[0].country_name || null,
            10,
            moment(new Date()).format("YYYY-MM-DD"),
          ]
        );
      }
    }

    const data = {
      user_id: req.user.id,
      table_id: productId,
      table_name: "products_price_logs",
      action: "price to " + price,
    };

    adminLog(data);

    return res
      .status(200)
      .json({ status: true, message: "Product price updated successfully" });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Product price not updated",
      error: error.message,
    });
  }
});

const getProductPriceLogs = catchAsync(async (req, res) => {
  await Promise.all([
    body("product_id")
      .notEmpty()
      .withMessage("Product ID is required")
      .run(req),
  ]);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = await formatValidationArray(errors);
    return res.status(200).json({ status: false, errors: formattedErrors });
  }

  try {
    const productId = parseInt(req.body.product_id);

    if (isNaN(productId)) {
      return res
        .status(200)
        .json({ status: false, message: "Invalid Product ID", error: "" });
    }

    const query = `SELECT price, TO_CHAR(upload_date, 'FMDD FMMonth YYYY') AS date_of_update
            FROM products_price_logs
            WHERE product_id = ${productId} order by id desc`;
    const result = await db.query(query, []);

    return res.status(200).json({
      status: true,
      message: "Product Price logs retrieved successfully",
      data: result.rows,
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

const exportProductPriceLogs = catchAsync(async (req, res) => {
  await Promise.all([
    body("product_id")
      .notEmpty()
      .withMessage("Product ID is required")
      .run(req),
  ]);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = await formatValidationArray(errors);
    return res.status(200).json({ status: false, errors: formattedErrors });
  }

  const productId = parseInt(req.body.product_id);

  if (isNaN(productId)) {
    return res
      .status(200)
      .json({ status: false, message: "Invalid Product ID", error: "" });
  }
  try {
    // Query database
    const query = `SELECT price, TO_CHAR(created_at, 'DD/Mon/YYYY') AS date_of_update
            FROM products_price_logs
            WHERE product_id = ${productId} order by id desc`;

    //return res.json(query)

    const result = await db.query(query, []);
    let list = result.rows;

    //return res.json(list);
    // Create Excel file
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Products Price Logs");

    worksheet.columns = [
      { header: "Price", key: "price", width: 25 },
      { header: "Date of Update", key: "date_of_update", width: 25 },
    ];

    list.forEach((row) => {
      worksheet.addRow({
        price: row.price,
        date_of_update: row.date_of_update,
      });
    });

    // Generate file name and path
    const dateTime = moment().tz("Asia/Kolkata").format("YYYY-MM-DD_HH-mm-ss");
    const fileName = `product_price_log_list_${dateTime}.xlsx`;
    const filePath = path.join(
      process.cwd(),
      "public/uploads/exports",
      fileName
    );

    // Ensure directory exists
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    // Save Excel file
    await workbook.xlsx.writeFile(filePath);

    // Send file path as response
    return res.status(200).json({
      status: true,
      message:"Export Product Price log successfully",
      filePath: BASE_URL + `/uploads/exports/${fileName}`,
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

const ChangePricelist = catchAsync(async (req, res) => {
  try {
    const { category_id, page, search } = req.body;
    const query_params = [1];
    let categories = "";
    let pageCountQuery = "";
    let searchQuery = ``;

    if (category_id) {
      categories = `and p.category = $${query_params.length + 1}`;
      query_params.push(category_id);
    }

    if (page) {
      let pageCount = (page - 1) * 10;
      pageCountQuery = `LIMIT $${query_params.length + 1} OFFSET $${
        query_params.length + 2
      }`;
      query_params.push(10, pageCount);
    }

    if (search) {
      searchQuery = `and p.name ILIKE $${query_params.length + 1}`;
      query_params.push(`%${search}%`);
    }

    const query = `
                    SELECT
                            p.id,
                            p.name AS product_name,
                            c.id AS category_id,
                            c.cat_name AS category_name,
                            p.price AS current_price,
                            COALESCE(pp.price, 0) AS price_yesterday
                        FROM
                            products AS p
                        LEFT JOIN
                            categories AS c ON p.category = c.id
                        LEFT JOIN LATERAL (
                            SELECT price
                            FROM products_price_logs
                            WHERE product_id = p.id
                            AND upload_date < CURRENT_DATE
                            ORDER BY upload_date DESC
                            LIMIT 1
                        ) AS pp ON true
                        WHERE
                            p.status = $1 ${categories} ${searchQuery}
                        ORDER BY
                            p.id ASC ${pageCountQuery}
            `;

    const result = await db.query(query, query_params);

    return res.status(200).json({
      status: true,
      total: result.rowCount > 0 ? result.rowCount : 0,
      message: "Fetch Change Price details successfully",
      data: result.rowCount > 0 ? result.rows : [],
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

/* Product API END ------------------------------- */

/*----------------------------- Import And Export Product list sample --------------------*/

const importProduct = catchAsync(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: false, message: "No file uploaded" });
  }
  const filePath = req.file.path;

  // Create image folder if missing
  if (!fs.existsSync(IMAGE_FOLDER)) {
    fs.mkdirSync(IMAGE_FOLDER, { recursive: true });
  }
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  for (let row of rows) {
    const {
      "Product Name": product_name,
      "Category Name": category_name,
      "Country Name": country_name,
      "Minimum Order Place": min_order,
      "Maximum Order Place": max_order,
      "Product Thumbnail Image": image_url,
    } = row;

    let local_image_path = FALLBACK_IMAGE;

    //Check for duplicate product
    const existingProduct = await db.query(
      `SELECT id FROM products WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL`,
      [product_name]
    );
    if (existingProduct.rows.length > 0) {
      continue;
    }

    // if (image_url && image_url.startsWith("https")) {
    if (
      image_url &&
      (image_url.startsWith("https://") || image_url.startsWith("http://"))
    ) {
      try {
        const imageRes = await axios.get(image_url, {
          responseType: "arraybuffer",
        });
        const ext = path.extname(image_url).split("?")[0] || ".jpg";
        const imageName = `${Date.now()}-${product_name.replace(
          /\s+/g,
          "_"
        )}${ext}`;
        console.log(`imageName: ${imageName}`);
        const savePath = path.join(IMAGE_FOLDER, imageName);

        fs.writeFileSync(savePath, imageRes.data);
        local_image_path = `public/uploads/product_images/${imageName}`;

        //console.log(`✅ Image saved: ${local_image_path}`);
      } catch (err) {
        // console.warn(
        //   ` Failed to download image for ${product_name}: ${err.message}`
        // );
      }
    }

    //category table
    const catgories = await db.query(
      `select id from categories where cat_name ILIKE $1`,
      [category_name]
    );

    //country table
    const countries = await db.query(
      `select id from country_data where country_name ILIKE $1`,
      [country_name]
    );

    const productName = product_name;
    const category_id = catgories.rows[0].id;
    const country_id = countries.rows[0].id;
    const minimum_order_place = min_order;
    const maximum_order_place = max_order;

    const thumbnailImage = local_image_path
      ? media_url(local_image_path)
      : null;

    let OrderingId = 0;
    // Get the current highest ordering
    const getCountOrdering = await db.query(
      "SELECT * FROM products where deleted_at IS NULL ORDER BY ordering DESC LIMIT 1"
    );

    if (getCountOrdering.rows.length > 0) {
      OrderingId = getCountOrdering.rows[0].ordering;
    }

    const product = await Product.create({
      name: productName,
      slug: generateSlug(productName),
      minimum_order_place: minimum_order_place,
      maximum_order_place: maximum_order_place,
      price: row.Price,
      country_id: country_id,
      thumbnail_product_image: thumbnailImage,
      category: category_id,
      created_by: req.user.id,
      ordering: OrderingId ? parseInt(OrderingId) + 1 : 1,
      status: 1,
    });

    const product_id = product.id;

    if (!product) {
      return res
        .status(200)
        .json({ status: false, message: "Product not created" });
    }

    const countryName = await db.query(
      `select id from country_data where id = ${country_id}`
    );

    //product price list log
    await db.query(
      `INSERT INTO products_price_logs (product_id,price,country_id,country_name,upload_date,maximum_quantity
    ,created_by,created_at,updated_by,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        product_id,
        row.Price,
        country_id,
        countryName?.rows[0].id,
        moment(new Date()).format("YYYY-MM-DD"),
        maximum_order_place,
        req.user.id,
        new Date(),
        req.user.id,
        new Date(),
      ]
    );

    const data = {
      user_id: req.user.id,
      table_id: product.id,
      table_name: "products",
      action: "import Product List",
    };

    adminLog(data);
  }

  fs.unlinkSync(filePath);

  res.status(200).json({
    status: true,
    message: "Products uploaded successfully",
  });
});

const exportProductlistSample = catchAsync(async (req, res) => {
  try {
    const categoriesQuery = `SELECT id, cat_name FROM categories Where status = $1 ORDER BY ID ASC`;
    const categoriesResult = await db.query(categoriesQuery, [1]);

    const countryQuery = `SELECT id, country_name FROM country_data Where status = $1 ORDER BY ID ASC`;
    const countryResult = await db.query(countryQuery, [1]);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();

    const productSheet = workbook.addWorksheet("Products Sample");
    productSheet.columns = [
      { header: "Product Name", key: "product_name", width: 30 },
      { header: "Category Name", key: "category_name", width: 25 },
      { header: "Country Name", key: "country_name", width: 25 },
      { header: "Minimum Order Place", key: "min_order", width: 20 },
      { header: "Maximum Order Place", key: "max_order", width: 20 },
      { header: "Price", key: "price", width: 15 },
      { header: "Product Thumbnail Image", key: "thumbnail", width: 40 },
    ];

    // Add one sample row
    productSheet.addRow({
      product_name: "Veg",
      category_name: "Beverages",
      country_name: "Angola",
      min_order: "1",
      max_order: "10",
      price: "12.11",
      thumbnail:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT4DpNCwVWdf4efPhMS4GMXJopo9CFx3GBT7w&s",
    });

    // ===== Sheet 2: Categories =====
    const categoriesSheet = workbook.addWorksheet("Categories");
    categoriesSheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Category Name", key: "cat_name", width: 30 },
    ];
    categoriesResult.rows.forEach((row) => {
      categoriesSheet.addRow({ id: row.id, cat_name: row.cat_name });
    });

    // ===== Sheet 3: Countries =====
    const countrySheet = workbook.addWorksheet("Countries");
    countrySheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Country Name", key: "country_name", width: 30 },
    ];
    countryResult.rows.forEach((row) => {
      countrySheet.addRow({ id: row.id, country_name: row.country_name });
    });

    // Save the file
    const dateTime = moment().tz("Asia/Kolkata").format("YYYY-MM-DD_HH-mm-ss");
    const fileName = `export_product_upload_sample_${dateTime}.xlsx`;
    const filePath = path.join(
      process.cwd(),
      "public/uploads/export_product_upload_sample",
      fileName
    );

    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    await workbook.xlsx.writeFile(filePath);

    return res.status(200).json({
      status: true,
      message:"Export product list successfully",
      filePath: `${BASE_URL}/uploads/export_product_upload_sample/${fileName}`,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

/*-----------------------------End Import And Export Product list sample --------------------*/

const getActiveCategories = catchAsync(async (req, res) => {
  try {


    //get get catgories list
    const query = `select c.id as cat_id,c.cat_name as category_name,c.slug,COALESCE(c.description,'') as description,
        COALESCE(COUNT(p.id),0) as No_of_products,c.status AS visibility_status  from categories as c
        LEFT JOIN products as p ON c.id = p.category
        where c.status = '1' and c.deleted_at IS NULL
        GROUP BY c.cat_name,c.id Order BY c.id desc`;

    const getCategorieslist = await db.query(query, []);

    return res.status(200).json({
      status: true,
      total:0,
      message: "Fetch Categories successfully",
      data: getCategorieslist.rowCount > 0 ? getCategorieslist.rows : [],
    });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

const getcountries = catchAsync(async (req, res) => {
  try {
    const query = `select c.id,c.country_name,c.code1 as code,CONCAT('${BASE_URL}/images/img-country-flag/',c.flag) as country_flag from country_data as c where c.status = 1 and c.deleted_at IS NULL`;

    const getCountrylist = await db.query(query, []);

    return res.status(200).json({
      status: true,
      total:0,
      message: "Fetch Countries Successfully",
      data: getCountrylist.rowCount > 0 ? getCountrylist.rows : [],
    });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

export {
  /* Products */
  createProduct,
  updateProduct,
  getProductById,
  deleteProductById,
  updateProductStatusById,
  excelExportProducts,
  changeProductPrice,
  getProductPriceLogs,
  exportProductPriceLogs,
  changeProductStockStatus,
  countries,
  getProductlist,
  excelExportProductsInfo,
  importProductListwithPrice,
  ChangePricelist,
  getChangePriceProductlist,
  importProduct,
  exportProductlistSample,
   getcountries,
  getActiveCategories
};
