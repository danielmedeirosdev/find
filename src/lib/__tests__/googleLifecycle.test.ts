import { afterEach, expect, it, vi } from 'vitest'
const h=vi.hoisted(()=>({effects:[] as (()=>()=>void)[],errors:vi.fn(),initialize:vi.fn(),render:vi.fn(),nonce:vi.fn(),load:vi.fn(),refs:[] as {current:unknown}[]}))
vi.mock('react',()=>({useEffect:(fn:()=>()=>void)=>h.effects.push(fn),useRef:(value:unknown)=>{const ref={current:value};h.refs.push(ref);return ref},useState:(v:unknown)=>[v,vi.fn()]}))
vi.mock('../google',()=>({GOOGLE_CLIENT_ID:'test',GoogleLoadError:class extends Error{},generateGoogleNonce:h.nonce,loadGoogleIdentityServices:h.load}))
import { GoogleSignInButton } from '../../components/GoogleSignInButton'
afterEach(()=>{h.effects=[];h.refs=[];vi.clearAllMocks();vi.unstubAllGlobals()})
it('ignores unmount while script loading without an error or global cancellation',async()=>{
 let resolve!:()=>void;h.load.mockReturnValue(new Promise<void>(r=>resolve=r))
 GoogleSignInButton({onCredential:vi.fn(),onError:h.errors});const cleanup=h.effects[0]();cleanup();resolve();await Promise.resolve();await Promise.resolve();expect(h.errors).not.toHaveBeenCalled();expect(h.nonce).not.toHaveBeenCalled()
})
it('ignores unmount during nonce preparation before touching the removed host',async()=>{
 h.load.mockResolvedValue(undefined);let resolve!:(v:string[])=>void;h.nonce.mockReturnValue(new Promise(r=>resolve=r));vi.stubGlobal('window',{google:{accounts:{id:{initialize:h.initialize,renderButton:h.render}}}})
 GoogleSignInButton({onCredential:vi.fn(),onError:h.errors});h.refs[0].current={innerHTML:'',clientWidth:320};const cleanup=h.effects[0]();await Promise.resolve();cleanup();h.refs[0].current=null;resolve(['raw','hashed']);await Promise.resolve();await Promise.resolve();expect(h.initialize).not.toHaveBeenCalled();expect(h.errors).not.toHaveBeenCalled()
})
it('prepares a new mount after navigation while the old mount is loading',async()=>{
 let resolve!:()=>void;h.load.mockReturnValue(new Promise<void>(r=>resolve=r));h.nonce.mockResolvedValue(['raw','hashed']);vi.stubGlobal('window',{google:{accounts:{id:{initialize:h.initialize,renderButton:h.render}}}})
 GoogleSignInButton({onCredential:vi.fn(),onError:h.errors});const first=h.effects[0]();first();
 const offset=h.refs.length;GoogleSignInButton({onCredential:vi.fn(),onError:h.errors});h.refs[offset].current={innerHTML:'',clientWidth:320};h.effects[1]();resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
 expect(h.render).toHaveBeenCalledTimes(1);expect(h.errors).not.toHaveBeenCalled();expect(h.initialize).toHaveBeenCalledWith(expect.objectContaining({nonce:'hashed'}))
})
it('reports preparation failures separately from credentials',async()=>{
 h.load.mockResolvedValue(undefined);h.nonce.mockRejectedValue(new Error('private diagnostic'));vi.stubGlobal('window',{google:{accounts:{id:{}}}})
 GoogleSignInButton({onCredential:vi.fn(),onError:h.errors});h.refs[0].current={innerHTML:'',clientWidth:320};h.effects[0]();await Promise.resolve();await Promise.resolve();await Promise.resolve();expect(h.errors).toHaveBeenCalledWith('private diagnostic','google_prepare')
})
