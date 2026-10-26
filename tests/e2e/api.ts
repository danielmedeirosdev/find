import type {Page} from '@playwright/test'
import fs from 'node:fs'
const env=fs.readFileSync('.env.local','utf8')
const url=env.match(/VITE_SUPABASE_URL=(.*)/)![1],key=env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)![1]
// Reuse the authenticated browser's test session; never export auth storage or tokens.
export async function data(page:Page,path:string,method='GET',body?:unknown){
 return page.evaluate(async({url,key,path,method,body})=>{
  const storageKey=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'))
  if(!storageKey)throw Error('No test session')
  const session=JSON.parse(localStorage.getItem(storageKey)!)
  const response=await fetch(`${url}/rest/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined})
  if(!response.ok)throw Error(`Test persistence request failed (${response.status})`)
  return response.status===204?null:response.json()
 },{url,key,path,method,body})
}
