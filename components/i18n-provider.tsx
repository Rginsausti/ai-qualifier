"use client";

import { ReactNode, useState } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { createInstance } from "i18next";
import { DEFAULT_LANGUAGE, DEFAULT_NAMESPACE, resources } from "@/i18n/settings";

const COOKIE_NAME = "alma-language";

type Props = {
  children: ReactNode;
  initialLanguage: string;
};

export function I18nProvider({ children, initialLanguage }: Props) {
  const [i18nInstance] = useState(() => {
    const i18n = createInstance();
    i18n.use(initReactI18next).init({
      resources,
      lng: initialLanguage,
      fallbackLng: DEFAULT_LANGUAGE,
      defaultNS: DEFAULT_NAMESPACE,
      interpolation: {
        escapeValue: false,
      },
    });
    
    // Sync language change to cookie
    i18n.on('languageChanged', (lng) => {
      document.cookie = `${COOKIE_NAME}=${lng}; path=/; max-age=31536000`; // 1 year
    });

    return i18n;
  });

  return <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>;
}
