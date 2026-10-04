import { describe, expect, it } from 'vitest';
import { Schema, type Node } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { adjacentBlockMove, canMoveAdjacentBlock } from '../../apps/client/src/editor/blocks.js';

const schema = new Schema({ nodes: {
  doc: { content: 'block+' }, text: { group: 'inline' },
  paragraph: { content: 'inline*', group: 'block' },
  details: { content: 'detailsSummary detailsContent', group: 'block' },
  detailsSummary: { content: 'inline*' }, detailsContent: { content: 'block+' },
} });
const paragraph = (text: string) => schema.node('paragraph', null, schema.text(text));
const toggle = (...blocks: Node[]) => schema.node('details', null, [schema.node('detailsSummary', null, schema.text('title')), schema.node('detailsContent', null, blocks)]);
function stateAt(doc: Node, text: string) {
  let position = -1;
  doc.descendants((node, pos) => { if (node.isText && node.text === text) position = pos; });
  expect(position).toBeGreaterThanOrEqual(0);
  return EditorState.create({ doc, selection: TextSelection.create(doc, position) });
}

describe('movement availability without constructing edits', () => {
  it('matches actual movement at top-level and nearest nested Toggle boundaries', () => {
    const doc = schema.node('doc', null, [paragraph('first'), toggle(paragraph('inner-first'), toggle(paragraph('nested-only')), paragraph('inner-last')), paragraph('last')]);
    for (const [text, expected] of [
      ['first', [false, true]], ['last', [true, false]],
      ['inner-first', [false, true]], ['inner-last', [true, false]],
      ['nested-only', [false, false]],
    ] as const) {
      const state = stateAt(doc, text);
      for (const [index, direction] of [-1, 1].entries()) {
        const moveDirection = direction as -1 | 1;
        expect(canMoveAdjacentBlock(state, moveDirection)).toBe(expected[index]);
        expect(Boolean(adjacentBlockMove(state, moveDirection))).toBe(expected[index]);
      }
      expect(state.doc).toBe(doc);
    }
  });

  it('does not enumerate a 1,000-block document or allocate transactions for availability', () => {
    const doc = schema.node('doc', null, Array.from({ length: 1000 }, (_, i) => paragraph(`block-${i}`)));
    const state = stateAt(doc, 'block-500');
    // Fail if this read-only check regresses to constructing edits/full-document scans.
    Object.defineProperty(state, 'tr', { get: () => { throw new Error('Availability constructed a transaction'); } });
    Object.defineProperty(doc, 'forEach', { value: () => { throw new Error('Availability enumerated every block'); } });
    expect(canMoveAdjacentBlock(state, -1)).toBe(true);
    expect(canMoveAdjacentBlock(state, 1)).toBe(true);
  });
});
