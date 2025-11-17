"use client";

import { ReactNode, useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE, initI18n } from "@/i18n/config";

const STORAGE_KEY = "alma-language";

type Props = {
  children: ReactNode;
};

export function I18nProvider({ children }: Props) {
  const [i18nInstance] = useState(() => initI18n(DEFAULT_LANGUAGE));

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const initialLang = stored && AVAILABLE_LANGUAGES.some((lang) => lang.code === stored)
      ? stored
      : DEFAULT_LANGUAGE;

    if (i18nInstance.language !== initialLang) {
      i18nInstance.changeLanguage(initialLang);
    }
  }, [i18nInstance]);

  return <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>;
}
