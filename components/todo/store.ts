import type { Board, Owner, Section, Task } from "./types"

export const STORAGE_KEY = "bain-todo:v1"

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function newTask(title: string): Task {
  return {
    id: uid(),
    title: title.trim(),
    done: false,
    notes: "",
    attachments: [],
    createdAt: Date.now(),
    completedAt: null,
  }
}

export function newSection(title: string): Section {
  return { id: uid(), title: title.trim() || "New section", tasks: [] }
}

const REPORT_NAMES = ["Chirag", "Ewelina", "Jagoda", "Szymon"]

export function defaultBoard(): Board {
  const me: Owner = {
    id: "me",
    name: "My work",
    kind: "me",
    sections: [
      { id: uid(), title: "Priorities", tasks: [] },
      { id: uid(), title: "This week", tasks: [] },
    ],
  }

  const reports: Owner[] = REPORT_NAMES.map((name) => ({
    id: uid(),
    name,
    kind: "report" as const,
    sections: [{ id: uid(), title: "Current work", tasks: [] }],
  }))

  return { owners: [me, ...reports], hideCompleted: false }
}

// Validate + backfill any missing fields (older saves or imported files).
// Returns null if the shape is clearly not a board.
export function normalizeBoard(parsed: unknown): Board | null {
  const b = parsed as Board
  if (!b || !Array.isArray(b.owners) || b.owners.length === 0) return null
  for (const owner of b.owners) {
    if (typeof owner.id !== "string" || typeof owner.name !== "string") return null
    owner.kind = owner.kind === "me" ? "me" : "report"
    owner.sections ||= []
    for (const section of owner.sections) {
      section.tasks ||= []
      for (const task of section.tasks) {
        task.notes ||= ""
        task.attachments ||= []
        task.completedAt ??= null
        task.done = Boolean(task.done)
        task.createdAt ||= Date.now()
      }
    }
  }
  b.hideCompleted = Boolean(b.hideCompleted)
  return b
}

export function loadBoard(): Board {
  if (typeof window === "undefined") return defaultBoard()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultBoard()
    return normalizeBoard(JSON.parse(raw)) ?? defaultBoard()
  } catch {
    return defaultBoard()
  }
}

// ---- Backup (export / restore a full JSON snapshot) ----------------------
export function exportBackup(board: Board): void {
  if (typeof window === "undefined") return
  const json = JSON.stringify(board, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `to-do-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function parseBackup(text: string): Board {
  const board = normalizeBoard(JSON.parse(text))
  if (!board) throw new Error("This file doesn't look like a valid to-do backup.")
  return board
}

// ---- Search --------------------------------------------------------------
export function taskMatchesQuery(task: Task, q: string): boolean {
  if (!q) return true
  return task.title.toLowerCase().includes(q) || task.notes.toLowerCase().includes(q)
}

export function saveBoard(board: Board): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board))
  } catch (err) {
    // Most likely the storage quota was exceeded (large attachments).
    console.log("[v0] saveBoard failed:", (err as Error)?.message)
    throw err
  }
}
