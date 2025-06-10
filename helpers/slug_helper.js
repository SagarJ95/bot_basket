import Customer from "../db/models/customers.js";
import pkg from "jsonwebtoken";
const { verify } = pkg;

const generateSlug = (title) => {
  return title
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

const media_url = (url) => {
  //return url.replace(/^public\\/, "/").replace(/\\/g, "/");
  return url.replace(/^public[\\/]/, "/").replace(/\\/g, "/");
};

const verifycustomerToken = async (token = null) => {
  if (!token) return null; // If token is missing, return null (not empty string)

  try {
    const tokenDetail = await new Promise((resolve, reject) => {
      verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) return resolve(null); // Return null for invalid/expired token
        resolve(decoded);
      });
    });

    if (!tokenDetail?.id) return null;

    const freshCustomer = await Customer.findByPk(tokenDetail.id);
    if (!freshCustomer) return null; // Return null if customer does not exist

    return freshCustomer.id; // Return customer ID
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
};

const formatValidationArray = async (errors) => {
  const result = errors.errors.reduce((acc, curr) => {
    if (curr.path) {
      acc[curr.path] = curr.msg;
    }
    return acc;
  }, {});

  return result;
};

const formatDateToISO = async (dateStr) => {
  const [day, month, year] = dateStr.split("-");
  return `${year}-${month}-${day}`;
};

export {
  generateSlug,
  media_url,
  verifycustomerToken,
  formatValidationArray,
  formatDateToISO,
};
