"use client"

import { useEffect, useRef, useState } from "react"
import { X, ImageIcon, Loader2, Sparkles, AlertTriangle } from "lucide-react"
import type { MoveOwner } from "./task-dialog"

type Stage = "pick" | "loading" | "review" | "error"

export function ImageImportDialog({
  owners,
  initialFile,
  onImport,
  onClose,
}: {
  owners: MoveOwner[]
  initialFile?: File | null
  onImport: (ownerId: string, sectionId: string, titles: string[]) => void
  onClose: () => void
}) {
  const [stage, setStage] = useState<Stage>("pick")
  const [errorMsg, setErrorMsg] = useState("")
  const [preview, setPreview] = useState<string | null>(null)
  const [tasks, setTasks] = useState<{ text: string; keep: boolean }[]>([])
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "")
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const destOwner = owners.find((o) => o.id === ownerId)
  const [sectionId, setSectionId] = useState(destOwner?.sections[0]?.id ?? "")

  // Keep the section selection valid when the owner changes.
  useEffect(() => {
    const o = owners.find((x) => x.id === ownerId)
    if (o && !o.sections.some((s) => s.id === sectionId)) {
      setSectionId(o.sections[0]?.id ?? "")
    }
  }, [ownerId, owners, sectionId])

  // If opened by dragging a file onto the page, process it immediately.
  useEffect(() => {
    if (initialFile) void processFile(initialFile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error("Could not read the file."))
      reader.readAsDataURL(file)
    })
  }

  async function processFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("That doesn't look like an image. Please choose a photo or screenshot.")
      setStage("error")
      return
    }
    try {
      const dataUrl = await readAsDataUrl(file)
      setPreview(dataUrl)
      setStage("loading")
      const res = await fetch("/api/extract-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Extraction failed.")
      const found: string[] = data.tasks ?? []
      if (found.length === 0) {
        setErrorMsg("No tasks were found in that image. Try a clearer photo.")
        setStage("error")
        return
      }
      setTasks(found.map((text) => ({ text, keep: true })))
      setStage("review")
    } catch (err) {
      setErrorMsg((err as Error)?.message || "Something went wrong.")
      setStage("error")
    }
  }

  const keptCount = tasks.filter((t) => t.keep && t.text.trim()).length

  function handleImport() {
    const titles = tasks.filter((t) => t.keep && t.text.trim()).map((t) => t.text.trim())
    if (titles.length === 0 || !ownerId || !sectionId) return
    onImport(ownerId, sectionId, titles)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="mt-4 w-full max-w-lg rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold">Import tasks from an image</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {stage === "pick" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void processFile(f)
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) void processFile(f)
                }}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors ${
                  dragOver ? "border-primary bg-accent" : "border-input bg-background hover:bg-secondary"
                }`}
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Drop an image here, or click to choose</span>
                <span className="text-xs text-muted-foreground">
                  A photo of handwritten notes or a screenshot. Tasks are read out automatically.
                </span>
              </button>
            </>
          )}

          {stage === "loading" && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview || "/placeholder.svg"} alt="Uploaded notes" className="max-h-32 rounded border border-border" />
              )}
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Reading your notes…</p>
              <p className="text-xs text-muted-foreground">Extracting tasks from the image.</p>
            </div>
          )}

          {stage === "error" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle className="h-7 w-7 text-primary" />
              <p className="text-sm text-foreground">{errorMsg}</p>
              <button
                onClick={() => {
                  setErrorMsg("")
                  setPreview(null)
                  setStage("pick")
                }}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
              >
                Try another image
              </button>
            </div>
          )}

          {stage === "review" && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Found {tasks.length} {tasks.length === 1 ? "task" : "tasks"} — review before adding
                </p>
                <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                  {tasks.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={t.keep}
                        onChange={(e) =>
                          setTasks((prev) => prev.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))
                        }
                        aria-label={`Include "${t.text}"`}
                        className="h-4 w-4 shrink-0 accent-primary"
                      />
                      <input
                        value={t.text}
                        onChange={(e) =>
                          setTasks((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                        }
                        className={`min-w-0 flex-1 bg-transparent text-xs outline-none ${
                          t.keep ? "text-foreground" : "text-muted-foreground line-through"
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Add to</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    aria-label="Assign to"
                    className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.kind === "me" ? "My work" : o.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    aria-label="Section"
                    className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    {destOwner?.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {stage === "review" && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <span className="text-xs text-muted-foreground">
              {keptCount} of {tasks.length} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={keptCount === 0 || !sectionId}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add {keptCount} {keptCount === 1 ? "task" : "tasks"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
