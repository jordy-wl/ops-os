import type { StepHandler } from './types'

// ─── Handler Registry ───────────────────────────────────────────────────────
// Maps step type names to their handler functions.
// Each handler is lazily imported to keep the registry module lightweight.

type LazyHandler = () => Promise<{ default: StepHandler }>

const HANDLER_MAP: Record<string, LazyHandler> = {
  emit_event: () => import('./emit-event').then((m) => m),
  run_action: () => import('./run-action').then((m) => m),
  wait: () => import('./wait-handler').then((m) => m),
  condition: () => import('./condition').then((m) => m),
  call_api: () => import('./call-api').then((m) => m),
  send_email: () => import('./send-email').then((m) => m),
  book_meeting: () => import('./book-meeting').then((m) => m),
  generate_document: () => import('./generate-document').then((m) => m),
  update_block: () => import('./update-block-handler').then((m) => m),
  generate_task: () => import('./generate-task').then((m) => m),
  run_sub_workflow: () => import('./run-sub-workflow').then((m) => m),
  // ─── Phase 5 Sprint 15: Data Operations + Human Interaction ───────────
  create_edge: () => import('./create-edge').then((m) => m),
  search_blocks: () => import('./search-blocks').then((m) => m),
  send_notification: () => import('./send-notification').then((m) => m),
  create_shared_link: () => import('./create-shared-link').then((m) => m),
  // ─── Phase 5 Sprint 16: AI + External ───────────────────────────────
  ai_analysis: () => import('./ai-analysis').then((m) => m),
  ai_classify: () => import('./ai-classify').then((m) => m),
  ai_summarize: () => import('./ai-summarize').then((m) => m),
  ai_risk_assessment: () => import('./ai-risk-assessment').then((m) => m),
  store_file: () => import('./store-file').then((m) => m),
  // Phase 6 Sprint 23: Route + For Each
  route: () => import('./route').then((m) => m),
  for_each: () => import('./for-each').then((m) => m),
}

/** Resolved handler cache — avoids repeated dynamic imports */
const handlerCache = new Map<string, StepHandler>()

/**
 * Resolve a step handler by type name.
 * Returns null if no handler is registered for the given type.
 */
export async function resolveHandler(stepType: string): Promise<StepHandler | null> {
  const cached = handlerCache.get(stepType)
  if (cached) return cached

  const loader = HANDLER_MAP[stepType]
  if (!loader) return null

  const mod = await loader()
  handlerCache.set(stepType, mod.default)
  return mod.default
}

/** Get all registered step type names */
export function getRegisteredTypes(): string[] {
  return Object.keys(HANDLER_MAP)
}
