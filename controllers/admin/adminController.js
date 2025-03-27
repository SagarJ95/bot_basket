// Defaults
import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import db from "../../config/db.js";

import Sequelize from "../../config/database.js";
// Models
import User from "../../db/models/user.js";
import Role from "../../db/models/role.js";
import Category from "../../db/models/category.js";
import Customer from '../../db/models/customer.js'

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

        const dashboard_data=[];
        const tot_courses_query=`Select count(id) as total_courses_count FROM courses where deleted_at IS NULL and status='1'`;
        const tot_courses=await db.query(tot_courses_query);
        const total_courses_count=(tot_courses.rowCount>0) ? tot_courses.rows[0].total_courses_count :0;

        const tot_amount_query=`Select SUM(total::numeric) AS total_amount FROM customer_subscriptions where razorpay_order_id IS NOT NULL`;
        const tot_amount_res=await db.query(tot_amount_query);
        const total_amount=(tot_amount_res.rowCount>0) ? tot_amount_res.rows[0].total_amount :0;

        const tot_customers_query=`Select count(id) AS total_customers FROM customers where deleted_at IS NULL`;
        const tot_customers_res=await db.query(tot_customers_query);
        const total_customers=(tot_customers_res.rowCount>0) ? tot_customers_res.rows[0].total_customers :0;

        const tot_subscribers_query=`Select count(id) AS total_subscribers FROM customer_subscriptions where razorpay_order_id IS NOT NULL group by customer_id`;
        const tot_subscribers_res=await db.query(tot_subscribers_query);
        const total_subscribers=(tot_subscribers_res.rowCount>0) ? tot_subscribers_res.rows[0].total_subscribers :0;

        dashboard_data['total_courses_count']=total_courses_count;
        dashboard_data['total_amount']=total_amount;
        dashboard_data['total_customers']=total_customers;
        dashboard_data['total_subscribers']=total_subscribers;

        const tot_year_amount_query = `
            WITH years AS (
                SELECT EXTRACT(YEAR FROM NOW()) AS year
                UNION ALL
                SELECT EXTRACT(YEAR FROM NOW()) - 1
                UNION ALL
                SELECT EXTRACT(YEAR FROM NOW()) - 2
            )
            SELECT
                y.year,
                COALESCE(SUM(c.total::numeric), 0) AS total_amount
            FROM years y
            LEFT JOIN customer_subscriptions c
                ON EXTRACT(YEAR FROM c.created_at) = y.year
                AND c.razorpay_order_id IS NOT NULL
            GROUP BY y.year
            ORDER BY y.year DESC
        `;

        const tot_yearwise_amount_res = await db.query(tot_year_amount_query);
        dashboard_data['tot_yearwise_amount_res']=tot_yearwise_amount_res.rows;

        const subscribers_names_query=`SELECT
            CONCAT(cust.first_name, ' ', cust.last_name) AS cust_name
        FROM customer_subscriptions AS s
        LEFT JOIN customers AS cust ON s.customer_id = cust.id
        WHERE s.razorpay_order_id IS NOT NULL
        GROUP BY s.customer_id,cust.first_name, cust.last_name
        LIMIT 5;
        `;
        const subscribers_res=await db.query(subscribers_names_query);
        const subscribers_names=(subscribers_res.rowCount>0) ? subscribers_res.rows :[];

        dashboard_data['subscribers_names']=subscribers_names;

        //masters courses users count
        const master_table_q=`SELECT
            m.name AS master_name,
            m.profession,
            m.photo,
            COUNT(DISTINCT c.id) AS course_count,
            COUNT(DISTINCT cs.customer_id) AS buyers_count
        FROM masters AS m
        LEFT JOIN courses AS c ON m.id = c.master_id
        LEFT JOIN customer_subscriptions AS cs
            ON cs.courses = 'All' OR c.id = ANY(string_to_array(cs.courses, ',')::int[])
        GROUP BY m.id, m.name, m.profession, m.photo
        ORDER BY course_count DESC;`

        const master_res=await db.query(master_table_q);
        const master_names=(master_res.rowCount>0) ? master_res.rows :0;

        //console.log(master_names)
        dashboard_data['master_names']=master_names;

        const trending_courses_query=`SELECT name from courses where trending_flag='1' limit 3`;
        const trending_courses_res=await db.query(trending_courses_query);

        dashboard_data['trending_courses']=trending_courses_res.rows;


        res.render("admin/pages/dashboard", {
            ...page_layout,
            user: req.user,
            access_routes: access_routes,
            dashboard_data
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
        const customerId = parseInt(req.params.id);
        const customers = await Customer.findOne({ where: { id: customerId } });

        // Fetch current subscription data
        const current_subscription_data = await customer_current_subscription_data(customerId);
        const baught_courses = await customer_baught_courses(customerId);

        //console.log(current_subscription_data)
        // Pass subscription data to the view
        res.render('admin/pages/customer-view', {
            ...page_layout,
            user: req.user,
            access_routes: req.session.accessRoute,
            customer: customers,
            subscription: current_subscription_data || [],
            baught_courses: baught_courses || []

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
