import pkg from 'jsonwebtoken';
const { verify } = pkg;
import User from '../db/models/user.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

const authenticate = catchAsync(async (req, res, next) => {
    // Get the token from headers
    let token = '';

    // Check for bearer token
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    // Check if token is valid
    const tokenDetail = await new Promise((resolve, reject) => {
        verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
            if (err) {
                if (err.name === "TokenExpiredError") {
                    return res.status(401).json({ status: 401, message: "Token expired",errors:{} });
                } else if (err.name === "JsonWebTokenError") {
                    return res.status(400).json({ status: 400, message: "Invalid token",errors:{} });
                } else {
                    return res.status(403).json({ status: 403, message: "Unauthorized access",errors:{} });
                }
            }
            resolve(decoded);
        });
    });

    const admin = await User.findByPk(tokenDetail.id); // Customer or carwasher login

    if (!admin) {
        throw new AppError('Customer does not exist', 201);
    }

    // Attach admmin details to request
    req.user = admin;
    return next();
});
export default authenticate;
