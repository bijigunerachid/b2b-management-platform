// The help assistant: finds the right help articles for a question and, when
// a Claude API key is configured, has Claude write the answer from them.
// Without a key (or if Claude fails or a limit is reached) the answer is the
// best article itself, so the helper always works.

const { can } = require("../config/permissions");
const staffArticles = require("./articles.staff");
const clientArticles = require("./articles.client");
const { buildIndex, search } = require("./search");
const claude = require("./claude");

const LANGUAGES = ["en", "fr", "ar"];
const MAX_QUESTION = 500;
const MAX_TURNS = 6; // earlier turns sent to Claude for follow-up questions
const MAX_TURN_LENGTH = 1500;
// Below this score the best match is probably unrelated: say so instead of guessing.
const MIN_SCORE = 0.12;
const AI_PER_USER_PER_HOUR = 30;
const DEFAULT_DAILY_LIMIT = 300;

const indexes = {
    staff: buildIndex(staffArticles),
    client: buildIndex(clientArticles)
};

function audienceOf(user) {
    return user?.role === "Customer" ? "client" : "staff";
}

/** Can this user see this article? Staff articles may need a permission. */
function allowedFor(user) {
    const audience = audienceOf(user);
    return (article) => audience === "client" || !article.permission || can(user, article.permission);
}

function present(article, language) {
    return {
        id: article.id,
        title: article.title[language] ?? article.title.en,
        body: article.body[language] ?? article.body.en,
        path: article.path ?? null
    };
}

// In-memory limits, like the rest of the API's rate limiting (one instance).
const usage = { day: null, total: 0, perUser: new Map() };

function underLimits(userId, now = Date.now()) {
    const day = new Date(now).toISOString().slice(0, 10);
    if (usage.day !== day) Object.assign(usage, { day, total: 0, perUser: new Map() });
    const dailyLimit = Number(process.env.ASSISTANT_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
    const recent = (usage.perUser.get(userId) ?? []).filter((time) => now - time < 3600 * 1000);
    usage.perUser.set(userId, recent);
    return usage.total < dailyLimit && recent.length < AI_PER_USER_PER_HOUR;
}

function countUse(userId, now = Date.now()) {
    usage.total += 1;
    usage.perUser.get(userId)?.push(now);
}

function cleanHistory(history) {
    if (!Array.isArray(history)) return [];
    return history
        .filter((turn) => (turn?.role === "user" || turn?.role === "assistant") && typeof turn.content === "string" && turn.content.trim())
        .slice(-MAX_TURNS)
        .map((turn) => ({ role: turn.role, content: turn.content.slice(0, MAX_TURN_LENGTH) }));
}

/**
 * Answers a question. Returns
 * { mode: "ai" | "search", answer: string | null, articles, notice: null | "not_found" | "ai_unavailable" | "ai_limit" }.
 * In search mode the first article is the answer; the others are related.
 */
async function ask({ user, question, history, page, language }, { askClaude = claude.askClaude, now = Date.now() } = {}) {
    const lang = LANGUAGES.includes(language) ? language : "en";
    const text = String(question ?? "").trim().slice(0, MAX_QUESTION);
    const turns = cleanHistory(history);
    const audience = audienceOf(user);

    const options = { limit: 4, allowed: allowedFor(user), page };
    const found = search(indexes[audience], text, options).filter((result) => result.score >= MIN_SCORE);
    const articles = found.map((result) => present(result.article, lang));

    if (claude.isConfigured()) {
        // Follow-ups like "and for a partial one?" only make sense with the earlier
        // question, so Claude also gets the articles for it, and the conversation.
        // (Search alone doesn't do this: it would answer an unrelated question
        // with the previous topic.)
        const lastQuestion = [...turns].reverse().find((turn) => turn.role === "user")?.content;
        if (lastQuestion) {
            for (const result of search(indexes[audience], `${text} ${lastQuestion}`, options)) {
                if (result.score >= MIN_SCORE && !found.some((item) => item.article.id === result.article.id)) found.push(result);
            }
        }

        if (!underLimits(user.userId, now)) {
            return { mode: "search", answer: null, articles, notice: articles.length ? "ai_limit" : "not_found" };
        }
        try {
            countUse(user.userId, now);
            const context = found.slice(0, 5);
            const reply = await askClaude({
                question: text,
                history: turns,
                articles: context.map((result) => result.article),
                language: lang,
                audience
            });
            const used = reply.sources;
            const shown = context.map((result) => present(result.article, lang));
            const ordered = [...shown.filter((a) => used.includes(a.id)), ...shown.filter((a) => !used.includes(a.id))];
            return { mode: "ai", answer: reply.answer, articles: ordered.slice(0, 3), notice: null };
        } catch (error) {
            console.error("Assistant: Claude unavailable, falling back to search:", error.message);
            return { mode: "search", answer: null, articles, notice: articles.length ? "ai_unavailable" : "not_found" };
        }
    }

    return { mode: "search", answer: null, articles, notice: articles.length ? null : "not_found" };
}

/** Articles about the page the user is on, then general ones, for the helper's start screen. */
function suggestions({ user, page, language }) {
    const lang = LANGUAGES.includes(language) ? language : "en";
    const audience = audienceOf(user);
    const allowed = allowedFor(user);
    const pool = (audience === "client" ? clientArticles : staffArticles).filter(allowed);
    const path = String(page ?? "/").split("?")[0].replace(/\/+$/, "") || "/";
    const here = pool.filter((article) => article.path === path);
    const general = pool.filter((article) => article.path !== path && ["getting-started", "portal-start", "roles", "portal-order"].includes(article.id));
    return {
        ai: claude.isConfigured(),
        page: here.slice(0, 4).map((article) => present(article, lang)),
        general: general.slice(0, 3).map((article) => present(article, lang))
    };
}

module.exports = { MIN_SCORE, allowedFor, ask, audienceOf, suggestions, _usage: usage };
