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

const BASE_URL = process.env.BASE_URL || "http://localhost:3848";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/* Category API Start ------------------------------- */

// GET all categories (datatables)
const getCategories = catchAsync(async (req, res) => {
  try {
    const { page, search } = req.body;
    let pageCountQuery = "";
    let searchQuery = ``;
    const query_params = [];

    if (page) {
      let pageCount = (page - 1) * 10;
      pageCountQuery = `LIMIT $${query_params.length + 1} OFFSET $${
        query_params.length + 2
      }`;
      query_params.push(10, pageCount);
    }

    if (search) {
      searchQuery = `AND c.cat_name ILIKE $${query_params.length + 1}`;
      query_params.push(`%${search}%`);
    }


    //get total number of categories
       const totalCategories = await db.query(`
            select c.id as cat_id,c.cat_name as category_name,c.slug,COALESCE(c.description,'') as description,
        COALESCE(COUNT(p.id),0) as No_of_products from categories as c
        LEFT JOIN products as p ON c.id = p.category
        where c.status = $1 and c.deleted_at IS NULL AND c.cat_name ILIKE $2
        GROUP BY c.cat_name,c.id Order BY c.id desc`,[1,`%${search}%`]
        );


    //get get catgories list
    const query = `select c.id as cat_id,c.cat_name as category_name,c.slug,COALESCE(c.description,'') as description,
        COALESCE(COUNT(p.id),0) as No_of_products,c.status AS visibility_status  from categories as c
        LEFT JOIN products as p ON c.id = p.category
        where  c.deleted_at IS NULL ${searchQuery}
        GROUP BY c.cat_name,c.id Order BY c.id desc ${pageCountQuery}`;

    const getCategorieslist = await db.query(query, query_params);

    return res.status(200).json({
      status: true,
      total: (totalCategories.rowCount > 0) ? parseInt(totalCategories.rowCount) : 0,
      message: "Fetch Categories successfully",
      data: getCategorieslist.rowCount > 0 ? getCategorieslist.rows : [],
    });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

// POST create category
const createCategory = catchAsync(async (req, res) => {
  // Apply validation rules
  await Promise.all([
    body("category_name")
      .notEmpty()
      .withMessage("Category Name is required")
      .bail() // stops further validation if empty
      .custom(async (value) => {
        const existingCategory = await Category.findOne({
          where: { cat_name: value },
        });
        if (existingCategory) {
          throw new Error("Category Name already exists");
        }
      })
      .run(req),
  ]);

  // Handle validation result
  const errors = validationResult(req);

  try {
    const { category_name, description } = req.body;

    const category = await Category.create({
      cat_name: category_name,
      slug: generateSlug(category_name),
      description: description,
      created_by: req.user.id,
      updated_by: req.user.id,
      status: "1",
    });

    if (!category) {
      return res
        .status(200)
        .json({ status: false, message: "Category not created" });
    }

    const data = {
      user_id: req.user.id,
      table_id: category.id,
      table_name: "categories",
      action: "insert",
    };

    adminLog(data);

    return res
      .status(200)
      .json({ status: true, message: "Category created successfully" });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Category not created",
      error: error.message,
    });
  }
});

// GET category by ID
const getCategoryById = catchAsync(async (req, res) => {
  try {
    await Promise.all([
      body("id").notEmpty().withMessage("Id is required").run(req),
    ]);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = await formatValidationArray(errors);
      return res.status(200).json({ status: false, errors: formattedErrors });
    }
    const categoryId = parseInt(req.body.id);

    if (isNaN(categoryId)) {
      return res
        .status(200)
        .json({ status: false, message: "Invalid Category ID", error: "" });
    }

    // Fetch data from the database
    const query = `SELECT cat_name,description FROM categories WHERE deleted_at IS NULL AND id = ${categoryId}`;

    const result = await db.query(query);

    if (result.rowCount <= 0) {
      return res
        .status(200)
        .json({ status: false, message: "Data Not Found", error: "" });
    }

    return res
      .status(200)
      .json({ status: true, message: "Data Found", data: result.rows[0] });
  } catch (error) {
    return res
      .status(200)
      .json({ status: false, message: "Data Not Found", error: error.message });
  }
});

// PATCH update category by ID
const updateCategoryById = catchAsync(async (req, res) => {

  const categoryId = parseInt(req.body.category_id);

  // Apply validation rules
  await Promise.all([
    body("category_name")
      .notEmpty()
      .withMessage("Category Name is required")
      .bail()
      .custom(async (value, { req }) => {
        const categoryId = req.body.category_id; // define it here from the request
        const existingCategory = await Category.findOne({
          where: {
            cat_name: value,
            id: { [Op.ne]: categoryId },
          },
        });

        if (existingCategory) {
          throw new Error("Category Name already exists");
        }
      })
      .run(req),
  ]);

  // Handle validation result
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = await formatValidationArray(errors);
    return res.status(200).json({ status: false, errors: formattedErrors });
  }

  try {
    if (isNaN(categoryId)) {
      return res
        .status(200)
        .json({ status: false, message: "Invalid Category ID", error: "" });
    }

    const { category_name, description } = req.body;

    const category_res = await Category.findOne({ where: { id: categoryId } });
    if (!category_res) {
      return res.json({
        status: false,
        message: "Category not found",
        error: "",
      });
    }

    const updateCategory = await Category.update(
      {
        cat_name: category_name,
        description: description,
        updated_by: req.user.id,
      },
      {
        where: { id: categoryId },
      }
    );

    if (!updateCategory) {
      return res
        .status(200)
        .json({ status: false, message: "Category Not Updated", error: "" });
    }

    const data = {
      user_id: req.user.id,
      table_id: categoryId,
      table_name: "categories",
      action: "update",
    };

    adminLog(data);

    return res
      .status(200)
      .json({ status: true, message: "Category updated successfully" });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Category Not Updated",
      error: error.message,
    });
  }
});

// DELETE category by ID
const deleteCategoryById = catchAsync(async (req, res) => {
  await Promise.all([
    body("category_id")
      .notEmpty()
      .withMessage("category id is required")
      .run(req), // THIS is important
  ]);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = await formatValidationArray(errors);
    return res.status(200).json({ status: false, errors: formattedErrors });
  }

  try {
    const categoryId = parseInt(req.body.category_id);

    if (isNaN(categoryId)) {
      return res
        .status(200)
        .json({ status: false, message: "Invalid Category ID", error: "" });
    }

    const result = await Category.findByPk(categoryId);

    if (!result) {
      return res
        .status(200)
        .json({ status: false, message: "Category not found", error: "" });
    }

    await db.query(
      `UPDATE categories SET status = $1, deleted_at = $2 where id = $3`,
      ["0", new Date(), categoryId]
    );

    const data = {
      user_id: req.user.id,
      table_id: categoryId,
      table_name: "categories",
      action: "delete",
    };

    adminLog(data);

    return res
      .status(200)
      .json({ status: true, message: "Data Deleted sucessfully" });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Category not found",
      error: error.message,
    });
  }
});

// PATCH update category status by ID
const updateCategoryStatusById = catchAsync(async (req, res) => {
  await Promise.all([
    body("category_id")
      .notEmpty()
      .withMessage("category id is required")
      .run(req),
    body("status").notEmpty().withMessage("status is required").run(req),
  ]);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = await formatValidationArray(errors);
    return res.status(200).json({ status: false, errors: formattedErrors });
  }

  try {
    let { category_id, status } = req.body;

    if (isNaN(category_id) || isNaN(status)) {
      return res.status(200).json({
        status: false,
        message: "Invalid Category ID or Status",
        error: "",
      });
    }

    //check no of product for particular category
    const count = await db.query(
      `select c.id as cat_id,c.cat_name as category_name,c.slug,COALESCE(c.description,'') as description,
        COALESCE(COUNT(p.id),0) as no_of_products from categories as c
        LEFT JOIN products as p ON c.id = p.category
        where c.id = $1 and c.status = $2 and c.deleted_at IS NULL
        GROUP BY c.cat_name,c.id Order BY c.id desc`,
      [category_id, 1]
    );

    if (count.rowCount > 0 && count.rows.no_of_products > 0) {
      return res.status(200).json({
        status: false,
        message: `Category has products cannot be deleted`,
      });
    } else {
      const updateCategory = await db.query(
        `UPDATE categories SET status = $1, updated_by = $2 where id = $3`,
        [status, req.user.id, category_id]
      );

      if (!updateCategory) {
        return res.status(200).json({
          status: false,
          message: "Category Status Not Updated",
          error: "",
        });
      }

      const data = {
        user_id: req.user.id,
        table_id: category_id,
        table_name: "categories",
        action: "status to " + status,
      };

      adminLog(data);
    }

    return res
      .status(200)
      .json({ status: true, message: "Category status updated successfully" });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Category Status Not Updated",
      error: error.message,
    });
  }
});

const excelExportCategory = catchAsync(async (req, res) => {
  try {
    // Query database
    const query = `SELECT
                    c.id,
                    c.cat_name,
                    c.description,
                    COUNT(p.id) AS product_count,
                    c.status
                FROM categories c
                LEFT JOIN products p ON p.category = c.id
                WHERE c.deleted_at IS NULL
                GROUP BY c.id, c.cat_name
                ORDER BY c.id`;

    //return res.json(query)

    const result = await db.query(query, []);
    let list = result.rows;
    // console.log(`result ${list.description}`);
    // console.log(list);

    //return res.json(list);
    // Create Excel file
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Products");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Category Name", key: "cat_name", width: 25 },
      { header: "Description", key: "description", width: 25 },
      { header: "Product Count", key: "product_count", width: 25 },
      { header: "Status", key: "status", width: 10 },
    ];

    list.forEach((row) => {
      worksheet.addRow({
        id: row.id,
        cat_name: row.cat_name,
        description: row.description,
        product_count: row.product_count,
        status: row.status == 1 ? "Active" : "Inactive",
      });
    });

    // Generate file name and path
    const dateTime = moment().tz("Asia/Kolkata").format("YYYY-MM-DD_HH-mm-ss");
    const fileName = `category_list_${dateTime}.xlsx`;
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
    return res
      .status(200)
      .json({ status: true, data: BASE_URL + `/uploads/exports/${fileName}` });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

/* Category API End ------------------------------- */
const excelImportCategory = catchAsync(async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ status: false, message: "No file uploaded" });
    }

    const filePath = path.join(process.cwd(), req.file.path);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);

    // Validate headers at A and B columns
    const headerRow = worksheet.getRow(1);
    if (
      headerRow.getCell("A").value !== "Category Name" ||
      headerRow.getCell("B").value !== "Description"
    ) {
      fs.unlinkSync(filePath);
      return res
        .status(400)
        .json({ status: false, message: "Invalid Excel header format" });
    }

    const insertedCategories = [];
    const skippedCategories = [];

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const cat_name = row.getCell("A").value;
      const description = row.getCell("B").value || "";

      if (!cat_name) continue; // skip empty category name rows

      const checkQuery = `SELECT id FROM categories WHERE cat_name = $1 AND deleted_at IS NULL`;
      const existing = await db.query(checkQuery, [cat_name]);

      if (existing.rows.length === 0) {
        const insertQuery = `
          INSERT INTO categories (cat_name, description, status, created_at, updated_at)
          VALUES ($1, $2, '1', NOW(), NOW())
          RETURNING id
        `;
        await db.query(insertQuery, [cat_name, description]);

        insertedCategories.push({ cat_name, description });
      } else {
        skippedCategories.push({ cat_name, description });
      }
    }

    fs.unlinkSync(filePath);

    // Generate report Excel
    const reportWorkbook = new ExcelJS.Workbook();

    const insertedSheet = reportWorkbook.addWorksheet("Inserted Categories");
    insertedSheet.columns = [
      { header: "Category Name", key: "cat_name", width: 30 },
      { header: "Description", key: "description", width: 40 },
    ];
    insertedCategories.forEach((item) => insertedSheet.addRow(item));

    const skippedSheet = reportWorkbook.addWorksheet("Skipped Categories");
    skippedSheet.columns = [
      { header: "Category Name", key: "cat_name", width: 30 },
      { header: "Description", key: "description", width: 40 },
    ];
    skippedCategories.forEach((item) => skippedSheet.addRow(item));

    const dateTime = moment().tz("Asia/Kolkata").format("YYYY-MM-DD_HH-mm-ss");
    const reportFileName = `category_import_report_${dateTime}.xlsx`;
    const reportPath = path.join(
      process.cwd(),
      "public/uploads/reports",
      reportFileName
    );

    if (!fs.existsSync(path.dirname(reportPath))) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    }

    await reportWorkbook.xlsx.writeFile(reportPath);

    return res.status(200).json({
      status: true,
      message: "Import completed",
      inserted: insertedCategories.length,
      skipped: skippedCategories.length,
      report_url: BASE_URL + `/uploads/reports/${reportFileName}`,
      // details: {
      //   insertedCategories,
      //   skippedCategories,
      // },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});
/* Product API Start ------------------------------- */
const getProductlist = catchAsync(async (req, res) => {
  try {
    const { category_id, page, search } = req.body;
    const query_params = [];
    const total_query_params = [];

    let categories = "";
    let pageCountQuery = "";
    let searchQuery = ``;

    if (category_id) {
      categories = `and p.category = $${query_params.length + 1}`;
      query_params.push(category_id);
      total_query_params.push(category_id);
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
            ${searchQuery}
        `;

    const totalProducts = await db.query(totalCountQuery, total_query_params);

    //get get product list
    const query = `select p.id as product_id,p.name as product_name,c.cat_name as category_name
        ,p.price as current_price,
        CONCAT('${BASE_URL}/images/img-country-flag/',ca.flag) as country_flag,
        p.category as category_id,
        ca.country_name,
        TO_CHAR(ppl.upload_date,'FMDD FMMonth YYYY') as last_updated_date,
        p.product_stock_status,p.status
         from products as p LEFT JOIN categories as c ON p.category = c.id
         LEFT JOIN country_data as ca ON p.country_id = ca.id
         LEFT JOIN products_price_logs as ppl ON p.id = ppl.product_id
         WHERE p.deleted_at IS NULL ${categories} ${searchQuery} ORDER BY p.id desc ${pageCountQuery}`;

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

const createProduct_bkp = catchAsync(async (req, res) => {
  // Apply validation rules
  await Promise.all([
    body("name").notEmpty().withMessage("Name is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("category").notEmpty().withMessage("Category is required"),
    body("countryId").notEmpty().withMessage("Country is required"),
    body('thumbnail_product_image').notEmpty().withMessage('Thumbnail image is required')
  ]);

  // Handle validation result
  const errors = validationResult(req);
  try {
    const body = req.body;
    const files = req.files;

     if (!files || !files.thumbnail_product_image || files.thumbnail_product_image.length === 0) {
        errors.errors.push({ msg: "Please upload thumbnail product image", path: "thumbnail_product_image" });
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
        const thumbnail_images = files && files.thumbnail_product_image ? files.thumbnail_product_image : [];


    const product = await Product.create({
      name: body.name,
      slug: generateSlug(body.name),
      description: body.description,
      minimum_order_place: 1,
      maximum_order_place: 10,
      price: 0,
      country_id: body.countryId,
      thumbnail_product_image:(thumbnail_images.length > 0) ? media_url(thumbnail_images[0]?.path) : null,
      category: body.category,
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

    const images = files && files.product_images ? files.product_images : [];

    if (images.length > 0) {
      for (const img of images) {
        await Product_images.create({
          product_id: product_id,
          image_path: media_url(img.path),
        });
      }
    }

    // const price_log = await Products_price_logs.create({
    //     product_id: product_id,
    //     price: body.price,
    //     created_by: req.user.id,
    //     updated_by: req.user.id
    // });

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

const updateProduct_bkp = catchAsync(async (req, res) => {
  // Apply validation rules
  await Promise.all([
    body("name").notEmpty().withMessage("Name is required").run(req),
    body("category").notEmpty().withMessage("Category is required").run(req),
    body("countryId").notEmpty().withMessage("Country is required"),
     body('thumbnail_product_image').notEmpty().withMessage('Thumbnail image is required')
  ]);

  const errors = validationResult(req);

  try {
    const productId = req.body.product_id;
    const body = req.body;
    const files = req.files;

    if (!files || !files.thumbnail_product_image || files.thumbnail_product_image.length === 0) {
          errors.errors.push({ msg: "Please upload thumbnail product image", path: "thumbnail_product_image" });
      }

    const product = await Product.findOne({
      where: { id: productId, deleted_at: null },
    });

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
      errors.errors.push({
        msg: "A product with the same name and category already exists",
        path: "name",
      });
    }

    if (!errors.isEmpty()) {
      const formattedErrors = await formatValidationArray(errors);
      return res.status(200).json({ status: false, errors: formattedErrors });
    }

    const thumbnail_images = files && files.thumbnail_product_image ? files.thumbnail_product_image : [];


    // Update product fields
    await Product.update(
      {
        name: body.name,
        slug: generateSlug(body.name),
        description: body.description,
        country_id: body.countryId,
        thumbnail_product_image:(thumbnail_images.length > 0) ? media_url(thumbnail_images[0]?.path) : null,
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

    // Optional: log price change
    if (product.price != body.price) {
      await Products_price_logs.create({
        product_id: productId,
        price: body.price,
        created_by: req.user.id,
        updated_by: req.user.id,
      });
    }
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
      message: "Product not updated",
      error: error.message,
    });
  }
});

const createProduct = catchAsync(async (req, res) => {

    // Apply validation rules
    await Promise.all([
        body('name')
            .notEmpty().withMessage('Name is required'),
        body('description').notEmpty().withMessage('Description is required'),
        body('category').notEmpty().withMessage('Category is required'),
        body('countryId').notEmpty().withMessage('Country is required'),
        body('price').notEmpty().withMessage('Price is required'),
        body('thumbnail_product_image').notEmpty().withMessage('Thumbnail image is required')
    ]);


    // Handle validation result
    const errors = validationResult(req);
    try {
        const body = req.body;
        const files = req.files;

        if (!files || !files.thumbnail_product_image || files.thumbnail_product_image.length === 0) {
            errors.errors.push({ msg: "Please upload thumbnail product image", path: "thumbnail_product_image" });
        }

        if (!files || !files.product_images || files.product_images.length === 0) {
            errors.errors.push({ msg: "Please upload product image", path: "product_images" });
        }

        // After validationResult()
        const existing = await Product.findOne({
            where: {
                name: req.body.name,
                category: req.body.category,
                deleted_at: null
            }
        });

        if (existing) {
            errors.errors.push({ msg: "A product with the same name and category already exists", path: "name" });
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
        const thumbnail_images = files && files.thumbnail_product_image ? files.thumbnail_product_image : '';


        const product = await Product.create({
            name: body.name,
            slug: generateSlug(body.name),
            description: body.description,
            minimum_order_place: (body.minimum_order_place) ? body.minimum_order_place : 1,
            maximum_order_place: (body.maximum_order_place) ? body.maximum_order_place : 10,
            price: body.price,
            country_id: body.countryId,
            thumbnail_product_image:(thumbnail_images.length > 0) ? media_url(thumbnail_images[0]?.path) : null,
            category: body.category,
            created_by: req.user.id,
            ordering: (OrderingId) ? parseInt(OrderingId) + 1 : 1,
            status: 1,
        });

        const product_id = product.id;

        if (!product) {
            return res.status(200).json({ status: false, message: 'Product not created' });
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
        const countryName = await db.query(`select id from country_data where id = ${body.countryId}`);

        //product price list log
        await db.query(
            `INSERT INTO products_price_logs (product_id,price,country_id,country_name,upload_date,maximum_quantity
        ,created_by,created_at,updated_by,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [product_id, body.price, body.countryId, countryName?.rows[0].id, moment(new Date()).format('YYYY-MM-DD'), body.maximum_order_place, req
            .user.id, new Date(),req.user.id,new Date()]
        );

        const data = {
            user_id: req.user.id,
            table_id: product.id,
            table_name: 'products',
            action: 'insert',
        };

        adminLog(data);

        return res.status(200).json({ status: true, message: 'Product created successfully' });

    } catch (error) {
        return res.status(200).json({ status: false, message: 'Product not created', error: error.message });
    }
});

const updateProduct = catchAsync(async (req, res) => {
    // Apply validation rules
    await Promise.all([
        body('name').notEmpty().withMessage('Name is required').run(req),
        body('category').notEmpty().withMessage('Category is required').run(req),
        body('countryId').notEmpty().withMessage('Country is required'),
        body('thumbnail_product_image').notEmpty().withMessage('Thumbnail image is required')
    ]);

    const errors = validationResult(req);


    try {
        const productId = req.body.product_id;
        const body = req.body;
        const files = req.files;

        const product = await Product.findOne({ where: { id: productId, deleted_at: null } });

        if (!files || !files.thumbnail_product_image || files.thumbnail_product_image.length === 0) {
            errors.errors.push({ msg: "Please upload thumbnail product image", path: "thumbnail_product_image" });
        }

        if (!product) {
            return res.status(404).json({ status: false, message: "Product not found" });
        }

        const existing = await Product.findOne({
            where: {
                name: req.body.name,
                category: req.body.category,
                deleted_at: null,
                id: { [Op.ne]: productId } // Exclude current product
            }
        });

        if (existing) {
            errors.errors.push({
                msg: "A product with the same name and category already exists",
                path: "name"
            });
        }

        if (!errors.isEmpty()) {
            const formattedErrors = await formatValidationArray(errors);
            return res.status(200).json({ status: false, errors: formattedErrors });
        }

        const thumbnail_images = files && files.thumbnail_product_image ? files.thumbnail_product_image : [];

        // Update product fields
        await Product.update({
            name: body.name,
            slug: generateSlug(body.name),
            minimum_order_place: (body.minimum_order_place) ? body.minimum_order_place : 1,
            maximum_order_place: (body.maximum_order_place) ? body.maximum_order_place : 10,
            price:body.price,
            description: body.description,
            country_id: body.countryId,
            thumbnail_product_image:(thumbnail_images.length > 0) ? media_url(thumbnail_images[0]?.path) : null,
            category: body.category,
            updated_by: req.user.id,
        },
            {
                where: { id: productId }
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
            WHERE product_id = $5 AND upload_date = $6`, [body.maximum_order_place, body.price, req.user.id, new Date(), productId, moment(new Date()).format('YYYY-MM-DD')]
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
            table_name: 'products',
            action: 'update',
        };

        adminLog(data);

        return res.status(200).json({ status: true, message: 'Product updated successfully' });

    } catch (error) {
        return res.status(500).json({ status: false, message: 'Product not updated', error: error.message });
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
            LEFT JOIN product_images pi ON pi.product_id = p.id
            WHERE p.deleted_at IS NULL AND p.id = $1
            GROUP BY p.id
        `;

    const result = await db.query(query, [productId]);

    if (result.rowCount <= 0) {
      return res
        .status(200)
        .json({ status: false, message: "Product Not Found", error: "" });
    }

    return res.status(200).json({
      status: true,
      message: "Product Found",
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
        .json({ status: false, message: "Product not found", error: "" });
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
        message: "Product status not updated",
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
      message: "Product status not updated",
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
        const {category_id } = req.body;

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

        query += ` GROUP BY p.id, ci.cat_name, c.country_name`;

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
                maximum_order_place:row.maximum_order_place,
                price:row.price,
                thumbnail_product_image: row.thumbnail_product_image,
                description: row.description,
                country_name: row.country_name,
                category: row.category,
                status: row.status == 1 ? "Active" : "Inactive",
                product_images: (row.product_images || []).join(", ")
            });
        });


        // Generate file name and path
        const dateTime = moment().tz("Asia/Kolkata").format("YYYY-MM-DD_HH-mm-ss");
        const fileName = `product_list_${dateTime}.xlsx`;
        const filePath = path.join(process.cwd(), "public/uploads/exports", fileName);

        // Ensure directory exists
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        // Save Excel file
        await workbook.xlsx.writeFile(filePath);

        // Send file path as response
        return res.json({ status: true, data: BASE_URL + `/uploads/exports/${fileName}` });

    } catch (error) {
        return res.status(200).json({ status: false, message: "Internal Server Error", error: error.message });
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
        const { category_id, page, search,country_id } = req.body;
        const query_params = [1];
        const total_query_params = [1];
        let categories = '';
        let countries = '';
        let pageCountQuery = '';
        let searchQuery = ``;

        if (category_id) {
            categories = `and p.category = $${query_params.length + 1}`;
            query_params.push(category_id)
            total_query_params.push(category_id)
        }

        if (country_id) {
            countries = `and p.country_id = $${query_params.length + 1}`;
            query_params.push(country_id)
            total_query_params.push(country_id)
        }

        if (search) {
            searchQuery = `and p.name ILIKE $${query_params.length + 1}`;
            query_params.push(`%${search}%`);
            total_query_params.push(`%${search}%`)
        }

        if (page) {
            let pageCount = (page - 1) * 10;
            pageCountQuery = `LIMIT $${query_params.length + 1} OFFSET $${query_params.length + 2}`
            query_params.push(10, pageCount)
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
                            p.status = $1 ${categories} ${countries} ${searchQuery}
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
                            p.status = $1 ${categories} ${countries} ${searchQuery}
                        ORDER BY
                            p.id ASC ${pageCountQuery}
            `;

        const result = await db.query(query, query_params);


        return res.status(200).json({
            status: true,
            total: (totalProducts.rowCount > 0) ? parseInt(totalProducts.rowCount) : 0,
            message: "Fetch Change Price details successfully",
            data: (result.rowCount > 0) ? result.rows : []
        });
    }
    catch (error) {
        return res.status(200).json({ status: false, message: "Internal Server Error", error: error.message });
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
    console.log(arrayProductId);

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
              WHERE product_id=$3`,
          [price, req.user.id, id, new Date()]
        );
      } else {
        const getCountryId = await db.query(
          `select p.country_id,cd.country_name from products as p
              LEFT JOIN country_data as cd ON p.country_id=cd.id WHERE p.id=$1`,
          [id]
        );

        console.log(id);

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
      message: "logs retrieved successfully",
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
    const query = `SELECT price, TO_CHAR(created_at, 'FMDD FMMonth YYYY') AS date_of_update
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

    // const query = `
    //         SELECT
    //             p.id,
    //             p.name AS product_name,
    //             c.id as category_id,
    //             c.cat_name AS category_name,
    //             p.price AS current_price,
    //             COALESCE(pp.price, 0) AS price_yesterday
    //         FROM
    //             products AS p
    //         LEFT JOIN
    //             categories AS c ON p.category = c.id
    //         LEFT JOIN
    //             products_price_logs AS pp ON p.id = pp.product_id
    //             AND pp.upload_date = CURRENT_DATE - INTERVAL '1 day'
    //         WHERE
    //             p.status = $1 ${categories} ${searchQuery}
    //         ORDER BY
    //         p.id ASC ${pageCountQuery}
    //         `;

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


/* Country API Start -------------------------------*/
const getcountrylist = catchAsync(async (req, res) => {
    try {

         const { page,search } = req.body
         const total_query_params = [];
        const query_params = [];
        let pageCountQuery = ``;
        let searchQuery = ``;

         if (search) {
            searchQuery = `AND CONCAT(c.country_name) ILIKE $${query_params.length + 1}`;
            query_params.push(`%${search}%`);
            total_query_params.push(`%${search}%`)
        }

        if (page) {
            let pageCount = (page - 1) * 10;
            pageCountQuery = `LIMIT $${query_params.length + 1} OFFSET $${query_params.length + 2}`
            query_params.push(10, pageCount)
        }

        //total number of country
        const totalquery = `select c.id,c.country_name,c.code1 as code,CONCAT('${BASE_URL}/images/img-country-flag/',c.flag),status from country_data as c where c.deleted_at IS NULL ${searchQuery}`;
        const getTotalCountrylist = await db.query(totalquery, total_query_params)

        const query = `select c.id,c.country_name,c.code1 as code,CONCAT('${BASE_URL}/images/img-country-flag/',c.flag) as country_flag,status from country_data as c where c.deleted_at IS NULL ${searchQuery} order by c.id asc  ${pageCountQuery} `;
        const getCountrylist = await db.query(query, query_params)

        return res.status(200).json({
            status: true,
            total:(getTotalCountrylist.rowCount > 0) ? getTotalCountrylist.rowCount : 0,
            message: 'Fetch Countries Successfully',
            data: (getCountrylist.rowCount > 0) ? getCountrylist.rows : []
        });
    } catch (error) {
        throw new AppError(error.message, 400);
    }

});

// POST create Country
const createCountry = catchAsync(async (req, res) => {

    // Apply validation rules
    await Promise.all([
        body('country_name')
            .notEmpty().withMessage('Country Name is required')
            .bail() // stops further validation if empty
            .custom(async (value) => {
                const existingCountry = await db.query(
                        `SELECT * FROM country_data WHERE country_name = $1`,
                        [value]
                    );
                    if (existingCountry.rowCount > 0) {
                        return res.status(200).json({status: false, message: 'Country Name already exists'})
                    }
            })
            .run(req),
        body("country_code").notEmpty().withMessage("Country Code is required").run(req),
        body('country_flag').notEmpty().withMessage('Country Flag is required').run(req)
    ]);

    // Handle validation result
    const errors = validationResult(req);

    try {
        const { country_name, country_code } = req.body;
        const files = req.files;
        const countryImage = files && files.country_flag ? files.country_flag : [];
        const countryFlag = countryImage[0].filename;

        const result = await db.query(
            `INSERT INTO country_data (country_name, code1, code2, flag,status)
            VALUES ($1, $2, $3, $4,1) RETURNING id`,
            [country_name, country_code, country_code,countryFlag]
        );

        if (result.rowCount === 0) {
            return res.status(200).json({ status: false, message: 'Country not created' });
        }

        const countryId = result.rows[0].id;


        const data = {
            user_id: req.user.id,
            table_id: countryId,
            table_name: 'country_data',
            action: 'insert',
        };

        adminLog(data);

        return res.status(200).json({ status: true, message: 'Country created successfully' });

    } catch (error) {
        return res.status(200).json({ status: false, message: 'Country not created', error: error.message });
    }
});

// PATCH update Country by ID
const updateCountryById = catchAsync(async (req, res) => {

    // Apply validation rules
    await Promise.all([
        body('country_id')
            .notEmpty().withMessage('country id is required')
            .run(req),
        body('country_name')
            .notEmpty().withMessage('country name is required')
            .run(req),
        body('country_code')
            .notEmpty().withMessage('country code is required')
            .run(req),
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = await formatValidationArray(errors);
        return res.status(200).json({ status: false, errors: formattedErrors });
    }

    try {

        const { country_id, country_name,country_code } = req.body;
        const files = req.files;
        let countryFlag;

        // Check if country exists
        const existing = await db.query(`SELECT * FROM country_data WHERE id = $1`, [country_id]);
        if (existing.rowCount === 0) {
            return res.status(404).json({ status: false, message: 'Country not found' });
        }

        // Get old flag if no new file uploaded
        if (files && files.country_flag && files.country_flag.length > 0) {
            countryFlag = files.country_flag[0].filename;
        } else {
            countryFlag = existing.rows[0].flag;
        }

        // Update country
        const result = await db.query(`
            UPDATE country_data
            SET country_name = $1, flag = $2 , code1 =  $3
            WHERE id = $4
        `, [country_name, countryFlag, country_code,country_id]);

        if (result.rowCount === 0) {
            return res.status(200).json({ status: false, message: 'Country not updated' });
        }

        const data = {
            user_id: req.user.id,
            table_id: country_id,
            table_name: 'country_data',
            action: 'update',
        };

        adminLog(data);

        return res.status(200).json({ status: true, message: 'Country updated successfully' });

    } catch (error) {
        return res.status(200).json({ status: false, message: 'Country Not Updated', error: error.message });
    }
});

const getAllCountry =catchAsync(async (req, res) => {
    try {

         const { page } = req.body
        const query_params = [1];
        let pageCountQuery = ``;

        if (page) {
            let pageCount = (page - 1) * 10;
            pageCountQuery = `LIMIT $${query_params.length + 1} OFFSET $${query_params.length + 2}`
            query_params.push(10, pageCount)
        }

        //total number of country
        const totalquery = `select c.id,c.country_name,c.code1 as code,CONCAT('${BASE_URL}/images/img-country-flag/',c.flag),status from country_data as c where c.status = 1`;
        const getTotalCountrylist = await db.query(totalquery, [])

        const query = `select c.id,c.country_name,c.code1 as code,CONCAT('${BASE_URL}/images/img-country-flag/',c.flag),status from country_data as c where c.status = $1 order by c.id asc ${pageCountQuery} `;
        const getCountrylist = await db.query(query, query_params)

        return res.status(200).json({
            status: true,
            total:(getTotalCountrylist.rowCount > 0) ? getTotalCountrylist.rowCount : 0,
            message: 'Fetch Countries Successfully',
            data: (getCountrylist.rowCount > 0) ? getCountrylist.rows : []
        });
    } catch (error) {
        throw new AppError(error.message, 400);
    }

});

// GET Country by ID
const getCountryById = catchAsync(async (req, res) => {
    try {
        await Promise.all([
            body('country_id')
                .notEmpty().withMessage('country id is required')
                .run(req)
        ]);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = await formatValidationArray(errors);
            return res.status(200).json({ status: false, errors: formattedErrors });
        }
        const countryId = parseInt(req.body.country_id);

        if (isNaN(countryId)) {
            return res.status(200).json({ status: false, message: 'Invalid Country ID', error: '' });
        }

        // Fetch data from the database
        const query = `SELECT id,country_name,code1 as country_code,CONCAT('${BASE_URL}', '/images/img-country-flag/', flag) AS country_flag FROM country_data WHERE deleted_at IS NULL AND id = ${countryId}`;

        const result = await db.query(query);

        if (result.rowCount <= 0) {
            return res.status(200).json({ status: false, message: 'Data Not Found', error: '' });
        }

        return res.status(200).json({ status: true, message: 'Data Found', data: result.rows[0] });
    } catch (error) {
        return res.status(200).json({ status: false, message: 'Data Not Found', error: error.message });
    }
});


// DELETE Country by ID
const deleteCountryById = catchAsync(async (req, res) => {
    await Promise.all([
        body('country_id')
            .notEmpty().withMessage('country id is required')
            .run(req) // THIS is important
    ]);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = await formatValidationArray(errors);
        return res.status(200).json({ status: false, errors: formattedErrors });
    }

    try {

        const countryId = parseInt(req.body.country_id);

        if (isNaN(countryId)) {
            return res.status(200).json({ status: false, message: 'Invalid Country ID', error: '' });
        }

         const result = await db.query(`SELECT * FROM country_data WHERE id = $1`, [countryId]);

            if (result.rowCount === 0) {
                return res.status(200).json({ status: false, message: 'Country not found', error: '' });
            }

        await db.query(
            `UPDATE country_data SET status = $1, deleted_at = $2 where id = $3`,
            ["0", new Date(), countryId]
        );

        const data = {
            user_id: req.user.id,
            table_id: countryId,
            table_name: 'country_data',
            action: 'delete',
        };

        adminLog(data);

        return res.status(200).json({ status: true, message: 'Data Deleted sucessfully' });

    } catch (error) {
        return res.status(200).json({ status: false, message: 'Country not found', error: error.message });
    }
});

// PATCH update country status by ID
const updateCountryStatusById = catchAsync(async (req, res) => {
    await Promise.all([
        body('country_id')
            .notEmpty().withMessage('country id is required')
            .run(req),
        body('status')
            .notEmpty().withMessage('status is required')
            .run(req)
    ]);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = await formatValidationArray(errors);
        return res.status(200).json({ status: false, errors: formattedErrors });
    }

    try {

        let { country_id, status } = req.body;

        if (isNaN(country_id) || isNaN(status)) {
            return res.status(200).json({ status: false, message: 'Invalid Country ID or Status', error: '' });
        }

        //check no of product for particular country
       const count = await db.query(`
                SELECT
                    c.id AS cat_id,
                    c.cat_name AS category_name,
                    c.slug,
                    COALESCE(c.description, '') AS description,
                    COALESCE(COUNT(p.id), 0) AS no_of_products
                FROM categories AS c
                LEFT JOIN products AS p ON c.id = p.category
                LEFT JOIN country_data AS ca ON p.country_id = ca.id
                WHERE ca.id = $1 AND c.status = $2 AND c.deleted_at IS NULL
                GROUP BY c.cat_name, c.id
                ORDER BY c.id DESC
            `, [country_id, 1]);
            const totalProducts = count.rows.reduce((sum, row) => sum + parseInt(row.no_of_products || 0), 0);


        if (count.rowCount > 0 && totalProducts > 0) {
            return res.status(200).json({
                status: false,
                message: `Country has products, cannot be deleted`
            });
        } else {

            const updateCountry = await db.query(
                `UPDATE country_data SET status = $1, updated_by = $2 where id = $3`,
                [status, req.user.id, country_id]
            );

            if (!updateCountry) {
                return res.status(200).json({ status: false, message: 'Country Status Not Updated', error: '' });
            }

            const data = {
                user_id: req.user.id,
                table_id: country_id,
                table_name: 'country_data',
                action: 'status to ' + status,
            };

            adminLog(data);
        }

        return res.status(200).json({ status: true, message: 'Country status updated successfully' });

    } catch (error) {

        return res.status(200).json({ status: false, message: 'Country Status Not Updated', error: error.message });
    }
});

/* End Country Api ---------------------------------*/


export {
  /* Category API */
  getCategories,
  createCategory,
  getCategoryById,
  updateCategoryById,
  deleteCategoryById,
  updateCategoryStatusById,
  excelExportCategory,

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
  excelImportCategory,
  getChangePriceProductlist,

  /* country master */
    getcountrylist,
    createCountry,
    getAllCountry,
    getCountryById,
    updateCountryById,
    deleteCountryById,
    updateCountryStatusById
};
