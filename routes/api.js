import multer, { diskStorage } from "multer";
import { existsSync, mkdirSync } from "fs";
import { extname } from "path";
import path from "path";
import { Router } from "express";
import sharp from "sharp"; // For image compression
import authenticate from "../middlewares/authenticate.js";
import * as userManagementController from "../controllers/admin/userManagementController.js";
import * as signInController from "../controllers/admin/signInController.js";
import * as adminController from "../controllers/admin/adminController.js";
import * as masterController from "../controllers/admin/masterController.js";

const router = Router();

const file_storage = diskStorage({
  destination: function (req, file, cb) {
      let uploadPath;

      if (file.fieldname === 'photo') {
          uploadPath = './public/uploads/masters';
      }else {
        return cb(new Error('Invalid fieldname'), null);
      }

      if (!existsSync(uploadPath)) {
          mkdirSync(uploadPath, { recursive: true });
      }

      cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
  }
});

const upload = multer({
  storage: file_storage,
  fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp','video/mp4','video/mov'];
      if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
      } else {
          cb(new Error('Only image files are allowed!'), false);
      }
  }
});

//uploadCategory
const categorytorage = multer.diskStorage({

  destination: (req, file, cb) => {
    let uploadPath;

    if (file.fieldname === 'icon') {
        uploadPath = './public/uploads/category';
    } else if (file.fieldname === 'green_icon') {
        uploadPath = './public/uploads/category';
    } else {
      return cb(new Error('Invalid fieldname'), null);
    }

    if (!existsSync(uploadPath)) {
        mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
    //cb(null, "public/uploads/category/"); // Files will be stored in 'uploads' folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename with timestamp
  },
});

const upload_category = multer({ storage: categorytorage });


const compressImage = async (req, res, next) => {
  if (req.file && req.file.mimetype.startsWith('image')) {
      const outputFilePath = req.file.path.replace(extname(req.file.filename), '-compressed.jpg');
      try {
          await sharp(req.file.path)
              .jpeg({ quality: 80 })
              .toFile(outputFilePath);
          req.file.path = outputFilePath;
          req.file.filename = req.file.filename.replace(extname(req.file.filename), '-compressed.jpg');
      } catch (err) {
          return next(err);
      }
  }
  next();
};

/* Auth API Routes -------------------------------------- */

// POST user login
router.post("/sign-in", signInController.userLogin);

// GET user logout
router.get("/sign-out", authenticate, signInController.userLogout);

/* Users API Start ----------------------------------- */

// POST get Users (datatables)
router.post("/getUsers", authenticate, userManagementController.getUsers);

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

router.route("/users_change_status/:id").patch(authenticate, userManagementController.activeUserById);

/* Users API End ------------------------------------ */

/* Category API Start ----------------------------------- */

// POST get categories (datatables)
router.post("/getCategories", authenticate, masterController.getCategories);

// POST add new category || GET get all categories
router
  .route("/category")
  .post(authenticate,upload_category.fields([
    { name: 'icon', maxCount: 1 },{ name: 'green_icon', maxCount: 1 }]), masterController.createCategory)
  .get(authenticate, masterController.getAllCategories);

// GET category by id || PATCH update category by id || DELETE delete category by id
router
  .route("/category/:id")
  .get(authenticate, masterController.getCategoryById)
  .patch(authenticate,upload_category.fields([
    { name: 'icon', maxCount: 1 },{ name: 'green_icon', maxCount: 1 }]), masterController.updateCategoryById)
  .delete(authenticate, masterController.deleteCategoryById);

  //router.patch('/updateCategoryOrder',authenticate,masterController.updateCategoryOrder)

/* Category API End ------------------------------------ */


/* Permission API Start ----------------------------------- */

// GET role by id
router.route("/permission_role/:id").get(authenticate, userManagementController.getRoleBasedUserById);

// POST add permission based on role id and user id
router.route("/permission_role").post(authenticate, userManagementController.savePermissions);

// GET permission based on role id and user id
router.route("/getPermissions").post(authenticate, userManagementController.getPermissions);

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


export default router;
