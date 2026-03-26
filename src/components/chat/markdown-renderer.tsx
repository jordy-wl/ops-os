'use client'

import { useMemo, useEffect, useRef, useCallback } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  streaming?: boolean
  className?: string
}

/**
 * MarkdownRenderer -- converts markdown content to sanitized HTML.
 *
 * Uses `marked.parse()` for markdown-to-HTML conversion and
 * `DOMPurify.sanitize()` to prevent XSS before rendering.
 *
 * Features:
 * - Streaming safety: auto-closes unclosed code fences during SSE streams
 * - Copy button on code blocks (attached via useEffect after render)
 * - Manual prose styling scoped to `.markdown-rendered` (no @tailwindcss/typography)
 * - text-[13px] base size to match existing chat bubble density
 * - Dark mode aware via CSS variables from the design system
 */
export function MarkdownRenderer({
  content,
  streaming = false,
  className,
}: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Pre-process content for streaming safety and parse markdown
  const sanitizedHtml = useMemo(() => {
    let processedContent = content

    // Streaming safety: if there is an odd number of triple backticks,
    // the last code fence is unclosed. Append a closing fence so
    // marked does not produce broken HTML while the stream is in progress.
    if (streaming) {
      const fenceCount = (processedContent.match(/```/g) || []).length
      if (fenceCount % 2 !== 0) {
        processedContent += '\n```'
      }
    }

    const rawHtml = marked.parse(processedContent, { async: false }) as string
    return DOMPurify.sanitize(rawHtml)
  }, [content, streaming])

  // Attach copy buttons to code blocks after render
  const attachCopyButtons = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const codeBlocks = container.querySelectorAll('pre code')
    codeBlocks.forEach((codeEl) => {
      const pre = codeEl.parentElement
      if (!pre || pre.querySelector('.md-copy-btn')) return

      // Ensure pre is positioned for absolute button placement
      pre.style.position = 'relative'

      const btn = document.createElement('button')
      btn.className = 'md-copy-btn'
      btn.setAttribute('aria-label', 'Copy code to clipboard')
      btn.textContent = 'Copy'

      btn.addEventListener('click', () => {
        const text = codeEl.textContent || ''
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = 'Copied!'
          setTimeout(() => {
            btn.textContent = 'Copy'
          }, 2000)
        })
      })

      pre.appendChild(btn)
    })
  }, [])

  useEffect(() => {
    attachCopyButtons()
  }, [sanitizedHtml, attachCopyButtons])

  return (
    <>
      <style>{MARKDOWN_STYLES}</style>
      <div
        ref={containerRef}
        className={cn('markdown-rendered text-[13px] leading-relaxed break-words', className)}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </>
  )
}

/**
 * Scoped prose styles for markdown-rendered content.
 * These replace @tailwindcss/typography prose classes with manual rules
 * targeting the `.markdown-rendered` container. Uses CSS variables from
 * the Ops OS design system for theme-aware colors.
 */
const MARKDOWN_STYLES = /* css */ `
.markdown-rendered {
  max-width: none;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* ── Headings ── */
.markdown-rendered h1 {
  font-size: 1.375em;
  font-weight: 700;
  margin-top: 1.25em;
  margin-bottom: 0.5em;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
.markdown-rendered h2 {
  font-size: 1.15em;
  font-weight: 600;
  margin-top: 1.15em;
  margin-bottom: 0.4em;
  line-height: 1.25;
  letter-spacing: -0.015em;
}
.markdown-rendered h3 {
  font-size: 1em;
  font-weight: 600;
  margin-top: 1em;
  margin-bottom: 0.35em;
  line-height: 1.3;
  letter-spacing: -0.01em;
}
.markdown-rendered h1:first-child,
.markdown-rendered h2:first-child,
.markdown-rendered h3:first-child {
  margin-top: 0;
}

/* ── Paragraphs ── */
.markdown-rendered p {
  margin-bottom: 0.625em;
}
.markdown-rendered p:last-child {
  margin-bottom: 0;
}

/* ── Lists ── */
.markdown-rendered ul {
  list-style-type: disc;
  padding-left: 1.5em;
  margin-bottom: 0.625em;
}
.markdown-rendered ol {
  list-style-type: decimal;
  padding-left: 1.5em;
  margin-bottom: 0.625em;
}
.markdown-rendered li {
  margin-bottom: 0.2em;
}
.markdown-rendered li > ul,
.markdown-rendered li > ol {
  margin-top: 0.2em;
  margin-bottom: 0;
}

/* ── Inline code ── */
.markdown-rendered code {
  background-color: var(--muted);
  border-radius: 0.25rem;
  padding: 0.125em 0.35em;
  font-size: 0.9em;
  font-family: var(--font-geist-mono, ui-monospace, monospace);
}

/* ── Code blocks ── */
.markdown-rendered pre {
  margin-bottom: 0.75em;
  border-radius: 0.5rem;
  overflow: hidden;
}
.markdown-rendered pre > code {
  display: block;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  background-color: var(--muted);
  border-radius: 0.5rem;
  font-size: 12px;
  line-height: 1.5;
  border: none;
}

/* ── Copy button on code blocks ── */
.markdown-rendered .md-copy-btn {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  padding: 0.2rem 0.5rem;
  font-size: 11px;
  font-family: inherit;
  line-height: 1.4;
  background-color: var(--background);
  color: var(--muted-foreground);
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.markdown-rendered pre:hover .md-copy-btn {
  opacity: 1;
}
.markdown-rendered .md-copy-btn:hover {
  background-color: var(--accent);
  color: var(--accent-foreground);
}
.markdown-rendered .md-copy-btn:focus-visible {
  opacity: 1;
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* ── Links ── */
.markdown-rendered a {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.markdown-rendered a:hover {
  text-decoration-thickness: 2px;
}

/* ── Blockquotes ── */
.markdown-rendered blockquote {
  border-left: 2px solid var(--border);
  padding-left: 0.875em;
  margin-left: 0;
  margin-bottom: 0.625em;
  font-style: italic;
  color: var(--muted-foreground);
}

/* ── Horizontal rules ── */
.markdown-rendered hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 1em 0;
}

/* ── Tables ── */
.markdown-rendered table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.75em;
  font-size: 12px;
}
.markdown-rendered th,
.markdown-rendered td {
  border: 1px solid var(--border);
  padding: 0.35em 0.6em;
  text-align: left;
}
.markdown-rendered th {
  background-color: var(--muted);
  font-weight: 600;
}

/* ── Strong / Emphasis ── */
.markdown-rendered strong {
  font-weight: 600;
}
.markdown-rendered em {
  font-style: italic;
}
`
