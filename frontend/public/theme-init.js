// Applies the saved (or system) theme before first paint to avoid a flash.
// Kept as a file rather than an inline script so the CSP can forbid inline JS.
(function () {
  try {
    var saved = localStorage.getItem("b2b-theme");
    var dark = saved
      ? saved === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch {
    // Storage blocked: ThemeContext falls back to the OS preference.
  }
})();
