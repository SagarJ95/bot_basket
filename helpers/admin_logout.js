import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";

const userLogout = catchAsync(async (req, res, next) => {
    try {
      if (!req.user || !req.role) {
        throw new AppError("Invalid User", 400);
      }

      // Clear the token stored in the session
      req.session.token = null;
      if (
        req.headers["content-type"] === "application/html" ||
        req.accepts("html")
      ) {
        next();
      } else {
        return res
          .status(200)
          .json({ status: "success", message: "Logout successfully" });
      }
    } catch (error) {
      throw new AppError(error.message, 400);
    }
  });

  export default userLogout;