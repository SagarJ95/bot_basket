import AppError from "../utils/appError.js";

const sendErrorDevHTML = (err, res) => {
  const statusCode = err.statusCode || 500;
  const status = false;
  const message = err.message || "Something went wrong";
  const stack = err.stack;

  // Render the error page with detailed information in development mode
  return res.status(statusCode).render("errors/error_detail", {
    title: "Error",
    statusCode,
    status,
    message,
    stack,
    layout: false, // Don't use any layout for error pages
  });
};

const sendErrorProdHTML = (err, res) => {
  const statusCode = err.statusCode || 500;
  const status = false;
  const message = err.isOperational ? err.message : "Something went wrong";

  // Render the error page with user-friendly messages in production mode
  return res.status(statusCode).render("errors/error_detail", {
    title: "Error",
    statusCode,
    status,
    message,
    stack: undefined, // Hide stack trace in production
    layout: false, // Don't use any layout for error pages
  });
};

const sendErrorDev = (err, res) => {
  const statusCode = err.statusCode || 500;
  const status = false;
  const message = err.message || "Something went wrong";
  const stack = err.stack;
  const errors = err.errors || [];

  return res.status(statusCode).json({ status, message, stack, errors });
};

const sendErrorProd = (err, res) => {
  const statusCode = err.statusCode || 500;
  const status = false;
  const message = err.message || "Something went wrong";
  const errors = err.errors || [];

  if (err.isOperational) {
    return res.status(statusCode).json({ status, message, errors });
  } else {
    return res
      .status(500)
      .json({ status: false, message: "Something went wrong" });
  }
};

const globalErrorHandler = (err, req, res, next) => {
  // Check if the request expects HTML
  if (
    req.headers["content-type"] === "application/html" ||
    req.accepts("html")
  ) {
    // If it's in development mode, render the HTML error page with full details
    if (process.env.NODE_ENV === "development") {
      return sendErrorDevHTML(err, res);
    }
    // In production, render a user-friendly error page
    return sendErrorProdHTML(err, res);
  }

  // Handle specific errors like JsonWebTokenError, Sequelize errors
  if (err.name === "JsonWebTokenError") {
    err = res.status(401).json({ status: 401, message: "Token expired",errors:{} });
    //err = new AppError("Invalid token", 401);
  }

  if (err.name === "TokenExpiredError") {
    err = res.status(400).json({ status: 400, message: "Invalid token",errors:{} });
    //err = new AppError("Invalid token", 401);
  }

  if (err.name === "SequelizeValidationError") {
    err = new AppError(err.errors[0].message, 400);
  }

  if (err.name === "SequelizeUniqueConstraintError") {
    err = new AppError(err.errors[0].message, 400);
  }

  // If the request does not expect HTML, handle it as JSON
  if (process.env.NODE_ENV === "development") {
    return sendErrorDev(err, res);
  }

  sendErrorProd(err, res);
};

export default globalErrorHandler;
