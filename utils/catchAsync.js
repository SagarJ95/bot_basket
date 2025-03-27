const catchAsync = (fun) => {
    const errorHandler = (req, res, next) => {
        fun(req, res, next).catch(next);
    }

    return errorHandler;
}

export default catchAsync;