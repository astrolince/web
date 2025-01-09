const LANGUAGES = {
  supported: ["en", "es"],
  default: "en",
  cookieName: "preferredLanguage",
};

const setLanguage = (lang) => {
  if (LANGUAGES.supported.includes(lang)) {
    document.cookie = `${LANGUAGES.cookieName}=${lang}; path=/; max-age=31536000`;
  }
};

const getLanguage = () => {
  // Check cookie
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(LANGUAGES.cookieName + "="));
  const cookieLang = cookie?.split("=")[1];
  if (LANGUAGES.supported.includes(cookieLang)) return cookieLang;

  // Check browser language
  const browserLang = navigator.language?.split("-")[0];
  return LANGUAGES.supported.includes(browserLang)
    ? browserLang
    : LANGUAGES.default;
};

// Handle Spanish redirection
const path = window.location.pathname;
if (getLanguage() === "es" && !path.startsWith("/es/")) {
  window.location.replace(`/es${path}`);
}
