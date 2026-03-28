import en from '../../public/locales/en.json';

type Messages = typeof en;

let messages: Messages = en;

/** Loads JSON resources (FR-I18N-003). Replace with async locale fetch later. */
export function setLocale(next: Messages) {
  messages = next;
}

export function t(key: keyof Messages): string {
  return messages[key] ?? en[key] ?? String(key);
}
