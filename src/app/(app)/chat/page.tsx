import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { ChatPanel } from '@/components/chat/chat-panel'
import type { Block } from '@/lib/context-assembly'

/**
 * ChatPage — full-page AI chat interface.
 *
 * Pre-fetches all org blocks server-side so the BlockContextPicker
 * is populated immediately without a client-side loading state.
 * Falls back to an empty block list if the query fails (chat still works
 * at org-level context without a selected block).
 */
export default async function ChatPage() {
  const { userId, orgId } = await auth()

  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const supabase = createServerClient()

  const { data: blocks } = await supabase
    .from('blocks')
    .select('id, org_id, type, name, state, metadata, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .order('name', { ascending: true })
    .limit(200)

  return <ChatPanel blocks={(blocks as Block[]) ?? []} mode="full-page" />
}
