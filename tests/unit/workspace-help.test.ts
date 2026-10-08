import {it,expect} from 'vitest';
import {helpArticle,helpArticles,helpCategories,searchHelp} from '../../apps/client/src/help/articles.js';
it('HELP-CONTENT: stable IDs resolve related articles and declare only bundled preview availability',()=>{
 expect(helpArticles.map(row=>row.id)).toEqual(['start','page-info','title','tasks','save-sync','local-save','connection','conflict','shortcuts']);
 expect(new Set(helpArticles.map(row=>row.id)).size).toBe(helpArticles.length);
 for(const row of helpArticles){expect(helpCategories.some(category=>category.id===row.category)).toBe(true);expect(row).toMatchObject({locale:'ja',revision:1,availability:'workspace-preview',platforms:['desktop','touch']});expect(row.sections.some(section=>section.steps?.length||section.paragraphs?.length)).toBe(true);for(const related of row.related)expect(helpArticle(related)).not.toBeNull();expect(Object.isFrozen(row.sections)).toBe(true);}
 expect(helpArticle('unknown-id')).toBeNull();expect(Object.isFrozen(helpArticles)).toBe(true);
});
it('HELP-SEARCH: aliases, Japanese/ASCII width and case normalization rank stable results',()=>{
 expect(searchHelp('  ＯＦＦＬＩＮＥ  ')[0]?.id).toBe('save-sync');expect(searchHelp('ｺﾝﾌﾘｸﾄ')[0]?.id).toBe('conflict');
 expect(searchHelp('タイトルを変更する')[0]?.id).toBe('title');expect(searchHelp('FAQ').slice(0,2).map(row=>row.id)).toEqual(['start','save-sync']);
 expect(searchHelp('')).toEqual(helpArticles);expect(Object.isFrozen(searchHelp(''))).toBe(true);
});
it('HELP-SEARCH: all terms match bundled fields, category filtering and no results retain source articles',()=>{
 expect(searchHelp('タイトル コピー').map(row=>row.id)).toContain('local-save');expect(searchHelp('タイトル コピー','pages')).toEqual([]);
 expect(searchHelp('','tasks').map(row=>row.id)).toEqual(['tasks']);expect(searchHelp('user-private-content-4d085b')).toEqual([]);expect(helpArticles).toHaveLength(9);
});
it('HELP-CONTENT: unknown save and metadata progress guidance do not label unsent bodies as synced',()=>{
 const local=JSON.stringify(helpArticle('local-save')),metadata=JSON.stringify(helpArticle('page-info'));
 expect(local).toContain('同じタイトルの保存を再確認');expect(local).toContain('データ消去');expect(metadata).toContain('本文や未送信タイトルの同期完了を表しません');
 expect(JSON.stringify(helpArticle('tasks'))).toContain('復元手順はこのプレビューでは提供していません');
});
