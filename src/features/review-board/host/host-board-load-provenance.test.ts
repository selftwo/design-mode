import { describe, expect, it } from 'vitest'
import {
  isTrustedHostBoardLoadMessage,
  resolveWindowBoardHostBinding,
} from './host-board-load-provenance'

function fakeWindow(overrides: Partial<Window> & { location: Location }): Window {
  return {
    parent: null,
    opener: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    postMessage: () => {},
    ...overrides,
  } as Window
}

describe('host board load provenance', () => {
  it('defaults allowed load origins to the canvas window origin', () => {
    const hostWindow = fakeWindow({
      location: { origin: 'http://canvas.test' } as Location,
    })
    expect(resolveWindowBoardHostBinding(hostWindow)).toEqual({
      allowedLoadOrigins: ['http://canvas.test'],
      requestBoardOrigins: ['http://canvas.test'],
    })
  })

  it('derives explicit parent or opener request origins from configured load origins', () => {
    const hostWindow = fakeWindow({
      location: { origin: 'http://canvas.test' } as Location,
    })
    expect(
      resolveWindowBoardHostBinding(hostWindow, ['http://canvas.test', 'http://host.test']),
    ).toEqual({
      allowedLoadOrigins: ['http://canvas.test', 'http://host.test'],
      requestBoardOrigins: ['http://canvas.test', 'http://host.test'],
    })
  })

  it('accepts same-window, parent, and opener sources only from allowed origins', () => {
    const parent = {} as Window
    const opener = {} as Window
    const hostWindow = fakeWindow({
      location: { origin: 'http://canvas.test' } as Location,
    })
    Object.assign(hostWindow, { parent, opener })
    const allowed = ['http://canvas.test', 'http://host.test']

    expect(
      isTrustedHostBoardLoadMessage({ source: hostWindow, origin: 'http://canvas.test' }, hostWindow, allowed),
    ).toBe(true)
    expect(
      isTrustedHostBoardLoadMessage({ source: parent, origin: 'http://host.test' }, hostWindow, allowed),
    ).toBe(true)
    expect(
      isTrustedHostBoardLoadMessage({ source: opener, origin: 'http://host.test' }, hostWindow, allowed),
    ).toBe(true)
  })

  it('ignores a valid envelope when origin or source does not match the binding', () => {
    const hostWindow = fakeWindow({
      location: { origin: 'http://canvas.test' } as Location,
    })
    const stranger = {} as Window
    const allowed = ['http://canvas.test']

    expect(
      isTrustedHostBoardLoadMessage({ source: stranger, origin: 'http://canvas.test' }, hostWindow, allowed),
    ).toBe(false)
    expect(
      isTrustedHostBoardLoadMessage({ source: hostWindow, origin: 'http://evil.test' }, hostWindow, allowed),
    ).toBe(false)
    expect(
      isTrustedHostBoardLoadMessage({ source: null, origin: 'http://canvas.test' }, hostWindow, allowed),
    ).toBe(false)
  })
})