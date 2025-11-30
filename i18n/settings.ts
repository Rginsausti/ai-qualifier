import { Resource } from "i18next";
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

export const resources: Resource = {
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
