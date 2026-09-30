import { Extension, type ChainedCommands } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import Mention from '@tiptap/extension-mention';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { BlockDrag } from './block-drag';
import { suggestionMenu, type MenuItem } from './suggestion-menu';

type BlockCommand = MenuItem & { run: (chain: ChainedCommands) => ChainedCommands };
export const blockCommands: BlockCommand[] = [
  { id: 'paragraph', label: '本文', run: c => c.setParagraph() },
  ...([1, 2, 3] as const).map(level => ({ id: `heading${level}`, label: `見出し${level}`, run: (c: ChainedCommands) => c.setHeading({ level }) })),
  { id: 'bullet', label: '箇条書き', run: c => c.toggleBulletList() },
  { id: 'ordered', label: '番号付きリスト', run: c => c.toggleOrderedList() },
  { id: 'todo', label: 'Todo', run: c => c.toggleTaskList() },
  { id: 'quote', label: '引用', run: c => c.setBlockquote() },
  { id: 'code', label: 'コード', run: c => c.setCodeBlock() },
  { id: 'divider', label: '区切り線', run: c => c.setHorizontalRule() },
  { id: 'toggle', label: 'Toggle', description: '折りたたみ', run: c => c.setDetails() },
];
const slashKey = new PluginKey('greivaSlash');
const mentionKey = new PluginKey('greivaMention');
const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [Suggestion<BlockCommand>({
      editor: this.editor, pluginKey: slashKey, char: '/', startOfLine: true,
      allow: ({ state, range }) => state.doc.resolve(range.from).parent.type.name === 'paragraph',
      items: ({ query }) => blockCommands.filter(item => `${item.label} ${item.id}`.toLowerCase().includes(query.toLowerCase())),
      command: ({ editor, range, props }) => props.run(editor.chain().focus().deleteRange(range).clearNodes()).run(),
      render: suggestionMenu<BlockCommand>('slash-menu', slashKey),
    })];
  },
});

export const dummyEntities: MenuItem[] = [
  { id: 'demo-page', label: 'サンプルPage', description: '検証用の固定候補' },
  { id: 'demo-task', label: 'サンプルTask', description: '検証用の固定候補' },
];

export function editorExtensions() {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    TaskList,
    TaskItem.configure({ nested: true, a11y: { checkboxLabel: node => `Todo: ${node.textContent || '未入力'}` } }),
    Details.configure({
      persist: true,
      renderToggleButton: ({ element, isOpen }) => {
        element.setAttribute('aria-label', isOpen ? 'Toggleを閉じる' : 'Toggleを開く');
        element.setAttribute('aria-expanded', String(isOpen));
        element.textContent = isOpen ? '▾' : '▸';
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
    SlashCommand, BlockDrag,
  ];
}
