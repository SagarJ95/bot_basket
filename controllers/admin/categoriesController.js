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

const getCategories = catchAsync(async (req, res) => {
  try {
    const { page, search } = req.body;
    let pageCountQuery = "";
    let searchQuery = ``;
    const query_params = [1];

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
    const totalCategories = await db.query(
      `select COUNT(c.id) FROM categories as c where c.status =$1 and c.deleted_at IS NULL ${searchQuery}
              ${pageCountQuery}`,
      query_params
    );

    //get get catgories list
    const query = `select c.id as cat_id,c.cat_name as category_name,c.slug,COALESCE(c.description,'') as description,
          COALESCE(COUNT(p.id),0) as No_of_products from categories as c
          LEFT JOIN products as p ON c.id = p.category
          where c.status = $1 and c.deleted_at IS NULL ${searchQuery}
          GROUP BY c.cat_name,c.id Order BY c.id desc ${pageCountQuery}`;

    const getCategorieslist = await db.query(query, query_params);

    return res.status(200).json({
      status: true,
      total:
        totalCategories.rowCount > 0
          ? parseInt(totalCategories.rows[0].count)
          : 0,
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
                  WHERE c.deleted_at IS NULL And c.status = '1'
                  GROUP BY c.id, c.cat_name
                  ORDER BY c.id`;

    //return res.json(query)

    const result = await db.query(query, []);
    let list = result.rows;

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

export {
  getCategories,
  createCategory,
  getCategoryById,
  updateCategoryById,
  deleteCategoryById,
  updateCategoryStatusById,
  excelExportCategory,
};
