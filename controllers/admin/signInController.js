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
import { generateSlug, media_url } from "../../helpers/slug_helper.js";

// Models
import sequelize from "../../config/database.js";
import User from "../../db/models/user.js";
// Node Modules
import { body, validationResult } from "express-validator";
import { Op, QueryTypes,Sequelize } from "sequelize";
import { compare } from "bcrypt";
import bcrypt from "bcrypt";
import os from "os";
const BASE_URL = process.env.BASE_URL || 'http://localhost:3847';

const getServerIP = () => {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
      for (const iface of interfaces[interfaceName]) {
          if (!iface.internal && iface.family === 'IPv4') {
              return iface.address;
          }
      }
  }
  return req.headers["x-forwarded-for"] || req.connection.remoteAddress;
};
/* Auth API Start ------------------------------------- */

// POST user login
const userLogin = catchAsync(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw AppError("Please provide email and password", 400);
    } else {
      const result = await User.findOne({ where: { email } });

      //res.json(result);

      if (!result || !(await compare(password, result.password))) {
        throw new AppError("Invalid Credentials", 400);
      } else {
        if (result.status != 1) {
          throw new AppError("Sorry, User is Inactivated", 400);
        }

        const token = generateToken({
          id: result.id,
          role: result.role,
        });

        // Store JWT token in session
        req.session.token = token;
        req.session.user_id =  result.id;
        // Get user's IP address
        const ipAddress = getServerIP();

        // Log the user's login info
        await sequelize.query(
          `INSERT INTO user_logs (user_id, role_id, ip_address) VALUES (:userId, :roleId, :ipAddress)`,
          {
            type: QueryTypes.INSERT,
            replacements: {
              userId: result.id,
              roleId: result.role,
              ipAddress,
            },
          }
        );

        //get permission_id based on role and user_id (table: users)
        const getPermissionQuery = `SELECT * FROM role_module_permissions WHERE role_id = ${result.role} And user_id = ${result.id} LIMIT 1`;
        const getPermissionResult = await db.query(getPermissionQuery);

        const accessRoute = {};
        if (getPermissionResult.rowCount > 0) {
          //get permission_id from result
          const permissionId = getPermissionResult.rows[0].permissions_id;
          const getAllRoutesQuery = `SELECT module,sub_module,routes,permission,module_slug,submodule_slug FROM role_module_managements WHERE id IN (${permissionId})`;
          const getAllRoutes = await db.query(getAllRoutesQuery);
         // console.log("getAllRoutes>>",getAllRoutes.rows);
          getAllRoutes.rows.forEach((item) => {
            const module = item.module_slug;
            const subModule = item.submodule_slug;

            // Ensure the structure exists before assigning values
            if (!accessRoute[module]) {
              accessRoute[module] = {};
            }
            if (!accessRoute[module][subModule]) {
              accessRoute[module][subModule] = [];
            }

            // Push the permission into the array
            accessRoute[module][subModule].push({ permission: item.permission });

            if (item.routes) {
              accessRoute["routes"] = [
                ...(accessRoute["routes"] || []),
                item.routes,
              ];
            }
          });
        }

        // Store Access Route  in session
        req.session.accessRoute = accessRoute;


        return res.status(200).json({
          status: true,
          message: "Logged in successfully",
          token: token,
        });
      }
    }
  });

  // GET user logout
const userLogout = catchAsync(async (req, res, next) => {
    try {
      if (!req.user || !req.role) {
        throw new AppError("Invalid User", 400);
      }

      // Clear the token stored in the session
      req.session.token = null;
      if (
        req.headers["content-type"] === "application/html" ||
        req.accepts("html")
      ) {
        next();
      } else {
        return res
          .status(200)
          .json({ status: "success", message: "Logout successfully" });
      }
    } catch (error) {
      throw new AppError(error.message, 400);
    }
  });

  /* Auth API End ------------------------------------- */

  export {
    /* Auth API */
    userLogin,
    userLogout,
  };
