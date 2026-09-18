import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './en';
import ka from './ka';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, ka: { translation: ka } },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
