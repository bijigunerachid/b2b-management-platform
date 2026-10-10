// Finds the help articles that answer a question. Pure functions, no database.
//
// Each article is indexed in all three languages, so a question in French
// finds the right article even when the app is in English. Words are matched
// whole and as 3-letter pieces, which keeps typos ("paymnt", "facure") and
// word forms ("invoices", "invoicing") working without a dictionary. Scores are
// TF-IDF cosine similarity, computed separately for whole words and for pieces
// and mixed (WORD_SHARE); the title counts three times, keywords twice.

const LANGUAGES = ["en", "fr", "ar"];
const FIELD_WEIGHTS = { title: 3, keywords: 2, body: 1 };
const PAGE_BOOST = 0.04; // a question asked on a page leans towards that page's articles
const WORD_SHARE = 0.7; // whole words are the stronger signal; pieces catch typos and word forms

const STOPWORDS = new Set(
    (
        "a an the and or of to in on for with is are be can i my me we our you your it this that how what why where when do does " +
        "who which there today now will would could should please did was were has have " +
        "qui quel quelle quels quelles il est aujourd hui maintenant " +
        "le la les un une des de du et ou en au aux pour avec est sont je mon ma mes nous vous votre vos il elle ce cette comment quoi pourquoi où quand " +
        "في من على الى إلى عن مع هل ما ماذا كيف لماذا أين متى هذا هذه أنا نحن انت أنت و او أو"
    ).split(" ").map(normalize)
);

/** Lowercase, without accents, Arabic diacritics or letter variants. */
function normalize(text) {
    return String(text ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "") // Latin accents
        .replace(/[ً-ٰٟـ]/g, "") // Arabic diacritics and tatweel
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/ؤ/g, "و")
        .replace(/ئ/g, "ي");
}

function words(text) {
    return normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Term counts: whole words (w:) and 3-letter pieces of each word (c:). */
function terms(text, weight = 1) {
    const counts = new Map();
    const add = (term) => counts.set(term, (counts.get(term) ?? 0) + weight);
    for (const word of words(text)) {
        if (STOPWORDS.has(word)) continue;
        add(`w:${word}`);
        const padded = `_${word}_`;
        for (let i = 0; i + 3 <= padded.length; i += 1) add(`c:${padded.slice(i, i + 3)}`);
    }
    return counts;
}

function merge(target, source) {
    for (const [term, count] of source) target.set(term, (target.get(term) ?? 0) + count);
    return target;
}

function vectorize(counts, idf) {
    const vector = new Map();
    let norm = 0;
    for (const [term, count] of counts) {
        const weight = (1 + Math.log(count)) * (idf.get(term) ?? 0);
        if (weight <= 0) continue;
        vector.set(term, weight);
        norm += weight * weight;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [term, weight] of vector) vector.set(term, weight / norm);
    return vector;
}

function cosine(a, b) {
    const [small, large] = a.size < b.size ? [a, b] : [b, a];
    let sum = 0;
    for (const [term, weight] of small) {
        const other = large.get(term);
        if (other) sum += weight * other;
    }
    return sum;
}

/**
 * Builds a search index over articles. `wordShare` is how much whole words
 * count against 3-letter pieces (1 = whole words only), for the evaluation.
 */
function buildIndex(articles, { wordShare = WORD_SHARE } = {}) {
    const documents = [];
    for (const article of articles) {
        for (const language of LANGUAGES) {
            const counts = new Map();
            for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
                merge(counts, terms(article[field]?.[language] ?? "", weight));
            }
            documents.push({ article, language, counts });
        }
    }

    const documentFrequency = new Map();
    for (const { counts } of documents) {
        for (const term of counts.keys()) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    const idf = new Map();
    for (const [term, frequency] of documentFrequency) idf.set(term, Math.log((documents.length + 1) / (frequency + 1)) + 1);

    for (const document of documents) Object.assign(document, split(document.counts, idf));
    return { documents, idf, wordShare };
}

/** Separate unit vectors for whole words and for 3-letter pieces. */
function split(counts, idf) {
    const part = (prefix) => vectorize(new Map([...counts].filter(([term]) => term.startsWith(prefix))), idf);
    return { wordVector: part("w:"), pieceVector: part("c:") };
}

/**
 * Articles ranked for a question: [{ article, score }], best first, one entry
 * per article (its best language). `allowed(article)` filters what this user
 * may see; `page` is the path the question was asked on.
 */
function search(index, question, { limit = 5, allowed = () => true, page = null } = {}) {
    const query = split(terms(question), index.idf);
    if (!query.wordVector.size && !query.pieceVector.size) return [];

    const best = new Map();
    for (const { article, wordVector, pieceVector } of index.documents) {
        if (!allowed(article)) continue;
        let score = index.wordShare * cosine(query.wordVector, wordVector) + (1 - index.wordShare) * cosine(query.pieceVector, pieceVector);
        if (page && samePage(article.path, page)) score += PAGE_BOOST;
        if (score > (best.get(article.id)?.score ?? 0)) best.set(article.id, { article, score });
    }
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

function samePage(articlePath, page) {
    if (!articlePath) return false;
    const path = page.split("?")[0].replace(/\/+$/, "") || "/";
    return articlePath === path;
}

module.exports = { LANGUAGES, buildIndex, normalize, search, words };
