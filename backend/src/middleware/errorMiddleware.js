function notFound(req, res) {
    res.status(404).json({
        success: false,
        message: "Route not found."
    });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    // Body-parser and other HTTP errors carry their own 4xx status.
    const status = Number(err.status || err.statusCode);
    const statusCode = status >= 400 && status < 500 ? status : 500;

    if (statusCode === 500) {
        console.error("API Error:", err);
    }

    const messages = {
        400: "Malformed request body.",
        413: "Request body is too large."
    };

    res.status(statusCode).json({
        success: false,
        message:
            statusCode === 500
                ? "Internal server error."
                : messages[statusCode] || "Request could not be processed."
    });
}

module.exports = { notFound, errorHandler };
