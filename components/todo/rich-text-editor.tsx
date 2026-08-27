"use client"

import { useEffect, useRef, useState } from "react"
import { Bold, Highlighter, Italic, List, Palette, Strikethrough, Underline } from "lucide-react"
import { htmlHasContent, notesToHtml } from "./rich-text"

type ActiveState = {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  ul: boolean
}

type FormatOption = { label: string; value: string }

const EMPTY_STATE: ActiveState = { bold: false, italic: false, underline: false, strike: false, ul: false }

const FONT_OPTIONS: FormatOption[] = [
  { label: "Default", value: "Arial, Helvetica, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
]

const SIZE_OPTIONS: FormatOption[] = [
  { label: "Small", value: "12px" },
  { label: "Normal", value: "14px" },
  { label: "Large", value: "18px" },
  { label: "Heading", value: "22px" },
]

const TEXT_COLORS: FormatOption[] = [
  { label: "Default text", value: "var(--foreground)" },
  { label: "Red text", value: "#cc0000" },
  { label: "Navy text", value: "#002b49" },
  { label: "Grey text", value: "#6b6b68" },
]

const HIGHLIGHTS: FormatOption[] = [
  { label: "Remove highlight", value: "transparent" },
  { label: "Yellow highlight", value: "#fff2a8" },
  { label: "Blue highlight", value: "#dbeafe" },
  { label: "Green highlight", value: "#dcfce7" },
]

/** Rich-text task notes. Formatting is applied only inside this editor using
 * inline styles; no font or size rule can leak into the rest of the app. */
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
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)
  const [empty, setEmpty] = useState(true)
  const [active, setActive] = useState<ActiveState>(EMPTY_STATE)

  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.innerHTML = notesToHtml(initialHtml)
    setEmpty(!htmlHasContent(editorRef.current.innerHTML))
    savedRange.current = null
  }, [initialHtml, taskId])

  function rememberSelection() {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editorRef.current) return
    const range = selection.getRangeAt(0)
    if (editorRef.current.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange()
  }

  function restoreSelection() {
    if (!savedRange.current) return false
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(savedRange.current)
    return true
  }

  function refreshActive() {
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

  function updateEditorState() {
    if (!editorRef.current) return
    setEmpty(!htmlHasContent(editorRef.current.innerHTML))
    rememberSelection()
    refreshActive()
  }

  function exec(command: string) {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand(command, false)
    updateEditorState()
  }

  function applyInlineStyle(property: "fontFamily" | "fontSize" | "color" | "backgroundColor", value: string) {
    editorRef.current?.focus()
    if (!restoreSelection()) return
    const selection = window.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (!range || range.collapsed || !editorRef.current?.contains(range.commonAncestorContainer)) return

    const span = document.createElement("span")
    span.style[property] = value
    span.appendChild(range.extractContents())
    range.insertNode(span)
    range.selectNodeContents(span)
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRange.current = range.cloneRange()
    updateEditorState()
  }

  function commitWhenLeaving(event: React.FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null
    if (next && containerRef.current?.contains(next)) return
    onCommit(editorRef.current?.innerHTML ?? "")
  }

  const tools: { key: keyof ActiveState; command: string; label: string; Icon: typeof Bold }[] = [
    { key: "bold", command: "bold", label: "Bold", Icon: Bold },
    { key: "italic", command: "italic", label: "Italic", Icon: Italic },
    { key: "underline", command: "underline", label: "Underline", Icon: Underline },
    { key: "strike", command: "strikeThrough", label: "Strikethrough", Icon: Strikethrough },
    { key: "ul", command: "insertUnorderedList", label: "Bulleted list", Icon: List },
  ]

  return (
    <div
      ref={containerRef}
      onBlur={commitWhenLeaving}
      className="rounded-md border border-input bg-background focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-1.5 py-1.5">
        {tools.map(({ key, command, label, Icon }) => (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-pressed={active[key]}
            title={label}
            onMouseDown={(event) => {
              event.preventDefault()
              exec(command)
            }}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              active[key] ? "bg-accent text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <FormatSelect label="Font style" options={FONT_OPTIONS} onApply={(value) => applyInlineStyle("fontFamily", value)} />
        <FormatSelect label="Font size" options={SIZE_OPTIONS} onApply={(value) => applyInlineStyle("fontSize", value)} />
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <ColorControls icon={Palette} label="Font color" options={TEXT_COLORS} onApply={(value) => applyInlineStyle("color", value)} />
        <ColorControls icon={Highlighter} label="Highlight" options={HIGHLIGHTS} onApply={(value) => applyInlineStyle("backgroundColor", value)} />
      </div>

      <div className="relative">
        {empty && placeholder && (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">{placeholder}</span>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Description and notes"
          onInput={updateEditorState}
          onKeyUp={updateEditorState}
          onMouseUp={updateEditorState}
          className="rte min-h-[9rem] w-full resize-y overflow-auto px-3 py-2 text-sm leading-relaxed text-foreground outline-none"
        />
      </div>
    </div>
  )
}

function FormatSelect({ label, options, onApply }: { label: string; options: FormatOption[]; onApply: (value: string) => void }) {
  return (
    <select
      aria-label={label}
      defaultValue=""
      onChange={(event) => {
        if (!event.target.value) return
        onApply(event.target.value)
        event.target.value = ""
      }}
      className="h-7 rounded border border-input bg-background px-1.5 text-xs text-foreground outline-none focus:border-primary"
    >
      <option value="" disabled>{label}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}

function ColorControls({
  icon: Icon,
  label,
  options,
  onApply,
}: {
  icon: typeof Palette
  label: string
  options: FormatOption[]
  onApply: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={option.label}
          title={option.label}
          onMouseDown={(event) => {
            event.preventDefault()
            onApply(option.value)
          }}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background ring-offset-1 hover:ring-1 hover:ring-primary"
        >
          <span
            className="block h-3 w-3 rounded-full border border-border"
            style={{ background: option.value.startsWith("var(") ? "currentColor" : option.value }}
          />
        </button>
      ))}
    </div>
  )
}
