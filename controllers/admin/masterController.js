import dotenv from 'dotenv';
dotenv.config({ path: `${process.cwd()}/.env` });

// Defaults
import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import { generateSlug, media_url, formatValidationArray } from "../../helpers/slug_helper.js";
import Category from "../../db/models/category.js";
import Product from "../../db/models/products.js";
import Product_images from "../../db/models/product_images.js";
import Products_price_logs from "../../db/models/products_price_logs.js";

import { body, validationResult } from "express-validator";
import { Op, QueryTypes, Sequelize } from "sequelize";
import { compare } from "bcrypt";
import bcrypt from "bcrypt";
import sequelize from "../../config/database.js";
import moment from 'moment';
import db from "../../config/db.js";
import adminLog from '../../helpers/admin_log.js';
import csvjson from 'csvjson'
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { format } from "fast-csv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const BASE_URL = process.env.BASE_URL || 'http://localhost:3848';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/* Category API Start ------------------------------- */

// GET all categories (datatables)
const getCategories = catchAsync(async (req, res) => {
    try {
        const { page, search } = req.body
        let pageCountQuery = '';
        let searchQuery = ``;
        const query_params = [1];
        const total_query_params = [1];

        if (page) {
            let pageCount = (page - 1) * 10;
            pageCountQuery = `LIMIT $${query_params.length + 1} OFFSET $${query_params.length + 2}`
            query_params.push(10, pageCount)
        }

        if (search) {
            searchQuery = `AND c.cat_name ILIKE $${query_params.length + 1}`;
            query_params.push(`%${search}%`);
            total_query_params.push(`%${search}%`)
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
        COALESCE(COUNT(p.id),0) as No_of_products from categories as c
        LEFT JOIN products as p ON c.id = p.category
        where c.status = $1 and c.deleted_at IS NULL ${searchQuery}
        GROUP BY c.cat_name,c.id Order BY c.id desc ${pageCountQuery}`;

        const getCategorieslist = await db.query(query, query_params)

        return res.status(200).json({
            status: true,
            total: (totalCategories.rowCount > 0) ? parseInt(totalCategories.rowCount) : 0,
            message: 'Fetch Categories successfully',
            data: (getCategorieslist.rowCount > 0) ? getCategorieslist.rows : []
        });
    } catch (error) {
        throw new AppError(error.message, 400);
    }

});

// POST create category
const createCategory = catchAsync(async (req, res) => {

    // Apply validation rules
    await Promise.all([
        body('category_name')
            .notEmpty().withMessage('Category Name is required')
            .bail() // stops further validation if empty
            .custom(async (value) => {
                const existingCategory = await Category.findOne({ where: { cat_name: value } });
                if (existingCategory) {
                    throw new Error('Category Name already exists');
                }
            })
            .run(req)
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
            status: '1',
        });

        if (!category) {
            return res.status(200).json({ status: false, message: 'Category not created' });
        }

        const data = {
            user_id: req.user.id,
            table_id: category.id,
            table_name: 'categories',
            action: 'insert',
        };

        adminLog(data);

        return res.status(200).json({ status: true, message: 'Category created successfully' });

    } catch (error) {
        return res.status(200).json({ status: false, message: 'Category not created', error: error.message });
    }
});

// GET category by ID
const getCategoryById = catchAsync(async (req, res) => {
    try {
        await Promise.all([
            body('id')
                .notEmpty().withMessage('Id is required')
                .run(req)
        ]);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = await formatValidationArray(errors);
            return res.status(200).json({ status: false, errors: formattedErrors });
        }
        const categoryId = parseInt(req.body.id);

        if (isNaN(categoryId)) {
            return res.status(200).json({ status: false, message: 'Invalid Category ID', error: '' });
        }

        // Fetch data from the database
        const query = `SELECT cat_name,description FROM categories WHERE deleted_at IS NULL AND id = ${categoryId}`;

        const result = await db.query(query);

        if (result.rowCount <= 0) {
            return res.status(200).json({ status: false, message: 'Data Not Found', error: '' });
        }

        return res.status(200).json({ status: true, message: 'Data Found', data: result.rows[0] });
    } catch (error) {
        return res.status(200).json({ status: false, message: 'Data Not Found', error: error.message });
    }
});

// PATCH update category by ID
const updateCategoryById = catchAsync(async (req, res) => {

    const categoryId = parseInt(req.body.category_id);

    // Apply validation rules
    await Promise.all([
        body('category_name')
            .notEmpty().withMessage('Category Name is required')
            .bail()
            .custom(async (value, { req }) => {
                const categoryId = req.body.category_id; // define it here from the request
                const existingCategory = await Category.findOne({
                    where: {
                        cat_name: value,
                        id: { [Op.ne]: categoryId }
                    }
                });

                if (existingCategory) {
                    throw new Error('Category Name already exists');
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
            return res.status(200).json({ status: false, message: 'Invalid Category ID', error: '' });
        }

        const { category_name, description } = req.body;

        const category_res = await Category.findOne({ where: { id: categoryId } });
        if (!category_res) {
            return res.json({ status: false, message: "Category not found", error: '' });
        }

        const updateCategory = await Category.update({
            cat_name: category_name,
            description: description,
            updated_by: req.user.id,
        }, {
            where: { id: categoryId }
        });

        if (!updateCategory) {
            return res.status(200).json({ status: false, message: 'Category Not Updated', error: '' });
        }

        const data = {
            user_id: req.user.id,
            table_id: categoryId,
            table_name: 'categories',
            action: 'update',
        };

        adminLog(data);

        return res.status(200).json({ status: true, message: 'Category updated successfully' });

    } catch (error) {
        return res.status(200).json({ status: false, message: 'Category Not Updated', error: error.message });
    }
});

// DELETE category by ID
const deleteCategoryById = catchAsync(async (req, res) => {
    await Promise.all([
        body('category_id')
            .notEmpty().withMessage('category id is required')
            .run(req) // THIS is important
    ]);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = await formatValidationArray(errors);
        return res.status(200).json({ status: false, errors: formattedErrors });
    }

    try {

        const categoryId = parseInt(req.body.category_id);

        if (isNaN(categoryId)) {
            return res.status(200).json({ status: false, message: 'Invalid Category ID', error: '' });
        }

        const result = await Category.findByPk(categoryId);

        if (!result) {
            return res.status(200).json({ status: false, message: 'Category not found', error: '' });
        }

        await db.query(
            `UPDATE categories SET status = $1, deleted_at = $2 where id = $3`,
            ["0", new Date(), categoryId]
        );

        const data = {
            user_id: req.user.id,
            table_id: categoryId,
            table_name: 'categories',
            action: 'delete',
        };

        adminLog(data);

        return res.status(200).json({ status: true, message: 'Data Deleted sucessfully' });

    } catch (error) {
        return res.status(200).json({ status: false, message: 'Category not found', error: error.message });
    }
});

// PATCH update category status by ID
const updateCategoryStatusById = catchAsync(async (req, res) => {
    await Promise.all([
        body('category_id')
            .notEmpty().withMessage('category id is required')
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

        let { category_id, status } = req.body;

        if (isNaN(category_id) || isNaN(status)) {
            return res.status(200).json({ status: false, message: 'Invalid Category ID or Status', error: '' });
        }

        //check no of product for particular category
        const count = await db.query(`select c.id as cat_id,c.cat_name as category_name,c.slug,COALESCE(c.description,'') as description,
        COALESCE(COUNT(p.id),0) as no_of_products from categories as c
        LEFT JOIN products as p ON c.id = p.category
        where c.id = $1 and c.status = $2 and c.deleted_at IS NULL
        GROUP BY c.cat_name,c.id Order BY c.id desc`, [category_id, 1]);

        if (count.rowCount > 0 && count.rows.no_of_products > 0) {
            return res.status(200).json({
                status: false,
                message: `Category has products cannot be deleted`
            });
        } else {

            const updateCategory = await db.query(
                `UPDATE categories SET status = $1, updated_by = $2 where id = $3`,
                [status, req.user.id, category_id]
            );

            if (!updateCategory) {
                return res.status(200).json({ status: false, message: 'Category Status Not Updated', error: '' });
            }

            const data = {
                user_id: req.user.id,
                table_id: category_id,
                table_name: 'categories',
                action: 'status to ' + status,
            };

            adminLog(data);
        }

        return res.status(200).json({ status: true, message: 'Category status updated successfully' });

    } catch (error) {

        return res.status(200).json({ status: false, message: 'Category Status Not Updated', error: error.message });
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
        const dateTime = moment().tz("Asia/Kolkata").format("YYYY-MM-DD_HH-mm-ss");;
        const fileName = `category_list_${dateTime}.xlsx`;
        const filePath = path.join(process.cwd(), "public/uploads/exports", fileName);

        // Ensure directory exists
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        // Save Excel file
        await workbook.xlsx.writeFile(filePath);

        // Send file path as response
        return res.status(200).json({ status: true, data: BASE_URL + `/uploads/exports/${fileName}` });

    } catch (error) {
        return res.status(200).json({ status: false, message: "Internal Server Error", error: error.message });
    }
});
/* Category API End ------------------------------- */

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

export {
    /* Category API */
    getCategories,
    createCategory,
    getCategoryById,
    updateCategoryById,
    deleteCategoryById,
    updateCategoryStatusById,
    excelExportCategory,

    /* country master */
    getcountrylist,
    createCountry,
    getAllCountry,
    getCountryById,
    updateCountryById,
    deleteCountryById,
    updateCountryStatusById,
    countries,
}
