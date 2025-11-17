import i18n, { Resource } from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "@/locales/en/common.json";
import esCommon from "@/locales/es/common.json";
import ptCommon from "@/locales/pt/common.json";
import itCommon from "@/locales/it/common.json";
import frCommon from "@/locales/fr/common.json";
import deCommon from "@/locales/de/common.json";
import jaCommon from "@/locales/ja/common.json";

export const DEFAULT_NAMESPACE = "common" as const;
export const DEFAULT_LANGUAGE = "es" as const;

export const AVAILABLE_LANGUAGES = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "it", label: "Italiano" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
];

const resources: Resource = {
  es: {
    [DEFAULT_NAMESPACE]: esCommon,
  },
  en: {
    [DEFAULT_NAMESPACE]: enCommon,
  },
  pt: {
    [DEFAULT_NAMESPACE]: ptCommon,
  },
  it: {
    [DEFAULT_NAMESPACE]: itCommon,
  },
  fr: {
    [DEFAULT_NAMESPACE]: frCommon,
  },
  de: {
    [DEFAULT_NAMESPACE]: deCommon,
  },
  ja: {
    [DEFAULT_NAMESPACE]: jaCommon,
  },
};

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
