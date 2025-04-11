import userLogout from "../helpers/admin_logout.js";
import authenticate from "../middlewares/authenticate.js";
import { Router } from "express";
import db from "../config/db.js";
import * as adminController from "../controllers/admin/adminController.js";
import * as dashboardController from "../controllers/admin/dashbordController.js";

import checkPermissionRoute from "../middlewares/check_access_route.js";
import category from "../db/models/category.js";
import multer from "multer";
import path from "path";

const router = Router();

const project_name = process.env.APP_NAME;

const auth_layout = {
  project_name: project_name,
  layout: "admin/layout/auth-layout.ejs",
};

const page_layout = {
  project_name: project_name,
  layout: "admin/layout/pages-layout.ejs",
};

/* Admin Auth Routes -------- */

// Login Route
router.route("/").get((req, res) => {
  res.render("admin/pages/auth/sign-in", { ...auth_layout });
});

/* Admin Routes ------- */

// Dashboard Page Route
router.route("/dashboard").get(authenticate, adminController.dashboard);

// Categories Page Route
router
  .route("/categories")
  .get([authenticate, checkPermissionRoute], adminController.categories);

//user Page Route (User Management)
router
  .route("/users")
  .get([authenticate, checkPermissionRoute], adminController.users);

//Roles Page Route (User Management)
router
  .route("/roles")
  .get([authenticate, checkPermissionRoute], adminController.roles);

//Permission Page Route (User Management)
router
  .route("/permissions")
  .get([authenticate, checkPermissionRoute], adminController.permissions);

// Customer list Page Route
router
  .route("/customers")
  .get([authenticate, checkPermissionRoute], adminController.customers);

//customer view page Route
router
  .route("/view-customer/:id")
  .get([authenticate], adminController.viewCustomers);

// Sign Out Route
router
  .route("/sign-out")
  .get(authenticate, userLogout, adminController.sign_out);

//getdashbord
router
  .route("/dashbord")
  .get(authenticate, dashboardController.dashboardController);

export default router;
