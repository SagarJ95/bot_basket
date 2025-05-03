import catchAsync from "../../utils/catchAsync.js";
import db from "../../config/db.js";
import AppError from "../../utils/appError.js";

const get_price = catchAsync(async (req, res) => {
  try {
    const result = await db.query(`
        SELECT 
          MIN(price::numeric) AS min_price, 
          MAX(price::numeric) AS max_price 
        FROM products_price_logs 
        WHERE deleted_at IS NULL
      `);

    if (
      result.rowCount === 0 ||
      !result.rows[0].min_price ||
      !result.rows[0].max_price
    ) {
      return res.status(400).json({
        status: false,
        message: "Price data not found!",
      });
    }

    const min = parseFloat(result.rows[0].min_price);
    const max = parseFloat(result.rows[0].max_price);
    const range = (max - min) / 4;

    // Create 4 price ranges
    const priceRanges = [
      { min: min.toFixed(2), max: (min + range).toFixed(2) },
      { min: (min + range).toFixed(2), max: (min + 2 * range).toFixed(2) },
      { min: (min + 2 * range).toFixed(2), max: (min + 3 * range).toFixed(2) },
      { min: (min + 3 * range).toFixed(2), max: max.toFixed(2) },
    ];

    res.status(200).json({
      status: true,
      message: "Price ranges fetched successfully!",
      data: priceRanges,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

export { get_price };
