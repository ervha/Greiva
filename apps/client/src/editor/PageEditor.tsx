import { useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { adjacentBlockMove } from './blocks';
import { blockCommands, editorExtensions } from './extensions';

export function PageEditor() {
  const [title, setTitle] = useState('');
  const editor = useEditor({
    extensions: editorExtensions(), content: '<p></p>',
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': 'Page本文', 'aria-multiline': 'true', spellcheck: 'false' },
      // Skip ProseMirror keymaps while leaving native IME handling uncancelled.
      handleDOMEvents: { keydown: (view, event) => event.isComposing || view.composing || event.keyCode === 229 },
    },
  });
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
    <input className="page-title" aria-label="Pageタイトル" placeholder="無題のPage" value={title} onChange={e => setTitle(e.target.value)} />
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
