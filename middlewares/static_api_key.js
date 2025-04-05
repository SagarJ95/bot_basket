import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

const staticApiKey = catchAsync(async (req, res, next) => {
    //const secretKey = "craftSchool3!@#project%^&*user987!!sum@n@apis";

    //let token = req.headers.api_key;
    let token = req.headers['x-api-key'];

    // Ensure token exists
    if (!token) {
        throw new AppError('Missing API key', 401);
    }

    try {

        // Decrypt the received token
        const encryptKey = 'IjMgJzUSIikuLi1yYAFiNWQfZ2s0MiQzeHl2YGAyN';

        // Compare with expected API key
        if (token !== encryptKey) {
            throw new AppError('Invalid API key', 401);
        }

        next();
    } catch (error) {
        throw new AppError('Invalid or malformed API key', 401);
    }
});

export default staticApiKey;
