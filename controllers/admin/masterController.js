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

import ExcelJS  from "exceljs";
import path  from "path";
import fs  from "fs";

const BASE_URL = process.env.BASE_URL || 'http://localhost:3848';

/* Category API Start ------------------------------- */

// GET all categories (datatables)
const getCategories = catchAsync(async (req, res) => {
    try {
        //get total number of categories
        const totalCategories = await db.query(`select COUNT(id) FROM categories where status =$1 and deleted_at IS NULL`,
            [1]
        );

        //get get catgories list
        const query = `select c.id as cat_id,c.cat_name as category_name,c.slug,COALESCE(c.description,'') as description,
        COALESCE(COUNT(p.id),0) as No_of_products from categories as c
        LEFT JOIN products as p ON c.id = p.category
        where c.status = $1 and c.deleted_at IS NULL
        GROUP BY c.cat_name,c.id Order BY c.id desc`;

        const getCategorieslist = await db.query(query,[1])

        return res.status(200).json({
            status: true,
            total:(totalCategories.rowCount > 0) ? totalCategories.rowCount : 0,
            message: 'Fetch Categories Successfully',
            data:(getCategorieslist.rowCount > 0) ? getCategorieslist.rows : []
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
        const {category_name,description} = req.body;

        const category = await Category.create({
            cat_name: category_name,
            slug: generateSlug(category_name),
            description:description,
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
            description:description,
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
            ["0", new Date(),categoryId]
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

       let {category_id,status} = req.body;

        if (isNaN(category_id) || isNaN(status)) {
            return res.status(200).json({ status: false, message: 'Invalid Category ID or Status', error: '' });
        }

        //check no of product for particular category
        const count = await db.query(`select c.id as cat_id,c.cat_name as category_name,c.slug,COALESCE(c.description,'') as description,
        COALESCE(COUNT(p.id),0) as no_of_products from categories as c
        LEFT JOIN products as p ON c.id = p.category
        where c.id = $1 and c.status = $2 and c.deleted_at IS NULL
        GROUP BY c.cat_name,c.id Order BY c.id desc`,[category_id,1]);

        if(count.rowCount > 0 && count.rows.no_of_products > 0){
            return res.status(200).json({ status: false,
                message: `Category has products cannot be deleted` });
        }else{

            const updateCategory = await db.query(
                `UPDATE categories SET status = $1, updated_by = $2 where id = $3`,
                [status, req.user.id,category_id]
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

const excelExportCategory=catchAsync( async(req,res)=>{
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
        const fileName = `category_list.xlsx`;
        const filePath = path.join(process.cwd(), "public/uploads/exports", fileName);

        // Ensure directory exists
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        // Save Excel file
        await workbook.xlsx.writeFile(filePath);

        // Send file path as response
        return res.status(200).json({ success: true, filePath: BASE_URL+`/uploads/exports/${fileName}` });

    } catch (error) {
        return res.status(200).json({ success: false, message: "Internal Server Error" ,error:error.message});
    }
});
/* Category API End ------------------------------- */

/* Product API Start ------------------------------- */
const getProductlist = catchAsync(async (req, res) => {
    try {
        const {category_id} = req.body;
        const query_params = [1];
        let categories = '';

        if(category_id){
            categories = `and p.category = $${query_params.length + 1}`;
            query_params.push(category_id)
         }

        //get total number of products
        const totalProducts = await db.query(`select COUNT(p.id) as product_id
         from products as p LEFT JOIN categories as c ON p.category = c.id
         LEFT JOIN country_data as ca ON p.country_id = ca.id
         WHERE p.status = $1 AND p.deleted_at IS NULL ${categories} GROUP BY p.id ORDER BY p.id desc`,
         query_params
        );

        //get get product list
        const query = `select p.id as product_id,p.name as product_name,c.cat_name as category_name
        ,p.price as current_price,
        CONCAT('${BASE_URL}/images/img-country-flag/',ca.flag) as country_flag,
        p.category as category_id,
        ca.country_name,
        TO_CHAR(p.created_at,'FMDD FMMonth YYYY') as last_updated_date,
        p.product_stock_status,p.status
         from products as p LEFT JOIN categories as c ON p.category = c.id
         LEFT JOIN country_data as ca ON p.country_id = ca.id
         WHERE p.status = $1 AND p.deleted_at IS NULL ${categories} ORDER BY p.id desc`;

        const getProductslist = await db.query(query,query_params)

        return res.status(200).json({
            status: true,
            total:(totalProducts.rowCount > 0) ? totalProducts.rowCount : 0,
            message: 'Fetch Product Successfully',
            data:(getProductslist.rowCount > 0) ? getProductslist.rows : []
          });
    } catch (error) {
        throw new AppError(error.message, 400);
    }

});

const countries = catchAsync(async (req, res) => {
    try {

        const query = `select c.id,c.country_name,c.code1 as code,CONCAT('${BASE_URL}/images/img-country-flag/',c.flag) from country_data as c`;

        const getCountrylist = await db.query(query,[])

        return res.status(200).json({
            status: true,
            message: 'Fetch Countries Successfully',
            data:(getCountrylist.rowCount > 0) ? getCountrylist.rows : []
          });
    } catch (error) {
        throw new AppError(error.message, 400);
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
        body('country_flag').notEmpty().withMessage('country flag is required')
    ]);


    // Handle validation result
    const errors = validationResult(req);
    try {
        const body = req.body;
        const files = req.files;

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

        const product = await Product.create({
            name: body.name,
            slug: generateSlug(body.name),
            description: body.description,
            minimum_order_place:1,
            maximum_order_place: 10,
            price: 0,
            country_id:body.country_id,
            country_flag:body.country_flag,
            category: body.category,
            created_by: req.user.id,
            ordering: (OrderingId) ? parseInt(OrderingId) + 1 : 1,
            status: 1,
        });

        const product_id=product.id;

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


        // const price_log = await Products_price_logs.create({
        //     product_id: product_id,
        //     price: body.price,
        //     created_by: req.user.id,
        //     updated_by: req.user.id
        // });

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
    const productId = req.body.product_id;

    // Apply validation rules
    await Promise.all([
        body('name').notEmpty().withMessage('Name is required').run(req),
        body('description').notEmpty().withMessage('Description is required').run(req),
        body('category').notEmpty().withMessage('Category is required').run(req)
    ]);

    const errors = validationResult(req);

    try {
        const body = req.body;
        const files = req.files;

        const product = await Product.findOne({ where: { id: productId, deleted_at: null } });

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

        // Update product fields
        await Product.update({
            name: body.name,
            slug: generateSlug(body.name),
            description: body.description,
            country_id:body.country_id,
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

        // Optional: log price change
        if(product.price != body.price)
        {
            await Products_price_logs.create({
                product_id: productId,
                price: body.price,
                created_by: req.user.id,
                updated_by: req.user.id
            });
        }
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
    try {
        await Promise.all([
            body('id')
                .notEmpty().withMessage('Product ID is required')
                .run(req)
        ]);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = await formatValidationArray(errors);
            return res.status(200).json({ status: false, errors: formattedErrors });
        }

        const productId = parseInt(req.body.id);

        if (isNaN(productId)) {
            return res.status(200).json({ status: false, message: 'Invalid Product ID', error: '' });
        }

        const query = `
            SELECT
                p.id,
                p.name,
                p.slug,
                p.description,
                p.minimum_order_place,
                p.maximum_order_place,
                p.price,
                p.category,
                p.ordering,
                p.status,

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
            WHERE p.deleted_at IS NULL AND p.id = $1
            GROUP BY p.id
        `;

        const result = await db.query(query, [productId]);

        if (result.rowCount <= 0) {
            return res.status(200).json({ status: false, message: 'Product Not Found', error: '' });
        }

        return res.status(200).json({
            status: true,
            message: 'Product Found',
            data: result.rows[0]
        });

    } catch (error) {
        return res.status(200).json({ status: false, message: 'Product Not Found', error: error.message });
    }
});

const deleteProductById = catchAsync(async (req, res) => {
    try {
        await Promise.all([
            body('id')
                .notEmpty().withMessage('Product ID is required')
                .run(req)
        ]);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = await formatValidationArray(errors);
            return res.status(200).json({ status: false, errors: formattedErrors });
        }

        const productId = parseInt(req.body.id);

        if (isNaN(productId)) {
            return res.status(200).json({ status: false, message: 'Invalid Product ID', error: '' });
        }

        const result = await Product.findByPk(productId);

        if (!result) {
            return res.status(200).json({ status: false, message: 'Product not found', error: '' });
        }

        await result.destroy(); // uses Sequelize's soft delete (paranoid)

        const data = {
            user_id: req.user.id,
            table_id: productId,
            table_name: 'products',
            action: 'delete',
        };

        adminLog(data);

        return res.status(200).json({ status: true, message: 'Product deleted successfully' });

    } catch (error) {
        return res.status(200).json({ status: false, message: 'Product not deleted', error: error.message });
    }
});

const updateProductStatusById = catchAsync(async (req, res) => {
    try {
        await Promise.all([
            body('id').notEmpty().withMessage('Product ID is required').run(req),
            body('status').notEmpty().withMessage('status is required').run(req),
        ]);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = await formatValidationArray(errors);
            return res.status(200).json({ status: false, errors: formattedErrors });
        }

        const productId = parseInt(req.body.id);
        const status = parseInt(req.body.status);

        if (isNaN(productId) || isNaN(status)) {
            return res.status(200).json({ status: false, message: 'Invalid Product ID or Status', error: '' });
        }

        const updated = await Product.update(
            {
                status: status,
                updated_by: req.user.id,
            },
            {
                where: { id: productId }
            }
        );

        if (!updated || updated[0] === 0) {
            return res.status(200).json({ status: false, message: 'Product status not updated', error: '' });
        }

        const data = {
            user_id: req.user.id,
            table_id: productId,
            table_name: 'products',
            action: 'status to ' + status,
        };

        adminLog(data);

        return res.status(200).json({ status: true, message: 'Product status updated successfully' });

    } catch (error) {
        return res.status(200).json({ status: false, message: 'Product status not updated', error: error.message });
    }
});

//excel export products
const excelExportProducts = catchAsync(async(req,res)=>{
    try {

        // Query database
        const query = `SELECT
                p.id,
                p.name,
                p.slug,
                p.description,
                p.minimum_order_place,
                p.maximum_order_place,
                p.price,
                ci.cat_name as category,
                p.status,

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
            WHERE p.deleted_at IS NULL group by p.id,ci.cat_name
        `;

        //return res.json(query)

        const result = await db.query(query, []);
        let list = result.rows;

        // Create Excel file
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Products");

        worksheet.columns = [
            { header: "ID", key: "id", width: 10 },
            { header: "Product Name", key: "name", width: 25 },
            { header: "Slug", key: "slug", width: 25 },
            { header: "Description", key: "description", width: 40 },
            { header: "Min Order", key: "minimum_order_place", width: 15 },
            { header: "Max Order", key: "maximum_order_place", width: 15 },
            { header: "Price", key: "price", width: 10 },
            { header: "Category", key: "category", width: 15 },
            { header: "Status", key: "status", width: 10 },
            { header: "Images", key: "product_images", width: 40 }
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
                category: row.category,
                status: row.status == 1 ? "Active" : "Inactive",
                product_images: (row.product_images || []).join(", ")
            });
        });


        // Generate file name and path
        const fileName = `product_list.xlsx`;
        const filePath = path.join(process.cwd(), "public/uploads/exports", fileName);

        // Ensure directory exists
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        // Save Excel file
        await workbook.xlsx.writeFile(filePath);

        // Send file path as response
        return res.json({ success: true, filePath: BASE_URL+`/uploads/exports/${fileName}` });

    } catch (error) {
        return res.status(200).json({ success: false, message: "Internal Server Error",error:error.message });
    }
});

const changeProductPrice = catchAsync(async(req,res)=>{
    try {
        await Promise.all([
            body('product_id').notEmpty().withMessage('Product ID is required').run(req),
            body('price').notEmpty().withMessage('Price is required').run(req),
        ]);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = await formatValidationArray(errors);
            return res.status(200).json({ status: false, errors: formattedErrors });
        }

        const productId = parseInt(req.body.product_id);
        const price = parseInt(req.body.price);

        if (isNaN(productId) || isNaN(price)) {
            return res.status(200).json({ status: false, message: 'Invalid Product ID or Status', error: '' });
        }

        const update_product = await Product.update(
            {
                price: price,
                updated_by: req.user.id,
            },
            {
                where: { id: productId }
            }
        );

        const update_log = await Products_price_logs.create({
            product_id: productId,
            price: req.body.price,
            created_by: req.user.id,
            updated_by: req.user.id
        });

        if (!update_log || update_log[0] === 0) {
            return res.status(200).json({ status: false, message: 'Product price not updated', error: '' });
        }

        const data = {
            user_id: req.user.id,
            table_id: productId,
            table_name: 'products_price_logs',
            action: 'price to ' + price,
        };

        adminLog(data);

        return res.status(200).json({ status: true, message: 'Product price updated successfully' });

    } catch (error) {
        return res.status(200).json({ status: false, message: 'Product price not updated', error: error.message });
    }
});

const getProductPriceLogs =catchAsync(async(req,res)=>{
    try
    {
        await Promise.all([
            body('product_id')
                .notEmpty().withMessage('Product ID is required')
                .run(req)
        ]);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = await formatValidationArray(errors);
            return res.status(200).json({ status: false, errors: formattedErrors });
        }

        const productId = parseInt(req.body.product_id);

        if (isNaN(productId)) {
            return res.status(200).json({ status: false, message: 'Invalid Product ID', error: '' });
        }

        const query = `SELECT price, TO_CHAR(created_at, 'DD/Mon/YYYY') AS date_of_update
            FROM products_price_logs
            WHERE product_id = ${productId} order by id desc`;
        const result=await db.query(query,[]);



        return res.status(200).json({ success: true,
             message: "logs retrieved successfully",
            data:result.rows });
    }
    catch(error)
    {
        return res.status(200).json({ success: false, message: "Internal Server Error",error:error.message });
    }
});

const exportProductPriceLogs = catchAsync(async(req,res)=>{
    await Promise.all([
        body('product_id')
            .notEmpty().withMessage('Product ID is required')
            .run(req)
    ]);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = await formatValidationArray(errors);
        return res.status(200).json({ status: false, errors: formattedErrors });
    }

    const productId = parseInt(req.body.product_id);

    if (isNaN(productId)) {
        return res.status(200).json({ status: false, message: 'Invalid Product ID', error: '' });
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
        const fileName = `product_price_list.xlsx`;
        const filePath = path.join(process.cwd(), "public/uploads/exports", fileName);

        // Ensure directory exists
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        // Save Excel file
        await workbook.xlsx.writeFile(filePath);

        // Send file path as response
        return res.status(200).json({ success: true, filePath: BASE_URL+`/uploads/exports/${fileName}` });

    } catch (error) {
        return res.status(200).json({ success: false, message: "Internal Server Error" ,error:error.message});
    }
});

const changeProductStockStatus = catchAsync(async (req, res) => {
    try {
        await Promise.all([
            body('product_id').notEmpty().withMessage('Product ID is required').run(req),
            body('product_stock_status').notEmpty().withMessage('Product stock status is required').run(req),
        ]);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = await formatValidationArray(errors);
            return res.status(200).json({ status: false, errors: formattedErrors });
        }

        const productId = parseInt(req.body.product_id);
        const product_stock_status = parseInt(req.body.product_stock_status);

        if (isNaN(productId) || isNaN(product_stock_status)) {
            return res.status(200).json({ status: false, message: 'Invalid Product ID or Stock Status', error: '' });
        }

        const updated = await Product.update(
            {
                product_stock_status: product_stock_status,
                updated_by: req.user.id,
            },
            {
                where: { id: productId }
            }
        );

        if (!updated || updated[0] === 0) {
            return res.status(200).json({ status: false, message: 'Product Stock status not updated', error: '' });
        }

        const data = {
            user_id: req.user.id,
            table_id: productId,
            table_name: 'products',
            action: 'stock status to ' + product_stock_status,
        };

        adminLog(data);

        return res.status(200).json({ status: true, message: 'Product stock status updated successfully' });

    } catch (error) {
        return res.status(200).json({ status: false, message: 'Product stock status not updated', error: error.message });
    }
});
/* Product API END ------------------------------- */

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
    getProductlist
}
