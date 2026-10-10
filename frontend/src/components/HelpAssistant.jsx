import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Icon from "./ui/Icon";
import { api, useResource } from "../lib/api";

import { getLocale, t, useLocale } from "../i18n";

const MAX_HISTORY = 6;

/** Paragraphs, numbered steps, bullet lists and **bold**, without injecting HTML. */
function RichText({ text }) {
  const blocks = [];
  for (const line of String(text ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    const kind = numbered ? "ol" : bullet ? "ul" : "p";
    const content = numbered?.[1] ?? bullet?.[1] ?? trimmed;
    const last = blocks[blocks.length - 1];
    if (kind !== "p" && last?.kind === kind) last.items.push(content);
    else blocks.push({ kind, items: [content] });
  }

  const inline = (value) =>
    value.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part
    );

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.kind === "p") return <p key={index}>{inline(block.items[0])}</p>;
        const List = block.kind;
        return (
          <List key={index} className={`space-y-1 ps-5 ${block.kind === "ol" ? "list-decimal" : "list-disc"}`}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{inline(item)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

function OpenPage({ path, onOpen }) {
  if (!path) return null;
  return (
    <button type="button" onClick={() => onOpen(path)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: "var(--primary)" }}>
      {t("Open this page")}
      <Icon name="arrowRight" size={13} />
    </button>
  );
}

function ArticleAnswer({ article, onOpen }) {
  return (
    <div>
      <p className="mb-1.5 font-semibold app-text">{article.title}</p>
      <RichText text={article.body} />
      <OpenPage path={article.path} onOpen={onOpen} />
    </div>
  );
}

const NOTICES = {
  not_found: "I couldn't find that in the help guide. Try other words, or ask someone on your team.",
  ai_unavailable: "The AI helper isn't available right now, so here's the matching page of the help guide.",
  ai_limit: "The AI helper has reached its limit for now, so here's the matching page of the help guide.",
};

function AssistantMessage({ message, onOpen, onShowArticle }) {
  const [first, ...related] = message.articles ?? [];
  return (
    <div className="space-y-2">
      {message.notice && <p className="text-xs app-text-muted">{t(NOTICES[message.notice])}</p>}
      {message.answer ? (
        <RichText text={message.answer} />
      ) : (
        first && <ArticleAnswer article={first} onOpen={onOpen} />
      )}
      {(message.answer ? message.articles : related)?.length > 0 && (
        <div className="border-t pt-2" style={{ borderColor: "var(--border-color)" }}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide app-text-muted">{message.answer ? t("From the help guide") : t("Related")}</p>
          <div className="flex flex-wrap gap-1.5">
            {(message.answer ? message.articles : related).map((article) => (
              <button
                key={article.id}
                type="button"
                onClick={() => (message.answer && article.path ? onOpen(article.path) : onShowArticle(article))}
                className="rounded-full border px-2.5 py-1 text-xs transition hover:bg-[var(--surface-hover)] app-text-secondary"
                style={{ borderColor: "var(--border-color)" }}
              >
                {article.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HelpAssistant() {
  const { locale } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  const page = location.pathname;
  const { data } = useResource(open ? `/assistant/suggestions?page=${encodeURIComponent(page)}&language=${locale}` : null);
  const suggestions = data?.data;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function openPage(path) {
    navigate(path);
  }

  function showArticle(article, asked) {
    setMessages((current) => [...current, ...(asked ? [{ role: "user", content: asked }] : []), { role: "assistant", articles: [article], mode: "search" }]);
  }

  function explainPage() {
    const [first, ...rest] = suggestions?.page ?? [];
    if (!first) return;
    setMessages((current) => [...current, { role: "user", content: t("Explain this page") }, { role: "assistant", articles: [first, ...rest], mode: "search" }]);
  }

  async function ask(question) {
    const text = question.trim();
    if (!text || busy) return;
    const history = messages
      .slice(-MAX_HISTORY)
      .map((message) =>
        message.role === "user"
          ? { role: "user", content: message.content }
          : { role: "assistant", content: message.answer ?? (message.articles?.[0] ? `${message.articles[0].title}\n${message.articles[0].body}` : "") }
      )
      .filter((turn) => turn.content);
    setMessages((current) => [...current, { role: "user", content: text }]);
    setDraft("");
    setBusy(true);
    try {
      const result = await api("/assistant/ask", { method: "POST", body: { question: text, history, page, language: getLocale() } });
      setMessages((current) => [...current, { role: "assistant", ...result.data }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", error: error.message || t("The helper couldn't answer right now.") }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="help-assistant"
        aria-label={open ? t("Close the helper") : t("Open the helper")}
        title={t("Help")}
        className="fixed bottom-5 end-5 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition hover:scale-105"
        style={{ backgroundColor: "var(--primary)", color: "var(--primary-contrast)", marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <Icon name={open ? "close" : "helpCircle"} size={22} />
      </button>

      {open && (
        <section
          id="help-assistant"
          role="dialog"
          aria-label={t("Helper")}
          className="fixed bottom-20 end-5 z-40 flex w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border animate-pop-in"
          style={{ height: "min(600px, calc(100vh - 7rem))", backgroundColor: "var(--surface)", borderColor: "var(--border-color)", boxShadow: "var(--pop-shadow)" }}
        >
          <header className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
              <Icon name="sparkles" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold app-text">{t("Helper")}</h2>
              <p className="truncate text-[11px] app-text-muted">
                {suggestions?.ai ? t("AI answers based on the help guide") : t("Answers from the help guide")}
              </p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={() => setMessages([])} className="text-xs font-semibold hover:underline app-text-secondary">
                {t("New conversation")}
              </button>
            )}
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm app-text-secondary" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-4">
                <p className="app-text">{t("Hi! Ask me how to do something in the app, in English, French or Arabic.")}</p>
                {suggestions?.page?.length > 0 && (
                  <button
                    type="button"
                    onClick={explainPage}
                    className="flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-start font-semibold transition hover:bg-[var(--surface-hover)] app-text"
                    style={{ borderColor: "color-mix(in srgb, var(--primary) 40%, var(--border-color))" }}
                  >
                    <Icon name="info" size={16} style={{ color: "var(--primary)" }} />
                    {t("Explain this page")}
                  </button>
                )}
                {[...(suggestions?.page ?? []), ...(suggestions?.general ?? [])].length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide app-text-muted">{t("Popular questions")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[...(suggestions?.page ?? []), ...(suggestions?.general ?? [])].map((article) => (
                        <button
                          key={article.id}
                          type="button"
                          onClick={() => showArticle(article, article.title)}
                          className="rounded-full border px-2.5 py-1 text-start text-xs transition hover:bg-[var(--surface-hover)] app-text-secondary"
                          style={{ borderColor: "var(--border-color)" }}
                        >
                          {article.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {messages.map((message, index) =>
              message.role === "user" ? (
                <div key={index} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-ee-md px-3 py-2" style={{ backgroundColor: "var(--primary)", color: "var(--primary-contrast)" }}>
                    {message.content}
                  </p>
                </div>
              ) : (
                <div key={index} className="max-w-[95%] rounded-2xl rounded-es-md border px-3 py-2.5" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface-muted)" }}>
                  {message.error ? (
                    <p style={{ color: "var(--danger)" }}>{message.error}</p>
                  ) : (
                    <AssistantMessage message={message} onOpen={openPage} onShowArticle={(article) => showArticle(article, article.title)} />
                  )}
                </div>
              )
            )}
            {busy && (
              <div className="flex gap-1 px-1" aria-label={t("Thinking…")}>
                {[0, 1, 2].map((dot) => (
                  <span key={dot} className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: "var(--text-muted)", animationDelay: `${dot * 150}ms` }} />
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask(draft);
            }}
            className="flex items-center gap-2 border-t p-3"
            style={{ borderColor: "var(--border-color)" }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={500}
              placeholder={t("Ask a question…")}
              aria-label={t("Your question")}
              className="app-input h-10 flex-1"
            />
            <button
              type="submit"
              disabled={!draft.trim() || busy}
              aria-label={t("Send")}
              className="flex h-10 w-10 items-center justify-center rounded-[var(--control-radius)] transition disabled:opacity-40"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-contrast)" }}
            >
              <Icon name="send" size={17} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
