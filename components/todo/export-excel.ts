import * as XLSX from "xlsx"
import type { Board } from "./types"
import { htmlToPlainText } from "./rich-text"

function formatDate(ms: number | null): string {
  if (!ms) return ""
  const d = new Date(ms)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

type Row = {
  Owner: string
  Section: string
  Task: string
  Status: string
  Notes: string
  Attachments: string
  Created: string
  Completed: string
}

export function exportBoardToExcel(board: Board): void {
  const rows: Row[] = []

  for (const owner of board.owners) {
    for (const section of owner.sections) {
      for (const task of section.tasks) {
        rows.push({
          Owner: owner.kind === "me" ? "Me" : owner.name,
          Section: section.title,
          Task: task.title,
          Status: task.done ? "Done" : "Open",
          Notes: htmlToPlainText(task.notes),
          Attachments: task.attachments.map((a) => a.name).join(", "),
          Created: formatDate(task.createdAt),
          Completed: formatDate(task.completedAt),
        })
      }
    }
  }

  if (rows.length === 0) {
    rows.push({
      Owner: "",
      Section: "",
      Task: "(No tasks yet)",
      Status: "",
      Notes: "",
      Attachments: "",
      Created: "",
      Completed: "",
    })
  }

  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet["!cols"] = [
    { wch: 12 }, // Owner
    { wch: 20 }, // Section
    { wch: 46 }, // Task
    { wch: 8 }, // Status
    { wch: 50 }, // Notes
    { wch: 30 }, // Attachments
    { wch: 12 }, // Created
    { wch: 12 }, // Completed
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "To-Do")

  const today = formatDate(Date.now())
  XLSX.writeFile(workbook, `to-do-${today}.xlsx`)
}
