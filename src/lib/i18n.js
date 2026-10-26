export const DEFAULT_LOCALE = "en";

export const LOCALES = [
  {
    code: "en",
    htmlLang: "en",
    prefix: "",
    label: "English",
    notice: "",
    fallbackNotice: ""
  },
  {
    code: "es",
    htmlLang: "es",
    prefix: "/es",
    label: "Español",
    notice: "",
    fallbackNotice: ""
  },
  {
    code: "ru",
    htmlLang: "ru",
    prefix: "/ru",
    label: "Русский",
    notice: "",
    fallbackNotice: ""
  }
];

export function localeConfig(locale = DEFAULT_LOCALE) {
  return LOCALES.find((entry) => entry.code === locale) || LOCALES[0];
}

export function localePathDepth(baseDepth = 0, locale = DEFAULT_LOCALE) {
  return baseDepth + (localeConfig(locale).prefix ? 1 : 0);
}

export function localizedPagePath(pathname = "/", locale = DEFAULT_LOCALE) {
  const config = localeConfig(locale);
  const value = String(pathname || "/");
  const [pathPart, suffix = ""] = value.split(/(?=[?#])/, 2);
  const normalizedPath = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  if (!config.prefix) return `${normalizedPath}${suffix}`;
  if (normalizedPath === "/") return `${config.prefix}/${suffix}`;
  if (normalizedPath === config.prefix || normalizedPath.startsWith(`${config.prefix}/`)) {
    return `${normalizedPath}${suffix}`;
  }
  return `${config.prefix}${normalizedPath}${suffix}`;
}

export function localeAlternates(pathname = "/") {
  return LOCALES.map((locale) => ({
    ...locale,
    pathname: localizedPagePath(pathname, locale.code)
  }));
}

export function localeNotice(locale = DEFAULT_LOCALE, status = "translated") {
  const config = localeConfig(locale);
  return status === "fallback" ? config.fallbackNotice : config.notice;
}
