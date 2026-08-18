"use client"

import { useRef, useState } from "react"
import type React from "react"

/**
 * Lightweight native HTML5 drag-and-drop reordering for a single list.
 * Dragging is "armed" only while a dedicated grip handle is pressed, so
 * text inputs inside items stay selectable. Handlers stopPropagation so
 * nested lists (tasks inside sections) don't cross-fire.
 */
export function useListDnd(onReorder: (from: number, to: number) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [armed, setArmed] = useState<number | null>(null)
  // Ref mirrors the active drag index so handlers read it synchronously,
  // independent of React's render timing.
  const dragRef = useRef<number | null>(null)

  function reset() {
    dragRef.current = null
    setDragIndex(null)
    setOverIndex(null)
    setArmed(null)
  }

  function containerItem(index: number) {
    return {
      draggable: armed === index,
      onDragStart: (e: React.DragEvent) => {
        e.stopPropagation()
        dragRef.current = index
        setDragIndex(index)
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", String(index)) // Firefox needs data
      },
      onDragOver: (e: React.DragEvent) => {
        if (dragRef.current === null) return // a drag from a different list — ignore
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = "move"
        if (overIndex !== index) setOverIndex(index)
      },
      onDrop: (e: React.DragEvent) => {
        const from = dragRef.current
        if (from === null) return
        e.preventDefault()
        e.stopPropagation()
        if (from !== index) onReorder(from, index)
        reset()
      },
      onDragEnd: reset,
    }
  }

  function handle(index: number) {
    return {
      onMouseDown: () => setArmed(index),
      onMouseUp: () => setArmed(null),
      onTouchStart: () => setArmed(index),
      onTouchEnd: () => setArmed(null),
    }
  }

  return { containerItem, handle, dragIndex, overIndex }
}
