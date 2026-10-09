
function notFound(req, res, next) {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
}

function errorHandler(err, req, res, next) {
    console.error("API Error:", err.message);

    const statusCode =
        res.statusCode >= 400 ? res.statusCode : 500;

    res.status(statusCode).json({
        success: false,
        message:
            statusCode === 500
                ? "Internal server error."
                : err.message
    });
}

module.exports = { notFound, errorHandler };