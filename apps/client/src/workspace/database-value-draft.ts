import {parseDatabaseValue,type DatabaseProperty,type DatabaseValue} from '@greiva/domain';
export type DatabaseValueDraft=Readonly<{mode:'omit'|'null'|'value';text:string}>;
export function readDatabaseValueDraft(property:DatabaseProperty,draft:DatabaseValueDraft):DatabaseValue{
 if(draft.mode==='null')return null;
 let candidate:unknown=draft.text;
 if(property.type==='number'){if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(draft.text.trim()))throw Error();candidate=Number(draft.text);}
 if(property.type==='checkbox'){if(draft.text!=='true'&&draft.text!=='false')throw Error();candidate=draft.text==='true';}
 return parseDatabaseValue(property,candidate);
}
