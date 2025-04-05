
// Defaults
import catchAsync from "../../utils/catchAsync.js";
import db from "../../config/db.js";
import Customer from "../../db/models/customers.js";
import bcrypt from "bcrypt";
const project_name = process.env.APP_NAME;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3848';

/*******************  Category list ************************ */

  const category_list = catchAsync(async (req, res) => {
    try{
      const getCategorieslist = await db.query(`select
        id,cat_name,slug from categories where status = $1 and deleted_at IS NULL`,[1]);


      if(getCategorieslist.rowCount > 0){
          return res.status(200).json({
            status: true,
            message: "fetch Categories sucessfully",
            data: getCategorieslist.rows
          });
      }else{
        return res.status(200).json({
          status: false,
          message: "fetch Categories Unsucessfully",
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
/******************* category  Info ************************ */



/******************* product  Info ************************ */

  const product_list = catchAsync(async (req, res) => {
    try{
      const getproductlist = await db.query(`select
        p.id,p.name as product_name,p.slug,p.description,p.price,c.cat_name as category_name from products as p
        left join categories as c ON p.category = c.id where p.status = $1 and p.deleted_at IS NULL`,[1]);

      if(getproductlist.rowCount > 0){
          return res.status(200).json({
            status: true,
            message: "fetch Product list sucessfully",
            data: getproductlist.rows
          });
      }else{
        return res.status(200).json({
          status: false,
          message: "fetch product list Unsucessfully",
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



/******************* End product  Info ************************ */

  export {
    category_list,
    product_list
}