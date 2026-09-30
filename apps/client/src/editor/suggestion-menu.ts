import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { exitSuggestion } from '@tiptap/suggestion';
import type { PluginKey } from '@tiptap/pm/state';

export type MenuItem = { id: string; label: string; description?: string };

export function suggestionMenu<Item extends MenuItem>(name: string, key: PluginKey): NonNullable<SuggestionOptions<Item>['render']> {
  return () => {
    let menu: HTMLDivElement | null = null;
    let current: SuggestionProps<Item> | null = null;
    let selected = 0;
    const position = () => {
      const rect = current?.clientRect?.();
      if (!menu || !rect) return;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8));
      const below = rect.bottom + 6;
      const top = below + menu.offsetHeight < window.innerHeight ? below : Math.max(8, rect.top - menu.offsetHeight - 6);
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    };
    const paint = () => {
      if (!menu || !current) return;
      menu.replaceChildren();
      current.items.forEach((item, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.role = 'option';
        button.id = `${name}-option-${index}`;
        button.setAttribute('aria-selected', String(index === selected));
        button.textContent = item.description ? `${item.label} — ${item.description}` : item.label;
        button.addEventListener('mousedown', event => event.preventDefault());
        button.addEventListener('click', () => current?.command(item));
        menu!.append(button);
      });
      if (!current.items.length) {
        const empty = document.createElement('p');
        empty.textContent = '候補がありません';
        menu.append(empty);
      }
      const dom = current.editor.view.dom;
      dom.setAttribute('aria-controls', name);
      dom.setAttribute('aria-expanded', 'true');
      if (current.items.length) dom.setAttribute('aria-activedescendant', `${name}-option-${selected}`);
      else dom.removeAttribute('aria-activedescendant');
      menu.children[selected]?.scrollIntoView({ block: 'nearest' });
      position();
    };
    return {
      onStart: props => {
        current = props;
        selected = 0;
        menu = document.createElement('div');
        menu.id = name;
        menu.role = 'listbox';
        menu.setAttribute('aria-label', name === 'slash-menu' ? 'ブロックを挿入' : 'Mention候補');
        menu.className = 'suggestion-menu';
        document.body.append(menu);
        window.addEventListener('resize', position);
        window.addEventListener('scroll', position, true);
        paint();
      },
      onUpdate: props => { current = props; selected = 0; paint(); },
      onKeyDown: ({ event, view }) => {
        if (event.isComposing || view.composing || event.keyCode === 229) return false;
        if (event.key === 'Escape') { exitSuggestion(view, key); return true; }
        if (!current?.items.length) return false;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + current.items.length) % current.items.length;
          paint();
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') { current.command(current.items[selected]); return true; }
        return false;
      },
      onExit: () => {
        const dom = current?.editor.view.dom;
        dom?.removeAttribute('aria-controls');
        dom?.removeAttribute('aria-expanded');
        dom?.removeAttribute('aria-activedescendant');
        window.removeEventListener('resize', position);
        window.removeEventListener('scroll', position, true);
        menu?.remove();
        menu = null;
        current = null;
      },
    };
  };
}
