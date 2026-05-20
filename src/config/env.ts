const clean = (value: string | undefined) => value?.trim() || undefined;

export const env = {
  appPassword: clean(import.meta.env.VITE_APP_PASSWORD),
  appPasswordHash: clean(import.meta.env.VITE_APP_PASSWORD_HASH)?.toLowerCase(),
  showcasePassword: clean(import.meta.env.VITE_SHOWCASE_PASSWORD) ?? "showcase123",
  appsScriptUrl: clean(import.meta.env.VITE_APPS_SCRIPT_URL),
  appsScriptToken: clean(import.meta.env.VITE_APPS_SCRIPT_TOKEN),
};
