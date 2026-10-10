// JSON columns come back as objects from MySQL and as strings from MariaDB.
function parseJson(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

module.exports = { parseJson };
