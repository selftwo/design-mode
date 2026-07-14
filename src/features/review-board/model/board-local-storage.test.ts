import { describe, expect, it, vi } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import {
  clearStoredBoard,
  deserializeBoard,
  restoreBoard,
  saveBoard,
  serializeBoard,
  STORAGE_KEY,
} from './board-local-storage'

function createMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear() {
      data.clear()
    },
    getItem(key: string) {
      return data.get(key) ?? null
    },
    key(index: number) {
      return [...data.keys()][index] ?? null
    },
    removeItem(key: string) {
      data.delete(key)
    },
    setItem(key: string, value: string) {
      data.set(key, value)
    },
  }
}

describe('board-local-storage', () => {
  it('validates before writing and does not call setItem when parsing fails', () => {
    const board = createPressureTestBoard()
    const invalid = {
      ...board,
      annotations: [{ ...board.annotations[0]!, anchor: [2, 0.5] }],
    }
    const storage = createMemoryStorage()
    const setItem = vi.spyOn(storage, 'setItem')
    expect(() => saveBoard(invalid as typeof board, storage)).toThrow()
    expect(setItem).not.toHaveBeenCalled()
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('round trips frame geometry, camera, annotations, and capture identity', () => {
    const board = createPressureTestBoard()
    const storage = createMemoryStorage()
    saveBoard(board, storage)
    const restored = restoreBoard(createPressureTestBoard(), storage)
    expect(restored.camera).toEqual(board.camera)
    expect(restored.frames).toEqual(board.frames)
    expect(restored.annotations).toEqual(board.annotations)
    expect(restored.frames[0]?.captureHash).toBe(board.frames[0]?.captureHash)
    expect(restored.annotations[0]?.madeAgainstCaptureHash).toBe(board.annotations[0]?.madeAgainstCaptureHash)
    expect(restored.annotations[0]?.madeAgainstRevision).toBe(board.annotations[0]?.madeAgainstRevision)
  })

  it('propagates write failures without mutating stored data', () => {
    const board = createPressureTestBoard()
    const storage = createMemoryStorage()
    saveBoard(board, storage)
    const before = storage.getItem(STORAGE_KEY)
    const failing: Pick<Storage, 'setItem'> = {
      setItem() {
        throw new Error('quota exceeded')
      },
    }
    expect(() => saveBoard({ ...board, camera: { ...board.camera, zoom: 0.8 } }, failing)).toThrow('quota exceeded')
    expect(storage.getItem(STORAGE_KEY)).toBe(before)
    expect(deserializeBoard(storage.getItem(STORAGE_KEY)!)).not.toEqual({ ...board, camera: { ...board.camera, zoom: 0.8 } })
  })

  it('clears the persisted override', () => {
    const storage = createMemoryStorage()
    saveBoard(createPressureTestBoard(), storage)
    clearStoredBoard(storage)
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('rejects invalid serialized data on restore', () => {
    const storage = createMemoryStorage()
    storage.setItem(STORAGE_KEY, '{"schemaVersion":2}')
    const fallback = createPressureTestBoard()
    expect(() => restoreBoard(fallback, storage)).toThrow()
  })

  it('serializes through the schema boundary', () => {
    const board = createPressureTestBoard()
    expect(() => deserializeBoard(serializeBoard(board))).not.toThrow()
  })
})