function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}.`);
  }

  return value;
}

export function getSupabaseUrl() {
  const value = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const url = new URL(value);

  if (url.pathname !== "/") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be the Supabase project base URL, for example https://your-project.supabase.co. Do not include /rest/v1."
    );
  }

  return value;
}

export function getSupabaseAnonKey() {
  return getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey() {
  return getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}
