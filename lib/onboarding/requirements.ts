export function requiresExtraIntake(flags: { hasWebsite?: boolean } | null | undefined) {
  return flags?.hasWebsite === false;
}
