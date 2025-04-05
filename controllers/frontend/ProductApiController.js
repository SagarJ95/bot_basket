
// Defaults
import catchAsync from "../../utils/catchAsync.js";
import db from "../../config/db.js";
import Customer from "../../db/models/customers.js";
import addToCart from "../../db/models/add_to_carts.js";
import bcrypt from "bcrypt";
const project_name = process.env.APP_NAME;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3848';

/*******************  Category list ************************ */

  const category_list = catchAsync(async (req, res) => {
    try{
      const getCategorieslist = await db.query(`select
        id,cat_name,slug from categories where status = $1 and deleted_at IS NULL`,[1]);

          return res.status(200).json({
            status: true,
            message: "fetch Categories sucessfully",
            data: (getCategorieslist.rowCount > 0) ? getCategorieslist.rows : []
          });

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

        return res.status(200).json({
          status: true,
          message: "fetch Product list sucessfully",
          data: (getproductlist.rowCount > 0) ? getproductlist.rows : []
        });

      }catch(e){
        return res.status(200).json({
            status: false,
            message: "Failed to retrieve data",
            errors: error.message
        });
      }
  });

const add_update_cart = catchAsync(async (req, res) => {
    try{
      const {id,product_id,qty,price} = req.body;

      let infoUpdate;
      let CartInfo;
      //if id is empty then product insert into cart otherwise update product qty in add_to_carts table
      if(!id && id == 0){
        console.log("in")
         CartInfo = await addToCart.create({
          product_id,
          qty,
          price,
          created_by:req.user.id,
          status:1
        })

        infoUpdate = 'Add';
      }else{

         CartInfo = await addToCart.update({
          qty:qty,
          price:price
        },{
          where:{
            id:parseInt(id),
            product_id:product_id,
            status:1,
            created_by:req.user.id
          }
        })

        infoUpdate = 'Update';
      }

      return res.status(200).json({
        status: true,
        message: (CartInfo) ? `${infoUpdate} Into Cart sucessfully` : `${infoUpdate} Into Cart Unsucessfully`,
      });

      }catch(e){
        return res.status(200).json({
            status: false,
            message: "Failed to retrieve data",
            errors: error.message
        });
      }
  });

const cart_list =catchAsync(async (req, res) => {
  try{
      const customer_id = req.user.id;

        const cartlist = await db.query(`
          SELECT DISTINCT ON (atc.id)
            atc.id,
            atc.product_id,
            p.name AS product_name,
            p.description,
            CONCAT('${BASE_URL}', pi.image_path) AS product_image,
            atc.qty,
            p.price
          FROM add_to_carts AS atc
          LEFT JOIN products AS p ON atc.product_id = p.id
          LEFT JOIN product_images AS pi ON p.id = pi.product_id
          WHERE atc.status = $1
            AND atc.created_by = $2
            AND atc.deleted_at IS NULL
        `, [1, customer_id]);

        return res.status(200).json({
          status: true,
          message: `Fetch Cart list sucessfully`,
          data:(cartlist.rowCount > 0) ? cartlist.rows : []
        });

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
    product_list,
    add_update_cart,
    cart_list
}