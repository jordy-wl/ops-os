import { redirect } from 'next/navigation'

/**
 * ChatPage — redirects to dashboard.
 * Chat is now accessed via the floating widget (bottom-left on every page).
 */
export default function ChatPage() {
  redirect('/dashboard')
}
