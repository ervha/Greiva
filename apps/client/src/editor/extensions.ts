import { Extension, type ChainedCommands } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import Mention from '@tiptap/extension-mention';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { BlockDrag } from './block-drag';
import { suggestionMenu, type MenuItem } from './suggestion-menu';
import { RefinedDetails } from './details-ux';
import { EditorPlaceholders } from './placeholders';
import Collaboration from '@tiptap/extension-collaboration';
import type { Doc } from 'yjs';
import { CollaborationHistory } from './collaboration-history';

type BlockCommand = MenuItem & { run: (chain: ChainedCommands) => ChainedCommands };
export const blockCommands: BlockCommand[] = [
  { id: 'paragraph', label: '本文', description: '自由に書けるテキスト', icon: 'T', group: 'テキスト', keywords: 'text テキスト', run: c => c.setParagraph() },
  ...([1, 2, 3] as const).map(level => ({ id: `heading${level}`, label: `見出し${level}`, description: ({ 1: '大きな見出し', 2: '中くらいの見出し', 3: '小さな見出し' })[level], icon: `H${level}`, group: 'テキスト', keywords: `h${level} 見出し`, run: (c: ChainedCommands) => c.setHeading({ level }) })),
  { id: 'bullet', label: '箇条書き', description: '順序のないリスト', icon: '•', group: 'リスト', keywords: 'list リスト', run: c => c.toggleBulletList() },
  { id: 'ordered', label: '番号付きリスト', description: '順番のあるリスト', icon: '1.', group: 'リスト', keywords: 'number 数字', run: c => c.toggleOrderedList() },
  { id: 'todo', label: 'Todo', description: 'チェックできるリスト', icon: '✓', group: 'リスト', keywords: 'task タスク チェック', run: c => c.toggleTaskList() },
  { id: 'quote', label: '引用', description: '引用文を際立たせる', icon: '❝', group: '構造', run: c => c.setBlockquote() },
  { id: 'code', label: 'コード', description: '等幅フォントのコードブロック', icon: '</>', group: '構造', keywords: 'コード', run: c => c.setCodeBlock() },
  { id: 'divider', label: '区切り線', description: '内容を線で区切る', icon: '—', group: '構造', keywords: 'hr 線', run: c => c.setHorizontalRule() },
  { id: 'toggle', label: 'Toggle', description: '見出しの下に内容を折りたたむ', icon: '›', group: '構造', keywords: 'トグル 折りたたみ', run: c => c.setDetails().updateAttributes('details', { open: true }) },
];
const slashKey = new PluginKey('greivaSlash');
const mentionKey = new PluginKey('greivaMention');
const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [Suggestion<BlockCommand>({
      editor: this.editor, pluginKey: slashKey, char: '/', startOfLine: true,
      allow: ({ state, range }) => state.doc.resolve(range.from).parent.type.name === 'paragraph',
      items: ({ query }) => blockCommands.filter(item => `${item.label} ${item.id} ${item.keywords ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())),
      command: ({ editor, range, props }) => props.run(editor.chain().focus().deleteRange(range).clearNodes()).run(),
      render: suggestionMenu<BlockCommand>('slash-menu', slashKey),
    })];
  },
});

export const dummyEntities: MenuItem[] = [
  { id: 'demo-page', label: 'サンプルPage', description: '検証用の固定候補', icon: 'P' },
  { id: 'demo-task', label: 'サンプルTask', description: '検証用の固定候補', icon: '✓' },
];

export function editorExtensions(yDocument?: Doc) {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, ...(yDocument ? { undoRedo: false } : {}) }),
    ...(yDocument ? [Collaboration.configure({ document: yDocument, field: 'body' }), CollaborationHistory] : []),
    TaskList,
    TaskItem.configure({ nested: true, a11y: { checkboxLabel: node => `Todo: ${node.textBetween(0, node.content.size, ' ') || '未入力'}` } }),
    RefinedDetails.configure({
      persist: true,
      renderToggleButton: ({ element, isOpen }) => {
        element.setAttribute('aria-label', isOpen ? 'Toggleを閉じる' : 'Toggleを開く');
        element.setAttribute('aria-expanded', String(isOpen));
        element.setAttribute('title', `${isOpen ? '閉じる' : '開く'}（Ctrl+Enter）`);
        element.setAttribute('aria-keyshortcuts', 'Control+Enter Meta+Enter');
        if (!element.firstChild) {
          const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          icon.setAttribute('viewBox', '0 0 16 16');
          icon.setAttribute('aria-hidden', 'true');
          const path = document.createElementNS(icon.namespaceURI, 'path');
          path.setAttribute('d', 'm6 3 5 5-5 5');
          icon.append(path);
          element.append(icon);
        }
      },
    }),
    DetailsSummary, DetailsContent,
    Mention.configure({
      HTMLAttributes: { class: 'mention' },
      suggestion: {
        pluginKey: mentionKey,
        items: ({ query }) => dummyEntities.filter(item => item.label.toLowerCase().includes(query.toLowerCase())),
        render: suggestionMenu<MenuItem>('mention-menu', mentionKey),
      },
    }),
    SlashCommand, BlockDrag, EditorPlaceholders,
  ];
}
