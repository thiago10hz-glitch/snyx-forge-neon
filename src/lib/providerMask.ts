// Máscara de marca: esconde providers reais e mostra como infraestrutura própria SnyX.
// Útil pra exibir nomes "SnyX Core / SnyX Edge / SnyX Turbo" em vez de Lovable/Groq/Google.

const PROVIDER_MASK: Record<string, { name: string; tier: string; color: string }> = {
  lovable:    { name: "SnyX Core",     tier: "Core",     color: "text-primary-glow" },
  groq:       { name: "SnyX Turbo",    tier: "Turbo",    color: "text-amber-300" },
  google:     { name: "SnyX Vision",   tier: "Vision",   color: "text-sky-300" },
  cerebras:   { name: "SnyX Quantum",  tier: "Quantum",  color: "text-fuchsia-300" },
  openrouter: { name: "SnyX Mesh",     tier: "Mesh",     color: "text-emerald-300" },
  mistral:    { name: "SnyX Wind",     tier: "Wind",     color: "text-blue-300" },
  github:     { name: "SnyX Forge",    tier: "Forge",    color: "text-zinc-300" },
  together:   { name: "SnyX Unity",    tier: "Unity",    color: "text-rose-300" },
  cloudflare: { name: "SnyX Edge",     tier: "Edge",     color: "text-orange-300" },
  pollinations: { name: "SnyX Bloom",  tier: "Bloom",    color: "text-pink-300" },
};

export function maskProvider(provider: string): { name: string; tier: string; color: string } {
  return PROVIDER_MASK[provider.toLowerCase()] || { name: `SnyX ${provider}`, tier: provider, color: "text-foreground" };
}

export function maskLabel(provider: string, originalLabel: string): string {
  // Se o label ainda tem nome do provider, substitui
  const m = maskProvider(provider);
  if (originalLabel.toLowerCase().includes("lovable") ||
      originalLabel.toLowerCase().includes("gateway") ||
      originalLabel.toLowerCase().includes(provider.toLowerCase())) {
    return `${m.name} Engine`;
  }
  return originalLabel;
}
