
// Defaults
import catchAsync from "../../utils/catchAsync.js";
import db from "../../config/db.js";
import Customer from "../../db/models/customers.js";
import customer_address from "../../db/models/customer_address.js";
import bcrypt from "bcrypt";
const project_name = process.env.APP_NAME;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3848';

  /*******************  Profile Info ************************ */

const fetch_profile = catchAsync(async (req, res) => {
    try{
      const customer_id = req.user.id;

      const getCustomerInfo = await db.query(`
        SELECT
            c.first_name,
            c.last_name,
            c.phone_no,
            c.whatsapp_no,
            c.email,
            CASE
                WHEN c.profile IS NULL OR c.profile = '' THEN ''
                ELSE CONCAT('${BASE_URL}', c.profile)
            END AS profile_pic,
            COALESCE(
            json_agg(
                json_build_object(
                    'id', ca.id,
                    'address', ca.address
                )
            ) FILTER (WHERE ca.id IS NOT NULL AND ca.status = $3),
            '[]'
        ) AS addresses
        FROM customers AS c
        LEFT JOIN customer_addresses AS ca
            ON c.id = ca.customer_id
        WHERE c.id = $1
          AND c.status = $2
          AND c.deleted_at IS NULL
        GROUP BY c.id
    `, [customer_id, "1", 1]);


      return res.status(200).json({
        status: true,
        message: "fetch customer info sucessfully",
        data: (getCustomerInfo.rowCount > 0) ? getCustomerInfo.rows : []
      });

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

        const {first_name,last_name,contact_number,whatsapp_no,email,password,enable_email_notification,address} = req.body;
        const files = req.files || {};
        let addressInfo;
        if (typeof address == 'string') {
          addressInfo = JSON.parse(address);
        }

        const customer_id = req.user.id;

        const getCustomerInfo = await db.query(`
                SELECT password
                FROM customers
                WHERE id = $1 AND status = $2 AND deleted_at IS NULL
            `, [customer_id, "1"]);


        const hashPassword = (password) ? await bcrypt.hash(password, 10) : getCustomerInfo.rows[0].password;

        if(Array.isArray(addressInfo))
        {
          for (const val of addressInfo) {
            if(val.id == ''){
              const Insertquery = `INSERT INTO customer_addresses (customer_id, address, tag,status,created_by) values ($1, $2, $3,$4,$5)`;
                await db.query(Insertquery, [customer_id, val.address, val.tag,1,customer_id])
            }else{
              const updatequery = `Update customer_addresses SET address = $1, tag = $2 Where customer_id = $3 and id = $4 and status = $5`;
              await db.query(updatequery, [val.address, val.tag,customer_id,val.id,1])
            }
          }
        }

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

          return res.status(200).json({
            status: true,
            message: (updateCustomerPassword.length > 0) ? "update customer info sucessfully" : "update customer info Unsucessfully",
          });

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