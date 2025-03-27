import { Router } from 'express';
const router = Router();
import multer, { diskStorage } from "multer";
import { existsSync, mkdirSync } from "fs";
import { extname } from "path";
import path from "path";
import * as cutomerController from "../controllers/frontend/signInApiController.js"
import authenticate from '../middlewares/customer_authenticate.js';
import staticApiKey from '../middlewares/static_api_key.js';
const project_name = process.env.APP_NAME;
import sharp from "sharp";

const page_layout = {
    project_name: project_name,
    layout: 'frontend/layout/pages-layout.ejs',
};

router.route('/').get((req, res) => {
    res.redirect('/admin')
    //res.render('frontend/pages/home', { ...page_layout });
});

const file_storage = diskStorage({
    destination: function (req, file, cb) {
        let uploadPath;

        if (file.fieldname === 'media') {
            uploadPath = './public/uploads/posts';
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
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});


/************************************ Customer Section *********************************/

//customer Sign Up API
router.post('/sign_up', cutomerController.SignUp);

//customer Login API
router.post('/login', cutomerController.Login);

//customer Logout API
router.post('/logout',cutomerController.Logout);

//forget password
router.post('/forgetPassword',cutomerController.forgetPassword)

//update password
router.post('/updatePassword',cutomerController.updatePassword)

//google login
router.post("/google_login", cutomerController.GoogleLogin);
/********************************** End Customer Section *********************************/


export default router;
