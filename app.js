import dotenv from "dotenv";
dotenv.config({ path: `${process.cwd()}/.env` });

// CONSTANTS
const APP_URL = process.env.APP_URL || "http://localhost";
const PORT = process.env.APP_PORT || 4000;
const APP_NAME = process.env.APP_NAME || "Bot Basket";

// Framework
import express from "express";
const app = express();
import expressLayouts from "express-ejs-layouts";
import { join } from "path";
import pkg from "body-parser";
const { json: _json, urlencoded: _urlencoded } = pkg;
import session, { Store } from "express-session";
import connectSessionSequelize from "connect-session-sequelize";
const SequelizeStore = connectSessionSequelize(Store);
import sequelize from "./config/database.js"; // Sequelize instance
import multer from "multer";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import swaggerUi from 'swagger-ui-express'
import swaggerDocument from './swagger-output.json' assert { type: 'json' };


app.use("/uploads/export", express.static(path.join(process.cwd(), "public/uploads/export")));


// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: "Sessions",
});
//sessionStore.sync();

// API Routes
import api from "./routes/admin_api.js";

// Admin View Routes
import admin from "./routes/adminFront.js";

// Front View Routes
import front from "./routes/web.js";


// Error Handlers
import catchAsync from "./utils/catchAsync.js";
import AppError from "./utils/appError.js";
import globalErrorHandler from "./controllers/errorController.js";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "Jnsdf83452Njsdfbsdbf", // You should store this in .env
    resave: false, // Don't save the session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    store: new SequelizeStore({ db: sequelize }), // Store sessions in DB
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      secure: false, // Set to true if using HTTPS
      httpOnly: true, // Prevents client-side JS from reading the cookie
    },
  })
);

app.use(_json());
app.use(_urlencoded({ extended: true }));
app.use(express.static(join(__dirname, "public")));
app.use(_json());
app.use(_urlencoded({ extended: false }));

// Set the views folder (admin in this case)
app.set("views", join(__dirname, "views"));

// Set EJS as the view engine
app.set("view engine", "ejs");

// Use express-ejs-layouts
app.use(expressLayouts);

app.use("/", front);
app.use("/api", api);
app.use("*",function(req,res){
  return res.status(404).json({message:"Route not found"})
})

app.locals.baseUrl = APP_URL + ":" + PORT;


app.use(
  "*",
  catchAsync(async (req, res, next) => {
    return next(
      new AppError(
        `Can't find the ${
          APP_URL + ":" + PORT + req.originalUrl
        } on the server`,
        404
      )
    );
  })
);

app.use(globalErrorHandler);

process.on("uncaughtException", (error) => {
});

process.on("unhandledRejection", (reason, promise) => {
});

app.listen(PORT, () => {
  console.log("Server Running on " + APP_URL + ":" + PORT);
});
