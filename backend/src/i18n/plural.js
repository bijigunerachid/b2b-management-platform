// Arabic plural forms by count (one, two, few, many), as on the frontend.
function plural(count, forms) {
    const n = Number(String(count).replace(/[^\d]/g, ""));
    if (n === 1) return forms.one;
    if (n === 2) return forms.two;
    if (n % 100 >= 3 && n % 100 <= 10) return forms.few;
    return forms.many;
}

module.exports = { plural };
