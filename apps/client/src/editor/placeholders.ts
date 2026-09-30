import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const EditorPlaceholders = Extension.create({
  name: 'editorPlaceholders',
  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        decorations: state => {
          const decorations: Decoration[] = [];
          state.doc.descendants((node, pos, parent) => {
            if (node.content.size || !['paragraph', 'detailsSummary'].includes(node.type.name)) return;
            const text = node.type.name === 'detailsSummary' ? 'トグルの見出し'
              : parent?.type.name === 'detailsContent' ? 'ここに内容を入力'
              : '「/」でブロックを追加';
            decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'is-empty', 'data-placeholder': text }));
          });
          return DecorationSet.create(state.doc, decorations);
        },
      },
    })];
  },
});
