type EcosystemApp = "architecta" | "prospra" | "directorium" | "synceri";

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requiredValue(value: string | undefined, name: string): string {
  const cleaned = cleanEnv(value);

  if (!cleaned) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return cleaned;
}

export function getSupabaseProjectConfig() {
  return {
    url: requiredValue(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL"
    ),
    anonKey: requiredValue(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    ),
  };
}

export function getEcosystemSiteUrl(): string | undefined {
  return (
    cleanEnv(process.env.NEXT_PUBLIC_ENTREPRENEURIA_APP_URL) ??
    cleanEnv(process.env.NEXT_PUBLIC_AUTH_APP_URL) ??
    cleanEnv(process.env.NEXT_PUBLIC_APP_URL) ??
    cleanEnv(process.env.NEXT_PUBLIC_SITE_URL)
  );
}

export function getEcosystemCookieDomain(): string | undefined {
  return cleanEnv(process.env.NEXT_PUBLIC_ENTREPRENEURIA_COOKIE_DOMAIN);
}

export function getEcosystemAppUrl(app: EcosystemApp): string | undefined {
  switch (app) {
    case "architecta":
      return cleanEnv(process.env.NEXT_PUBLIC_ARCHITECTA_APP_URL);
    case "prospra":
      return cleanEnv(process.env.NEXT_PUBLIC_PROSPRA_APP_URL);
    case "directorium":
      return cleanEnv(process.env.NEXT_PUBLIC_DIRECTORIUM_APP_URL);
    case "synceri":
      return cleanEnv(process.env.NEXT_PUBLIC_SYNCERI_APP_URL);
    default:
      return undefined;
  }
}

export function getUrlOrigin(value: string | undefined) {
  if (!value) return undefined;

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}
