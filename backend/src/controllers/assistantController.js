const assistant = require("../assistant/assistant");

// POST /api/assistant/ask { question, history?, page?, language? }
const ask = async (req, res) => {
    const { question, history, page, language } = req.body ?? {};
    if (typeof question !== "string" || !question.trim()) {
        return res.status(400).json({ success: false, message: "Ask a question." });
    }
    if (question.length > 500) {
        return res.status(400).json({ success: false, message: "Questions can be up to 500 characters." });
    }
    if (history !== undefined && (!Array.isArray(history) || history.length > 20)) {
        return res.status(400).json({ success: false, message: "Invalid conversation history." });
    }

    try {
        const data = await assistant.ask({
            user: req.user,
            question,
            history,
            page: typeof page === "string" ? page.slice(0, 200) : null,
            language
        });
        return res.json({ success: true, data });
    } catch (error) {
        console.error("Assistant error:", error);
        return res.status(500).json({ success: false, message: "The helper couldn't answer right now." });
    }
};

// GET /api/assistant/suggestions?page=/receivables&language=fr
const getSuggestions = (req, res) => {
    const page = typeof req.query.page === "string" ? req.query.page.slice(0, 200) : "/";
    return res.json({ success: true, data: assistant.suggestions({ user: req.user, page, language: req.query.language }) });
};

module.exports = { ask, getSuggestions };
