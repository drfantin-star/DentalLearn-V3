// Tarifs Sonnet pour l'estimation de coût indicative côté UI admin (T5.3).
// Aligné sur supabase/functions/synthesize_articles/types.ts (constantes
// SONNET_INPUT_PRICE_USD_PER_MTOK / SONNET_OUTPUT_PRICE_USD_PER_MTOK).
//
// Le coût réel reste mesurable via la console Anthropic — ces valeurs sont
// des estimations pour donner un ordre de grandeur dans la page admin.

export const SONNET_INPUT_PRICE_USD_PER_MTOK = 3.0
export const SONNET_OUTPUT_PRICE_USD_PER_MTOK = 15.0
