import multer, { diskStorage } from "multer";
import { existsSync, mkdirSync } from "fs";
import { extname } from "path";
import path from "path";
import { Router } from "express";
import sharp from "sharp"; // For image compression
import authenticate from "../middlewares/authenticate.js";
import * as userManagementController from "../controllers/admin/userManagementController.js";
import * as signInController from "../controllers/admin/signInController.js";
// import * as adminController from "../controllers/admin/adminController.js";
import * as masterController from "../controllers/admin/masterController.js";
import * as dashboardController from "../controllers/admin/dashbordController.js";

import * as customerController from "../controllers/admin/customerController.js";
import * as orderController from "../controllers/admin/orderManagementController.js";

// import * as dashboardController from "../controllers/admin/dashbordController.js";
import moment from "moment";

const router = Router();

const file_storage = diskStorage({
  destination: function (req, file, cb) {
    let uploadPath;

    if (file.fieldname === "photo") {
      uploadPath = "./public/uploads/masters";
    } else {
      return cb(new Error("Invalid fieldname"), null);
    }

    if (file.fieldname === "profile") {
      uploadPath = "./public/uploads/profile";
    } else {
      return cb(new Error("Invalid fieldname"), null);
    }

    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + extname(file.originalname));
  },
});

//uploadCategory

const StorageFile = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;

    if (file.fieldname === "icon") {
      uploadPath = "./public/uploads/category";
    } else if (file.fieldname === "product_images") {
      uploadPath = "./public/uploads/product_images";
    } else if (file.fieldname === "invoice") {
      uploadPath = "./public/uploads/invoice";
    } else if (file.fieldname === "csv_file") {
      uploadPath = "./public/uploads/import_product_update_price";
    } else {
      return cb(new Error("Invalid fieldname"), null);
    }

    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const now = new Date();
    const dateTime = moment().tz("Asia/Kolkata").format("YYYY-MM-DD_HH-mm-ss");

    const filename = `${dateTime}_${file.originalname}`;
    cb(null, filename);
  },
});

const upload = multer({ storage: StorageFile });
const upload_profile = multer({ storage: file_storage });

const compressImage = async (req, res, next) => {
  if (req.file && req.file.mimetype.startsWith("image")) {
    const outputFilePath = req.file.path.replace(
      extname(req.file.filename),
      "-compressed.jpg"
    );
    try {
      await sharp(req.file.path).jpeg({ quality: 80 }).toFile(outputFilePath);
      req.file.path = outputFilePath;
      req.file.filename = req.file.filename.replace(
        extname(req.file.filename),
        "-compressed.jpg"
      );
    } catch (err) {
      return next(err);
    }
  }
  next();
};

/* Auth API Routes -------------------------------------- */

//countries
router.post("/countries", masterController.countries);

// POST user login
router.post("/sign-in", signInController.userLogin);

// GET user logout
router.get("/sign-out", authenticate, signInController.userLogout);

//reset Password

/* Users API Start ----------------------------------- */

// POST get Users (datatables)
router.post("/getUsers", authenticate, userManagementController.getUsers);

//dashboard
router.post(
  "/dashboard",
  authenticate,
  dashboardController.dashboardController
);

// POST add new user || GET get all user
router
  .route("/users")
  .post(authenticate, userManagementController.createUser)
  .get(authenticate, userManagementController.getAllUsers);

// GET user by id || PATCH update user by id || DELETE delete user by id
router
  .route("/users/:id")
  .get(authenticate, userManagementController.getUserById)
  .patch(authenticate, userManagementController.updateUserById)
  .delete(authenticate, userManagementController.deleteUserById);

router
  .route("/users_change_status/:id")
  .patch(authenticate, userManagementController.activeUserById);

/* Users API End ------------------------------------ */

/* Category API Start ----------------------------------- */
// POST add new category || GET get all categories
router.post("/getCategories", authenticate, masterController.getCategories);

router.post(
  "/createCategory",
  authenticate,
  upload.fields([{ name: "icon", maxCount: 1 }]),
  masterController.createCategory
);
router.post("/getCategoryById", authenticate, masterController.getCategoryById);

router.post(
  "/updateCategoryById",
  authenticate,
  upload.fields([{ name: "icon", maxCount: 1 }]),
  masterController.updateCategoryById
);
router.post(
  "/deleteCategoryById",
  authenticate,
  masterController.deleteCategoryById
);
router.post(
  "/excelExportCategory",
  authenticate,
  masterController.excelExportCategory
);
router.post(
  "/updateCategoryStatusById",
  authenticate,
  masterController.updateCategoryStatusById
);

/* Category API End ------------------------------------ */
router.post(
  "/createProduct",
  upload.fields([{ name: "product_images", maxCount: 5 }]),
  authenticate,
  masterController.createProduct
);
router.post(
  "/updateProduct",
  upload.fields([{ name: "product_images", maxCount: 5 }]),
  authenticate,
  masterController.updateProduct
);
router.post("/getProductById", authenticate, masterController.getProductById);

router.post(
  "/deleteProductById",
  authenticate,
  masterController.deleteProductById
);
router.post(
  "/updateProductStatusById",
  authenticate,
  masterController.updateProductStatusById
);
router.post(
  "/excelExportProducts",
  authenticate,
  masterController.excelExportProducts
);
router.post(
  "/changeProductPrice",
  authenticate,
  masterController.changeProductPrice
);
router.post(
  "/getProductPriceLogs",
  authenticate,
  masterController.getProductPriceLogs
);
router.post(
  "/exportProductPriceLogs",
  authenticate,
  masterController.exportProductPriceLogs
);
router.post("/ChangePricelist", authenticate, masterController.ChangePricelist);
router.post(
  "/changeProductStockStatus",
  authenticate,
  masterController.changeProductStockStatus
);
router.post("/getProductlist", authenticate, masterController.getProductlist);

//export product list for price change
router.post(
  "/excelExportProductsInfo",
  authenticate,
  masterController.excelExportProductsInfo
);

//import product list with update price and store update price in log table
router.post(
  "/importProductListwithPrice",
  authenticate,
  upload.fields([{ name: "csv_file", maxCount: 1 }]),
  masterController.importProductListwithPrice
);

/* Customers */
router.post("/getCustomers", authenticate, customerController.getCustomers);
router.post(
  "/exportCustomers",
  authenticate,
  customerController.exportCustomers
);
router.post(
  "/getParticularCustomerInfo",
  authenticate,
  customerController.getParticularCustomerInfo
);
router.post(
  "/update_customer_info",
  authenticate,
  upload_profile.fields([{ name: "profile", maxCount: 1 }]),
  customerController.update_customer_info
);
router.post(
  "/add_customer",
  authenticate,
  upload_profile.fields([{ name: "profile", maxCount: 1 }]),
  customerController.add_customer
);
router.post(
  "/activationStatus",
  authenticate,
  customerController.activationStatus
);

/* Permission API Start ----------------------------------- */

// GET role by id
router
  .route("/permission_role/:id")
  .get(authenticate, userManagementController.getRoleBasedUserById);

// POST add permission based on role id and user id
router
  .route("/permission_role")
  .post(authenticate, userManagementController.savePermissions);

// GET permission based on role id and user id
router
  .route("/getPermissions")
  .post(authenticate, userManagementController.getPermissions);

/* Permission API End ------------------------------------ */

/* Roles API Start ----------------------------------- */

// POST get Role (datatables)
router.post("/getRoles", authenticate, userManagementController.getRoles);

// POST add new role || GET get all role
router
  .route("/roles")
  .post(authenticate, userManagementController.createRole)
  .get(authenticate, userManagementController.getAllRoles);

// GET role by id || PATCH update role by id || DELETE delete role by id
router
  .route("/roles/:id")
  .get(authenticate, userManagementController.getRoleById)
  .patch(authenticate, userManagementController.updateRoleById)
  .delete(authenticate, userManagementController.deleteRoleById);

/* Roles API End ------------------------------------ */

/* Order Management */
router.post("/getOrderlist", authenticate, orderController.getOrderlist);
router.post("/changeOrderStatus", authenticate, orderController.changeStatus);
router.post(
  "/orderViewDetails",
  authenticate,
  orderController.orderViewDetails
);
router.post(
  "/orderEditDetails",
  authenticate,
  upload.fields([{ name: "invoice", maxCount: 1 }]),
  orderController.orderEditDetails
);

//dashbord

router.post("/dashbord", authenticate, dashboardController.dashboardController);

export default router;
