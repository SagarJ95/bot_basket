import dotenv from 'dotenv';
dotenv.config({ path: `${process.cwd()}/.env` });

// Defaults
import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import db from "../../config/db.js";

// Sequelize
//import sequelize from "../config/database.js";

// Helpers
import {
  encryptPassword,
  decryptPassword,
} from "../../helpers/password_helper.js";
import { generateToken } from "../../helpers/jwt_helper.js";

// Models
import User from "../../db/models/user.js";
import Role from "../../db/models/role.js";
import RolePermission from "../../db/models/role_module_permissions.js";
// Node Modules
import { body, validationResult } from "express-validator";
import { Op, QueryTypes,Sequelize } from "sequelize";
import { compare } from "bcrypt";
import bcrypt from "bcrypt";
import moment  from 'moment';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3847';

/* Users API Start (Only For Super Admin) ----------------- */

// GET all users (datatables)
const getUsers = catchAsync(async (req, res) => {
  try {
    if (!req.xhr) {
      throw new AppError("Bad Request: Only AJAX requests are allowed", 400);
    }

    const draw = req.body.draw;
    const start = parseInt(req.body.start);
    const length = parseInt(req.body.length);
    const order_data = req.body.order;

    // const { draw, start, length, search, order, columns } = req.query;

    let column_name = "users.id"; // Default column for sorting
    let column_sort_order = "DESC"; // Default sorting order

    // Check if order_data exists, then extract sorting info
    if (order_data) {
      const column_index = req.body.order[0].column;
      column_name = req.body.columns[column_index].data;
      column_sort_order = req.body.order[0].dir.toUpperCase();
    }

    // Fetch total records
    const totalRecords = await User.count({
      where: {
        deleted_at: null,
        id: {
          [Sequelize.Op.ne]: 1, // 'not equal' condition
        },
      },
    });

    // Search value handling
    const search_value =
      req.body.search && req.body.search.value
        ? req.body.search.value.toLowerCase()
        : "";
    let search_query = ` WHERE users.deleted_at IS NULL AND users.id != 1`;
    //let search_query = ` WHERE users.deleted_at ISNULL`;
    const query_params = [];
    if (search_value) {
      search_query += ` AND (
       LOWER(users.name) LIKE $1 OR
       LOWER(users.email) LIKE $1 OR
       LOWER(roles.role_name) LIKE $1 OR
       LOWER(u1.name) LIKE $1 OR
       LOWER(u2.name) LIKE $1
       )`;
      //query_params.push(`%${search_value}%`, `%${search_value}%`);
      query_params.push(`%${search_value}%`);
    }

    const {status,role}=req.body;
      const range_date = req.body.range_date || "";

    if (range_date.includes(" - ")) {
        let start_date = range_date.split(" - ")[0].trim();
        let end_date = range_date.split(" - ")[1].trim();

        // Convert from DD-MM-YYYY to YYYY-MM-DD
        start_date = moment(start_date, "DD-MM-YYYY").format("YYYY-MM-DD");
        end_date = moment(end_date, "DD-MM-YYYY").format("YYYY-MM-DD");

        if (start_date && end_date) {
            search_query += ` AND users.updated_at::DATE BETWEEN $${query_params.length + 1} AND $${query_params.length + 2}`;
            query_params.push(start_date, end_date);
        }
    }

    if(status && status!='')
    {
        search_query += ` AND users.status=$${query_params.length+1}`;
        query_params.push(`${status}`);
    }

    if(role && role!='')
      {
          search_query += ` AND users.role=$${query_params.length+1}`;
          query_params.push(`${role}`);
      }

    // Filter data count from the database
    const filter_query = `SELECT users.name,
    users.email,
    users.created_at,
    roles.role_name,
    u1.name AS created_by_name, u2.name AS updated_by_name
    FROM users
    LEFT JOIN roles ON users.role = roles.id
    LEFT JOIN users u1 ON users.created_by = u1.id
    LEFT JOIN users u2 ON users.updated_by = u2.id
    ${search_query}`;

    //return res.json(filter_query);
    const filter_result = await db.query(filter_query, query_params);
    let order_query = ` ORDER BY ${column_name} ${column_sort_order}`;
    let limit_query = ``;

    if (length > 0) {
      limit_query = ` OFFSET $${query_params.length + 1} LIMIT $${
        query_params.length + 2
      }`;
      query_params.push(start, length);
    }

    // Fetch total records with filtering
    const totalRecordsWithFilter = filter_result.rows.length;
    // Filter data count from the database
    // const query = `SELECT * FROM users ${search_query} ${order_query} ${limit_query}`;
    const query = `SELECT users.id,users.name,
    users.email,
    users.created_at,
    roles.role_name,
    users.status,
    users.created_at,users.updated_at,
    u1.name AS created_by_name, u2.name AS updated_by_name
    FROM users
    LEFT JOIN roles ON users.role = roles.id
    LEFT JOIN users u1 ON users.created_by = u1.id
    LEFT JOIN users u2 ON users.updated_by = u2.id
    ${search_query} ${order_query} ${limit_query}`;
    const result = await db.query(query, query_params);
    let users = result.rows;
    // Map data for response
    const data_arr = users.map((user, index) => {
      const createdAtFormatted = new Date(user.created_at).toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "2-digit",
          year: "numeric"
        }
      );

      const created_by = `<div class='created'>
            <small> `+user.created_by_name+`</small>
            <br/>
            <small class='text-muted'>`+createdAtFormatted+`</small>
            </div>`;

            const updatedAtFormatted= new Date(user.updated_at).toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric'
            });

            if(user.updated_by_name!='' && user.updated_by_name!=null)
            {
                var updated_by = `<div class='created'>
                <small > `+user.updated_by_name+`</small>
                <br/>
                <small class='text-muted'>`+updatedAtFormatted+`</small>
                </div>`;
            }
            else
            {
               var updated_by ='';
            }
      // let user_id = JSON.stringify(
      //   encryptionData("node_encryption", user.id.toString())
      // );

      const user_id = user.id;

      let status = ``;

      if (user.status == "0") {
        status += `
        <div class="d-flex justify-content-center">
        <label  class="form-check form-switch form-check-custom form-check-solid me-10">
            <input  class="form-check-input h-20px w-30px" type="checkbox" onchange="return change_status(${user_id},'1')">&nbsp;&nbsp; <span class="badge badge-danger">Deactivate</span>
        </label>
        </div>
        `;
      } else if (user.status == "1") {
        status += `
        <div class="d-flex justify-content-center">
        <label class="form-check form-switch form-check-custom form-check-solid me-10">
            <input  class="form-check-input h-20px w-30px" type="checkbox" checked="checked" onchange="return change_status(${user_id},'0')">&nbsp;&nbsp; <span class="badge badge-success">Active</span>
        </label>
        </div>
        `;
      }

      return {
        serial: start + index + 1, // Serial number calculation
        name: user.name,
        address: user.email,
        roles: user.role_name,
        created_by: created_by,
        updated_by:updated_by,
        status: status,
        action: `<div class="d-flex justify-content-center">
            <a href="javascript:void(0)" onclick='return edit_data(${user_id});'
                class="btn btn-icon btn-bg-light btn-active-color-dark btn-sm me-1 mb-2" data-bs-toggle="tooltip" data-bs-placement="top" title="Edit">
                <i class="ki-duotone text-dark ki-pencil fs-1">
                    <span class="path1"></span>
                    <span class="path2"></span>
                </i>
            </a>
            <a href="javascript:void(0)" onclick='return delete_data(${user_id});'
                class="btn btn-icon btn-bg-light btn-active-color-danger btn-sm me-1 mb-2" data-bs-toggle="tooltip" data-bs-placement="top" title="Delete">
                <i class="ki-duotone text-dark ki-trash fs-1">
                    <span class="path1"></span>
                    <span class="path2"></span>
                    <span class="path3"></span>
                    <span class="path4"></span>
                    <span class="path5"></span>
                </i>
            </a>
        </div>`,
      };
    });

    // Create output
    const output = {
      draw: draw,
      iTotalRecords: totalRecords,
      iTotalDisplayRecords: totalRecordsWithFilter,
      data: data_arr,
    };

    // Send the output
    return res.json(output);
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

// GET all users
const getAllUsers = catchAsync(async (req, res) => {
  try {
    const start =
      parseInt(req.body.start) != NaN ? parseInt(req.body.start) : 0;
    const length =
      parseInt(req.body.length) != NaN ? parseInt(req.body.length) : 0;

    let column_name = "id"; // Default column for sorting
    let column_sort_order = "DESC"; // Default sorting order

    // Search value handling
    const search_value =
      req.body.search && req.body.search.value
        ? req.body.search.value.toLowerCase()
        : "";
    let search_query = ` WHERE deleted_at IS NULL AND users.id != 1`;
    const query_params = [];

    if (search_value) {
      search_query += ` AND (LOWER(name) LIKE $1 OR LOWER(email) LIKE $1 OR LOWER(role_name) LIKE $1)`;
      query_params.push(`%${search_value}%`);
    }

    let order_query = ` ORDER BY ${column_name} ${column_sort_order}`;
    let limit_query = ``;

    if (length > 0) {
      limit_query = ` OFFSET $${query_params.length + 1} LIMIT $${
        query_params.length + 2
      }`;
      query_params.push(start, length);
    }

    // Fetch data from the database
    const query = `SELECT users.name,users.email,users.created_at,roles.role_name FROM users LEFT JOIN roles ON user.role = roles.id ${search_query} ${order_query} ${limit_query}`;

    const result = await db.query(query, query_params);

    if (result.rowCount <= 0) {
      throw new AppError("Data Not Found");
    }

    return res
      .status(200)
      .json({ status: true, message: "Data Found", data: result.rows });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

// POST create user
const createUser = catchAsync(async (req, res) => {

    // Apply validation rules
    await Promise.all([
      body("name").notEmpty().withMessage("Name is required").run(req),
      body("email")
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid Email")
        .run(req),
      body("role").notEmpty().withMessage("Role is required").run(req),
      body("password").notEmpty().withMessage("Password is required").run(req),
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error_message = errors.array()[0].msg;

      throw new AppError(error_message, 422, errors);
    }

    try {
            const { role, name, email, password } = req.body;
            const created_by=req.session.user_id;
            if (!role || !name || !email || !password) {
            throw new AppError("Role, Name, Email and Password are required", 400);
            }

            const hashPassword = bcrypt.hashSync(password, 10);

            const enc_password = encryptPassword(password);

            const newUser = await User.create({
            role: role,
            name: name,
            email: email,
            password: hashPassword,
            enc_password: enc_password.encryptedPassword,
            iv_key: enc_password.iv,
            status: "1",
            created_by,
            updated_by:created_by
            });

            //store permission id in role_module_permissions based role
            storeUpdateRolePermission(newUser.id,role,1)


            if (!newUser) {
            throw new AppError("User Not Created");
            }

            return res
            .status(201)
            .json({ status: true, message: "User created successfully" });


  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

// GET user by ID
const getUserById = catchAsync(async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    //const userId = encryptionData("node_decryption", JSON.parse(req.params.id));

    if (isNaN(userId) || userId < 2) {
      throw new AppError("Invalid User ID");
    }

    // Fetch data from the database
    const query = `SELECT users.*,roles.role_name FROM users LEFT JOIN roles ON users.role = roles.id WHERE users.deleted_at ISNULL AND users.id = ${userId}`;

    const result = await db.query(query);

    if (result.rowCount <= 0) {
      throw new AppError("Data Not Found");
    }

    const info = {
      //id: encryptionData("node_encryption", result.rows[0].id.toString()),
      id: result.rows[0].id.toString(),
      role: result.rows[0].role,
      name: result.rows[0].name,
      email: result.rows[0].email,
    };

    return res
      .status(200)
      .json({ status: true, message: "Data Found", data: info });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

// PATCH update user by ID
const updateUserById = catchAsync(async (req, res) => {

    const userId = parseInt(req.params.id);
    //const userId = encryptionData("node_decryption", JSON.parse(req.params.id));

    if (isNaN(userId) || userId < 2) {
      throw new AppError("Invalid User ID");
    }

    // Apply validation rules
    await Promise.all([
      body("name").notEmpty().withMessage("Name is required").run(req),
      body("email")
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid Email")
        .custom(async (value) => {
          // Check if the name already exists in the database
          const existingUser = await User.findOne({
            where: {
              email: value,
              id: { [Op.ne]: userId }, // Exclude the current location from uniqueness check
            },
          });
          if (existingUser) {
            throw new Error("Email already exists");
          }
        })
        .run(req),
        body("role").notEmpty().withMessage("Role is required").run(req),
    ]);

    // Handle validation result
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const error_message = errors.array()[0].msg;

      throw new AppError(error_message, 422, errors);
    }

    try {
        if (isNaN(userId)) {
        throw new AppError("Invalid User ID");
        }

    const { name, email, role, password } = req.body;
    const updated_by=req.session.user_id;
    if (!name || !email) {
      throw new AppError("Name and Email are required", 400);
    }

    //first check role id user
    const perRoleIdQuery = `SELECT * from users where id = ${userId} LIMIT 1`;
    const pervRoleIdInfo = await db.query(perRoleIdQuery);

    if(pervRoleIdInfo.rowCount > 0 ){
      const PervRoleId = pervRoleIdInfo.rows[0].role;
      /*
      *  check pervious Role Id and Pass Role Id is not matched then
      *  store role wise per defined permission Id
      */
      if(PervRoleId != role){
        storeUpdateRolePermission(pervRoleIdInfo.rows[0].id,role,2)
      }
    }


    //if user provide password then password encrypted condition execute
    let userInfo;
    if (password.length > 0) {
      const hashPassword = bcrypt.hashSync(password, 10);
      const enc_password = encryptPassword(password);

      userInfo = {
        name: name,
        email: email,
        role: role,
        password: hashPassword,
        enc_password: enc_password.encryptedPassword,
        iv_key: enc_password.iv,
        updated_by
      };
    } else {
      userInfo = {
        name: name,
        email: email,
        role: role,
        updated_by
      };
    }

    const user = await User.update(userInfo, {
      where: { id: userId },
    });

    return res
      .status(200)
      .json({ status: true, message: "User updated successfully" });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

async function storeUpdateRolePermission(userId,roleId, type){
      const permissionIdQuery = await db.query(`SELECT * FROM roles where id = ${roleId} LIMIT 1`);

      if(permissionIdQuery.rowCount > 0){
        const permissionId = permissionIdQuery.rows[0].permission_id;

        /** Type 1 means create new user and 2 means update the records */
        if(type == 1){
            const updateRoleId = await RolePermission.create({
                user_id: userId,
                role_id: roleId,
                permissions_id: permissionId,
                status: "1",
              });
        }else{

            const updateDetails = {
                permissions_id: permissionId,
                role_id:roleId
            }
            const updateRoleId = await RolePermission.update(updateDetails, {
                where: { user_id: userId },
              });
        }

      }else{
        throw new AppError('Role Id is missing',500)
      }
}

// POST change password
const changePassword = catchAsync(async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId) || userId < 2) {
      throw new AppError("Invalid User ID");
    }

    // Apply validation rules
    await Promise.all([
      body("password").notEmpty().withMessage("Password is required").run(req),
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error_message = errors.array()[0].msg;

      throw new AppError(error_message, 422, errors);
    }

    if (isNaN(userId)) {
      throw new AppError("Invalid User ID");
    }

    const { password } = req.body;

    if (!password) {
      throw new AppError("Password is required", 400);
    }

    const hashPassword = bcrypt.hashSync(password, 10);

    const enc_password = encryptPassword(password);

    const user = await User.update(
      {
        password: hashPassword,
        enc_password: enc_password.encryptedPassword,
        iv_key: enc_password.iv,
      },
      {
        where: { id: userId },
      }
    );

    return res
      .status(200)
      .json({ status: true, message: "Password updated successfully" });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

// DELETE user by ID
const deleteUserById = catchAsync(async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    //const userId = encryptionData("node_decryption", JSON.parse(req.params.id));

    if (isNaN(userId) || userId < 2) {
      throw new AppError("Invalid User ID");
    }

    const result = await User.findByPk(userId);

    if (!result) {
      throw new AppError(`User not found`);
    }

    await result.destroy();

    return res.status(200).json({ status: true, message: "Data Deleted" });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

// ACTIVE DEACTIVE user by ID
const activeUserById = catchAsync(async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId) || userId < 2) {
      throw new AppError("Invalid User ID");
    }

    if (isNaN(userId)) {
      throw new AppError("Invalid User ID");
    }

    const { status } = req.body;

    if (!status) {
      throw new AppError("status is required", 400);
    }

    const user = await User.update(
      {
        status: status,
      },
      {
        where: { id: userId },
      }
    );

    return res
      .status(200)
      .json({ status: true, message: "status updated successfully" });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

/* Users API End (Only For Super Admin) ----------------- */

/* Role API Start (Only for Super Admin) ------------------------ */

// GET all roles (datatables)
const getRoles = catchAsync(async (req, res) => {
  try {
    if (!req.xhr) {
      throw new AppError("Bad Request: Only AJAX requests are allowed", 400);
    }

    const draw = req.body.draw;
    const start = parseInt(req.body.start);
    const length = parseInt(req.body.length);
    const order_data = req.body.order;

    let column_name = "id"; // Default column for sorting
    let column_sort_order = "DESC"; // Default sorting order

    // Check if order_data exists, then extract sorting info
    if (order_data) {
      const column_index = order[0].column;
      column_name = columns[column_index].data;
      column_sort_order = order[0].dir.toUpperCase();
    }

    // Fetch total records
    const totalRecords = await Role.count({
      where: {
        deleted_at: null,
        id: {
          [Sequelize.Op.ne]: 1, // 'not equal' condition
        },
      },
    });

    // Search value handling
    const search_value =
      req.body.search && req.body.search.value
        ? req.body.search.value.toLowerCase()
        : "";
    let search_query = ` WHERE roles.deleted_at IS NULL AND roles.id != 1 `;
    const query_params = [];

    if (search_value) {
      search_query += ` AND (
      LOWER(roles.role_name) LIKE $1 OR
      LOWER(u1.name) LIKE $1 OR
      LOWER(u2.name) LIKE $1
      )`;
      query_params.push(`%${search_value}%`);
    }

    // Filter data count from the database
    const filter_query = `SELECT roles.*,
    u1.name AS created_by_name, u2.name AS updated_by_name
    FROM roles
    LEFT JOIN users u1 ON roles.created_by = u1.id
    LEFT JOIN users u2 ON roles.updated_by = u2.id
    ${search_query}`;
    const filter_result = await db.query(filter_query, query_params);

    let order_query = ` ORDER BY ${column_name} ${column_sort_order}`;
    let limit_query = ``;

    if (length > 0) {
      limit_query = ` OFFSET $${query_params.length + 1} LIMIT $${
        query_params.length + 2
      }`;
      query_params.push(start, length);
    }

    // Fetch total records with filtering
    const totalRecordsWithFilter = filter_result.rows.length;

    // Filter data count from the database
    const query = `SELECT roles.*,
    u1.name AS created_by_name, u2.name AS updated_by_name
    FROM roles
    LEFT JOIN users u1 ON roles.created_by = u1.id
    LEFT JOIN users u2 ON roles.updated_by = u2.id
    ${search_query} ${order_query} ${limit_query}`;
    const result = await db.query(query, query_params);
    let roles = result.rows;

    // Map data for response
    const data_arr = roles.map((role, index) => {
      const createdAtFormatted = new Date(role.created_at).toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "2-digit",
          year: "numeric"
        }
      );

      const created_by = `<div class='created'>
        <small> `+role.created_by_name+`</small>
        <br/>
        <small class='text-muted'>`+createdAtFormatted+`</small>
        </div>`;

        const updatedAtFormatted= new Date(role.updated_at).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric'
        });

        if(role.updated_by_name!='' && role.updated_by_name!=null)
        {
            var updated_by = `<div class='created'>
            <small > `+role.updated_by_name+`</small>
            <br/>
            <small class='text-muted'>`+updatedAtFormatted+`</small>
            </div>`;
        }
        else
        {
            var updated_by ='';
        }

      const roleId = parseInt(role.id);

      return {
        serial: start + index + 1, // Serial number calculation
        role_name: role.role_name,
        created_by: created_by,
        updated_by:updated_by,
        action: `

        <div class="text-center">
                            <a href="javascript:void(0)" onclick="return edit_data(${roleId});"
                                class="btn btn-icon btn-bg-light btn-active-color-dark btn-sm me-1 mb-2" data-bs-toggle="tooltip" data-bs-placement="top" title="Edit">
                                <i class="ki-duotone text-dark ki-pencil fs-1">
                                    <span class="path1"></span>
                                    <span class="path2"></span>
                                </i>
                            </a>
                            <a href="javascript:void(0)" onclick="return delete_data(${roleId});"
                                class="btn btn-icon btn-bg-light btn-active-color-danger btn-sm me-1 mb-2" data-bs-toggle="tooltip" data-bs-placement="top" title="Delete">
                                <i class="ki-duotone text-dark ki-trash fs-1">
                                    <span class="path1"></span>
                                    <span class="path2"></span>
                                    <span class="path3"></span>
                                    <span class="path4"></span>
                                    <span class="path5"></span>
                                </i>
                            </a>
                        </div>`,
      };
    });

    // Create output
    const output = {
      draw: draw,
      iTotalRecords: totalRecords,
      iTotalDisplayRecords: totalRecordsWithFilter,
      data: data_arr,
    };

    // Send the output
    return res.json(output);
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

// GET all roles
const getAllRoles = catchAsync(async (req, res) => {
  try {
    const start =
      parseInt(req.body.start) != NaN ? parseInt(req.body.start) : 0;
    const length =
      parseInt(req.body.length) != NaN ? parseInt(req.body.length) : 0;

    let column_name = "id"; // Default column for sorting
    let column_sort_order = "DESC"; // Default sorting order

    // Search value handling
    const search_value =
      req.body.search && req.body.search.value
        ? req.body.search.value.toLowerCase()
        : "";
    let search_query = ` WHERE deleted_at IS NULL AND id != 1`;
    const query_params = [];

    if (search_value) {
      search_query += ` AND (LOWER(role_name) LIKE $1)`;
      query_params.push(`%${search_value}%`);
    }

    let order_query = ` ORDER BY ${column_name} ${column_sort_order}`;
    let limit_query = ``;

    if (length > 0) {
      limit_query = ` OFFSET $${query_params.length + 1} LIMIT $${
        query_params.length + 2
      }`;
      query_params.push(start, length);
    }

    // Fetch data from the database
    const query = `SELECT * from roles ${search_query} ${order_query} ${limit_query}`;

    const result = await db.query(query, query_params);

    if (result.rows.length <= 0) {
      throw new AppError("Data Not Found");
    }

    return res
      .status(200)
      .json({ status: true, message: "Data Found", data: result.rows });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

// POST create role
const createRole = catchAsync(async (req, res) => {

    // Apply validation rules
    await Promise.all([
      body("role_name")
        .notEmpty()
        .withMessage("Role Name is required")
        .custom(async (value) => {
          // Check if the name already exists in the database
          const existingRole = await Role.findOne({
            where: { role_name: value },
          });
          if (existingRole) {
            throw new Error("Role Name already exists");
          }
        })
        .run(req),
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error_message = errors.array()[0].msg;

      throw new AppError(error_message, 422, errors);
    }

    try {
    const { role_name } = req.body;
    const  created_by =req.session.user_id;


    if (!role_name) {
      throw new AppError("Role Name is required", 400);
    }

    const role = await Role.create({
      role_name: role_name,
      permission_id:'1,5,9,13,17,21,23,25,27',
      status:'1',
      created_by,
      updated_by:created_by
    });


    return res
      .status(201)
      .json({ status: true, message: "Role created successfully" });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

// GET role by ID
const getRoleById = catchAsync(async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);

    if (isNaN(roleId) || roleId < 2) {
      throw new AppError("Invalid Role ID");
    }

    // Fetch data from the database
    const query = `SELECT * FROM roles WHERE deleted_at ISNULL AND id = ${roleId}`;

    const result = await db.query(query);

    if (result.rowCount <= 0) {
      throw new AppError("Data Not Found");
    }

    return res
      .status(200)
      .json({ status: true, message: "Data Found", data: result.rows[0] });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

// PATCH update role by ID
const updateRoleById = catchAsync(async (req, res) => {

    const roleId = parseInt(req.params.id);

    if (isNaN(roleId) || roleId < 2) {
      throw new AppError("Invalid User ID");
    }

    // Apply validation rules
    await Promise.all([
      body("role_name")
        .notEmpty()
        .withMessage("Role Name is required")
        .custom(async (value) => {
          // Check if the name already exists in the database
          const existingRole = await Role.findOne({
            where: {
              role_name: value,
              id: { [Op.ne]: roleId }, // Exclude the current location from uniqueness check
            },
          });

          if (existingRole) {
            throw new Error("Role Name already exists");
          }
        })
        .run(req),
    ]);

    // Handle validation result
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error_message = errors.array()[0].msg;

      throw new AppError(error_message, 422, errors);
    }

    try {

    if (isNaN(roleId)) {
      throw new AppError("Invalid Role ID");
    }

    const { role_name } = req.body;
    const  updated_by =req.session.user_id;

    if (!role_name) {
      throw new AppError("Role Name is required", 400);
    }

    const role = await Role.update(
      {
        role_name: role_name,
        updated_by
      },
      {
        where: { id: roleId },
      }
    );

    return res
      .status(200)
      .json({ status: true, message: "Role updated successfully" });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

// DELETE role by ID
const deleteRoleById = catchAsync(async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);

    if (isNaN(roleId) || roleId < 2) {
      throw new AppError("Invalid Role ID");
    }

    const result = await Role.findByPk(roleId);

    if (!result) {
      throw new AppError(`Role not found`);
    }

    await result.destroy();

    return res.status(200).json({ status: true, message: "Data Deleted" });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

/* Role API End (Only for Super Admin) -------------------------- */

/* Permissions API Start (Only for Super Admin) ------------------------------- */

// POST get all permissions by user id
const getPermissions = catchAsync(async (req, res) => {
  try {
    const { roleId, userId } = req.body;

    if (!roleId || !userId) {
      throw new AppError("Role ID and User ID are required", 400);
    }

    const getRoleModuleQuery = `SELECT * FROM role_module_managements order by id`;
    const getRoleModule = await db.query(getRoleModuleQuery);

    const roleModule = {};
    const SubmoduleCounts = {};
    getRoleModule.rows.forEach((element) => {
      const module = element.module;
      const submodule = element.sub_module;

      if (!roleModule[module]) {
        roleModule[module] = []; // Initialize if not yet defined
      }

      if (!roleModule[module].includes(submodule)) {
        roleModule[module].push(submodule);
        if (!SubmoduleCounts[module]) {
          SubmoduleCounts[module] = {
            selectId: [],
            permission: [],
            submodule_count: 0,
          };
        }

        SubmoduleCounts[module].selectId.push(element.id);
      }
      SubmoduleCounts[module].permission.push(element.id);

      SubmoduleCounts[module].submodule_count = new Set(
        SubmoduleCounts[module].selectId
      ).size;
    });

    const dbcountformodule = [];
    const i = 0;
    for (const module in SubmoduleCounts) {
      if (SubmoduleCounts.hasOwnProperty(module)) {
        try {
          const getCountQuery = `SELECT * FROM role_module_permissions WHERE role_id= ${roleId} AND user_id = ${userId}`;
          const getCount = await db.query(getCountQuery);
          const permissionIds = SubmoduleCounts[module].permission;
          const getValueRolePermission = getCount.rows[0]?.permissions_id;

          let countFound = 0;

          if (getValueRolePermission) {
            const countFoundQuery = `
              WITH input_values AS (
                  SELECT unnest(ARRAY[${getValueRolePermission}]) AS value
              )
              SELECT COUNT(*) AS count_found
              FROM input_values
              WHERE value IN (${permissionIds.join(",")})`;

            const countFoundResult = await db.query(countFoundQuery);
            countFound = countFoundResult.rows[0]?.count_found || 0; // Use count if found, else 0
          }
          dbcountformodule.push(
            `${countFound} / ${SubmoduleCounts[module].submodule_count}`
          );
          i++;
        } catch (error) {}
      }
    }

    const getPermissionQuery = `SELECT * FROM role_module_permissions where role_id = ${roleId} and user_id = ${userId}`;
    const getPermission = await db.query(getPermissionQuery);

    return res.status(200).json({
      status: true,
      message: "Role updated successfully",
      selectedcheck: dbcountformodule,
      getPermission: getPermission.rows,
    });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

// POST save permissions for user
const savePermissions = catchAsync(async (req, res) => {
  try {
    const { roleId, userId, permissions } = req.body;
    if (!roleId || !userId || !permissions) {
      throw new AppError(
        "Role ID and User ID and permissions are required",
        400
      );
    }

    const PreviousEntry = await RolePermission.findOne({
      where: {
        role_id: roleId,
        user_id: userId,
      },
    });

    if (PreviousEntry) {

      await PreviousEntry.update({
        permissions_id: permissions.join(","),
      }, {
        where: { role_id: roleId, user_id: userId}
      });
    } else {
      const createPermissionBasedUser = await RolePermission.create({
        role_id: roleId,
        user_id: userId,
        permissions_id: permissions.join(","),
        status: 1,
      });
    }

    return res
      .status(200)
      .json({ status: true, message: "Permission updated successfully" });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

// GET User based on Role Id
const getRoleBasedUserById = catchAsync(async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);

    if (isNaN(roleId)) {
      throw new AppError("Invalid Role ID");
    }

    // Fetch data from the database
    const query = `SELECT id,name FROM users WHERE deleted_at ISNULL AND role = ${roleId}`;

    const result = await db.query(query);

    // if (result.rowCount <= 0) {
    //   throw new AppError("Data Not Found");
    // }

    return res
      .status(200)
      .json({ status: true, message: "Data Found", data: result.rows });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
});

/* Permissions API End (Only for Super Admin) --------------------------------- */

export {
  /* Users API (Only for Super Admin) */
  getUsers,
  getAllUsers,
  createUser,
  getUserById,
  updateUserById,
  changePassword,
  deleteUserById,
  activeUserById,

  /* Roles API (Only for Super Admin) */
  getRoles,
  getAllRoles,
  createRole,
  getRoleById,
  updateRoleById,
  deleteRoleById,

  /* Permissions API (Only for Super Admin) */
  getPermissions,
  savePermissions,
  getRoleBasedUserById,
};
