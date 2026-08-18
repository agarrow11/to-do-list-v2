export type Attachment = {
  id: string
  name: string
  type: string
  size: number
  dataUrl: string
}

export type Task = {
  id: string
  title: string
  done: boolean
  notes: string
  attachments: Attachment[]
  createdAt: number
  completedAt: number | null
}

export type Section = {
  id: string
  title: string
  tasks: Task[]
}

export type OwnerKind = "me" | "report"

export type Owner = {
  id: string
  name: string
  kind: OwnerKind
  sections: Section[]
}

export type Board = {
  owners: Owner[]
  hideCompleted: boolean
}
