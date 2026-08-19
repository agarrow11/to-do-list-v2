"use client"

import { useEffect, useRef, useState } from "react"
import { Bold, Italic, Underline, List } from "lucide-react"
import { notesToHtml, htmlHasContent } from "./rich-text"

type ActiveState = { bold: boolean; italic: boolean; underline: boolean; ul: boolean }

const EMPTY_STATE: ActiveState = { bold: false, italic: false, underline: false, ul: false }

/** Small rich-text editor for task notes: bold, italic, underline, bulleted list.
 *  Value is HTML. Re-initialised only when `taskId` changes so typing is never
 *  interrupted, and commits on blur. */
export function RichTextEditor({
  taskId,
  initialHtml,
  onCommit,
  placeholder,
}: {
  taskId: string
  initialHtml: string
  onCommit: (html: string) => void
  placeholder?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [empty, setEmpty] = useState(true)
  const [active, setActive] = useState<ActiveState>(EMPTY_STATE)

  // Load the note when a different task opens (not on every keystroke).
  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = notesToHtml(initialHtml)
    setEmpty(!htmlHasContent(ref.current.innerHTML))
  }, [taskId])

  function refreshActive() {
    if (typeof document === "undefined") return
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        ul: document.queryCommandState("insertUnorderedList"),
      })
    } catch {
      setActive(EMPTY_STATE)
    }
  }

  function exec(command: string) {
    document.execCommand(command, false)
    ref.current?.focus()
    if (ref.current) setEmpty(!htmlHasContent(ref.current.innerHTML))
    refreshActive()
  }

  const tools: { key: keyof ActiveState; cmd: string; label: string; Icon: typeof Bold }[] = [
    { key: "bold", cmd: "bold", label: "Bold", Icon: Bold },
    { key: "italic", cmd: "italic", label: "Italic", Icon: Italic },
    { key: "underline", cmd: "underline", label: "Underline", Icon: Underline },
    { key: "ul", cmd: "insertUnorderedList", label: "Bulleted list", Icon: List },
  ]

  return (
    <div className="rounded-md border border-input bg-background focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
      <div className="flex items-center gap-1 border-b border-border px-1.5 py-1">
        {tools.map(({ key, cmd, label, Icon }) => (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-pressed={active[key]}
            title={label}
            onMouseDown={(e) => {
              e.preventDefault() // keep the text selection in the editor
              exec(cmd)
            }}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              active[key] ? "bg-accent text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      <div className="relative">
        {empty && placeholder && (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">{placeholder}</span>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Description and notes"
          onInput={() => {
            if (ref.current) setEmpty(!htmlHasContent(ref.current.innerHTML))
          }}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          onBlur={() => onCommit(ref.current?.innerHTML ?? "")}
          className="rte min-h-[9rem] w-full resize-y overflow-auto px-3 py-2 text-sm leading-relaxed text-foreground outline-none"
        />
      </div>
    </div>
  )
}
