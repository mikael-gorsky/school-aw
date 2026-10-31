// Reads settings from the environment. Secrets come from the pod's Secrets panel
// (docs/deployment-podway.md) and are never written to the repository.
import path from 'node:path';
import crypto from 'node:crypto';

const env = process.env;

function list(v) {
  return (v || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

export const config = {
  port: Number(env.PORT || 8080),
  host: env.HOST || '0.0.0.0',
  baseUrl: (env.BASE_URL || `http://localhost:${env.PORT || 8080}`).replace(/\/$/, ''),
  dataDir: path.resolve(env.DATA_DIR || './data'),
  // Without a configured secret the server makes one per start. Sessions then end
  // on every restart, which is safe but inconvenient, so the pod must set it.
  sessionSecret: env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  sessionSecretIsSet: Boolean(env.SESSION_SECRET),
  google: {
    clientId: env.GOOGLE_CLIENT_ID || '',
    clientSecret: env.GOOGLE_CLIENT_SECRET || '',
  },
  teacherEmails: list(env.TEACHER_EMAILS),
  demoPassword: env.DEMO_PASSWORD || '',
  anthropicKey: env.ANTHROPIC_API_KEY || '',
  tutorModel: env.TUTOR_MODEL || 'claude-sonnet-5-5',
  // The helper runs on Claude Sonnet (decision of 31 October 2026).
  helperModel: env.HELPER_MODEL || 'claude-sonnet-5-5',
  // The most the site may spend on the Claude API in a calendar month, in dollars.
  aiMonthlyCap: Number(env.AI_MONTHLY_CAP_USD || 20),
  githubToken: env.GITHUB_TOKEN || '',
  devLogin: env.DEV_LOGIN === '1',
};

export const googleConfigured = () => Boolean(config.google.clientId && config.google.clientSecret);
export const secureCookies = () => config.baseUrl.startsWith('https://');
