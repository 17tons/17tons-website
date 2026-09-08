import React, { createContext, useContext } from "react";
import { messages } from "./messages.js";

const LocaleContext = createContext("en");

export function LocaleProvider({ locale, children }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const locale = useContext(LocaleContext);
  return { locale, copy: messages[locale] };
}
