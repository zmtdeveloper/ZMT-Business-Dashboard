const clean = (value: string | undefined) => value?.trim() || undefined;

export const env = {
  appPassword: clean(import.meta.env.VITE_APP_PASSWORD),
  appsScriptUrl: clean(import.meta.env.VITE_APPS_SCRIPT_URL),
  appsScriptToken: clean(import.meta.env.VITE_APPS_SCRIPT_TOKEN),
};
