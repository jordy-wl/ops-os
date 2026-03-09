import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verifies an HMAC-SHA256 signature against a raw request body.
 *
 * @param body - Raw request body string
 * @param signature - The signature from the request header (hex-encoded)
 * @param secret - The HMAC secret stored in the connector
 * @returns true if the signature is valid
 */
export function verifyHmacSignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex')

  // Use timing-safe comparison to prevent timing attacks
  if (signature.length !== expected.length) return false

  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}
