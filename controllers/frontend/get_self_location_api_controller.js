import catchAsync from "../../utils/catchAsync.js";
import db from "../../config/db.js";

const getStoreLocation = catchAsync(async (req, res) => {
  try {
    const getStoreLocation = await db.query(
      `SELECT * FROM store_self_locations WHERE status = $1`,
      ["1"]
    );
    if (!getStoreLocation) {
      return res.status(404).json({ message: "No store locations found" });
    }

    return res.status(200).json({
      message: "Store locations retrieved successfully",
      data: getStoreLocation.rows,
    });
  } catch (error) {
    console.error("Error in getStoreLocation:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export { getStoreLocation };
