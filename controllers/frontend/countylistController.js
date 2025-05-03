import catchAsync from "../../utils/catchAsync.js";
import db from "../../config/db.js";
import AppError from "../../utils/appError.js";

const country_list = catchAsync(async (req, res) => {
  try {
    const getCountryList = await db.query(
      `select id,country_name from country_data ORDER BY id ASC `
    );

    if (getCountryList.rowCount > 0) {
      return res.status(200).json({
        status: true,
        message: "county get successfully!",
        data: getCountryList.rows,
      });
    } else {
      return res.status(200).json({
        status: false,
        message: "country not found",
      });
    }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

export { country_list };
