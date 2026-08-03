import type { FrameElement, ScreenFrame } from './model/board-document.schema'
import { deriveElementAspects } from './derive-element-aspects'

function flexGlyph(direction: string): string {
  if (direction.includes('column')) return '↓'
  if (direction.includes('row-reverse')) return '←'
  if (direction.includes('column-reverse')) return '↑'
  return '→'
}

function alignIndex(align: string | undefined): number {
  const value = (align ?? 'start').toLowerCase()
  if (value.includes('end') && value.includes('center')) return 8
  if (value.includes('end')) return 6
  if (value.includes('center')) return 4
  if (value.includes('stretch')) return 7
  return 0
}

export function ElementAspectsPanel({
  element,
  frame,
}: {
  element: FrameElement
  frame: ScreenFrame
}) {
  const aspects = deriveElementAspects(element, frame.viewport)
  const frameLabel = `${frame.label} · ${frame.route || '/'} · ${frame.viewport.width}`

  return (
    <div className="layers-aspects-scroll" data-testid="element-aspects-panel">
      <div className="dm-arow">
        <span className="dm-alabel">Label</span>
        <span className="dm-aval">{element.label}</span>
      </div>
      <div className="dm-arow">
        <span className="dm-alabel">Frame</span>
        <span className="dm-aval">{frameLabel}</span>
      </div>

      <div className="dm-insp-sect dm-insp-sect--first">Layout</div>
      <div className="dm-well-grid">
        <div className="dm-well"><span className="dm-well-l">x</span><span className="dm-well-v">{aspects.layout.x}</span></div>
        <div className="dm-well"><span className="dm-well-l">y</span><span className="dm-well-v">{aspects.layout.y}</span></div>
        <div className="dm-well"><span className="dm-well-l">w</span><span className="dm-well-v">{aspects.layout.width}</span></div>
        <div className="dm-well"><span className="dm-well-l">h</span><span className="dm-well-v">{aspects.layout.height}</span></div>
      </div>
      <div className="dm-well-solo">
        <div className="dm-well">
          <span className="dm-well-l">rotation</span>
          <span className="dm-well-v">{aspects.layout.rotation}°</span>
        </div>
      </div>

      {aspects.flex ? (
        <>
          <div className="dm-insp-sect">Flex</div>
          <div className="dm-flex-dir">
            <span className="dm-flex-glyph" aria-hidden="true">{flexGlyph(aspects.flex.direction)}</span>
            {aspects.flex.direction}
          </div>
          <div className="dm-well-grid">
            <div className="dm-well"><span className="dm-well-l">gap</span><span className="dm-well-v">{aspects.flex.gap}</span></div>
            <div className="dm-well"><span className="dm-well-l">padding</span><span className="dm-well-v">{aspects.flex.padding}</span></div>
          </div>
          <div
            className="dm-align-picker"
            role="img"
            aria-label={`Alignment: ${aspects.flex.align ?? 'start'}`}
          >
            {Array.from({ length: 9 }, (_, index) => (
              <span
                key={index}
                className="dm-align-dot"
                data-active={index === alignIndex(aspects.flex?.align) ? 'true' : undefined}
              />
            ))}
          </div>
        </>
      ) : null}

      {aspects.radius ? (
        <>
          <div className="dm-insp-sect">Radius</div>
          <div className="dm-well-solo">
            <div className="dm-well">
              <span className="dm-well-l">radius</span>
              <span className="dm-well-v">{aspects.radius}</span>
            </div>
          </div>
        </>
      ) : null}

      {aspects.fills.length > 0 ? (
        <>
          <div className="dm-insp-sect">Fill</div>
          {aspects.fills.map((fill) => (
            <div key={`${fill.name}-${fill.value}`} className="dm-swatch-row">
              <span className="dm-swatch" style={{ background: fill.value }} />
              <span className="dm-swatch-name">{fill.name}</span>
              <span className="dm-swatch-val">{fill.value}</span>
            </div>
          ))}
        </>
      ) : null}

      {aspects.border ? (
        <>
          <div className="dm-insp-sect">Border</div>
          <div className="dm-well-solo">
            <div className="dm-well">
              <span className="dm-well-l">width</span>
              <span className="dm-well-v">{aspects.border.width}</span>
            </div>
          </div>
          <div className="dm-swatch-row">
            <span className="dm-swatch" style={{ background: aspects.border.color.value }} />
            <span className="dm-swatch-name">{aspects.border.color.name}</span>
            <span className="dm-swatch-val">{aspects.border.color.value}</span>
          </div>
        </>
      ) : null}

      {aspects.type ? (
        <>
          <div className="dm-insp-sect">Type</div>
          <div className="dm-type-rows">
            <div className="dm-type-row">
              <span className="dm-tlabel">size / leading</span>
              <span className="dm-tval">{aspects.type.sizeLeading}</span>
            </div>
            <div className="dm-type-row">
              <span className="dm-tlabel">family</span>
              <span className="dm-tval">{aspects.type.family}</span>
            </div>
            <div className="dm-type-row">
              <span className="dm-tlabel">weight</span>
              <span className="dm-tval">{aspects.type.weight}</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
