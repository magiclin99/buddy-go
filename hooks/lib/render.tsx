import type { Elements, RenderElement } from 'claude-code'

import type { Row, Span } from './frame'

type Table = Pick<Elements['terminal'], 'Box' | 'Text'> | Pick<Elements['desktop'], 'Box' | 'Text'>

const textProps = (span: Span) => {
  const props: Record<string, unknown> = {}

  if (span.color !== undefined) {
    props.color = span.color
  }

  if (span.backgroundColor !== undefined) {
    props.backgroundColor = span.backgroundColor
  }

  if (span.dimColor) {
    props.dimColor = true
  }

  return props
}

// The one place frame data becomes elements: every animation draws through it.
export const renderRows = ({ Box, Text }: Table, rows: readonly Row[]) =>
  // `h` is typed for any node; a Box with children is always an element.
  h(
    Box,
    { flexDirection: 'column' },
    ...rows.map(row =>
      h(
        Box,
        { height: 1, marginLeft: row.indent },
        ...(row.spans.length === 0
          ? [h(Text, null, ' ')]
          : row.spans.map(span => {
              const text = h(Text, textProps(span), span.text)

              return span.gap === undefined ? text : h(Box, { marginLeft: span.gap }, text)
            })),
      ),
    ),
  ) as RenderElement
