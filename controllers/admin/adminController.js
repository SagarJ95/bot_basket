// Defaults
import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import db from "../../config/db.js";

import Sequelize from "../../config/database.js";
// Models
import User from "../../db/models/user.js";
import Role from "../../db/models/role.js";
import Category from "../../db/models/category.js";
import Customer from '../../db/models/customers.js'

import { body, validationResult } from "express-validator";
// Node Modules
import moment from "moment-timezone";
import { Op } from "sequelize";
import Hashids from "hashids";

const project_name = process.env.APP_NAME;

const auth_layout = {
    project_name: project_name,
    layout: "admin/layout/auth-layout.ejs",
};

const page_layout = {
    project_name: project_name,
    layout: "admin/layout/pages-layout.ejs",
};

const hashids = new Hashids(process.env.HASHIDS_SALT, 10);

// Admin Dashboard
const dashboard = catchAsync(async (req, res) => {
    try
    {
        const access_routes = req.session.accessRoute;



        res.render("admin/pages/dashboard", {
            ...page_layout,
            user: req.user,
            access_routes: access_routes
        });
    }
    catch(error)
    {
        console.log(error.message)
    }
});


//Categories
const categories = catchAsync(async (req, res) => {
    res.render("admin/pages/categories", { ...page_layout, user: req.user, access_routes: req.session.accessRoute });

})

//users
const users = catchAsync(async (req, res) => {
    const query = `SELECT id,role_name FROM roles WHERE deleted_at IS NULL AND id != 1`;
    const role = await db.query(query, []);
    res.render("admin/pages/users", {
        ...page_layout,
        user: req.user,
        data: role.rows,
        access_routes: req.session.accessRoute
    });
})

//roles
const roles = catchAsync(async (req, res) => {
    res.render("admin/pages/roles", { ...page_layout, user: req.user, access_routes: req.session.accessRoute });

})

//permission
const permissions = catchAsync(async (req, res) => {
        const rolequery = `SELECT id,role_name FROM roles WHERE deleted_at IS NULL AND id != 1`;
        const role = await db.query(rolequery, []);

        const permissionQuery = `select trm.id,trm.module,trm.sub_module,trm.permission,trm.routes,tcp.access_name from role_module_managements as trm left join access_permissions as tcp ON tcp.id = trm.permission::bigint order by id asc `;
        const PermissionResult = await db.query(permissionQuery, []);

        const result = {};

        if (PermissionResult.rowCount > 0) {
            PermissionResult.rows.forEach((permission) => {
                const {
                    module,
                    sub_module,
                    id,
                    permission: perm,
                    routes,
                    access_name,
                } = permission;

                if (!result[module]) {
                    result[module] = {};
                }
                if (!result[module][sub_module]) {
                    result[module][sub_module] = [];
                }

                const info = {
                    id,
                    permission: perm,
                    routes,
                    access_name,
                };

                result[module][sub_module].push({
                    id,
                    permission: perm,
                    routes,
                    access_name,
                });
            });
        }

        res.render("admin/pages/permission", {
            ...page_layout,
            user: req.user,
            data: role.rows,
            permission: result,
            access_routes: req.session.accessRoute
        });
})

// Sign Out
const sign_out = catchAsync(async (req, res) => {
    return res.redirect("/admin");
})

const customers = catchAsync(async (req, res) => {
    res.render('admin/pages/customers', { ...page_layout, user: req.user, access_routes: req.session.accessRoute });
})

//view Customer Page
const viewCustomers = catchAsync(async (req, res) => {
    try {
        // Get customer info for a particular customer
        // const customerId = parseInt(req.params.id);
        // const customers = await Customer.findOne({ where: { id: customerId } });

        // // Fetch current subscription data
        // const current_subscription_data = await customer_current_subscription_data(customerId);
        // const baught_courses = await customer_baught_courses(customerId);

        //console.log(current_subscription_data)
        // Pass subscription data to the view
        res.render('admin/pages/customer-view', {
            ...page_layout,
            user: req.user,
            access_routes: req.session.accessRoute,
            // customer: customers,
            // subscription: current_subscription_data || [],
            // baught_courses: baught_courses || []

        });

    } catch (error) {
        console.log("Error in viewCustomers:", error.message);
        res.status(500).send("Server Error"); // Send a proper error response
    }
});


//addBlog, editBlog
export {
    dashboard,
    categories,
    users,
    roles,
    permissions,
    sign_out,
    viewCustomers,
    customers
};
