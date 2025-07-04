import catchAsync from "../../utils/catchAsync.js";
import db from "../../config/db.js";
import axios from 'axios'
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

const country_phonecode = catchAsync(async (req, res) => {
  try {
    const response = await axios.get('https://restcountries.com/v3.1/all?fields=name,idd,cca2');
    const countries = response.data
      .filter(country => country.idd?.root)
      .map(country => {
        const root = country.idd.root;
        const suffixes = country.idd.suffixes || [''];

        // Some countries have multiple suffixes (e.g., US Virgin Islands)
        return suffixes.map(suffix => ({
          name: country.name.common,
          code: country.cca2,
          dial_code: `${root}${suffix}`
        }));
      })
      .flat() // flatten nested arrays
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      status:true,
      message: "Country phone codes fetched successfully",
      data: countries
    });
  } catch (error) {
    console.error("Error in getStoreLocation:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export { getStoreLocation,country_phonecode };
