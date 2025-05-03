import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/appError.js";
import db from "../../config/db.js";

///////////////////////////////adrees fun//////////////////////////////

const getAddressList = catchAsync(async (req, res) => {
  try {
    const customer_id = req.user.id;

    const result = await db.query(
      `SELECT id, full_name, mobile_number, address1, address2, zip_code, country, city, state 
         FROM customer_addresses 
         WHERE customer_id = $1`,
      [customer_id]
    );

    res.status(200).json({
      status: true,
      message: "Address list fetched successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching address list:", error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

const addAddress = catchAsync(async (req, res) => {
  await Promise.all([
    body("address1").notEmpty().withMessage("Address is required").run(req),
  ]);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error_message = errors.array()[0].msg;
    throw new AppError(error_message, 200, errors);
  }

  const {
    id,
    full_name,
    mobile_number,
    address1,
    address2,
    zip_code,
    country,
    city,
    state,
  } = req.body;

  const customer_id = req.user.id;

  try {
    if (id && id != 0) {
      const existing = await db.query(
        `SELECT id FROM customer_addresses WHERE id = $1 AND customer_id = $2`,
        [id, customer_id]
      );

      if (existing.rowCount === 0) {
        return res.status(404).json({
          status: false,
          message: "Address not found or unauthorized",
        });
      }

      const update_address = await db.query(
        `UPDATE customer_addresses 
           SET customer_id=$1, full_name=$2, mobile_number=$3, address1=$4, 
               address2=$5, zip_code=$6, country=$7, city=$8, state=$9 
           WHERE id=$10`,
        [
          customer_id,
          full_name,
          mobile_number,
          address1,
          address2,
          zip_code,
          country,
          city,
          state,
          id,
        ]
      );

      res.status(200).json({
        status: true,
        message: "Address updated successfully!",
      });
    } else {
      console.log("insert address");

      const add_address = await db.query(
        `INSERT INTO customer_addresses 
           (customer_id, full_name, mobile_number, address1, address2, zip_code, country, city, state) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          customer_id,
          full_name,
          mobile_number,
          address1,
          address2,
          zip_code,
          country,
          city,
          state,
        ]
      );

      if (add_address.rowCount > 0) {
        res.status(200).json({
          status: true,
          message: "Address added successfully!",
        });
      } else {
        res.status(400).json({
          status: false,
          message: "Something went wrong",
        });
      }
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

const deleteAddress = catchAsync(async (req, res) => {
  const { id } = req.body;

  if (!id) {
    throw new AppError("Address ID is required", 400);
  }

  try {
    const result = await db.query(
      `DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2`,
      [id, req.user.id]
    );

    if (result.rowCount > 0) {
      res.status(200).json({
        status: true,
        message: "Address deleted successfully!",
      });
    } else {
      res.status(404).json({
        status: false,
        message: "Address not found or unauthorized",
      });
    }
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

const getLocationByZip = catchAsync(async (req, res) => {
  const { country_code, zip_code } = req.body;

  if (!country_code || !zip_code) {
    return res.status(400).json({
      status: false,
      message: "Country code and ZIP code are required",
    });
  }

  try {
    const apiUrl = `https://api.zippopotam.us/${country_code}/${zip_code}`;

    const response = await axios.get(apiUrl);

    const place = response.data.places[0];

    res.status(200).json({
      status: true,
      message: "Location found",
      data: {
        country: response.data.country,
        state: place["state"],
        city: place["place name"],
        zip_code: response.data["post code"],
      },
      place: place,
    });
  } catch (error) {
    console.error("ZIP API error:", error.response?.data || error.message);
    res.status(404).json({
      status: false,
      message: "Location not found for this ZIP code",
    });
  }
});

/******************* End  Profile Info ************************ */

export { getAddressList, addAddress, deleteAddress, getLocationByZip };
