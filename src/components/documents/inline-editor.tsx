'use client'

import { useRef, useCallback } from 'react'

interface InlineEditorProps {
  htmlContent: string
  onChange: (newHtml: string) => void
  readOnly: boolean
}

/**
 * Inline editor for document content using an iframe with contentEditable.
 * When readOnly=false, the doc-body section becomes editable.
 * On blur, extracts the edited HTML and calls onChange.
 */
export function InlineEditor({ htmlContent, onChange, readOnly }: InlineEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentDocument) return

    const body = iframe.contentDocument.querySelector('.doc-body')
    if (body && !readOnly) {
      ;(body as HTMLElement).contentEditable = 'true'
      ;(body as HTMLElement).style.outline = 'none'
      ;(body as HTMLElement).style.minHeight = '200px'

      // Add editing indicator border
      ;(body as HTMLElement).style.border = '2px dashed var(--ring, #6366f1)'
      ;(body as HTMLElement).style.borderRadius = '4px'
      ;(body as HTMLElement).style.padding = '16px'

      body.addEventListener('blur', () => {
        const fullHtml = iframe.contentDocument?.documentElement.outerHTML
        if (fullHtml) {
          onChange(fullHtml)
        }
      })
    }
  }, [readOnly, onChange])

  return (
    <iframe
      ref={iframeRef}
      srcDoc={htmlContent}
      onLoad={handleLoad}
      title="Document preview"
      sandbox="allow-same-origin"
      className="w-full h-full border-0 bg-white rounded"
      style={{ minHeight: '500px' }}
    />
  )
}
