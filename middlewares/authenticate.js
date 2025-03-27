import pkg from 'jsonwebtoken';
const { verify } = pkg;
import User from '../db/models/user.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

const authenticate = catchAsync(async (req, res, next) => {
    // Get the token from headers
    let token = '';

    if (req.headers['content-type'] === 'application/html' || req.accepts('html')) {
        token = req.session.token;
    } else {
        // Check for bearer token
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }else{
            token = req.session.token;
        }
    }

    //console.log("Token = ",token); return false;

    // Check if token exists and matches the session token (either admin or customer)
    if (!token || (token !== req.session.token)) {
        if (req.headers['content-type'] === 'application/html' || req.accepts('html')) {
            return res.redirect('/admin');
        } else {
            throw new AppError('Please Login to get access', 401);
        }
    }

    // Check if token is valid
    const tokenDetail = verify(token, process.env.JWT_SECRET_KEY);

    const freshUser = await User.findByPk(tokenDetail.id); // Customer or carwasher login

    if (!freshUser) {
        return res.redirect('/admin');
       // throw new AppError('User does not exist', 201);
    }

    // Attach user details to request
    req.user = freshUser;
    req.role = tokenDetail.role;

    return next();
});

export default authenticate;