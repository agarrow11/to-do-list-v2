"use client"

import { useEffect, useRef, useState } from "react"
import { Bold, Italic, Underline, List, Strikethrough, Highlighter, Palette } from "lucide-react"
import { notesToHtml, htmlHasContent } from "./rich-text"

type ActiveState = { bold: boolean; italic: boolean; underline: boolean; strike: boolean; ul: boolean }

const EMPTY_STATE: ActiveState = { bold: false, italic: false, underline: false, strike: false, ul: false }

const FONT_OPTIONS = [
  { label: "Arial", value: "Arial" },
  { label: "Georgia", value: "Georgia" },
]

const SIZE_OPTIONS = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "4" },
  { label: "Heading", value: "5" },
]

const TEXT_COLORS = [
  { label: "Ink", value: "#1a1a1a" },
  { label: "Bain red", value: "#cc0000" },
  { label: "Navy", value: "#002b49" },
  { label: "Grey", value: "#6b6b68" },
]

const HIGHLIGHT_COLORS = [
  { label: "No highlight", value: "transparent" },
  { label: "Yellow", value: "#fff2a8" },
  { label: "Blue", value: "#dbeafe" },
  { label: "Green", value: "#dcfce7" },
]

/** Rich-text editor for task notes with emphasis, lists, font, size, text
 *  color, and highlighting controls. Value is HTML. Re-initialised only when
 *  `taskId` changes so typing is never interrupted, and commits on blur. */
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
  const savedRange = useRef<Range | null>(null)
  const [empty, setEmpty] = useState(true)
  const [active, setActive] = useState<ActiveState>(EMPTY_STATE)

  // Load the note when a different task opens (not on every keystroke).
  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = notesToHtml(initialHtml)
    setEmpty(!htmlHasContent(ref.current.innerHTML))
  }, [taskId])

  // Toolbar controls can temporarily take focus. Preserve the editor selection
  // so font, size, color, and highlight apply to the text the user selected.
  useEffect(() => {
    function rememberSelection() {
      const selection = window.getSelection()
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null
      if (range && ref.current?.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange()
    }
    document.addEventListener("selectionchange", rememberSelection)
    return () => document.removeEventListener("selectionchange", rememberSelection)
  }, [])

  function refreshActive() {
    if (typeof document === "undefined") return
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strike: document.queryCommandState("strikeThrough"),
        ul: document.queryCommandState("insertUnorderedList"),
      })
    } catch {
      setActive(EMPTY_STATE)
    }
  }

  function restoreSelection() {
    if (!savedRange.current) return
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(savedRange.current)
  }

  function exec(command: string, value?: string) {
    ref.current?.focus()
    restoreSelection()
    document.execCommand(command, false, value)
    if (ref.current) setEmpty(!htmlHasContent(ref.current.innerHTML))
    refreshActive()
  }

  const tools: { key: keyof ActiveState; cmd: string; label: string; Icon: typeof Bold }[] = [
    { key: "bold", cmd: "bold", label: "Bold", Icon: Bold },
    { key: "italic", cmd: "italic", label: "Italic", Icon: Italic },
    { key: "underline", cmd: "underline", label: "Underline", Icon: Underline },
    { key: "strike", cmd: "strikeThrough", label: "Strikethrough", Icon: Strikethrough },
    { key: "ul", cmd: "insertUnorderedList", label: "Bulleted list", Icon: List },
  ]

  return (
    <div className="rounded-md border border-input bg-background focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-1.5 py-1.5">
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

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <label className="sr-only" htmlFor={`note-font-${taskId}`}>Font style</label>
        <select
          id={`note-font-${taskId}`}
          aria-label="Font style"
          defaultValue="Arial"
          onMouseDown={() => {
            const selection = window.getSelection()
            if (selection?.rangeCount) savedRange.current = selection.getRangeAt(0).cloneRange()
          }}
          onChange={(e) => exec("fontName", e.target.value)}
          className="h-7 rounded border border-input bg-background px-1.5 text-xs text-foreground outline-none focus:border-primary"
        >
          {FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        <label className="sr-only" htmlFor={`note-size-${taskId}`}>Font size</label>
        <select
          id={`note-size-${taskId}`}
          aria-label="Font size"
          defaultValue="3"
          onMouseDown={() => {
            const selection = window.getSelection()
            if (selection?.rangeCount) savedRange.current = selection.getRangeAt(0).cloneRange()
          }}
          onChange={(e) => exec("fontSize", e.target.value)}
          className="h-7 rounded border border-input bg-background px-1.5 text-xs text-foreground outline-none focus:border-primary"
        >
          {SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <div className="flex items-center gap-1" role="group" aria-label="Font color">
          <Palette className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {TEXT_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              aria-label={`${color.label} text`}
              title={`${color.label} text`}
              onMouseDown={(e) => {
                e.preventDefault()
                exec("foreColor", color.value)
              }}
              className="h-5 w-5 rounded-full border border-border ring-offset-1 hover:ring-1 hover:ring-primary"
              style={{ backgroundColor: color.value }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Highlight color">
          <Highlighter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              aria-label={color.label}
              title={color.label}
              onMouseDown={(e) => {
                e.preventDefault()
                exec("hiliteColor", color.value)
              }}
              className={`h-5 w-5 rounded border border-border ring-offset-1 hover:ring-1 hover:ring-primary ${
                color.value === "transparent" ? "bg-background" : ""
              }`}
              style={color.value === "transparent" ? undefined : { backgroundColor: color.value }}
            >
              {color.value === "transparent" && <span className="block h-px w-full rotate-45 bg-primary" />}
            </button>
          ))}
        </div>
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
