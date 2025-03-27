import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";

const checkPermissionRoute = catchAsync(async (req, res, next) => {
  const accessRoutes = req.session.accessRoute || { routes: [] };
  const currentRoute = req.path;
  const isAllowedPath = currentRoute.split("/")[1];

  // Check if the route exists in the allowed routes array
  if (!accessRoutes.routes.includes(isAllowedPath)) {
    // If not allowed, respond with a "no route permission" message or page
    throw new AppError("No route permission", 403);
  }

  return next();
});

export default checkPermissionRoute;
