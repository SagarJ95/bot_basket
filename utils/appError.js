class AppError extends Error {
    constructor(message, statusCode, errors) {
        super(message)
        this.statusCode = statusCode
        this.status = false;

        var formattedErrors = {};
        if (errors) {
            // Convert errors to a format { field_name: "error_message" }
            errors.array().forEach(error => {
                formattedErrors[error.path] = error.msg;
            });
        }
        this.errors = formattedErrors ? formattedErrors : [];

        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

export default AppError;