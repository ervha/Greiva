import {it,expect,vi} from 'vitest';
import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
const mocks=vi.hoisted(()=>({spawn:vi.fn()}));vi.mock('node:child_process',()=>({spawn:mocks.spawn}));
import {StructuredDevice} from '../support/structured-device.js';
function child(){const value=Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough(),stdin:new PassThrough(),kill:vi.fn(()=>{queueMicrotask(()=>value.emit('exit',null,'SIGTERM'));return true;})});return value;}
it('STRUCTURED-DRIVER: EOF in a partial response rejects pending requests and cannot become a successful result after restart',async()=>{
 const one=child(),two=child();mocks.spawn.mockReturnValueOnce(one).mockReturnValueOnce(two);const device=new StructuredDevice('/fixture.sqlite'),first=device.request('structured-snapshot'),second=device.request('structured-prepare'),assertions=Promise.all([expect(first).rejects.toThrow('Invalid Rust store response'),expect(second).rejects.toThrow('Invalid Rust store response')]);one.stdout.end('{"id":1,"value":');await assertions;expect(one.kill).toHaveBeenCalledOnce();const fresh=device.request('structured-prepare');two.stdout.write('{"id":3,"value":null}\n');expect(await fresh).toBeNull();await device.close();
});
it('STRUCTURED-DRIVER: malformed response identity rejects the captured process rather than resolving an unrelated request',async()=>{
 const process=child();mocks.spawn.mockReturnValueOnce(process);const device=new StructuredDevice('/fixture.sqlite'),work=device.request('structured-snapshot'),assertion=expect(work).rejects.toThrow('Invalid Rust store response');process.stdout.write('{"id":"1","value":{}}\n');await assertion;expect(process.kill).toHaveBeenCalledOnce();await device.close();
});
