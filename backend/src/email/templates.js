// Emails to clients: a quote, an invoice, a payment reminder. Pure functions:
// each takes the document's data and a language and returns
// { subject, html, text }. Everything that comes from the database (names,
// notes) is escaped, so a product called "<b>" can't change the email.

const company = require("../config/company");

const LOCALES = { en: "fr-MA", fr: "fr-MA", ar: "ar-MA" }; // amounts like the app: 1 234,50 MAD
const DATE_LOCALES = { en: "en-GB", fr: "fr-MA", ar: "ar-MA" };

const TEXT = {
    en: {
        hello: "Hello {name},",
        quoteSubject: "Quote {number} from {company}",
        quoteIntro: "Please find our quote {number} below. It is valid until {date}.",
        quotePortal: "You can accept or decline it in your client portal:",
        invoiceSubject: "Invoice {number} from {company}",
        invoiceIntro: "Please find invoice {number} below, for order #{order}. Payment is due by {date}.",
        invoicePaid: "This invoice is already paid in full. Thank you.",
        reminderSubject: "Reminder: invoice {number} is due on {date}",
        reminderIntro: "A friendly reminder that invoice {number} is due on {date} ({when}). The amount still to pay is {amount}.",
        reminderPaidIgnore: "If you have already paid, thank you, and please ignore this email.",
        portal: "View it in your client portal:",
        product: "Product",
        quantity: "Qty",
        unitPrice: "Unit price",
        lineTotal: "Total",
        subtotal: "Subtotal (excl. VAT)",
        vat: "VAT 20%",
        total: "Total (incl. VAT)",
        credited: "Credit notes",
        paid: "Already paid",
        balance: "Amount due",
        payBy: "Payment by bank transfer to {bank}, RIB {rib}, quoting {number}.",
        note: "Note from {company}:",
        closing: "Kind regards,",
        footer: "{company} · {address} · {phone}"
    },
    fr: {
        hello: "Bonjour {name},",
        quoteSubject: "Devis {number} de {company}",
        quoteIntro: "Veuillez trouver ci-dessous notre devis {number}. Il est valable jusqu'au {date}.",
        quotePortal: "Vous pouvez l'accepter ou le refuser dans votre portail client :",
        invoiceSubject: "Facture {number} de {company}",
        invoiceIntro: "Veuillez trouver ci-dessous la facture {number}, pour la commande n° {order}. Le paiement est dû au plus tard le {date}.",
        invoicePaid: "Cette facture est déjà entièrement payée. Merci.",
        reminderSubject: "Rappel : la facture {number} arrive à échéance le {date}",
        reminderIntro: "Petit rappel : la facture {number} arrive à échéance le {date} ({when}). Le montant restant à payer est de {amount}.",
        reminderPaidIgnore: "Si vous avez déjà payé, merci, et ne tenez pas compte de ce message.",
        portal: "Consultez-la dans votre portail client :",
        product: "Produit",
        quantity: "Qté",
        unitPrice: "Prix unitaire",
        lineTotal: "Total",
        subtotal: "Sous-total HT",
        vat: "TVA 20 %",
        total: "Total TTC",
        credited: "Avoirs",
        paid: "Déjà payé",
        balance: "Montant dû",
        payBy: "Paiement par virement à {bank}, RIB {rib}, en indiquant {number}.",
        note: "Message de {company} :",
        closing: "Cordialement,",
        footer: "{company} · {address} · {phone}"
    },
    ar: {
        hello: "السلام عليكم {name}،",
        quoteSubject: "عرض السعر {number} من {company}",
        quoteIntro: "تجدون أدناه عرض السعر {number}، وهو صالح إلى غاية {date}.",
        quotePortal: "يمكنكم قبوله أو رفضه من بوابة الزبناء:",
        invoiceSubject: "الفاتورة {number} من {company}",
        invoiceIntro: "تجدون أدناه الفاتورة {number} الخاصة بالطلبية رقم {order}. يُستحق الأداء في أجل أقصاه {date}.",
        invoicePaid: "هذه الفاتورة مؤداة بالكامل. شكرًا لكم.",
        reminderSubject: "تذكير: الفاتورة {number} تُستحق بتاريخ {date}",
        reminderIntro: "نذكّركم بأن الفاتورة {number} تُستحق بتاريخ {date} ({when}). المبلغ المتبقي للأداء هو {amount}.",
        reminderPaidIgnore: "إذا كنتم قد أديتم المبلغ، فشكرًا لكم، ويُرجى تجاهل هذه الرسالة.",
        portal: "اطلعوا عليها في بوابة الزبناء:",
        product: "المنتج",
        quantity: "الكمية",
        unitPrice: "ثمن الوحدة",
        lineTotal: "المجموع",
        subtotal: "المجموع دون ضريبة",
        vat: "الضريبة 20%",
        total: "المجموع مع الضريبة",
        credited: "الإشعارات الدائنة",
        paid: "المبلغ المؤدى",
        balance: "المبلغ المستحق",
        payBy: "الأداء بتحويل بنكي إلى {bank}، رقم الحساب {rib}، مع ذكر {number}.",
        note: "رسالة من {company}:",
        closing: "مع خالص التحيات،",
        footer: "{company} · {address} · {phone}"
    }
};

/** "today", "tomorrow", "in 3 days", with Arabic's one/two/few/many forms. */
function whenText(days, language) {
    const n = Math.max(0, Math.round(Number(days) || 0));
    if (language === "fr") return n === 0 ? "aujourd'hui" : n === 1 ? "demain" : `dans ${n} jours`;
    if (language === "ar") {
        if (n === 0) return "اليوم";
        if (n === 1) return "غدًا";
        if (n === 2) return "بعد يومين";
        return n % 100 >= 3 && n % 100 <= 10 ? `بعد ${n} أيام` : `بعد ${n} يومًا`;
    }
    return n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Plain text to HTML. In Arabic, runs of Latin letters and digits (invoice
// numbers, the RIB, names, amounts) are kept together and left to right in a
// <bdi>, instead of the browser reordering or breaking them ("INV-2026-" /
// "004960"). Runs are found in the raw text, then each piece is escaped.
const LATIN_RUN = /[A-Za-z0-9][A-Za-z0-9\-.,:/@' ]*[A-Za-z0-9]/g;

function textToHtml(text, language) {
    if (language !== "ar") return escapeHtml(text);
    let html = "";
    let last = 0;
    for (const match of String(text).matchAll(LATIN_RUN)) {
        // A single code like INV-2026-000123 shouldn't break at its hyphens; runs with spaces may wrap.
        const nowrap = match[0].includes(" ") ? "" : ' style="white-space:nowrap"';
        html += `${escapeHtml(text.slice(last, match.index))}<bdi dir="ltr"${nowrap}>${escapeHtml(match[0])}</bdi>`;
        last = match.index + match[0].length;
    }
    return html + escapeHtml(String(text).slice(last));
}

function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, (match, name) => (values[name] === undefined ? match : String(values[name])));
}

function money(value, language) {
    return new Intl.NumberFormat(LOCALES[language], { style: "currency", currency: "MAD" }).format(Number(value) || 0);
}

function date(value, language) {
    const day = typeof value === "string" ? new Date(`${value.slice(0, 10)}T12:00:00Z`) : new Date(value);
    return new Intl.DateTimeFormat(DATE_LOCALES[language], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(day);
}

/** Text in the email language; `values` are plain text (escaped for HTML separately). */
function t(language, key, values = {}) {
    return fill(TEXT[language]?.[key] ?? TEXT.en[key], values);
}

function linesTable(lines, language) {
    const dir = language === "ar" ? "rtl" : "ltr";
    const align = dir === "rtl" ? "left" : "right";
    const start = dir === "rtl" ? "right" : "left";
    const cell = `padding:8px 10px;border-bottom:1px solid #e5e7eb;`;
    const head = [
        [t(language, "product"), start],
        [t(language, "quantity"), align],
        [t(language, "unitPrice"), align],
        [t(language, "lineTotal"), align]
    ]
        .map(([label, side]) => `<th style="${cell}text-align:${side};font-size:12px;color:#6b7280;font-weight:600;">${escapeHtml(label)}</th>`)
        .join("");
    const rows = lines
        .map(
            (line) => `<tr>
<td style="${cell}text-align:${start};">${escapeHtml(line.product_name)}</td>
<td style="${cell}text-align:${align};">${escapeHtml(line.quantity)}</td>
<td style="${cell}text-align:${align};white-space:nowrap;">${escapeHtml(money(line.unit_price, language))}</td>
<td style="${cell}text-align:${align};white-space:nowrap;">${escapeHtml(money(line.quantity * line.unit_price, language))}</td>
</tr>`
        )
        .join("");
    return `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;" dir="${dir}"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function totalsTable(rows, language) {
    const dir = language === "ar" ? "rtl" : "ltr";
    const align = dir === "rtl" ? "left" : "right";
    const body = rows
        .map(
            ([label, value, strong]) =>
                `<tr><td style="padding:4px 10px;text-align:${align};color:#374151;${strong ? "font-weight:700;" : ""}">${escapeHtml(label)}</td><td style="padding:4px 10px;text-align:${align};white-space:nowrap;${strong ? "font-weight:700;" : ""}">${escapeHtml(value)}</td></tr>`
        )
        .join("");
    return `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;" dir="${dir}">${body}</table>`;
}

/** Wraps the content in the email layout (inline styles: mail apps ignore <style>). */
function layout({ language, title, paragraphs, tableHtml = "", totalsHtml = "", link = null, linkIntro = "", note = "" }) {
    const dir = language === "ar" ? "rtl" : "ltr";
    const para = (text) => `<p style="margin:0 0 12px;line-height:1.55;">${textToHtml(text, language)}</p>`;
    const linkHtml = link
        ? `${para(linkIntro)}<p style="margin:0 0 16px;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">${escapeHtml(link)}</a></p>`
        : "";
    const noteHtml = note
        ? `<div style="margin:16px 0;padding:12px 14px;background:#f3f4f6;border-radius:8px;"><p style="margin:0 0 6px;font-weight:600;">${escapeHtml(t(language, "note", { company: company.name }))}</p><p dir="auto" style="margin:0;white-space:pre-line;line-height:1.55;">${escapeHtml(note)}</p></div>`
        : "";
    return `<!doctype html>
<html lang="${language}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#111827;" dir="${dir}">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
<p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#1e3a8a;">${escapeHtml(company.name)}</p>
${paragraphs.map(para).join("\n")}
${noteHtml}
${tableHtml}
${totalsHtml}
${linkHtml}
${para(t(language, "closing"))}
${para(company.name)}
</div>
<p style="max-width:640px;margin:16px auto 0;font-size:12px;color:#6b7280;text-align:center;">${escapeHtml(t(language, "footer", { company: company.name, address: company.address, phone: company.phone }))}</p>
</body>
</html>`;
}

/** Plain-text version for mail apps that don't show HTML. */
function plainText({ paragraphs, lines = [], totals = [], link = null, linkIntro = "", note = "", language }) {
    const parts = [...paragraphs];
    if (note) parts.push(`${t(language, "note", { company: company.name })}\n${note}`);
    if (lines.length) parts.push(lines.map((line) => `- ${line.product_name} × ${line.quantity} = ${money(line.quantity * line.unit_price, language)}`).join("\n"));
    if (totals.length) parts.push(totals.map(([label, value]) => `${label}: ${value}`).join("\n"));
    if (link) parts.push(`${linkIntro}\n${link}`);
    parts.push(`${t(language, "closing")}\n${company.name}`);
    return parts.join("\n\n");
}

/**
 * quote: { number, customer: { company_name, contact_name }, valid_until, items, subtotal, vat, total }
 */
function quoteEmail(quote, { language = "fr", portalUrl = null, note = "" } = {}) {
    const values = { number: quote.number, company: company.name, date: date(quote.valid_until, language) };
    const subject = t(language, "quoteSubject", values);
    const paragraphs = [t(language, "hello", { name: quote.customer.contact_name || quote.customer.company_name }), t(language, "quoteIntro", values)];
    const totals = [
        [t(language, "subtotal"), money(quote.subtotal, language)],
        [t(language, "vat"), money(quote.vat, language)],
        [t(language, "total"), money(quote.total, language), true]
    ];
    const link = portalUrl ? `${portalUrl}/portal/quotes` : null;
    const linkIntro = t(language, "quotePortal");
    return {
        subject,
        html: layout({ language, title: subject, paragraphs, tableHtml: linesTable(quote.items, language), totalsHtml: totalsTable(totals, language), link, linkIntro, note }),
        text: plainText({ paragraphs, lines: quote.items, totals, link, linkIntro, note, language })
    };
}

/**
 * invoice: { number, order_id, customer, due_date, items, subtotal, vat, total, credited, paid, balance }
 */
function invoiceEmail(invoice, { language = "fr", portalUrl = null, note = "" } = {}) {
    const values = { number: invoice.number, company: company.name, order: invoice.order_id, date: date(invoice.due_date, language) };
    const subject = t(language, "invoiceSubject", values);
    const paragraphs = [t(language, "hello", { name: invoice.customer.contact_name || invoice.customer.company_name }), t(language, "invoiceIntro", values)];
    if (invoice.balance <= 0.005) paragraphs.push(t(language, "invoicePaid"));
    else paragraphs.push(t(language, "payBy", { bank: company.bank.name, rib: company.bank.rib, number: invoice.number }));

    const totals = [
        [t(language, "subtotal"), money(invoice.subtotal, language)],
        [t(language, "vat"), money(invoice.vat, language)],
        [t(language, "total"), money(invoice.total, language)]
    ];
    if (invoice.credited > 0) totals.push([t(language, "credited"), `−${money(invoice.credited, language)}`]);
    if (invoice.paid > 0) totals.push([t(language, "paid"), `−${money(invoice.paid, language)}`]);
    totals.push([t(language, "balance"), money(invoice.balance, language), true]);

    const link = portalUrl ? `${portalUrl}/portal/orders?view=${invoice.order_id}` : null;
    const linkIntro = t(language, "portal");
    return {
        subject,
        html: layout({ language, title: subject, paragraphs, tableHtml: linesTable(invoice.items, language), totalsHtml: totalsTable(totals, language), link, linkIntro, note }),
        text: plainText({ paragraphs, lines: invoice.items, totals, link, linkIntro, note, language })
    };
}

/** A short reminder before the due date: no line table, just what's owed and when. */
function reminderEmail(invoice, { language = "fr", portalUrl = null, daysLeft } = {}) {
    const values = {
        number: invoice.number,
        date: date(invoice.due_date, language),
        when: whenText(daysLeft, language),
        amount: money(invoice.balance, language)
    };
    const subject = t(language, "reminderSubject", values);
    const paragraphs = [
        t(language, "hello", { name: invoice.customer.contact_name || invoice.customer.company_name }),
        t(language, "reminderIntro", values),
        t(language, "payBy", { bank: company.bank.name, rib: company.bank.rib, number: invoice.number }),
        t(language, "reminderPaidIgnore")
    ];
    const link = portalUrl ? `${portalUrl}/portal/orders?view=${invoice.order_id}` : null;
    const linkIntro = t(language, "portal");
    return {
        subject,
        html: layout({ language, title: subject, paragraphs, link, linkIntro }),
        text: plainText({ paragraphs, link, linkIntro, language })
    };
}

module.exports = { escapeHtml, invoiceEmail, quoteEmail, reminderEmail, whenText };
