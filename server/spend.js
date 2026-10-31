// A limit on what the site spends on the Claude API (decisions of 31 October
// 2026). Every call records its cost from the token counts the API returns.
// When the total reaches the limit ($20 at first), the helper and @tutor stop
// and stay stopped until the teacher allows more. The teacher is told each
// time another $10 has been spent.
import { config } from './config.js';
import { setting, setSetting, log } from './db.js';

// Dollars per million tokens. Cache writes use the 1-hour lifetime (2x input).
// A model not listed is priced as Opus, so that the estimate errs high.
const PRICES = {
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 4 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 8 },
};
const FALLBACK_PRICE = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 10 };
export const ALERT_STEP = 10;

const num = (k, d = 0) => Number(setting(k, String(d))) || 0;
const monthKey = () => `ai_spend:${new Date().toISOString().slice(0, 7)}`;

export function costOf(model, usage) {
  if (!usage) return 0;
  const p = PRICES[model] || FALLBACK_PRICE;
  return ((usage.input_tokens || 0) * p.input
    + (usage.output_tokens || 0) * p.output
    + (usage.cache_read_input_tokens || 0) * p.cacheRead
    + (usage.cache_creation_input_tokens || 0) * p.cacheWrite) / 1e6;
}

// Spending before the total was kept was counted per month only.
function ensureTotal() {
  if (setting('ai_spend_total', '') === '') setSetting('ai_spend_total', num(monthKey()).toFixed(6));
}
export const totalSpend = () => { ensureTotal(); return num('ai_spend_total'); };
export const monthSpend = () => num(monthKey());
export const spendLimit = () => num('ai_limit', config.aiSpendLimit);
export const aiStopped = () => setting('ai_stopped', '') === '1' || totalSpend() >= spendLimit();
export const overBudget = aiStopped;

// Alerts not yet seen by the teacher, newest first.
export function spendAlerts() {
  try { return JSON.parse(setting('ai_alerts', '[]')); } catch { return []; }
}
function alert(text) {
  setSetting('ai_alerts', JSON.stringify([{ text, at: new Date().toISOString() }, ...spendAlerts()].slice(0, 10)));
  log('steward', text);
}
export const dismissAlerts = () => setSetting('ai_alerts', '[]');

export function recordSpend(model, usage) {
  const cost = costOf(model, usage);
  if (cost <= 0) return 0;
  const total = totalSpend() + cost;
  setSetting('ai_spend_total', total.toFixed(6));
  setSetting(monthKey(), (monthSpend() + cost).toFixed(6));
  const step = Math.floor(total / ALERT_STEP) * ALERT_STEP;
  if (step > num('ai_alerted_upto')) {
    setSetting('ai_alerted_upto', String(step));
    alert(`The site has now spent $${step} on the Claude API in total.`);
  }
  if (total >= spendLimit() && setting('ai_stopped', '') !== '1') {
    setSetting('ai_stopped', '1');
    alert(`The Teaching Assistant and @tutor have stopped at $${total.toFixed(2)}, the limit of $${spendLimit()}. They stay stopped until you allow more.`);
  }
  return cost;
}

// The teacher's commands on the Agents page.
export function allowMore(dollars) {
  setSetting('ai_limit', (totalSpend() + dollars).toFixed(2));
  setSetting('ai_stopped', '0');
  log('steward', `the teacher allowed another $${dollars} for the Teaching Assistant and @tutor`);
}
export function stopAi() {
  setSetting('ai_stopped', '1');
  log('steward', 'the teacher stopped the Teaching Assistant and @tutor');
}
