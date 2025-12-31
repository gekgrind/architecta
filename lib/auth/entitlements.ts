export function canUseClaude(plan?: string) {
  return plan === "pro" || plan === "premium" || plan === "founder";
}
