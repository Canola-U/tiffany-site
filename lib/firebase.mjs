import { createSign } from 'node:crypto';

// FCM HTTP v1. The service-account JSON is a raw secret in the hosting provider,
// not a proxy-placeholder token: its private key is needed locally for JWT signing.
export function createFirebase(env = process.env, fetcher = fetch) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let account;
  if (raw) {
    try { account = JSON.parse(raw); } catch { throw Error('Firebase 서비스 계정 JSON 형식이 올바르지 않습니다.'); }
    if (!/^[a-z][a-z0-9-]{4,62}$/.test(account.project_id || '') || typeof account.private_key !== 'string' || typeof account.client_email !== 'string') throw Error('Firebase 서비스 계정 설정이 불완전합니다.');
  }
  let cached, expiresAt = 0, pending;
  async function accessToken() {
    if (cached && Date.now() < expiresAt) return cached;
    if (pending) return pending;
    pending = (async () => {
      const now = Math.floor(Date.now() / 1000);
      const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
      const signingInput = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
      const signature = createSign('RSA-SHA256').update(signingInput).sign(account.private_key).toString('base64url');
      const response = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${signingInput}.${signature}` }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw Error(`Firebase 인증 실패 (HTTP ${response.status})`);
      const data = await response.json();
      if (!data.access_token) throw Error('Firebase 인증 응답이 비어 있습니다.');
      cached = data.access_token; expiresAt = Date.now() + Math.max(0, (Number(data.expires_in || 3600) - 120) * 1000);
      return cached;
    })().finally(() => pending = null);
    return pending;
  }
  return {
    configured: Boolean(account),
    projectId: account?.project_id,
    async send(token, event) {
      if (!account) throw Error('Firebase 서비스 계정이 연결되지 않았습니다.');
      const response = await fetcher(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await accessToken()}` },
        body: JSON.stringify({ message: { token, data: { title:event.title.slice(0,100), body:event.body.slice(0,800), url:event.url, eventKey:event.key }, android: { priority: 'high', ttl: '3600s' } } }),
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const invalid = data.error?.details?.some(detail => detail.errorCode === 'UNREGISTERED');
        const error = new Error(`Firebase 발송 실패 (HTTP ${response.status})`);
        error.invalidToken = Boolean(invalid); throw error;
      }
    }
  };
}
