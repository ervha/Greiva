import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { exitSuggestion } from '@tiptap/suggestion';
import type { PluginKey } from '@tiptap/pm/state';

export type MenuItem = { id: string; label: string; description?: string; icon?: string; group?: string; keywords?: string };

export function suggestionMenu<Item extends MenuItem>(name: string, key: PluginKey): NonNullable<SuggestionOptions<Item>['render']> {
  return () => {
    let menu: HTMLDivElement | null = null;
    let list: HTMLDivElement | null = null;
    let current: SuggestionProps<Item> | null = null;
    let buttons: HTMLButtonElement[] = [];
    let selected = 0;
    const position = () => {
      const rect = current?.clientRect?.();
      if (!menu || !rect) return;
      const belowSpace = Math.max(0, window.innerHeight - rect.bottom - 16);
      const aboveSpace = Math.max(0, rect.top - 16);
      const placeBelow = belowSpace >= Math.min(420, 240) || belowSpace >= aboveSpace;
      menu.style.maxHeight = `${Math.min(420, placeBelow ? belowSpace : aboveSpace)}px`;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8));
      const below = rect.bottom + 8;
      const top = placeBelow ? below : Math.max(8, rect.top - menu.offsetHeight - 8);
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    };
    const select = (index: number, reveal = false) => {
      selected = index;
      buttons.forEach((button, i) => button.setAttribute('aria-selected', String(i === selected)));
      const dom = current?.editor.view.dom;
      const button = buttons[selected];
      if (button) dom?.setAttribute('aria-activedescendant', button.id);
      else dom?.removeAttribute('aria-activedescendant');
      // Scroll the list only. Element.scrollIntoView can move the editor/page.
      if (reveal && button && list) {
        const optionRect = button.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        if (optionRect.top < listRect.top) list.scrollTop -= listRect.top - optionRect.top;
        else if (optionRect.bottom > listRect.bottom) list.scrollTop += optionRect.bottom - listRect.bottom;
      }
    };
    const paint = () => {
      if (!menu || !list || !current) return;
      const query = menu.querySelector('.suggestion-query');
      if (query) query.textContent = current.query ? `${name === 'slash-menu' ? '/' : '@'}${current.query}` : '';
      list.replaceChildren();
      buttons = [];
      let group = '';
      current.items.forEach((item, index) => {
        if (item.group && item.group !== group) {
          const heading = document.createElement('div');
          heading.className = 'suggestion-group';
          heading.role = 'presentation';
          heading.textContent = item.group;
          list!.append(heading);
          group = item.group;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.role = 'option';
        button.tabIndex = -1;
        button.id = `${name}-option-${index}`;
        button.setAttribute('aria-label', item.label);
        button.setAttribute('aria-posinset', String(index + 1));
        button.setAttribute('aria-setsize', String(current!.items.length));
        const icon = document.createElement('span');
        icon.className = 'suggestion-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = item.icon ?? '@';
        const text = document.createElement('span');
        text.className = 'suggestion-text';
        const label = document.createElement('span');
        label.textContent = item.label;
        text.append(label);
        if (item.description) {
          const description = document.createElement('span');
          description.className = 'suggestion-description';
          description.id = `${name}-description-${index}`;
          description.textContent = item.description;
          text.append(description);
          button.setAttribute('aria-describedby', description.id);
        }
        button.append(icon, text);
        button.addEventListener('mousedown', event => event.preventDefault());
        button.addEventListener('pointermove', () => select(index));
        button.addEventListener('click', () => {
          if (!current?.editor.view.composing) current?.command(item);
        });
        buttons.push(button);
        list!.append(button);
      });
      if (!current.items.length) {
        const empty = document.createElement('p');
        empty.className = 'suggestion-empty';
        empty.textContent = '候補が見つかりません。別の名前で検索できます。';
        list.append(empty);
      }
      const dom = current.editor.view.dom;
      dom.setAttribute('aria-controls', name);
      dom.setAttribute('aria-expanded', 'true');
      position();
      select(selected, true);
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu?.contains(event.target) && !current?.editor.view.dom.contains(event.target) && current) {
        exitSuggestion(current.editor.view, key);
      }
    };
    return {
      onStart: props => {
        current = props;
        selected = 0;
        menu = document.createElement('div');
        menu.className = 'suggestion-menu';
        const header = document.createElement('div');
        header.className = 'suggestion-header';
        const title = document.createElement('span');
        title.textContent = name === 'slash-menu' ? 'ブロックを挿入' : 'Mention';
        const query = document.createElement('span');
        query.className = 'suggestion-query';
        header.append(title, query);
        list = document.createElement('div');
        list.id = name;
        list.role = 'listbox';
        list.setAttribute('aria-label', name === 'slash-menu' ? 'ブロックを挿入' : 'Mention候補');
        list.className = 'suggestion-list';
        const footer = document.createElement('div');
        footer.className = 'suggestion-footer';
        for (const [shortcut, label] of [['↑ ↓', '選択'], ['Enter', '挿入'], ['Esc', '閉じる']] as const) {
          const hint = document.createElement('span');
          const kbd = document.createElement('kbd');
          kbd.textContent = shortcut;
          hint.append(kbd, ` ${label}`);
          footer.append(hint);
        }
        menu.append(header, list, footer);
        document.body.append(menu);
        window.addEventListener('resize', position);
        window.addEventListener('scroll', position, true);
        document.addEventListener('pointerdown', outside);
        paint();
      },
      onUpdate: props => {
        const selectedId = current?.items[selected]?.id;
        const changedQuery = props.query !== current?.query;
        current = props;
        const retained = props.items.findIndex(item => item.id === selectedId);
        selected = changedQuery || retained < 0 ? 0 : retained;
        paint();
      },
      onKeyDown: ({ event, view }) => {
        if (event.isComposing || view.composing || event.keyCode === 229) return false;
        if (event.key === 'Escape') { exitSuggestion(view, key); return true; }
        if (!current?.items.length) return false;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          select((selected + (event.key === 'ArrowDown' ? 1 : -1) + current.items.length) % current.items.length, true);
          return true;
        }
        if (event.key === 'Home' || event.key === 'End') {
          select(event.key === 'Home' ? 0 : current.items.length - 1, true);
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
        document.removeEventListener('pointerdown', outside);
        menu?.remove();
        menu = null;
        list = null;
        buttons = [];
        current = null;
      },
    };
  };
}
