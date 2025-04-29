import catchAsync from "../../utils/catchAsync.js";
import db from "../../config/db.js";
import AppError from "../../utils/appError.js";
import { validationResult } from "express-validator";
import { Op } from "sequelize";
import store_self_location from "../../db/models/store_self_location.js";

const selfStoreLocation = catchAsync(async (req, res) => {
  try {
    const { store_name, store_address, store_pincode } = req.body;

    const existingStore = await store_self_location.findOne({
      where: {
        store_name,
        store_address,
      },
    });

    if (existingStore) {
      return res.status(400).json({
        message: "Store with this name and address already exists",
      });
    }

    const newStoreLocation = await store_self_location.create({
      store_name,
      store_address,
      store_pincode,
      created_by: req.user.id,
    });

    return res.status(200).json({
      message: "Store location created successfully",
      data: newStoreLocation,
    });
  } catch (error) {
    console.error("Error in selfStoreLocation:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

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

const updateStoreLocation = catchAsync(async (req, res) => {
  try {
    const { id, store_name, store_address, store_pincode } = req.body;

    const result = await db.query(
      `UPDATE store_self_Locations SET store_name = $1, store_address = $2, store_pincode = $3, status = $4 WHERE id = $5 RETURNING *`,
      [store_name, store_address, store_pincode, "1", id]
    );

    if (result.rowCount == 0) {
      return res.status(404).json({ message: "Store location not found" });
    }

    return res.status(200).json({
      message: "Store location updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error in updateStoreLocation:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

const deleteStoreLocation = catchAsync(async (req, res) => {
  try {
    const { id } = req.body;

    const result = await db.query(
      `UPDATE store_self_Locations SET status = $1 WHERE id = $2`,
      ["0", id]
    );

    if (result.rowCount == 0) {
      return res.status(404).json({ message: "Store location not found" });
    }

    return res.status(200).json({
      message: "Store location deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error in deleteStoreLocation:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export {
  selfStoreLocation,
  getStoreLocation,
  updateStoreLocation,
  deleteStoreLocation,
};
