import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyReports} from './assert-ci-reports.mjs';
const baseline={unit:{tests:1,files:1},nativeUi:{tests:2,projects:['desktop','mobile']}};
function fixture(){return {unit:{success:true,numTotalTests:1,numPassedTests:1,numFailedTests:0,numPendingTests:0,testResults:[{status:'passed',assertionResults:[{status:'passed'}]}]},ui:{stats:{expected:2,unexpected:0,skipped:0,flaky:0},suites:[{specs:[{ok:true,tests:['desktop','mobile'].map(projectName=>({projectName,status:'expected',results:[{status:'passed',retry:0}]}))}]}]}};}
test('complete reports pass',()=>{const {unit,ui}=fixture();assert.deepEqual(verifyReports(unit,ui,baseline),{unit:1,nativeUi:2,skipped:0});});
for(const [name,change] of [
 ['pending unit',f=>{f.unit.numPendingTests=1;}],
 ['skipped unit assertion',f=>{f.unit.testResults[0].assertionResults[0].status='pending';}],
 ['fewer unit tests',f=>{f.unit.numTotalTests=0;}],
 ['missing unit file',f=>{f.unit.testResults=[];}],
 ['skipped UI',f=>{f.ui.stats.skipped=1;}],
 ['failed UI',f=>{f.ui.stats.unexpected=1;}],
 ['flaky UI',f=>{f.ui.stats.flaky=1;}],
 ['missing UI case',f=>{f.ui.suites[0].specs[0].tests.pop();}],
 ['skipped UI result despite green totals',f=>{f.ui.suites[0].specs[0].tests[0].results[0].status='skipped';}],
 ['retry despite green totals',f=>{f.ui.suites[0].specs[0].tests[0].results.push({status:'passed',retry:1});}],
 ['missing project',f=>{f.ui.suites[0].specs[0].tests[1].projectName='desktop';}],
])test(`reject ${name}`,()=>{const f=fixture();change(f);assert.throws(()=>verifyReports(f.unit,f.ui,baseline),/Required CI report rejected:/);});
