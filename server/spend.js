// A monthly cap on what the site spends on the Claude API (decision of
// 31 October 2026: $20 a month). Every call records its cost from the token
// counts the API returns; once the month's total reaches the cap, the helper
// and @tutor stop until the first day of the next month.
import { config } from './config.js';
import { setting, setSetting } from './db.js';

// Dollars per million tokens. Cache writes use the 1-hour lifetime (2x input).
// A model not listed is priced as Opus, so that the estimate errs high.
const PRICES = {
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 4 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 8 },
};
const FALLBACK_PRICE = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 10 };

const monthKey = () => `ai_spend:${new Date().toISOString().slice(0, 7)}`;

export function costOf(model, usage) {
  if (!usage) return 0;
  const p = PRICES[model] || FALLBACK_PRICE;
  return ((usage.input_tokens || 0) * p.input
    + (usage.output_tokens || 0) * p.output
    + (usage.cache_read_input_tokens || 0) * p.cacheRead
    + (usage.cache_creation_input_tokens || 0) * p.cacheWrite) / 1e6;
}

export const monthSpend = () => Number(setting(monthKey(), '0')) || 0;
export const monthCap = () => config.aiMonthlyCap;
export const overBudget = () => monthSpend() >= monthCap();

export function recordSpend(model, usage) {
  const cost = costOf(model, usage);
  if (cost > 0) setSetting(monthKey(), (monthSpend() + cost).toFixed(6));
  return cost;
}
