import { createSign, createPrivateKey } from 'node:crypto';

// FCM HTTP v1. The service-account JSON is a raw secret in the hosting provider,
// not a proxy-placeholder token: its private key is needed locally for JWT signing.
export function createFirebase(env = process.env, fetcher = fetch) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let account, signingKey, configurationError = null;
  if (raw) {
    try { account = JSON.parse(raw.replace(/^\uFEFF/, '').trim()); }
    catch { configurationError = 'Firebase 서비스 계정 JSON 형식이 올바르지 않습니다. Render의 값을 비공개 키 파일의 전체 내용으로 교체해주세요.'; }
    if (!configurationError && (!account || typeof account !== 'object' || Array.isArray(account) || account.type !== 'service_account')) {
      configurationError = 'Firebase 서버용 서비스 계정 JSON이 필요합니다. google-services.json은 이 입력란에 사용할 수 없습니다.';
    }
    if (!configurationError && (!/^[a-z][a-z0-9-]{4,62}$/.test(account.project_id || '') || typeof account.private_key !== 'string' || typeof account.client_email !== 'string')) {
      configurationError = 'Firebase 서비스 계정 설정이 불완전합니다. 비공개 키 파일의 전체 내용을 확인해주세요.';
    }
    if (!configurationError) {
      try {
        signingKey = createPrivateKey(account.private_key);
        if (signingKey.asymmetricKeyType !== 'rsa') throw Error('Unsupported key type');
      } catch { configurationError = 'Firebase 비공개 키 형식이 올바르지 않습니다. 비공개 키 파일의 전체 내용을 확인해주세요.'; }
    }
    if (configurationError) { account = undefined; signingKey = undefined; }
  }
  let cached, expiresAt = 0, pending;
  async function accessToken() {
    if (cached && Date.now() < expiresAt) return cached;
    if (pending) return pending;
    pending = (async () => {
      const now = Math.floor(Date.now() / 1000);
      const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
      const signingInput = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
      const signature = createSign('RSA-SHA256').update(signingInput).sign(signingKey).toString('base64url');
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
    error: configurationError,
    async send(token, event) {
      if (!account) throw Error(configurationError || 'Firebase 서비스 계정이 연결되지 않았습니다.');
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
