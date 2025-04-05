
// Defaults
import catchAsync from "../../utils/catchAsync.js";
import db from "../../config/db.js";
import Customer from "../../db/models/customers.js";
import bcrypt from "bcrypt";
const project_name = process.env.APP_NAME;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3848';

  /*******************  Profile Info ************************ */

  const fetch_profile = catchAsync(async (req, res) => {
    try{
      const customer_id = req.user.id;

      const getCustomerInfo = await db.query(`
        SELECT first_name, last_name, phone_no, whatsapp_no, email,
         CASE
          WHEN profile IS NULL OR profile = '' THEN ''
              ELSE CONCAT('${BASE_URL}', profile)
      END AS profile_pic
        FROM customers
        WHERE id = $1 AND status = $2 AND deleted_at IS NULL
    `, [customer_id, "1"]);


      if(getCustomerInfo.rowCount > 0){
          return res.status(200).json({
            status: true,
            message: "fetch customer info sucessfully",
            data: getCustomerInfo.rows
          });
      }else{
        return res.status(200).json({
          status: false,
          message: "fetch customer info Unsucessfully",
        });
      }

      }catch(e){
        return res.status(200).json({
            status: false,
            message: "Failed to retrieve data",
            errors: error.message
        });
      }
  });

const update_customer_profile = catchAsync(async (req, res) => {
    try{

      const {first_name,last_name,contact_number,whatsapp_no,email,password,enable_email_notification} = req.body;
      const files = req.files || {};

      const customer_id = req.user.id;

      const getCustomerInfo = await db.query(`
              SELECT password
              FROM customers
              WHERE id = $1 AND status = $2 AND deleted_at IS NULL
          `, [customer_id, "1"]);


      const hashPassword = (password) ? await bcrypt.hash(password, 10) : getCustomerInfo.rows[0].password;

      const updateInfo = {
        first_name:first_name,
        last_name:last_name,
        phone_no:contact_number,
        whatsapp_no:whatsapp_no,
        email:email,
        password:hashPassword,
        enable_email_notification:enable_email_notification
        };

        const formatPath = (filePath) => {
          return filePath ? filePath.replace(/^public[\\/]/, '/').replace(/\\/g, '/') : null;
      };

      const profile_pic = files.profile && files.profile.length > 0
          ? formatPath(files.profile[0].path)
          : null;

      if (profile_pic) updateInfo.profile = profile_pic;
      const updateCustomerPassword = await Customer.update(updateInfo,{
          where:{
            id:customer_id
            }
        });






      if(updateCustomerPassword.length > 0){
          return res.status(200).json({
            status: true,
            message: "update customer info sucessfully"
          });
      }else{
        return res.status(200).json({
          status: false,
          message: "update customer info Unsucessfully",
        });
      }

      }catch(e){
        return res.status(200).json({
            status: false,
            message: "Failed to data",
            errors: error.message
        });
      }
  });
  /******************* End  Profile Info ************************ */

  export {
    fetch_profile,
    update_customer_profile
}