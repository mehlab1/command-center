// Heuristic backing the Vault chat-redirect requirement in
// docs/05-vault-and-security.md: "detecting the vault-creation context plus
// a long/high-entropy string is enough — don't over-build a secret-scanning
// system for a single-user app." Two independent, cheap signals, both
// required — neither alone is enough to short-circuit a normal message.

const KNOWN_SECRET_PREFIXES = [
  "sk-", "pk_", "ghp_", "gho_", "github_pat_", "AKIA", "xox", "ya29.", "eyJ", "-----BEGIN",
];

const VAULT_KEYWORD_RE = /\b(vault|secret|password|passwd|api[ -]?key|credential|token|private key)\b/i;

function looksHighEntropy(token: string): boolean {
  if (token.length < 16) return false;
  if (KNOWN_SECRET_PREFIXES.some((p) => token.startsWith(p))) return true;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(token)).length;
  return classes >= 3;
}

export function containsSecretLikeToken(content: string): boolean {
  return content.split(/\s+/).some(looksHighEntropy);
}

export function mentionsVaultContext(content: string): boolean {
  return VAULT_KEYWORD_RE.test(content);
}
