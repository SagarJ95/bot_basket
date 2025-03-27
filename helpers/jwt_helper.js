import pkg from 'jsonwebtoken';
const { sign, verify } = pkg;
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import User from '../db/models/user.js';

// GENERATE TOKEN
const generateToken = (payload) => {
    return sign(payload, process.env.JWT_SECRET_KEY, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    })
}

// VERIFY TOKEN
const verifyToken = catchAsync(async (req, res, next) => {
    // get the token from headers
    let idToken = '';

    // Check for bearer token
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        idToken = req.headers.authorization.split(' ')[1];
    }

    // Check for token exists
    if (!idToken) {
        throw new AppError('Please Login to get access', 401);
    }

    // Check token is valid
    const tokenDetail = verify(idToken, process.env.JWT_SECRET_KEY);

    // Check user is valid
    const freshUser = await User.findByPk(tokenDetail.id);

    if (!freshUser) {
        throw new AppError('User does not exist', 201);
    }

    // Give user to request
    req.user = freshUser;

    return next();
})

export { generateToken, verifyToken }