import { Router } from "express";
const router = Router();
import multer, { diskStorage } from "multer";
import { existsSync, mkdirSync } from "fs";
import { extname } from "path";
import * as cutomerController from "../controllers/frontend/signInApiController.js";
import * as profileController from "../controllers/frontend/ProfileApiController.js";
import * as productController from "../controllers/frontend/ProductApiController.js";
const project_name = process.env.APP_NAME;
import customer_authenticate from "../middlewares/customer_authenticate.js";
import staticApiKey from "../middlewares/static_api_key.js";

const page_layout = {
  project_name: project_name,
  layout: "frontend/layout/pages-layout.ejs",
};

router.route("/").get((req, res) => {
  res.redirect("/admin");
  //res.render('frontend/pages/home', { ...page_layout });
});

const file_storage = diskStorage({
  destination: function (req, file, cb) {
    let uploadPath;

    if (file.fieldname === "profile") {
      uploadPath = "./public/uploads/profile";
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

const upload = multer({
  storage: file_storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

/************************************ Customer Section *********************************/

//customer Sign Up API
router.post("/sign_up", cutomerController.SignUp);

//customer Login API
router.post("/login", cutomerController.Login);

//forget password
router.post("/forget_password", cutomerController.updatePassword);

//reset password
router.post(
  "/set_new_password",
  customer_authenticate,
  cutomerController.resetpassword
);

//send Email wwith OTP
router.post("/resend_otp", cutomerController.resend_otp);

//get customer info
router.post(
  "/fetch_customer_profile",
  customer_authenticate,
  profileController.fetch_profile
);

//update customer info
router.post(
  "/update_customer_info",
  customer_authenticate,
  upload.fields([{ name: "profile", maxCount: 1 }]),
  profileController.update_customer_profile
);

//category list
router.get("/category_list", staticApiKey, productController.category_list);

//product list
router.post(
  "/product_list",
  customer_authenticate,
  productController.product_list
);

//Add cart
router.post(
  "/add_update_cart",
  customer_authenticate,
  productController.add_update_cart
);

//display cart list
router.post("/cart_list", customer_authenticate, productController.cart_list);

//delete product cart
router.post(
  "/delete_product_cart",
  customer_authenticate,
  productController.delete_product_cart
);

//create_order
router.post(
  "/place_order",
  customer_authenticate,
  productController.create_order
);

//order_history
router.post(
  "/order_history",
  customer_authenticate,
  productController.order_history
);

//view_order
router.post("/view_order", customer_authenticate, productController.view_order);

//recommended_products
router.post(
  "/recommended_products",
  customer_authenticate,
  productController.recommended_products
);

//repeat_order
router.post(
  "/repeat_order",
  customer_authenticate,
  productController.repeat_order
);

/********************************** End Customer Section *********************************/

export default router;
