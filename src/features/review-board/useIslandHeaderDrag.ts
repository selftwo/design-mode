import { useCallback, type RefObject } from 'react'

const DRAG_THRESHOLD_PX = 3

export function useIslandHeaderDrag(
  islandRef: RefObject<HTMLElement | null>,
  placeAt: (left: number, top: number) => void,
  setDragging: (dragging: boolean) => void,
) {
  return useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if ((event.target as Element).closest('button, a, input, textarea, select')) return
      const island = islandRef.current
      if (!island) return
      event.preventDefault()
      const header = event.currentTarget
      const pointerId = event.pointerId
      const start = island.getBoundingClientRect()
      const startX = event.clientX
      const startY = event.clientY
      let moved = false

      const handleMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
        if (!moved) {
          moved = true
          setDragging(true)
        }
        placeAt(start.left + dx, start.top + dy)
      }

      const handleUp = (upEvent: PointerEvent) => {
        setDragging(false)
        moved = false
        header.removeEventListener('pointermove', handleMove)
        if (header.hasPointerCapture(upEvent.pointerId)) {
          header.releasePointerCapture(upEvent.pointerId)
        }
      }

      header.setPointerCapture(pointerId)
      header.addEventListener('pointermove', handleMove)
      header.addEventListener('pointerup', handleUp, { once: true })
      header.addEventListener('pointercancel', handleUp, { once: true })
    },
    [islandRef, placeAt, setDragging],
  )
}
