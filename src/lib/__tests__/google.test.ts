import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
class Script extends EventTarget {
 src=''; async=false; removed=false
 remove(){this.removed=true}
}
let scripts: Script[]
const sdk={accounts:{id:{}}}
beforeEach(()=>{
 vi.resetModules();vi.useFakeTimers();scripts=[]
 vi.stubGlobal('window',{})
 vi.stubGlobal('document',{querySelector:()=>scripts.find(s=>!s.removed)||null,createElement:()=>new Script(),head:{appendChild:(s:Script)=>scripts.push(s)}})
})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
async function loader(){return (await import('../google')).loadGoogleIdentityServices}
function ready(){Object.assign(window,{google:sdk})}
describe('Google script recovery',()=>{
 it('shares a pending load across simultaneous callers and resolves only with SDK',async()=>{
  const load=await loader();const a=load(),b=load();expect(a).toBe(b);expect(scripts).toHaveLength(1)
  ready();scripts[0].dispatchEvent(new Event('load'));await expect(a).resolves.toBeUndefined();await expect(load()).resolves.toBeUndefined();expect(scripts).toHaveLength(1)
 })
 it('recovers after an initial network error instead of caching rejection',async()=>{
  const load=await loader();const first=load();const failed=expect(first).rejects.toMatchObject({stage:'google_script_error'});scripts[0].dispatchEvent(new Event('error'));await failed
  const retry=load();expect(retry).not.toBe(first);expect(scripts[0].removed).toBe(true);ready();scripts[1].dispatchEvent(new Event('load'));await retry
 })
 it('uses an existing loading script without adding another',async()=>{
  scripts.push(new Script());const load=await loader();const p=load();ready();scripts[0].dispatchEvent(new Event('load'));await p;expect(scripts).toHaveLength(1)
 })
 it('recognizes an already loaded SDK immediately',async()=>{
  ready();const load=await loader();await load();expect(scripts).toHaveLength(0)
 })
 it('detects SDK availability even if an existing script load event was missed',async()=>{
  scripts.push(new Script());const load=await loader();const p=load();ready();await vi.advanceTimersByTimeAsync(100);await p
 })
 it('bounds indefinite waits and permits recovery from a stale existing script',async()=>{
  scripts.push(new Script());const load=await loader();const p=load();const failed=expect(p).rejects.toMatchObject({stage:'google_script_timeout'});await vi.advanceTimersByTimeAsync(15000);await failed
  const retry=load();ready();scripts[1].dispatchEvent(new Event('load'));await retry
 })
 it('does not treat load without the SDK as success and allows a new attempt',async()=>{
  const load=await loader();const p=load();const failed=expect(p).rejects.toMatchObject({stage:'google_sdk_missing'});scripts[0].dispatchEvent(new Event('load'));await failed
  const retry=load();ready();scripts[1].dispatchEvent(new Event('load'));await retry
 })
})
