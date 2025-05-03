import catchAsync from "../../utils/catchAsync.js";
import db from "../../config/db.js";
import AppError from "../../utils/appError.js";

/*******************  Category list ************************ */

const category_list = catchAsync(async (req, res) => {
  try {
    const getCategorieslist = await db.query(
      `select
          id,cat_name,slug from categories where status = $1 and deleted_at IS NULL`,
      [1]
    );

    return res.status(200).json({
      status: true,
      message: "fetch Categories sucessfully",
      data: getCategorieslist.rowCount > 0 ? getCategorieslist.rows : [],
    });
  } catch (e) {
    return res.status(200).json({
      status: false,
      message: "Failed to retrieve data",
      errors: error.message,
    });
  }
});
export { category_list };
