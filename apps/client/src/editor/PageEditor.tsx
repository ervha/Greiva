import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { adjacentBlockMove } from './blocks';
import { blockCommands, editorExtensions } from './extensions';
import * as Y from 'yjs';
import type { PageSession } from './page-session';
import type { EditorProps } from '@tiptap/pm/view';

const pageEditorProps: EditorProps = {
  attributes: { role: 'textbox', 'aria-label': 'Page本文', 'aria-multiline': 'true', spellcheck: 'false' },
  handleDOMEvents: { keydown: (view, event) => event.isComposing || view.composing || event.keyCode === 229 },
};

export function PageEditor({ session, title, storageError }: { session: PageSession; title: string; storageError: string | null }) {
  // Save/ACK indicators rerender the parent frequently. Stable extension and
  // NodeView identities keep those status changes from disturbing DOM selection.
  const extensions = useMemo(() => editorExtensions(session.document), [session.document]);
  const editor = useEditor({
    extensions, editorProps: pageEditorProps,
  }, [session.document]);
  useEffect(() => { if (editor && editor.isEditable === Boolean(storageError)) editor.setEditable(!storageError, false); }, [editor, storageError]);
  useEffect(() => {
    // Read-only test diagnostics. Absent from normal dev and production builds.
    if (!editor || import.meta.env.VITE_GREIVA_TEST_HOOKS !== '1') return;
    const target = window as unknown as { greivaTest?: { snapshot: () => unknown } };
    target.greivaTest = { snapshot: () => ({
      pageId: session.pageId, clientId: session.clientId,
      stateVector: Array.from(Y.encodeStateVector(session.document)),
      clocks: Array.from(Y.decodeStateVector(Y.encodeStateVector(session.document))).sort(([a], [b]) => a - b),
      json: editor.getJSON(), fragment: session.document.getXmlFragment('body').toJSON(),
      selection: { from: editor.state.selection.from, to: editor.state.selection.to,
        parent: editor.state.selection.$from.parent.textContent,
        offset: editor.state.selection.$from.parentOffset, size: editor.state.selection.$from.parent.content.size },
      pending: session.provider.unsyncedChanges,
    }) };
    return () => { delete target.greivaTest; };
  }, [editor, session]);
  const state = useEditorState({ editor, selector: ({ editor: e }) => ({
    undo: e?.can().undo() ?? false, redo: e?.can().redo() ?? false,
    details: e?.isActive('details') ?? false,
    listItem: e?.isActive('taskItem') ? 'taskItem' : e?.isActive('listItem') ? 'listItem' : null,
    up: e ? Boolean(adjacentBlockMove(e.state, -1)) : false,
    down: e ? Boolean(adjacentBlockMove(e.state, 1)) : false,
  }) });
  if (!editor) return <p>Editorを準備しています…</p>;
  const move = (direction: -1 | 1) => {
    if (editor.view.composing) return;
    const tr = adjacentBlockMove(editor.state, direction);
    if (tr) { editor.view.dispatch(tr); editor.view.focus(); }
  };
  return <section className="editor-panel" aria-label="Page Editor">
    <input className="page-title" aria-label="Pageタイトル" placeholder="無題のPage" value={title} disabled={Boolean(storageError)} onChange={e => session.setTitle(e.target.value)} />
    <div className="editor-toolbar" role="toolbar" aria-label="編集操作">
      <button type="button" disabled={!state?.undo} onClick={() => editor.chain().focus().undo().run()}>元に戻す</button>
      <button type="button" disabled={!state?.redo} onClick={() => editor.chain().focus().redo().run()}>やり直す</button>
      <details className="block-picker"><summary>ブロックを挿入</summary><div role="group" aria-label="ブロック種別">
        {blockCommands.map(item => <button type="button" key={item.id} onClick={e => {
          if (!editor.view.composing) item.run(editor.chain().focus().clearNodes()).run();
          e.currentTarget.closest('details')?.removeAttribute('open');
        }}>{item.label}</button>)}
      </div></details>
      <button type="button" disabled={!state?.up} onClick={() => move(-1)}>上へ移動</button>
      <button type="button" disabled={!state?.down} onClick={() => move(1)}>下へ移動</button>
      <button type="button" disabled={!state?.listItem} onClick={() => state?.listItem && editor.chain().focus().sinkListItem(state.listItem).run()}>インデント</button>
      <button type="button" disabled={!state?.listItem} onClick={() => state?.listItem && editor.chain().focus().liftListItem(state.listItem).run()}>インデント解除</button>
      {state?.details && <button type="button" onClick={() => editor.chain().focus().unsetDetails().run()}>Toggleを解除</button>}
    </div>
    <p className="editor-hint">行頭の <kbd>/</kbd> でブロック追加、<kbd>@</kbd> でMention。トグルは <kbd>Enter</kbd> で本文へ、<kbd>Ctrl+Enter</kbd> で開閉。</p>
    <EditorContent editor={editor} />
  </section>;
}
