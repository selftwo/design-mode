import { describe, expect, it } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import { saveBoard, STORAGE_KEY } from './board-local-storage'
import { loadBoardFromHostStorage } from './load-board-from-host-storage'

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

describe('loadBoardFromHostStorage', () => {
  it('uses a valid restored board as both document and last saved baseline', () => {
    const hostBoard = createPressureTestBoard()
    const storage = createMemoryStorage()
    const persisted = {
      ...hostBoard,
      camera: { worldX: 12, worldY: 34, zoom: 1.1 },
    }
    saveBoard(persisted, storage)
    const loaded = loadBoardFromHostStorage(hostBoard, storage)
    expect(loaded.document).toEqual(persisted)
    expect(loaded.lastSaved).toEqual(persisted)
  })

  it('falls back to the host board and keeps an invalid stored payload recoverable', () => {
    const hostBoard = createPressureTestBoard()
    const storage = createMemoryStorage()
    storage.setItem(STORAGE_KEY, '{"schemaVersion":2}')
    const loaded = loadBoardFromHostStorage(hostBoard, storage)
    expect(loaded.document).toEqual(hostBoard)
    expect(loaded.lastSaved).toEqual(hostBoard)
    // The payload stays in place so a failed parse never destroys local edits.
    expect(storage.getItem(STORAGE_KEY)).toBe('{"schemaVersion":2}')
  })

  it('falls back to the host board and keeps an unparseable stored payload', () => {
    const hostBoard = createPressureTestBoard()
    const storage = createMemoryStorage()
    storage.setItem(STORAGE_KEY, '{invalid')

    expect(loadBoardFromHostStorage(hostBoard, storage)).toEqual({
      document: hostBoard,
      lastSaved: hostBoard,
    })
    expect(storage.getItem(STORAGE_KEY)).toBe('{invalid')
  })

  it('ignores stored overrides for a different board id', () => {
    const hostBoard = createPressureTestBoard()
    const storage = createMemoryStorage()
    saveBoard({ ...hostBoard, boardId: 'other-board' }, storage)
    const loaded = loadBoardFromHostStorage(hostBoard, storage)
    expect(loaded.document).toEqual(hostBoard)
    expect(loaded.lastSaved).toEqual(hostBoard)
  })
})