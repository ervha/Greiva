import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

function requirePass(condition,reason){if(!condition)throw new Error(`Required CI report rejected: ${reason}`);}
export function verifyReports(unit,ui,baseline){
  requirePass(Number.isSafeInteger(baseline.unit.tests)&&baseline.unit.tests>0&&Number.isSafeInteger(baseline.unit.files)&&baseline.unit.files>0,'baseline');
  requirePass(Number.isSafeInteger(baseline.nativeUi.tests)&&baseline.nativeUi.tests>0&&Array.isArray(baseline.nativeUi.projects)&&baseline.nativeUi.projects.length>0,'baseline');
  requirePass(unit.success===true&&unit.numTotalTests===baseline.unit.tests&&unit.numPassedTests===baseline.unit.tests&&unit.numFailedTests===0&&unit.numPendingTests===0,'unit totals or skipped tests');
  requirePass(Array.isArray(unit.testResults)&&unit.testResults.length===baseline.unit.files,'unit files');
  const assertions=unit.testResults.flatMap(file=>{requirePass(file.status==='passed'&&Array.isArray(file.assertionResults),'unit file result');return file.assertionResults;});
  requirePass(assertions.length===baseline.unit.tests&&assertions.every(test=>test.status==='passed'),'unit assertion results');
  requirePass(ui.stats?.expected===baseline.nativeUi.tests&&ui.stats?.unexpected===0&&ui.stats?.skipped===0&&ui.stats?.flaky===0,'UI totals or skipped tests');
  const cases=[];
  function visit(suites){requirePass(Array.isArray(suites),'UI suites');for(const suite of suites){for(const spec of suite.specs??[]){requirePass(spec.ok===true&&Array.isArray(spec.tests),'UI spec');cases.push(...spec.tests);}visit(suite.suites??[]);}}
  visit(ui.suites);
  requirePass(cases.length===baseline.nativeUi.tests,'UI case count');
  requirePass(cases.every(test=>test.status==='expected'&&test.results?.length===1&&test.results[0].status==='passed'&&test.results[0].retry===0),'UI case results');
  requirePass(new Set(cases.map(test=>test.projectName)).size===baseline.nativeUi.projects.length&&baseline.nativeUi.projects.every(project=>cases.some(test=>test.projectName===project)),'UI projects');
  return {unit:assertions.length,nativeUi:cases.length,skipped:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const [unit,ui,baseline]=process.argv.slice(2).map(file=>JSON.parse(fs.readFileSync(file,'utf8')));console.log(JSON.stringify(verifyReports(unit,ui,baseline)));}
  catch(error){console.error(error instanceof Error&&error.message.startsWith('Required CI report rejected:')?error.message:'Required CI report missing or malformed');process.exitCode=1;}
}
