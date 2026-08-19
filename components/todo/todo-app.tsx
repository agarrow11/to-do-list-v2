"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, Download, EyeOff, Eye, AlertTriangle, Search, X, Database, Save, Upload, Check } from "lucide-react"
import type { Board, Owner, Section, Task } from "./types"
import { defaultBoard, loadBoard, saveBoard, newTask, newSection, newReport, taskMatchesQuery, exportBackup, parseBackup } from "./store"
import { SectionCard } from "./section"
import { TaskDialog, type MoveOwner } from "./task-dialog"
import { exportBoardToExcel } from "./export-excel"
import { useListDnd } from "./use-list-dnd"

function move<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice()
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

type DialogTarget = { ownerId: string; sectionId: string; taskId: string }

export function TodoApp() {
  const [board, setBoard] = useState<Board>(defaultBoard)
  const [mounted, setMounted] = useState(false)
  const [dialogTarget, setDialogTarget] = useState<DialogTarget | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [lastSaved, setLastSaved] = useState<number | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [query, setQuery] = useState("")
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  // Load once on mount (client only).
  useEffect(() => {
    setBoard(loadBoard())
    setMounted(true)
  }, [])

  // Write the board to localStorage now, recording the timestamp.
  function persist(next: Board) {
    try {
      saveBoard(next)
      setLastSaved(Date.now())
      setSaveError(false)
      return true
    } catch {
      setSaveError(true)
      return false
    }
  }

  // Manual save triggered by the "Save now" button.
  function saveNow() {
    if (persist(board)) {
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1500)
    }
  }

  // Auto-save (debounced) whenever the board changes.
  useEffect(() => {
    if (!mounted) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persist(board), 300)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [board, mounted])

  // ---- Immutable mutators -------------------------------------------------
  function mapSection(ownerId: string, sectionId: string, fn: (s: Section) => Section) {
    setBoard((b) => ({
      ...b,
      owners: b.owners.map((o) =>
        o.id !== ownerId ? o : { ...o, sections: o.sections.map((s) => (s.id !== sectionId ? s : fn(s))) },
      ),
    }))
  }

  function addTask(ownerId: string, sectionId: string, title: string) {
    mapSection(ownerId, sectionId, (s) => ({ ...s, tasks: [...s.tasks, newTask(title)] }))
  }

  function toggleTask(ownerId: string, sectionId: string, taskId: string) {
    mapSection(ownerId, sectionId, (s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id !== taskId ? t : { ...t, done: !t.done, completedAt: !t.done ? Date.now() : null },
      ),
    }))
  }

  function deleteTask(ownerId: string, sectionId: string, taskId: string) {
    mapSection(ownerId, sectionId, (s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== taskId) }))
  }

  function patchTask(target: DialogTarget, patch: Partial<Task>) {
    mapSection(target.ownerId, target.sectionId, (s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id !== target.taskId ? t : { ...t, ...patch })),
    }))
  }

  function renameSection(ownerId: string, sectionId: string, title: string) {
    mapSection(ownerId, sectionId, (s) => ({ ...s, title }))
  }

  function deleteSection(ownerId: string, sectionId: string) {
    setBoard((b) => ({
      ...b,
      owners: b.owners.map((o) => (o.id !== ownerId ? o : { ...o, sections: o.sections.filter((s) => s.id !== sectionId) })),
    }))
  }

  function addSection(ownerId: string) {
    setBoard((b) => ({
      ...b,
      owners: b.owners.map((o) => (o.id !== ownerId ? o : { ...o, sections: [...o.sections, newSection("New section")] })),
    }))
  }

  // Adds a new "My Team" section (a report owner with one flat task list).
  function addReport() {
    setBoard((b) => ({ ...b, owners: [...b.owners, newReport("New team member")] }))
  }

  function reorderTasks(ownerId: string, sectionId: string, fromTaskId: string, toTaskId: string) {
    mapSection(ownerId, sectionId, (s) => {
      const from = s.tasks.findIndex((t) => t.id === fromTaskId)
      const to = s.tasks.findIndex((t) => t.id === toTaskId)
      if (from < 0 || to < 0) return s
      return { ...s, tasks: move(s.tasks, from, to) }
    })
  }

  function reorderSections(ownerId: string, from: number, to: number) {
    setBoard((b) => ({
      ...b,
      owners: b.owners.map((o) => (o.id !== ownerId ? o : { ...o, sections: move(o.sections, from, to) })),
    }))
  }

  function renameOwner(ownerId: string, name: string) {
    setBoard((b) => ({
      ...b,
      owners: b.owners.map((o) => (o.id !== ownerId ? o : { ...o, name })),
    }))
  }

  function moveTask(from: DialogTarget, destOwnerId: string, destSectionId: string) {
    if (from.ownerId === destOwnerId && from.sectionId === destSectionId) return
    setBoard((b) => {
      let moved: Task | undefined
      const removed = b.owners.map((o) =>
        o.id !== from.ownerId
          ? o
          : {
              ...o,
              sections: o.sections.map((s) => {
                if (s.id !== from.sectionId) return s
                moved = s.tasks.find((t) => t.id === from.taskId) ?? moved
                return { ...s, tasks: s.tasks.filter((t) => t.id !== from.taskId) }
              }),
            },
      )
      if (!moved) return b
      const inserted = removed.map((o) =>
        o.id !== destOwnerId
          ? o
          : {
              ...o,
              sections: o.sections.map((s) => (s.id !== destSectionId ? s : { ...s, tasks: [...s.tasks, moved!] })),
            },
      )
      return { ...b, owners: inserted }
    })
    // Keep the dialog pointed at the task in its new home.
    setDialogTarget({ ownerId: destOwnerId, sectionId: destSectionId, taskId: from.taskId })
  }

  async function handleRestoreFile(file?: File | null) {
    if (!file) return
    try {
      const text = await file.text()
      const restored = parseBackup(text)
      if (window.confirm("Restore this backup? It will replace all current tasks and sections.")) {
        setBoard(restored)
        setQuery("")
        setDialogTarget(null)
      }
    } catch (err) {
      window.alert((err as Error)?.message || "Could not read that file.")
    } finally {
      if (restoreInputRef.current) restoreInputRef.current.value = ""
    }
  }

  // ---- Derived ------------------------------------------------------------
  const me = board.owners.find((o) => o.kind === "me")
  const reports = board.owners.filter((o) => o.kind === "report")
  const teamCount = reports.reduce(
    (acc, r) => {
      const c = countTasks(r)
      return { done: acc.done + c.done, total: acc.total + c.total }
    },
    { done: 0, total: 0 },
  )

  const q = query.trim().toLowerCase()
  const searching = q.length > 0
  const sectionHasMatch = (s: Section) => s.tasks.some((t) => taskMatchesQuery(t, q))
  const meSections = searching ? (me?.sections ?? []).filter(sectionHasMatch) : (me?.sections ?? [])

  const totals = useMemo(() => {
    let open = 0
    let done = 0
    for (const o of board.owners) for (const s of o.sections) for (const t of s.tasks) t.done ? done++ : open++
    return { open, done }
  }, [board])

  const moveOwners: MoveOwner[] = useMemo(
    () =>
      board.owners.map((o) => ({
        id: o.id,
        name: o.name,
        kind: o.kind,
        sections: o.sections.map((s) => ({ id: s.id, title: s.title })),
      })),
    [board],
  )

  const meSectionDnd = useListDnd((from, to) => {
    if (me) reorderSections(me.id, from, to)
  })

  const dialogData = useMemo(() => {
    if (!dialogTarget) return null
    const owner = board.owners.find((o) => o.id === dialogTarget.ownerId)
    const section = owner?.sections.find((s) => s.id === dialogTarget.sectionId)
    const task = section?.tasks.find((t) => t.id === dialogTarget.taskId)
    if (!owner || !section || !task) return null
    return { owner, section, task }
  }, [dialogTarget, board])

  // Close dialog if its task disappeared.
  useEffect(() => {
    if (dialogTarget && !dialogData) setDialogTarget(null)
  }, [dialogTarget, dialogData])

  if (!mounted) {
    return <div className="min-h-screen bg-background" aria-hidden />
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-6 w-6 rounded-sm bg-primary" aria-hidden />
            <div className="leading-tight">
              <h1 className="text-base font-bold tracking-tight">To-Do</h1>
              <p className="text-[11px] text-muted-foreground">
                {lastSaved ? `Last saved ${formatSaved(lastSaved)}` : "Auto-saved in this browser"}
              </p>
            </div>
          </div>

          <span className="hidden items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground sm:inline-flex">
            <strong className="font-bold text-foreground">{totals.open}</strong> open
            <span className="mx-0.5 text-border">·</span>
            <strong className="font-bold text-foreground">{totals.done}</strong> done
          </span>

          {/* Search */}
          <div className="relative order-last w-full min-w-0 md:order-none md:ml-2 md:w-64 lg:w-80">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks and notes…"
              aria-label="Search tasks"
              className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-8 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {saveError && (
              <span className="hidden items-center gap-1.5 rounded border border-primary/40 bg-accent px-2.5 py-1.5 text-[11px] font-medium text-primary sm:flex">
                <AlertTriangle className="h-3.5 w-3.5" />
                Storage full — remove large attachments
              </span>
            )}
            <button
              onClick={() => setBoard((b) => ({ ...b, hideCompleted: !b.hideCompleted }))}
              aria-pressed={board.hideCompleted}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                board.hideCompleted
                  ? "border-primary bg-accent text-primary"
                  : "border-input bg-background text-foreground hover:bg-secondary"
              }`}
            >
              {board.hideCompleted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {board.hideCompleted ? "Completed hidden" : "Hide completed"}
            </button>
            <button
              onClick={saveNow}
              aria-label="Save now to this browser"
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                justSaved
                  ? "border-primary bg-accent text-primary"
                  : "border-input bg-background text-foreground hover:bg-secondary"
              }`}
            >
              {justSaved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {justSaved ? "Saved" : "Save now"}
            </button>
            <DataMenu onBackup={() => exportBackup(board)} onRestore={() => restoreInputRef.current?.click()} />
            <button
              onClick={() => exportBoardToExcel(board)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" />
              Export to Excel
            </button>
          </div>
        </div>
      </header>

      <input
        ref={restoreInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => handleRestoreFile(e.target.files?.[0])}
      />

      {/* Body: left 2/3 (me) + right 1/3 (team) */}
      <main className="mx-auto max-w-[1600px] px-4 py-5">
        <div className="flex flex-col gap-5 lg:flex-row">
          {/* My work — 2/3 */}
          <div className="min-w-0 lg:w-2/3">
            <ColumnHeader
              label="My work"
              count={countTasks(me)}
              onAddSection={() => me && addSection(me.id)}
            />
            <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {me &&
                meSections.map((section, i) => (
                  <div
                    key={section.id}
                    {...(searching ? {} : meSectionDnd.containerItem(i))}
                    className={`rounded-md transition-shadow ${
                      !searching && meSectionDnd.dragIndex === i ? "opacity-40" : ""
                    } ${!searching && meSectionDnd.overIndex === i && meSectionDnd.dragIndex !== i ? "ring-2 ring-primary/50" : ""}`}
                  >
                    <SectionCard
                      section={section}
                      hideCompleted={board.hideCompleted}
                      query={query}
                      dragHandleProps={searching ? undefined : meSectionDnd.handle(i)}
                      onAddTask={(title) => addTask(me.id, section.id, title)}
                      onToggleTask={(taskId) => toggleTask(me.id, section.id, taskId)}
                      onOpenTask={(task) => setDialogTarget({ ownerId: me.id, sectionId: section.id, taskId: task.id })}
                      onDeleteTask={(taskId) => deleteTask(me.id, section.id, taskId)}
                      onRenameSection={(title) => renameSection(me.id, section.id, title)}
                      onDeleteSection={() => deleteSection(me.id, section.id)}
                      onReorderTask={(fromId, toId) => reorderTasks(me.id, section.id, fromId, toId)}
                    />
                  </div>
                ))}
              {me && me.sections.length === 0 && <EmptyColumn onAdd={() => addSection(me.id)} />}
              {me && me.sections.length > 0 && searching && meSections.length === 0 && (
                <p className="col-span-full rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                  No matching tasks in your work.
                </p>
              )}
            </div>
          </div>

          {/* My team — 1/3 */}
          <div className="min-w-0 lg:w-1/3">
            <div className="border-b-2 border-primary pb-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide">My team</h2>
                <span className="text-[11px] text-muted-foreground">{reports.length} people</span>
                <button
                  onClick={addReport}
                  className="ml-auto inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Section
                </button>
              </div>
              <ProgressBar done={teamCount.done} total={teamCount.total} className="mt-1.5" />
            </div>
            <div className="mt-3 space-y-4">
              {reports.map((report) => (
                <ReportPanel
                  key={report.id}
                  report={report}
                  hideCompleted={board.hideCompleted}
                  query={query}
                  onAddTask={(sectionId, title) => addTask(report.id, sectionId, title)}
                  onToggleTask={(sectionId, taskId) => toggleTask(report.id, sectionId, taskId)}
                  onOpenTask={(sectionId, task) =>
                    setDialogTarget({ ownerId: report.id, sectionId, taskId: task.id })
                  }
                  onDeleteTask={(sectionId, taskId) => deleteTask(report.id, sectionId, taskId)}
                  onRenameSection={(sectionId, title) => renameSection(report.id, sectionId, title)}
                  onDeleteSection={(sectionId) => deleteSection(report.id, sectionId)}
                  onReorderTask={(sectionId, fromId, toId) => reorderTasks(report.id, sectionId, fromId, toId)}
                  onReorderSection={(from, to) => reorderSections(report.id, from, to)}
                  onRenameOwner={(name) => renameOwner(report.id, name)}
                />
              ))}
            </div>
          </div>
        </div>
      </main>

      {dialogData && dialogTarget && (
        <TaskDialog
          task={dialogData.task}
          ownerLabel={dialogData.owner.kind === "me" ? "My work" : dialogData.owner.name}
          sectionTitle={dialogData.section.title}
          owners={moveOwners}
          currentOwnerId={dialogTarget.ownerId}
          currentSectionId={dialogTarget.sectionId}
          onMove={(ownerId, sectionId) => moveTask(dialogTarget, ownerId, sectionId)}
          onDelete={() => {
            deleteTask(dialogTarget.ownerId, dialogTarget.sectionId, dialogTarget.taskId)
            setDialogTarget(null)
          }}
          onClose={() => setDialogTarget(null)}
          onChange={(patch) => patchTask(dialogTarget, patch)}
        />
      )}
    </div>
  )
}

// ---- Small helpers ----------------------------------------------------------

function formatSaved(ts: number): string {
  const d = new Date(ts)
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })
  return `${date} at ${time}`
}

function countTasks(owner?: Owner): { done: number; total: number } {
  if (!owner) return { done: 0, total: 0 }
  let done = 0
  let total = 0
  for (const s of owner.sections) {
    for (const t of s.tasks) {
      total++
      if (t.done) done++
    }
  }
  return { done, total }
}

function ColumnHeader({
  label,
  count,
  onAddSection,
}: {
  label: string
  count: { done: number; total: number }
  onAddSection: () => void
}) {
  return (
    <div className="border-b-2 border-primary pb-1.5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide">{label}</h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {count.done}/{count.total} done
        </span>
        <button
          onClick={onAddSection}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" />
          Section
        </button>
      </div>
      <ProgressBar done={count.done} total={count.total} className="mt-1.5" />
    </div>
  )
}

function ProgressBar({ done, total, className = "" }: { done: number; total: number; className?: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${done} of ${total} tasks done`}
      className={`h-1 w-full overflow-hidden rounded-full bg-secondary ${className}`}
    >
      <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  )
}

function DataMenu({ onBackup, onRestore }: { onBackup: () => void; onRestore: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
      >
        <Database className="h-3.5 w-3.5" />
        Data
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 w-60 rounded-md border border-border bg-card p-1 shadow-lg"
          >
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onBackup()
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs font-medium text-foreground hover:bg-secondary"
            >
              <Save className="h-3.5 w-3.5 text-muted-foreground" />
              Download backup (.json)
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onRestore()
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs font-medium text-foreground hover:bg-secondary"
            >
              <Upload className="h-3.5 w-3.5 text-muted-foreground" />
              Restore from backup
            </button>
            <p className="px-2.5 pb-1.5 pt-1 text-[10px] leading-snug text-muted-foreground">
              Back up regularly — clearing browser data erases your list.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function EmptyColumn({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="col-span-full rounded-md border border-dashed border-border py-8 text-sm text-muted-foreground hover:border-primary hover:text-primary"
    >
      + Add your first section
    </button>
  )
}

function ReportPanel({
  report,
  hideCompleted,
  query = "",
  onAddTask,
  onToggleTask,
  onOpenTask,
  onDeleteTask,
  onRenameSection,
  onDeleteSection,
  onReorderTask,
  onReorderSection,
  onRenameOwner,
}: {
  report: Owner
  hideCompleted: boolean
  query?: string
  onAddTask: (sectionId: string, title: string) => void
  onToggleTask: (sectionId: string, taskId: string) => void
  onOpenTask: (sectionId: string, task: Task) => void
  onDeleteTask: (sectionId: string, taskId: string) => void
  onRenameSection: (sectionId: string, title: string) => void
  onDeleteSection: (sectionId: string) => void
  onReorderTask: (sectionId: string, fromTaskId: string, toTaskId: string) => void
  onReorderSection: (from: number, to: number) => void
  onRenameOwner: (name: string) => void
}) {
  const count = countTasks(report)
  const initials = report.name.slice(0, 1).toUpperCase()
  const [name, setName] = useState(report.name)
  const sectionDnd = useListDnd(onReorderSection)

  const q = query.trim().toLowerCase()
  const searching = q.length > 0
  const sectionsToShow = searching
    ? report.sections.filter((s) => s.tasks.some((t) => taskMatchesQuery(t, q)))
    : report.sections

  return (
    <div className="rounded-md border border-border bg-secondary/40 p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {initials}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim()
            if (trimmed && trimmed !== report.name) onRenameOwner(trimmed)
            else setName(report.name)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          }}
          aria-label="Report name"
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-foreground outline-none focus:border-b focus:border-primary"
        />
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {count.done}/{count.total}
        </span>
      </div>
      <ProgressBar done={count.done} total={count.total} className="mb-2.5" />
      <div className="space-y-2.5">
        {sectionsToShow.map((section, i) => (
          <div
            key={section.id}
            {...(searching ? {} : sectionDnd.containerItem(i))}
            className={`rounded-md ${!searching && sectionDnd.dragIndex === i ? "opacity-40" : ""} ${
              !searching && sectionDnd.overIndex === i && sectionDnd.dragIndex !== i ? "ring-2 ring-primary/50" : ""
            }`}
          >
            <SectionCard
              section={section}
              hideCompleted={hideCompleted}
              query={query}
              compact
              dragHandleProps={searching ? undefined : sectionDnd.handle(i)}
              onAddTask={(title) => onAddTask(section.id, title)}
              onToggleTask={(taskId) => onToggleTask(section.id, taskId)}
              onOpenTask={(task) => onOpenTask(section.id, task)}
              onDeleteTask={(taskId) => onDeleteTask(section.id, taskId)}
              onRenameSection={(title) => onRenameSection(section.id, title)}
              onDeleteSection={() => onDeleteSection(section.id)}
              onReorderTask={(fromId, toId) => onReorderTask(section.id, fromId, toId)}
            />
          </div>
        ))}
        {searching && sectionsToShow.length === 0 && (
          <p className="px-1 py-1 text-[11px] text-muted-foreground">No matching tasks.</p>
        )}
      </div>
    </div>
  )
}
