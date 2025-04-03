import dotenv from 'dotenv';
dotenv.config({ path: `${process.cwd()}/.env` });

// Defaults
import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import { generateSlug, media_url } from "../../helpers/slug_helper.js";
import Category from "../../db/models/category.js";
import { body, validationResult } from "express-validator";
import { Op, QueryTypes,Sequelize } from "sequelize";
import { compare } from "bcrypt";
import bcrypt from "bcrypt";
import sequelize from "../../config/database.js";
import moment  from 'moment';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3848';

/* Category API Start ------------------------------- */

// GET all categories (datatables)
const getCategories = catchAsync(async (req, res) => {
    try {
        if (!req.xhr) {
            throw new AppError('Bad Request: Only AJAX requests are allowed', 400);
        }

        // Extract query parameters
        const draw = req.body.draw;
        const start = parseInt(req.body.start);
        const length = parseInt(req.body.length);
        const order_data = req.body.order;

        let column_name = 'ordering'; // Default column for sorting
        let column_sort_order = 'ASC'; // Default sorting order

        // Check if order_data exists, then extract sorting info
        if (order_data) {
            const column_index = req.body.order[0].column;
            column_name = req.body.columns[column_index].data;
            column_sort_order = req.body.order[0].dir.toUpperCase();
        }

        var where = {};
        where = {
                    deleted_at: null,
                };
        // Fetch total records
        const totalRecords = await Category.count({
            where: where,
        });

        // Search value handling
        const search_value = req.body.search && req.body.search.value ? req.body.search.value.toLowerCase() : '';
        let search_query = ` WHERE categories.deleted_at IS NULL`;

        // if (req.user && req.user.role != 1) {
        //     search_query += ` AND categories.created_by = ${req.user.id}`;
        // }

        const query_params = [];

        if (search_value) {
            search_query += ` AND (
            LOWER(cat_name) LIKE $1 OR
            LOWER(u1.name) LIKE $1 OR
            LOWER(u2.name) LIKE $1
            )
            `;
            query_params.push(`%${search_value}%`);
        }

        // Filter data count from the database
        const filter_query = `SELECT categories.*,
        u1.name AS created_by_name,
        u2.name AS updated_by_name FROM categories
        LEFT JOIN users u1 ON categories.created_by = u1.id
        LEFT JOIN users u2 ON categories.updated_by = u2.id ${search_query}`;
        const filter_result = await db.query(filter_query, query_params);

        let order_query = ` ORDER BY ${column_name} ${column_sort_order}`;
        let limit_query = ``;

        if (length > 0) {
            limit_query = ` OFFSET $${query_params.length + 1} LIMIT $${query_params.length + 2}`;
            query_params.push(start, length);
        }

        // Fetch total records with filtering
        const totalRecordsWithFilter = filter_result.rows.length;

        // Filter data count from the database
        const query = `SELECT categories.*,
        u1.name AS created_by_name,
        u2.name AS updated_by_name FROM categories
        LEFT JOIN users u1 ON categories.created_by = u1.id
        LEFT JOIN users u2 ON categories.updated_by = u2.id
        ${search_query} ${order_query} ${limit_query}`;

        const result = await db.query(query, query_params);

        let categories = result.rows;

        // Map data for response
        const data_arr = categories.map((category, index) => {
            const createdAtFormatted = new Date(category.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',

            });

            const updatedAtFormatted = new Date(category.updated_at).toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',

            });

            const created_by = `<div class='created'>
                            <small> `+category.created_by_name+`</small>
                                <br/>
                                <small class='text-muted'>`+createdAtFormatted+`</small>
                                </div>`;

            if(category.updated_by_name!='' && category.updated_by_name!=null)
            {
                var updated_by = `<div class='created'>
                                    <small > `+category.updated_by_name+`</small>
                                        <br/>
                                        <small class='text-muted'>`+updatedAtFormatted+`</small>
                                        </div>`;
            }
            else
            {
               var updated_by ='';
            }

            let status = ``;

            if (category.status == 1) {
                status = `<div class="form-check form-switch form-check-custom form-check-solid">
                                <input class="form-check-input h-20px w-30px" type="checkbox" onchange="return change_status(${category.id},0)" id="category_${category.id}" checked="checked" />
                                <label class="form-check-label text-success" for="category_${category.id}">
                                    <span class="badge badge-success">Active</span>
                                </label>
                            </div>`;
            } else {
                status = `<div class="form-check form-switch form-check-custom form-check-solid">
                                <input class="form-check-input h-20px w-30px" type="checkbox" onchange="return change_status(${category.id},1)" id="category_${category.id}" />
                                <label class="form-check-label text-dark" for="category_${category.id}">
                                    <span class="badge badge-danger">In-active</span>
                                </label>
                            </div>`;
            }
            var icon_image="";
            if(category.icon!='' && category.icon!=null)
            {
            var icon_image=`<div class="text-center">
                            <img src="${category.icon}" alt="image_preview" class="dbimg rounded">

                        </div>`;
            }

            var green_icon_image="";
            if(category.green_icon!='' && category.green_icon!=null)
            {
            var green_icon_image=`<div class="text-center">
                            <img src="${category.green_icon}" alt="image_preview" class="dbimg rounded">

                        </div>`;
            }

            return {
                id:category.id,
                ordering:category.ordering,
		        icon:icon_image,
                green_icon:green_icon_image,
                cat_name: category.cat_name,
                created_by_name: created_by,
                //createdAt: createdAtFormatted,
                updated_by_name: updated_by,
                //updatedAt: updatedAtFormatted,
                status: status,
                action: `<div class="text-center">
                            <a href="javascript:void(0)" onclick="return edit_data(${category.id});"
                                class="btn btn-icon btn-bg-light btn-active-color-dark btn-sm me-1 mb-2" data-bs-toggle="tooltip" data-bs-placement="top" title="Edit">
                                <i class="ki-duotone text-dark
                                    ki-pencil fs-1">
                                    <span class="path1"></span>
                                    <span class="path2"></span>
                                </i>
                            </a>
                            <a href="javascript:void(0)" onclick="return delete_data(${category.id});"
                                class="btn btn-icon btn-bg-light btn-active-color-danger btn-sm me-1 mb-2" data-bs-toggle="tooltip" data-bs-placement="top" title="Delete">
                                <i class="ki-duotone text-dark
                                    ki-trash fs-1">
                                    <span class="path1"></span>
                                    <span class="path2"></span>
                                    <span class="path3"></span>
                                    <span class="path4"></span>
                                    <span class="path5"></span>
                                </i>
                            </a>
                        </div>`
            };
        });

        // Create output
        const output = {
            draw: draw,
            recordsTotal: totalRecords,
            recordsFiltered: totalRecordsWithFilter,
            data: data_arr,
        };

        // Send the output
        return res.json(output);
    } catch (error) {
        throw new AppError(error.message, 400);
    }

  });

  // POST create category
const createCategory = catchAsync(async (req, res) => {

    // Apply validation rules
    await Promise.all([
        body('cat_name').notEmpty().withMessage('Category Name is required').custom(async (value) => {
            // Check if the name already exists in the database
            const existingCategory = await Category.findOne({ where: { cat_name: value } });
            if (existingCategory) {
                throw new Error('Category Name already exists');
            }
        }).run(req),
    ]);

    // Handle validation result
    const errors = validationResult(req);


    try {
        const body = req.body;

        const errors = validationResult(req);

        const files = req.files;
        const icon = files.icon ? media_url(files.icon[0].path) : null;
        const green_icon = files.green_icon ? media_url(files.green_icon[0].path) : null;

        if (icon=='' || icon==null) {
            errors.errors.push({ msg: "Please upload icon image", path: "icon" });
        }

        if (green_icon=='' || green_icon==null) {
            errors.errors.push({ msg: "Please upload green icon image", path: "green icon" });
        }

        if (!errors.isEmpty()) {
            //console.log(errors)
            return res.status(400).json({ status: false, errors: errors });

        }

        let categoriesOrderingId = 0;
        // Get the current highest ordering
        const getCountOrdering = await db.query(
            "SELECT * FROM categories where deleted_at IS NULL ORDER BY ordering DESC LIMIT 1"
        );

        if (getCountOrdering.rows.length > 0) {
            categoriesOrderingId = getCountOrdering.rows[0].ordering;
        }


        const category = await Category.create({
            cat_name: body.cat_name,
            slug: generateSlug(body.cat_name),
            created_by: req.user.id,
            updated_by:req.user.id,
            ordering: (categoriesOrderingId) ? parseInt(categoriesOrderingId) + 1 : 1,
            icon:icon,
            green_icon:green_icon,
            status: '1',
        });

        if (!category) {
            throw new AppError('Category Not Created');
        }

        const data = {
            user_id: req.user.id,
            table_id: category.id,
            table_name: 'categories',
            action: 'insert',
        };

        adminLog(data);

        return res.status(201).json({ status: true, message: 'Category created successfully' });

    } catch (error) {
        throw new AppError(error.message, 400);
    }
  });

  // GET category by ID
const getCategoryById = catchAsync(async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);

        if (isNaN(categoryId)) {
            throw new AppError('Invalid Category ID');
        }

        // Fetch data from the database
        const query = `SELECT * FROM categories WHERE deleted_at ISNULL AND id = ${categoryId}`;

        const result = await db.query(query);

        if (result.rowCount <= 0) {
            throw new AppError('Data Not Found');
        }

        return res.status(200).json({ status: true, message: 'Data Found', data: result.rows[0] });
    } catch (error) {
        throw new AppError(error.message, 400);
    }
  });

  // PATCH update category by ID
const updateCategoryById = catchAsync(async (req, res) => {

    const categoryId = parseInt(req.params.id);

    // Apply validation rules
    await Promise.all([
        body('cat_name').notEmpty().withMessage('Category Name is required').custom(async (value) => {
            // Check if the name already exists in the database
            const existingCategory = await Category.findOne({
                where: {
                    cat_name: value,
                    id: { [Op.ne]: categoryId } // Exclude the current location from uniqueness check
                }
            });

            if (existingCategory) {
                throw new Error('Category Name already exists');
            }
        }).run(req),
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error_message = errors.array()[0].msg;

        throw new AppError(error_message, 422, errors);
    }

    try {

        if (isNaN(categoryId)) {
            throw new AppError('Invalid Category ID');
        }


        const { cat_name } = req.body;

        if (!cat_name) {
            throw new AppError('Category Name is required', 400);
        }

        const category_res = await Category.findOne({ where: { id: categoryId } });
        if (!category_res) {
            return res.json({ status: false, message: "Category not found" });
        }
        const files = req.files;

        const icon = files.icon
            ? media_url(files.icon[0].path)
            : category_res.icon;

        const green_icon = files.green_icon
            ? media_url(files.green_icon[0].path)
            : category_res.green_icon;


        const updateCategory = await Category.update({
            cat_name: cat_name,
            icon,
            green_icon,
            updated_by: req.user.id,
        }, {
            where: { id: categoryId }
        });

        if (!updateCategory) {
            throw new AppError('Category Not Updated', 400);
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
        throw new AppError(error.message, 400);
    }
  });

  // DELETE category by ID
const deleteCategoryById = catchAsync(async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);

        if (isNaN(categoryId)) {
            throw new AppError('Invalid Category ID');
        }



        const result = await Category.findByPk(categoryId);

        if (!result) {
            throw new AppError(`Category not found`);
        }

        await result.destroy();

        const data = {
            user_id: req.user.id,
            table_id: categoryId,
            table_name: 'categories',
            action: 'delete',
        };

        adminLog(data);

        return res.status(200).json({ status: true, message: 'Data Deleted' });

    } catch (error) {
        throw new AppError(error.message, 400);
    }
  });

  // PATCH update category status by ID
const updateCategoryStatusById = catchAsync(async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);
        const status = parseInt(req.params.status);

        if (isNaN(categoryId) || isNaN(status)) {
            throw new AppError('Invalid Category ID or Status');
        }

        const updateCategory = await Category.update({
            status: status,
            updated_by: req.user.id,
        }, {
            where: { id: categoryId }
        });

        if (!updateCategory) {
            throw new AppError('Category Status Not Updated', 400);
        }

        const data = {
            user_id: req.user.id,
            table_id: categoryId,
            table_name: 'categories',
            action: 'status to ' + status,
        };

        adminLog(data);

        return res.status(200).json({ status: true, message: 'Category status updated successfully' });

    } catch (error) {
        throw new AppError(error.message, 400);
    }
  });

  /* Category API End ------------------------------- */


export {
    /* Category API */
    getCategories,
    createCategory,
    getCategoryById,
    updateCategoryById,
    deleteCategoryById,
    updateCategoryStatusById

}
