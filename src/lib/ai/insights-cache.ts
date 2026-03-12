/**
 * Insights Cache — in-memory cache for AI-generated insights.
 *
 * Cache key: `${blockId}_${lastEventId}`
 * TTL: 5 minutes
 * Invalidation: automatic when lastEventId changes (new event for block)
 *
 * No external dependencies — pure Map-based cache.
 */

import type { InsightsResult } from './insights-generator'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface CacheEntry {
  result: InsightsResult
  expiresAt: number
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ─── Cache Store ────────────────────────────────────────────────────────────────

const cache = new Map<string, CacheEntry>()

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Build a cache key from block ID and last event ID.
 * When lastEventId changes, the key changes, effectively invalidating
 * the previous cached insight for that block.
 */
export function buildCacheKey(blockId: string, lastEventId: string): string {
  return `${blockId}_${lastEventId}`
}

/**
 * Get a cached insights result if it exists and has not expired.
 * Returns null if not found or expired.
 */
export function getCachedInsights(key: string): InsightsResult | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return { ...entry.result, fromCache: true }
}

/**
 * Store an insights result in cache with TTL.
 */
export function setCachedInsights(key: string, result: InsightsResult): void {
  cache.set(key, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

/**
 * Invalidate all cached insights for a specific block.
 * Scans all keys starting with `${blockId}_`.
 */
export function invalidateBlockInsights(blockId: string): number {
  const prefix = `${blockId}_`
  let removed = 0
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
      removed++
    }
  }
  return removed
}

/**
 * Clear all cached insights. Useful for testing.
 */
export function clearInsightsCache(): void {
  cache.clear()
}

/**
 * Get the current cache size. Useful for monitoring.
 */
export function getInsightsCacheSize(): number {
  return cache.size
}
