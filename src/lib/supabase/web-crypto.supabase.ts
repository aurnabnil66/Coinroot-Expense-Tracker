import * as ExpoCrypto from 'expo-crypto';

/**
 * The two WebCrypto pieces supabase-js uses for the PKCE flow, backed by expo-crypto where
 * the JavaScript engine (Hermes) doesn't have them:
 * - `crypto.getRandomValues` for the secret code verifier (supabase-js would fall back to
 *   `Math.random`, which isn't a secure random source)
 * - `crypto.subtle.digest('SHA-256', …)` for the code challenge (it would fall back to the
 *   weaker "plain" method, sending the verifier itself)
 * Anything already present is left alone. Call once, before the Supabase client is created.
 */
export function installWebCrypto(): void {
  const scope = globalThis as { crypto?: Partial<Crypto> };
  const crypto = (scope.crypto ??= {} as Partial<Crypto>) as Partial<Crypto> & { subtle?: Partial<SubtleCrypto> };

  if (typeof crypto.getRandomValues !== 'function') {
    crypto.getRandomValues = ((array: Parameters<typeof ExpoCrypto.getRandomValues>[0]) =>
      ExpoCrypto.getRandomValues(array)) as Crypto['getRandomValues'];
  }

  if (!crypto.subtle || typeof crypto.subtle.digest !== 'function') {
    const digest = async (algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> => {
      const name = (typeof algorithm === 'string' ? algorithm : algorithm.name).toUpperCase();
      if (name !== 'SHA-256') throw new Error(`Unsupported digest: ${name}`);
      return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
    };
    try {
      crypto.subtle = { ...crypto.subtle, digest } as SubtleCrypto;
    } catch {
      // A read-only `subtle`: supabase-js then uses the plain challenge, which still only works on this phone.
    }
  }
}
