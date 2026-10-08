export const helpCategories=Object.freeze([{id:'start',label:'はじめに'},{id:'pages',label:'Pageとタイトル'},{id:'tasks',label:'TaskとRelation'},{id:'save',label:'保存・同期'},{id:'trouble',label:'問題解決'},{id:'keys',label:'操作方法'}] as const);
export type HelpCategory=typeof helpCategories[number]['id'];
export type HelpArticleId='start'|'page-info'|'title'|'tasks'|'save-sync'|'local-save'|'connection'|'conflict'|'shortcuts';
export type HelpArticle=Readonly<{id:HelpArticleId;title:string;summary:string;category:HelpCategory;aliases:readonly string[];locale:'ja';revision:number;availability:'workspace-preview';platforms:readonly ['desktop','touch'];sections:readonly Readonly<{heading:string;paragraphs?:readonly string[];steps?:readonly string[]}>[];related:readonly HelpArticleId[]}>;
const rows:HelpArticle[]=[
 {id:'start',title:'接続プレビューを使い始める',summary:'ログインからPage作成までの基本操作と、提供中の範囲です。',category:'start',aliases:['はじめに','ログイン','新規作成','FAQ'],locale:'ja',revision:1,availability:'workspace-preview',platforms:['desktop','touch'],sections:[
  {heading:'できること',paragraphs:['個人workspaceの接続プレビューでは、Page本文とタイトル、Task、Relationを端末へ保存し、明示操作でサーバーと確認します。端末保存に対応したアプリが必要です。']},
  {heading:'操作手順',steps:['メールアドレスとパスワードでログインします。','認証の確認後に「workspaceを開く」を選びます。','新しいPageのタイトルを入力し、「新しいPageを作成」を選びます。','本文を入力し、端末の保存状態が「端末に保存済み」になることを確認します。']},
  {heading:'確認すること',paragraphs:['端末に保存できたことと、サーバーへ送信できたことは別です。本文、タイトル、TaskとRelation、それぞれの確認状態を見てください。ログイン前の保存内容の閲覧は提供していません。','基本DB、Calendar、削除済みPageの復元、バックアップの取り込みは、このプレビューの操作として案内していません。']}],related:['save-sync','page-info','tasks']},
 {id:'page-info',title:'Page情報と本文を取得する',summary:'以前取得したタイトル情報と、本文の保存・同期状態を区別します。',category:'pages',aliases:['一覧','メタデータ','増分','タイトル情報','本文未取得'],locale:'ja',revision:1,availability:'workspace-preview',platforms:['desktop','touch'],sections:[
  {heading:'一覧の意味',paragraphs:['「端末に保存済み」は本文をこの端末に保存したPageです。「保存済みのPage情報」は以前取得したタイトル情報です。本文をまだ取得していないPageも含まれます。「サーバーのPage」は明示的に取得したサーバー一覧です。']},
  {heading:'操作手順',steps:['「Page情報を取得」でタイトル情報の変更を取得します。続きがあれば「Page情報の続きを取得」を選びます。','一覧の続きは「情報の一覧をさらに表示」、先頭は「情報の一覧を先頭へ」で確認します。','本文が未取得のPageを選ぶと、ログイン中の接続から本文を取得して端末へ保存します。']},
  {heading:'操作後の確認',paragraphs:['「前回取得した範囲の末尾まで保存しました」は、その取得範囲の確認です。本文や未送信タイトルの同期完了を表しません。以前の情報は別端末の操作で古くなっていることがあります。','受信した情報の保存結果が不明な場合は、表示される「受信した情報の保存を再確認」を使ってください。表示中の情報や未送信入力を削除する必要はありません。']}],related:['save-sync','local-save','title']},
 {id:'title',title:'タイトルを変更する',summary:'本文とは別にタイトルを保存・送信し、未保存入力と競合候補を保ちます。',category:'pages',aliases:['名前変更','rename','タイトル未確認','未保存'],locale:'ja',revision:1,availability:'workspace-preview',platforms:['desktop','touch'],sections:[
  {heading:'前提',paragraphs:['新しいPageでは、先に「タイトルを送信・確認」でPage作成と編集の基準を確認します。タイトルと本文の確認状態は別です。']},
  {heading:'操作手順',steps:['「タイトルを編集」で入力し、「タイトルを端末に保存」を選びます。入力をやめる場合は「タイトル入力を取り消す」を選びます。','未確認のタイトル変更があれば、「タイトルを送信・確認」で送信と候補を確認します。','別端末との候補が表示された場合は、比較してから選び、保存された変更を送信・確認します。']},
  {heading:'入力中の受信',paragraphs:['保存していない入力や変換中の文字を、受信したタイトルで上書きしません。入力の保存・取消や変換終了後に表示を更新します。入力中や保存結果不明の間は、Pageやアカウントの切替を保留します。']}],related:['conflict','local-save','page-info']},
 {id:'tasks',title:'TaskとRelationを使う',summary:'Taskのタイトル・状態・期限と、参照先の関連を明示的に保存します。',category:'tasks',aliases:['タスク','期日','関連付け','リレーション'],locale:'ja',revision:1,availability:'workspace-preview',platforms:['desktop','touch'],sections:[
  {heading:'Taskの操作',steps:['Taskタイトル、状態、必要なら期限を入力し、「Taskを端末に保存」を選びます。','編集ボタンから変更し、「Taskの変更を保存」を選びます。未保存入力をやめる場合は取消を使います。','「TaskとRelationを同期」で保存済みの変更を送信し、取得した範囲を確認します。']},
  {heading:'Relationの操作',paragraphs:['Relationの元と先を選び、端末へ保存します。参照先はサーバーにも保存されている必要があります。未送信Pageは本文を、TaskはTaskとRelationの同期を先に確認してください。','削除ボタンを選ぶと削除変更を端末へ保存します。対象を確認してから操作してください。削除したデータの復元手順はこのプレビューでは提供していません。']},
  {heading:'確認すること',paragraphs:['未確認件数、競合、拒否された変更を分けて確認します。拒否された入力が残っている場合、同期の成功表示だけで解決したと判断しないでください。']}],related:['save-sync','conflict','local-save']},
 {id:'save-sync',title:'端末保存とサーバー同期の違い',summary:'保存中・保存済み・未確認・エラーを読み分け、入力を保全します。',category:'save',aliases:['オフライン','offline','同期されない','未送信','保存済み','FAQ'],locale:'ja',revision:1,availability:'workspace-preview',platforms:['desktop','touch'],sections:[
  {heading:'状態の意味',paragraphs:['「端末へ保存中」の入力は、強制終了すると失われることがあります。「端末に保存済み」は端末で保存できた状態です。サーバーへの送信完了とは別です。','本文、タイトル、TaskとRelationの未確認件数と確認状態は別々です。Page情報の取得完了だけで、未送信の変更を確認済みとはしません。']},
  {heading:'接続できないとき',steps:['画面上の端末保存状態を確認します。保存エラーがあれば、未保存入力をコピーして保管します。','現在開いているPageで入力できる場合も、保存状態を確認してからアプリを閉じてください。','接続が戻ったら、それぞれの送信・同期ボタンで確認します。未確認件数が減ったか、競合や拒否された変更が残っていないかを見ます。']},
  {heading:'ログアウトと再開',paragraphs:['ログアウトしても、この端末の保存済みデータと未送信変更は保持します。再度同じアカウントでログインしてworkspaceを開いてください。ログイン前の閲覧は提供していません。認証の期限が切れた場合は接続を開き直す必要があります。']}],related:['local-save','connection','conflict']},
 {id:'local-save',title:'保存エラー・保存結果不明に対処する',summary:'入力をコピーして保管し、同じ保存の再確認を使います。',category:'trouble',aliases:['保存できない','結果不明','保存失敗','再確認','コピー','FAQ'],locale:'ja',revision:1,availability:'workspace-preview',platforms:['desktop','touch'],sections:[
  {heading:'先に入力を保管する',paragraphs:['端末に保存できたと確認できない場合、画面に残っている本文やフォームの入力をコピーし、別の安全な場所へ保管してください。画面への表示だけで保存済みとは判断しないでください。']},
  {heading:'操作手順',steps:['どの保存状態でエラーになったかを確認します。本文、タイトル、TaskとRelation、受信したPage情報では再確認の操作が異なります。','「同じタイトルの保存を再確認」など、画面に表示された同じ保存の再確認を使います。別の入力を新しく作り直す前に結果を確認してください。','Page情報の保存結果不明は「受信した情報の保存を再確認」を使います。これは新しい情報を取得する操作とは別です。']},
  {heading:'注意すること',paragraphs:['データ消去、アプリ初期化、未送信変更の削除から始めないでください。未保存入力を保管する前に、アプリを再起動・終了しないでください。','この説明を読むだけでは、保存や再送、設定変更を実行しません。再確認後もエラーが続く場合は、入力を保持したまま操作を止めてください。']}],related:['save-sync','connection','title']},
 {id:'connection',title:'接続・認証を確認する',summary:'通信エラーと認証の期限・権限を分けて確認します。',category:'trouble',aliases:['ログインできない','権限','認証エラー','通信エラー','期限切れ','FAQ'],locale:'ja',revision:1,availability:'workspace-preview',platforms:['desktop','touch'],sections:[
  {heading:'接続できない場合',paragraphs:['通信に失敗しても、端末の保存済み内容と未送信変更は保持します。接続を確認し、表示中の保存状態を見てから明示的に再試行してください。']},
  {heading:'認証の期限が切れた場合',steps:['未保存入力があれば、先にコピーして保管します。','「認証を更新」、またはログインし直してworkspaceを開きます。','同じアカウントで端末の保存内容と未確認の変更が残っているか確認します。']},
  {heading:'権限がない場合',paragraphs:['同じ操作を繰り返す前に、ログインしているアカウントと対象workspaceを確認してください。権限がない接続では保存内容の送信・取得を進めません。','問い合わせの自動送信や、本文を含む診断送信の操作はこのヘルプでは提供していません。パスワードや認証情報を他人へ送らないでください。']}],related:['local-save','save-sync','start']},
 {id:'conflict',title:'競合候補を比較して解決する',summary:'編集の基準、この端末の入力、取得した値を比較します。',category:'trouble',aliases:['コンフリクト','Conflict','三値','候補','拒否'],locale:'ja',revision:1,availability:'workspace-preview',platforms:['desktop','touch'],sections:[
  {heading:'候補の意味',paragraphs:['同じ項目を別端末でも変更した場合、編集の基準、この端末の入力、取得したサーバーの値が候補として表示されます。値が違う理由を見てから選んでください。']},
  {heading:'操作手順',steps:['未保存入力を保存または取り消し、保存済みの未送信変更を先に確認します。','候補の各値を比較し、使う値のボタンを選びます。選択は新しい保存済み変更として扱います。','対応する送信・同期ボタンで確認します。別端末が先に解決・更新した場合は、選択が受け付けられないことがあります。']},
  {heading:'受け付けられなかった場合',paragraphs:['元の入力や拒否履歴を確認してください。受信済み情報を更新し、必要な変更をあらためて検討します。保存済みの入力を黙って消す操作はしません。','Page情報の受信で別端末の解決を確認すると、その候補の選択ボタンは表示されなくなります。本文の同期状態とは別の確認です。']}],related:['title','tasks','save-sync']},
 {id:'shortcuts',title:'キーボードとタッチの操作',summary:'提供中の編集操作と、キーを使わない代替操作を確認します。',category:'keys',aliases:['ショートカット','keyboard','スラッシュ','Mention','Toggle','Undo','Redo'],locale:'ja',revision:1,availability:'workspace-preview',platforms:['desktop','touch'],sections:[
  {heading:'本文の操作',paragraphs:['行頭の「/」でブロック候補、「@」でMention候補を開きます。候補は矢印キーで移動し、Enterで選びます。変換中のEnterでは確定候補の選択を進めません。','Windowsのキーボードでは、トグルのEnterで本文へ移動し、Ctrl+Enterで開閉します。元に戻す・やり直す、ブロック追加・移動は画面のボタンからも操作できます。']},
  {heading:'フォームとヘルプ',paragraphs:['Tabで入力とボタンを移動し、ボタンはEnterまたはSpaceで操作します。タッチでは同じボタンを選びます。タイトル入力のEnterは、変換中を除いて端末保存の操作です。','ヘルプの記事はボタンで選択します。検索中のEnterで記事を自動的に開きません。ヘルプを閉じると元の操作位置へ戻ります。']}],related:['title','start','save-sync']},
];
function frozen<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
export const helpArticles:readonly HelpArticle[]=frozen(rows);
export function helpArticle(id:string){return helpArticles.find(article=>article.id===id)??null;}
const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('ja').trim();
// Searches only bundled product content. There is no document/user-data port.
export function searchHelp(query:string,category:HelpCategory|'all'='all'):readonly HelpArticle[]{
 const text=normalize(query.slice(0,120)),terms=text.split(/\s+/).filter(Boolean).slice(0,8);
 const scored=helpArticles.filter(article=>category==='all'||article.category===category).map(article=>{
  const title=normalize(article.title),aliases=article.aliases.map(normalize),summary=normalize(article.summary),body=normalize(article.sections.flatMap(section=>[section.heading,...(section.paragraphs??[]),...(section.steps??[])]).join(' '));
  if(terms.some(term=>![title,...aliases,summary,body].some(field=>field.includes(term))))return{article,score:-1};
  return{article,score:!text?0:title===text?100:aliases.includes(text)?80:terms.reduce((score,term)=>score+(title.includes(term)?20:aliases.some(alias=>alias.includes(term))?15:summary.includes(term)?10:5),0)};
 });return Object.freeze(scored.filter(row=>row.score>=0).sort((a,b)=>b.score-a.score||helpArticles.indexOf(a.article)-helpArticles.indexOf(b.article)).map(row=>row.article));
}
