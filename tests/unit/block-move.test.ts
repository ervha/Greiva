import { describe, expect, it } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { history, redo, undo } from '@tiptap/pm/history';
import { moveTopLevelBlock } from '../../apps/client/src/editor/blocks.js';

const schema = new Schema({ nodes: {
  doc: { content: 'block+' }, paragraph: { group: 'block', content: 'text*' },
  blockquote: { group: 'block', content: 'block+' }, text: { group: 'inline' },
} });
const paragraph = (text: string) => schema.node('paragraph', null, schema.text(text));
describe('STEP2-MOVE: structured block transactions', () => {
  it('undoes an immediate move separately from the preceding typing', () => {
    let state = EditorState.create({ schema, doc: schema.node('doc', null, [paragraph('first'), paragraph('last')]), plugins: [history()] });
    const last = state.doc.child(0).nodeSize;
    state = state.apply(state.tr.insertText('!', last + state.doc.child(1).nodeSize - 1));
    const typed = state.doc.toJSON();
    state = state.apply(moveTopLevelBlock(state, last, 0)!);
    const moved = state.doc.toJSON();
    const dispatch = (tr: Parameters<typeof state.apply>[0]) => { state = state.apply(tr); };
    expect(undo(state, dispatch)).toBe(true);
    expect(state.doc.toJSON()).toEqual(typed);
    expect(redo(state, dispatch)).toBe(true);
    expect(state.doc.toJSON()).toEqual(moved);
    expect(undo(state, dispatch)).toBe(true);
    expect(undo(state, dispatch)).toBe(true);
    expect(state.doc.child(1).textContent).toBe('last');
  });
  it('retains a nested subtree and supports history undo', () => {
    const nested = schema.node('blockquote', null, [paragraph('child 1'), paragraph('child 2')]);
    let state = EditorState.create({ schema, doc: schema.node('doc', null, [paragraph('first'), nested, paragraph('last')]), plugins: [history()] });
    const original = state.doc.toJSON();
    const from = state.doc.child(0).nodeSize;
    const tr = moveTopLevelBlock(state, from, state.doc.content.size)!;
    state = state.apply(tr);
    expect(state.doc.lastChild?.toJSON()).toEqual(nested.toJSON());
    expect(state.doc.child(0).textContent).toBe('first');
    expect(state.doc.child(1).textContent).toBe('last');
    expect(undo(state, undoTr => { state = state.apply(undoTr); })).toBe(true);
    expect(state.doc.toJSON()).toEqual(original);
  });
  it('rejects offsets inside a block and self-drops without changing the document', () => {
    const state = EditorState.create({ schema, doc: schema.node('doc', null, [paragraph('first'), paragraph('last')]) });
    expect(moveTopLevelBlock(state, 1, state.doc.content.size)).toBeNull();
    expect(moveTopLevelBlock(state, 0, 2)).toBeNull();
    expect(moveTopLevelBlock(state, 0, 0)).toBeNull();
    expect(moveTopLevelBlock(state, 0, state.doc.child(0).nodeSize)).toBeNull();
  });
  it('moves upwards and leaves the selection inside the moved block', () => {
    const doc = schema.node('doc', null, [paragraph('first'), paragraph('last')]);
    const state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, doc.child(0).nodeSize + 1) });
    const result = state.apply(moveTopLevelBlock(state, doc.child(0).nodeSize, 0)!);
    expect(result.doc.child(0).textContent).toBe('last');
    expect(result.selection.$from.parent.textContent).toBe('last');
  });
});
