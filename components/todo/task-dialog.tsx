"use client"

import { useEffect, useRef, useState } from "react"
import { X, Paperclip, Trash2, Download, FileText, MoveRight, Pencil } from "lucide-react"
import type { Attachment, OwnerKind, Task } from "./types"
import { uid } from "./store"
import { RichTextEditor } from "./rich-text-editor"

export type MoveOwner = {
  id: string
  name: string
  kind: OwnerKind
  sections: { id: string; title: string }[]
}

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024 // ~4MB per file guard

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function TaskDialog({
  task,
  ownerLabel,
  sectionTitle,
  owners,
  currentOwnerId,
  currentSectionId,
  onMove,
  onDelete,
  onClose,
  onChange,
}: {
  task: Task
  ownerLabel: string
  sectionTitle: string
  owners: MoveOwner[]
  currentOwnerId: string
  currentSectionId: string
  onMove: (ownerId: string, sectionId: string) => void
  onDelete: () => void
  onClose: () => void
  onChange: (patch: Partial<Task>) => void
}) {
  const [title, setTitle] = useState(task.title)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const destOwner = owners.find((o) => o.id === currentOwnerId)
  const ownerLabelFor = (o: MoveOwner) => (o.kind === "me" ? "My work" : o.name)

  function changeOwner(ownerId: string) {
    const owner = owners.find((o) => o.id === ownerId)
    const firstSection = owner?.sections[0]?.id
    if (owner && firstSection) onMove(ownerId, firstSection)
  }

  // Keep local fields in sync if the task object identity changes.
  useEffect(() => {
    setTitle(task.title)
  }, [task.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  function commitTitle() {
    const trimmed = title.trim()
    if (trimmed && trimmed !== task.title) onChange({ title: trimmed })
    else setTitle(task.title)
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    const added: Attachment[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`"${file.name}" is ${formatSize(file.size)} — over the ~4MB limit for browser storage.`)
        continue
      }
      try {
        const dataUrl = await readFileAsDataUrl(file)
        added.push({ id: uid(), name: file.name, type: file.type, size: file.size, dataUrl })
      } catch {
        setError(`Could not read "${file.name}".`)
      }
    }
    if (added.length > 0) {
      onChange({ attachments: [...task.attachments, ...added] })
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function removeAttachment(id: string) {
    onChange({ attachments: task.attachments.filter((a) => a.id !== id) })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        className="mt-6 w-full max-w-xl rounded-md border border-border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {ownerLabel} <span className="text-primary">/</span> {sectionTitle}
            </p>
            <label className="mt-1.5 flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                }}
                className="w-full bg-transparent text-lg font-bold text-foreground outline-none"
                aria-label="Task title"
                placeholder="Task name"
              />
            </label>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <MoveRight className="h-3.5 w-3.5" />
              Move / reassign
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={currentOwnerId}
                onChange={(e) => changeOwner(e.target.value)}
                aria-label="Assign to"
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {ownerLabelFor(o)}
                  </option>
                ))}
              </select>
              <select
                value={currentSectionId}
                onChange={(e) => onMove(currentOwnerId, e.target.value)}
                aria-label="Section"
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {destOwner?.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Description / notes
            </label>
            <RichTextEditor
              taskId={task.id}
              initialHtml={task.notes}
              onCommit={(html) => {
                if (html !== task.notes) onChange({ notes: html })
              }}
              placeholder="Add context, links, next steps…"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Attachments
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Add file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {error && (
              <p className="mb-2 rounded border border-primary/30 bg-accent px-2.5 py-1.5 text-xs text-primary">
                {error}
              </p>
            )}

            {task.attachments.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
                No attachments. Keep files under ~4MB so they save in the browser.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {task.attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-2.5 py-1.5"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{a.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatSize(a.size)}</span>
                    <a
                      href={a.dataUrl}
                      download={a.name}
                      aria-label={`Download ${a.name}`}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => removeAttachment(a.id)}
                      aria-label={`Remove ${a.name}`}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-background hover:text-primary"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <button
            onClick={() => {
              if (window.confirm(`Delete "${task.title}"? This can't be undone.`)) onDelete()
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold text-primary hover:bg-accent"
          >
            <Trash2 className="h-4 w-4" />
            Delete task
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
