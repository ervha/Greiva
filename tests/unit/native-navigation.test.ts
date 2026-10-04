import { describe, it, expect } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection, NodeSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { commitNativeNavigationSelection } from '../../apps/client/src/editor/native-navigation.js';

const schema = new Schema({ nodes: { doc: { content: 'block+' }, paragraph: { content: 'text*', group: 'block' }, text: {} } });
function fixture(anchor = 1, head = anchor) {
  const doc = schema.node('doc', null, [schema.node('paragraph', null, schema.text('prefix text'))]);
  const node = {}, native = { anchorNode: node, focusNode: node, anchorOffset: anchor, focusOffset: head };
  let state = EditorState.create({ doc, selection: TextSelection.create(doc, 4) });
  const transactions: { selectionSet: boolean; docChanged: boolean }[] = [];
  const view = { composing: false, hasFocus: () => true,
    dom: { contains: (value: unknown) => value === node, ownerDocument: { getSelection: () => native } },
    posAtDOM: (_node: unknown, offset: number) => offset,
    get state() { return state; },
    dispatch: (tr: Parameters<EditorState['apply']>[0]) => { transactions.push(tr); state = state.apply(tr); },
  };
  const run = (event: Partial<KeyboardEvent> = {}) => commitNativeNavigationSelection(view as unknown as EditorView, { key: 'Home', isComposing: false, keyCode: 36, ...event } as KeyboardEvent);
  return { view, native, transactions, run, state: () => state, setState: (next: EditorState) => { state = next; } };
}

describe('native navigation before delayed selectionchange', () => {
  it('commits the native caret before another document transaction maps the stale caret', () => {
    const f = fixture(); expect(f.run()).toBe(false);
    expect(f.state().selection.from).toBe(1);
    expect(f.transactions).toHaveLength(1); expect(f.transactions[0]!.docChanged).toBe(false);
    const remote = f.state().tr.insertText('R ', 1); f.setState(f.state().apply(remote));
    expect(f.state().selection.from).toBe(3);
  });
  it('preserves backward selection and does not dispatch the same selection twice', () => {
    const f = fixture(8, 5); f.run({ key: 'ArrowLeft', shiftKey: true });
    expect(f.state().selection.anchor).toBe(8); expect(f.state().selection.head).toBe(5);
    f.run({ key: 'ArrowLeft' }); expect(f.transactions).toHaveLength(1);
  });
  it('leaves composing views, composing events and IME keycode 229 untouched', () => {
    const f = fixture(); f.view.composing = true; f.run(); f.view.composing = false;
    f.run({ isComposing: true }); f.run({ keyCode: 229 }); expect(f.transactions).toHaveLength(0);
  });
  it('does not normalize ordinary typing, a blurred view, or an outside selection', () => {
    const f = fixture(); f.run({ key: 'a', keyCode: 65 }); f.view.hasFocus = () => false; f.run();
    f.view.hasFocus = () => true; f.native.anchorNode = {}; f.run(); expect(f.transactions).toHaveLength(0);
  });
  it('leaves node selections, invalid positions and detached DOM nodes to the binding', () => {
    const f = fixture(); f.setState(f.state().apply(f.state().tr.setSelection(NodeSelection.create(f.state().doc, 0))));
    f.run(); expect(f.transactions).toHaveLength(0);
    const invalid = fixture(100); invalid.run(); expect(invalid.transactions).toHaveLength(0);
    const detached = fixture(); detached.view.posAtDOM = () => { throw Error('Detached selection'); };
    detached.run(); expect(detached.transactions).toHaveLength(0);
  });
});
