"use client"

import type React from "react"
import { Check, GripVertical, Paperclip, StickyNote, Trash2 } from "lucide-react"
import type { Task } from "./types"

export function TaskRow({
  task,
  onToggle,
  onOpen,
  onDelete,
  compact = false,
  dragHandleProps,
  containerProps,
  dragging = false,
  over = false,
}: {
  task: Task
  onToggle: () => void
  onOpen: () => void
  onDelete: () => void
  compact?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  containerProps?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean }
  dragging?: boolean
  over?: boolean
}) {
  const hasNotes = task.notes.trim().length > 0
  const hasAttachments = task.attachments.length > 0

  return (
    <div
      {...containerProps}
      className={`group flex items-center gap-1.5 border-b border-border/70 py-1.5 last:border-b-0 ${
        dragging ? "opacity-40" : ""
      } ${over ? "border-t-2 border-t-primary" : ""}`}
    >
      <button
        {...dragHandleProps}
        aria-label="Drag to reorder task"
        className="shrink-0 cursor-grab touch-none rounded p-0.5 text-transparent hover:bg-secondary active:cursor-grabbing group-hover:text-muted-foreground"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <button
        onClick={onToggle}
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? "Mark as not done" : "Mark as done"}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors ${
          task.done ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:border-primary"
        }`}
      >
        {task.done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      <button
        onClick={onOpen}
        className={`min-w-0 flex-1 truncate text-left ${compact ? "text-xs" : "text-sm"} ${
          task.done ? "text-muted-foreground line-through" : "text-foreground"
        } hover:text-primary`}
        title={task.title}
      >
        {task.title}
      </button>

      {hasNotes && <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Has notes" />}
      {hasAttachments && (
        <span className="flex shrink-0 items-center gap-0.5 text-muted-foreground" aria-label="Has attachments">
          <Paperclip className="h-3.5 w-3.5" />
          {task.attachments.length > 1 && <span className="text-[10px]">{task.attachments.length}</span>}
        </span>
      )}

      <button
        onClick={onDelete}
        aria-label="Delete task"
        className="shrink-0 rounded p-0.5 text-transparent hover:bg-secondary group-hover:text-muted-foreground hover:!text-primary"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
