import { blockCreateHandler } from '@/lib/actions/handlers/block-create'
import { onboardingStartHandler } from '@/lib/actions/handlers/onboarding-start'
import { emailSendHandler } from '@/lib/actions/handlers/email-send'
import { meetingBookHandler } from '@/lib/actions/handlers/meeting-book'
import { documentGenerateHandler } from '@/lib/actions/handlers/document-generate'
import type { ActionHandler } from '@/lib/actions/types'

/**
 * Action Registry — maps action type strings to their handlers.
 *
 * To add a new action:
 *   1. Create `src/lib/actions/handlers/{action-name}.ts`
 *      - Export `schema: z.ZodType<YourPayload>` for request validation
 *      - Export `execute: (payload, ctx, supabase) => Promise<ActionResult>`
 *      - Export a named `{camelCaseName}Handler: ActionHandler<YourPayload>` object
 *   2. Import the handler here and add it to the REGISTRY map below
 *   3. The route handler auto-discovers it — no other changes needed
 *
 * Action type naming convention:  `{domain}.{verb}` e.g. `block.create`, `onboarding.start`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const REGISTRY: Record<string, ActionHandler<any>> = {
  'block.create': blockCreateHandler,
  'onboarding.start': onboardingStartHandler,
  'email.send': emailSendHandler,
  'meeting.book': meetingBookHandler,
  'document.generate': documentGenerateHandler,
}
