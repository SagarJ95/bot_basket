import db from "../../config/db.js";
import catchAsync from "../../utils/catchAsync.js";
import delivery_option from "../../db/models/delivery_option.js";

const storedeliveryOption = catchAsync(async (req, res) => {
  try {
    const { delivery_option_name } = req.body;

    // Check if the delivery option already exists
    const existingOption = await delivery_option.findOne({
      where: {
        delivery_option_name,
      },
    });

    if (existingOption) {
      return res.status(400).json({
        message: "Delivery option with this name already exists",
      });
    }

    // Create a new delivery option
    const newDeliveryOption = await delivery_option.create({
      delivery_option_name,
      created_by: req.user.id,
    });

    return res.status(200).json({
      message: "Delivery option created successfully",
      data: newDeliveryOption,
    });
  } catch (error) {
    console.error("Error in deliveryOption:", error);
    return res.status(500).json({ message: error.message });
  }
});

const getDeliveryOption = catchAsync(async (req, res) => {
  try {
    const deliveryOptions = await db.query(
      `SELECT * FROM delivery_options WHERE status = $1`,
      ["1"]
    );
    if (!deliveryOptions) {
      return res.status(404).json({ message: "No delivery options found" });
    }

    return res.status(200).json({
      message: "Delivery options retrieved successfully",
      data: deliveryOptions.rows,
    });
  } catch (error) {
    console.error("Error in getDeliveryOption:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export { storedeliveryOption, getDeliveryOption };
