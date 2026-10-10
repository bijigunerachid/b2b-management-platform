// Reads what the Python jobs in ml/ publish: the model registry and the
// demand forecasts. The API never trains anything; until a job has run (or
// if the migration hasn't been applied) these return empty results.
const { parseJson } = require("../services/json");

const DEMAND_FORECAST = "demand_forecast";
const PAYMENT_RISK = "payment_risk";
const RECOMMENDATIONS = "recommendations";
// Probability of paying more than 7 days late from which an invoice counts as "likely late".
const HIGH_RISK = 0.5;
const HISTORY_WEEKS = 26;
const WEEK_MS = 7 * 24 * 3600 * 1000;

async function tolerateMissingTable(query, fallback) {
    try {
        return await query();
    } catch (error) {
        if (error?.code === "ER_NO_SUCH_TABLE") return fallback;
        throw error;
    }
}

function toModel(row) {
    return {
        id: row.id,
        name: row.name,
        version: row.version,
        trained_at: row.trained_at,
        is_active: Boolean(row.is_active),
        metrics: parseJson(row.metrics)
    };
}

function toForecast(row) {
    return {
        product_id: row.product_id,
        origin_week: row.origin_week,
        horizon_weeks: Number(row.horizon_weeks),
        units: Number(row.units),
        lower_units: Number(row.lower_units),
        upper_units: Number(row.upper_units)
    };
}

/** Every trained version, newest first, with the full details of the active ones. */
async function listModels(connection) {
    return tolerateMissingTable(async () => {
        const [rows] = await connection.query(
            "SELECT id, name, version, trained_at, is_active, metrics, details FROM ml_models ORDER BY trained_at DESC, id DESC LIMIT 100"
        );
        return rows.map((row) => ({ ...toModel(row), details: row.is_active ? parseJson(row.details) : null }));
    }, []);
}

/** Active demand forecasts as Map(product_id → forecast). */
async function loadActiveForecasts(connection) {
    return tolerateMissingTable(async () => {
        const [rows] = await connection.query(
            `SELECT f.product_id, DATE_FORMAT(f.origin_week, '%Y-%m-%d') AS origin_week, f.horizon_weeks,
                    f.units, f.lower_units, f.upper_units
             FROM demand_forecasts f
             INNER JOIN ml_models m ON m.id = f.model_id AND m.is_active = 1 AND m.name = ?`,
            [DEMAND_FORECAST]
        );
        return new Map(rows.map((row) => [row.product_id, toForecast(row)]));
    }, new Map());
}

/** Active late-payment scores as Map(order_id → { probability, facts }). */
async function loadRiskScores(connection) {
    return tolerateMissingTable(async () => {
        const [rows] = await connection.query(
            `SELECT s.order_id, s.probability, s.facts
             FROM payment_risk_scores s
             INNER JOIN ml_models m ON m.id = s.model_id AND m.is_active = 1 AND m.name = ?`,
            [PAYMENT_RISK]
        );
        return new Map(rows.map((row) => [row.order_id, { probability: Number(row.probability), facts: parseJson(row.facts) }]));
    }, new Map());
}

/**
 * Products recommended to one customer, best first: active products they
 * still haven't bought (also since the model was trained), with the reason.
 */
async function loadRecommendations(connection, customerId, limit = 10) {
    return tolerateMissingTable(async () => {
        const [rows] = await connection.query(
            `SELECT r.rank_position, r.reason, p.id, p.name, p.description, p.price, p.stock, p.reorder_point,
                    p.is_active, p.category_id, c.name AS category_name
             FROM product_recommendations r
             INNER JOIN ml_models m ON m.id = r.model_id AND m.is_active = 1 AND m.name = ?
             INNER JOIN products p ON p.id = r.product_id AND p.is_active = 1
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE r.customer_id = ?
               AND NOT EXISTS (
                   SELECT 1 FROM order_items oi
                   INNER JOIN orders o ON o.id = oi.order_id
                   WHERE o.customer_id = r.customer_id AND oi.product_id = r.product_id AND o.status <> 'Cancelled'
               )
             ORDER BY r.rank_position
             LIMIT ?`,
            [RECOMMENDATIONS, customerId, limit]
        );

        const reasons = rows.map((row) => parseJson(row.reason) ?? { type: "popular_in_category" });
        const relatedIds = [...new Set(reasons.filter((reason) => reason.type === "bought_with").map((reason) => reason.product_id))];
        const names = new Map();
        if (relatedIds.length) {
            const [related] = await connection.query("SELECT id, name FROM products WHERE id IN (?)", [relatedIds]);
            for (const product of related) names.set(product.id, product.name);
        }

        return rows.map((row, index) => {
            const reason = reasons[index];
            return {
                ...row,
                price: Number(row.price),
                reason:
                    reason.type === "bought_with" && names.has(reason.product_id)
                        ? { type: "bought_with", product_id: reason.product_id, product_name: names.get(reason.product_id), share: reason.share ?? null }
                        : { type: "popular_in_category" }
            };
        });
    }, []);
}

/** Monday 00:00 UTC of the week `date` falls in. */
function mondayOf(date) {
    const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    return day;
}

/** `weeks` Mondays ending with `lastWeek`, each with the units sold that week (zeros filled in). */
function fillWeeks(rows, lastWeek, weeks = HISTORY_WEEKS) {
    const units = new Map(rows.map((row) => [row.week, Number(row.units)]));
    const result = [];
    for (let i = weeks - 1; i >= 0; i -= 1) {
        const week = new Date(lastWeek.getTime() - i * WEEK_MS).toISOString().slice(0, 10);
        result.push({ week, units: units.get(week) ?? 0 });
    }
    return result;
}

/**
 * The active forecast for one product with recent weekly sales for context.
 * History ends at the forecast's origin week (the last full week the model
 * saw), or at last week when there is no forecast.
 */
async function productForecast(connection, productId, now = new Date()) {
    const model = await tolerateMissingTable(async () => {
        const [rows] = await connection.query(
            "SELECT id, name, version, trained_at, is_active, metrics FROM ml_models WHERE name = ? AND is_active = 1 LIMIT 1",
            [DEMAND_FORECAST]
        );
        return rows[0] ? toModel(rows[0]) : null;
    }, null);

    const forecast = model ? (await loadActiveForecasts(connection)).get(productId) ?? null : null;

    const lastWeek = forecast ? new Date(`${forecast.origin_week}T00:00:00Z`) : new Date(mondayOf(now).getTime() - WEEK_MS);
    const firstWeek = new Date(lastWeek.getTime() - (HISTORY_WEEKS - 1) * WEEK_MS);
    const endExclusive = new Date(lastWeek.getTime() + WEEK_MS);

    const [rows] = await connection.query(
        `SELECT DATE_FORMAT(DATE_SUB(DATE(o.created_at), INTERVAL WEEKDAY(o.created_at) DAY), '%Y-%m-%d') AS week,
                SUM(oi.quantity) AS units
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         WHERE oi.product_id = ? AND o.status <> 'Cancelled'
           AND o.created_at >= ? AND o.created_at < ?
         GROUP BY week`,
        [productId, firstWeek, endExclusive]
    );

    return { model, forecast, history: fillWeeks(rows, lastWeek) };
}

module.exports = {
    DEMAND_FORECAST,
    HIGH_RISK,
    HISTORY_WEEKS,
    PAYMENT_RISK,
    RECOMMENDATIONS,
    fillWeeks,
    listModels,
    loadActiveForecasts,
    loadRecommendations,
    loadRiskScores,
    mondayOf,
    productForecast
};
