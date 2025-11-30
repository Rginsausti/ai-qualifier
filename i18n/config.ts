import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LANGUAGE, DEFAULT_NAMESPACE, resources } from "./settings";

export * from "./settings";

export function initI18n(language?: string) {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng: language ?? DEFAULT_LANGUAGE,
      fallbackLng: DEFAULT_LANGUAGE,
      defaultNS: DEFAULT_NAMESPACE,
      interpolation: {
        escapeValue: false,
      },
    });
  } else if (language && i18n.language !== language) {
    i18n.changeLanguage(language);
  }

  return i18n;
}


