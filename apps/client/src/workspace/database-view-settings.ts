
import {parseDatabaseView,type DatabaseSource,type DatabaseView,type DatabaseViewField,type DatabaseViewFieldValue,type DatabaseFilter,type DatabaseProperty} from '@greiva/domain';
import {readDatabaseValueDraft} from './database-value-draft.js';
export type Operator='eq'|'not_eq'|'contains'|'lt'|'lte'|'gt'|'gte'|'is_unset'|'is_set';
export type Rule=Readonly<{id:string;propertyId:string;operator:Operator;mode:'null'|'value';text:string}>;
export type ViewSettingsDraft=Readonly<{name:string;layout:'table'|'list';columns:readonly string[];filterMode:'keep'|'none'|'rules';join:'and'|'or';rules:readonly Rule[];sortMode:'keep'|'none'|'one';sortPropertyId:string;direction:'asc'|'desc'}>;
export const labels:Record<Operator,string>={eq:'値が等しい',not_eq:'値が異なる',contains:'文字を含む',lt:'より小さい',lte:'以下',gt:'より大きい',gte:'以上',is_unset:'値なし',is_set:'値あり'};
export function initialViewSettings(source:DatabaseSource,base?:DatabaseView):ViewSettingsDraft{return{name:base?.name??'',layout:base?.layout??'table',columns:base?.visiblePropertyIds.slice()??source.properties.map(property=>property.id),filterMode:base?'keep':'none',join:'and',rules:[],sortMode:base?'keep':'none',sortPropertyId:source.properties[0]!.id,direction:'asc'};}
export function viewFromSettingsDraft(source:DatabaseSource,draft:ViewSettingsDraft,id:string,base?:DatabaseView):DatabaseView{
 let filter:DatabaseFilter|null=base?.filter??null;
 if(draft.filterMode==='none')filter=null;
 if(draft.filterMode==='rules'){if(!draft.rules.length||draft.rules.length>20)throw Error();const children=draft.rules.map(rule=>{const property=source.properties.find(property=>property.id===rule.propertyId);if(!property)throw Error();if(rule.operator==='is_set'||rule.operator==='is_unset')return{kind:'predicate' as const,propertyId:property.id,operator:rule.operator};return{kind:'predicate' as const,propertyId:property.id,operator:rule.operator,value:readDatabaseValueDraft(property,{mode:rule.mode,text:rule.text})};});filter=children.length===1?children[0]!:{kind:draft.join,children};}
 const sorts=draft.sortMode==='keep'?base?.sorts??[]:draft.sortMode==='none'?[]:[{propertyId:draft.sortPropertyId,direction:draft.direction}];
 return parseDatabaseView(source,{id,sourceId:source.id,name:draft.name,layout:draft.layout,visiblePropertyIds:draft.columns,filter,sorts});
}
function short(value:unknown){if(value===null)return'空値（null）';if(value==='')return'空のテキスト';const text=String(value);return[...text].length>160?[...text].slice(0,160).join('')+'…':text;}
export function describeViewField(source:DatabaseSource,field:DatabaseViewField,value:DatabaseViewFieldValue):string{
 const name=(id:string)=>source.properties.find(property=>property.id===id)?.name??'未取得の列';
 if(field==='name')return short(value);if(field==='layout')return value==='list'?'List':'Table';
 if(field==='visiblePropertyIds')return(value as string[]).map(name).join('、');
 if(field==='sorts'){const rows=value as DatabaseView['sorts'];return rows.length?rows.map(row=>name(row.propertyId)+(row.direction==='asc'?' 昇順':' 降順')).join('、'):'並べ替えなし';}
 if(value===null)return'条件なし';const visit=(node:DatabaseFilter):string=>node.kind==='predicate'?name(node.propertyId)+' '+labels[node.operator]+('value' in node?' '+short(node.value):''):'('+node.children.map(visit).join(node.kind==='and'?' AND ':' OR ')+')';return visit(value as DatabaseFilter);
}
