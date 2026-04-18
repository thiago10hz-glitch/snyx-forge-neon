// Mapeamento dos modelos públicos "SnyX" -> providers reais.
// Cliente nunca vê o que está por trás. Cada modelo SnyX tenta uma lista
// de providers em race paralelo (primeiro que responder vence).

export type SnyxModel =
  | "snyx-fast"        // velocidade extrema, perguntas curtas
  | "snyx-pro"         // GPT-4o class, raciocínio geral
  | "snyx-reasoning"   // o1/R1, problemas complexos
  | "snyx-coder"       // código
  | "snyx-vision"      // imagens
  | "snyx-search";     // com busca web

export interface ProviderRoute {
  provider: "google" | "groq" | "pollinations" | "lovable";
  model: string;
}

// Cada modelo SnyX = lista de providers para race paralelo.
// Ordem = prioridade (todos disparam ao mesmo tempo, mas se vier empate, prefere o primeiro).
export const SNYX_MODEL_ROUTES: Record<SnyxModel, ProviderRoute[]> = {
  "snyx-fast": [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "google", model: "gemini-2.0-flash-lite" },
    { provider: "pollinations", model: "openai" },
    { provider: "pollinations", model: "llama" },
  ],
  "snyx-pro": [
    { provider: "pollinations", model: "openai-large" },
    { provider: "google", model: "gemini-2.0-flash" },
    { provider: "pollinations", model: "deepseek" },
    { provider: "pollinations", model: "gemini" },
  ],
  "snyx-reasoning": [
    { provider: "pollinations", model: "deepseek-reasoner" },
    { provider: "pollinations", model: "openai-reasoning" },
    { provider: "google", model: "gemini-2.5-flash" },
  ],
  "snyx-coder": [
    { provider: "pollinations", model: "qwen-coder" },
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "pollinations", model: "openai-large" },
    { provider: "google", model: "gemini-2.0-flash" },
  ],
  "snyx-vision": [
    { provider: "google", model: "gemini-2.5-flash" },
    { provider: "google", model: "gemini-2.0-flash" },
  ],
  "snyx-search": [
    { provider: "pollinations", model: "searchgpt" },
    { provider: "google", model: "gemini-2.0-flash" },
  ],
};

export const SNYX_MODELS = Object.keys(SNYX_MODEL_ROUTES) as SnyxModel[];

export function isSnyxModel(model?: string): model is SnyxModel {
  return !!model && model in SNYX_MODEL_ROUTES;
}

export function getRoutesForModel(model: string): ProviderRoute[] {
  if (isSnyxModel(model)) return SNYX_MODEL_ROUTES[model];
  // Default: snyx-fast
  return SNYX_MODEL_ROUTES["snyx-fast"];
}
