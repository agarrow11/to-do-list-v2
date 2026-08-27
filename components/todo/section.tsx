"use client"

import type React from "react"
import { useState } from "react"
import { GripVertical, Plus, Trash2 } from "lucide-react"
import type { Section, Task } from "./types"
import { TaskRow } from "./task-row"
import { useListDnd } from "./use-list-dnd"
import { taskMatchesQuery } from "./store"

export function SectionCard({
  section,
  hideCompleted,
  query = "",
  onAddTask,
  onToggleTask,
  onOpenTask,
  onDeleteTask,
  onRenameSection,
  onDeleteSection,
  onReorderTask,
  dragHandleProps,
}: {
  section: Section
  hideCompleted: boolean
  query?: string
  onAddTask: (title: string) => void
  onToggleTask: (taskId: string) => void
  onOpenTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  onRenameSection: (title: string) => void
  onDeleteSection: () => void
  onReorderTask: (fromTaskId: string, toTaskId: string) => void
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
}) {
  const [draft, setDraft] = useState("")
  const [title, setTitle] = useState(section.title)

  const q = query.trim().toLowerCase()
  const searching = q.length > 0
  const visibleTasks = section.tasks
    .filter((t) => (hideCompleted ? !t.done : true))
    .filter((t) => taskMatchesQuery(t, q))
  const doneCount = section.tasks.filter((t) => t.done).length

  // Reorder operates on the VISIBLE list, then translates to task IDs so it
  // stays correct when completed tasks are hidden.
  const taskDnd = useListDnd((from, to) => {
    const fromTask = visibleTasks[from]
    const toTask = visibleTasks[to]
    if (fromTask && toTask) onReorderTask(fromTask.id, toTask.id)
  })

  function submitDraft() {
    const value = draft.trim()
    if (!value) return
    onAddTask(value)
    setDraft("")
  }

  return (
    <section className="rounded-md border border-border bg-card">
      <header className="flex items-center gap-1.5 border-b border-border px-2 py-2">
        {dragHandleProps ? (
          <button
            {...dragHandleProps}
            aria-label="Drag to reorder section"
            className="shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:bg-secondary hover:text-primary active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : (
          <span className="h-3.5 w-1 shrink-0 rounded-sm bg-primary" aria-hidden />
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const trimmed = title.trim()
            if (trimmed && trimmed !== section.title) onRenameSection(trimmed)
            else setTitle(section.title)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          }}
          aria-label="Section title"
          className="min-w-0 flex-1 bg-transparent text-sm font-bold leading-5 text-foreground outline-none focus:border-b focus:border-primary"
        />
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {doneCount}/{section.tasks.length}
        </span>
        <button
          onClick={onDeleteSection}
          aria-label="Delete section"
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-primary"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="px-3 py-1">
        {visibleTasks.length === 0 ? (
          <p className="py-2 text-xs leading-4 text-muted-foreground">
            {searching
              ? "No matching tasks."
              : section.tasks.length > 0 && hideCompleted
                ? "All done here."
                : "No tasks yet."}
          </p>
        ) : (
          visibleTasks.map((task, i) => (
            <TaskRow
              key={task.id}
              task={task}
              dragHandleProps={searching ? undefined : taskDnd.handle(i)}
              containerProps={searching ? undefined : taskDnd.containerItem(i)}
              dragging={!searching && taskDnd.dragIndex === i}
              over={!searching && taskDnd.overIndex === i && taskDnd.dragIndex !== i}
              onToggle={() => onToggleTask(task.id)}
              onOpen={() => onOpenTask(task)}
              onDelete={() => onDeleteTask(task.id)}
            />
          ))
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-border px-3 py-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault()
              submitDraft()
            }
          }}
          placeholder="Add a task and press Enter"
          aria-label="Add a task"
          className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1.5 text-xs leading-4 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={submitDraft}
          aria-label="Add task"
          className="inline-flex shrink-0 items-center gap-1 rounded bg-primary px-2 py-1.5 text-xs font-semibold leading-4 text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </section>
  )
}
