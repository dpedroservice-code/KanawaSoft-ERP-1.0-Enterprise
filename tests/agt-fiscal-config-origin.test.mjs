import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../supabase/functions/agt-fiscal-config/index.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../supabase/migrations/20261128100000_agt_async_submission_queue.sql', import.meta.url), 'utf8');

test('AGT fiscal configuration allows the canonical production origin', () => {
  assert.ok(source.includes('https://kanawasoft.shop'));
});

test('AGT fiscal configuration allows the www production origin', () => {
  assert.ok(source.includes('https://www.kanawasoft.shop'));
});

test('AGT fiscal configuration keeps explicit preview and local development origins', () => {
  assert.ok(source.includes('kanawasoft-erp-1-0-enterprise.netlify.app'));
  assert.ok(source.includes('deploy-preview-'));
  assert.ok(source.includes('localhost:8888'));
});

test('AGT Base64URL encoding uses strict URL-safe substitutions', () => {
  assert.ok(source.includes('replace(/\\+/g,"-")'));
  assert.ok(source.includes('replace(/\\//g,"_")'));
  assert.ok(source.includes('replace(/=/g,"")'));
});

test('AGT PKCS#8 parser normalizes real and escaped newlines', () => {
  assert.ok(source.includes('replace(/\\\\n/g,"\\n")'));
  assert.ok(source.includes('replace(/\\\\r\\\\n/g,"\\n")'));
  assert.ok(source.includes('-----BEGIN PRIVATE KEY-----'));
});

test('AGT signature version is mandatory in readiness and signed software payload', () => {
  assert.ok(source.includes('AGT_SOFTWARE_SIGNATURE_VERSION'));
  assert.ok(source.includes('softwareSignatureVersionConfigured:!!softwareSignatureVersion'));
  assert.ok(source.includes('signatureVersion:softwareSignatureVersion'));
  assert.ok(source.includes('!softwareSignatureVersion'));
  assert.ok(source.includes('AGT_SOFTWARE_SIGNATURE_VERSION não está configurada no servidor.'));
});

function extractFunction(name) {
  const marker=new RegExp("function\\s+"+name+"\\s*\\("), match=marker.exec(source);
  assert.ok(match,"function "+name+" must exist in Edge Function");
  const isAsync=source.slice(Math.max(0,match.index-6),match.index)==="async ";
  const start=isAsync?match.index-6:match.index, open=source.indexOf("{",match.index);
  let depth=0, quote=null, escaped=false;
  for(let i=open;i<source.length;i++) {
    const ch=source[i];
    if(quote) { if(escaped) escaped=false; else if(ch==="\\") escaped=true; else if(ch===quote) quote=null; continue; }
    if(ch==="'"||ch==='"'||ch===String.fromCharCode(96)) { quote=ch; continue; }
    if(ch==="{") depth++;
    if(ch==="}" && --depth===0) return source.slice(start,i+1);
  }
  throw new Error("Unclosed function "+name);
}
function loadHelpers() {
  const context={URL,AbortController,setTimeout,clearTimeout,fetch,btoa,unescape,encodeURIComponent,Error,JSON,Math,Number,String};
  vm.createContext(context);
  vm.runInContext(extractFunction("resolveAgtConfig")+";"+extractFunction("agtHttpRequest")+";"+extractFunction("mapAgtResult"),context);
  return context;
}
test('AGT HTTP client fails closed without URL or Basic Auth credentials',()=>{
  const h=loadHelpers();
  assert.throws(()=>h.resolveAgtConfig({}),/AGT_API_BASE_URL/);
  assert.throws(()=>h.resolveAgtConfig({AGT_API_BASE_URL:"https://sifphml.minfin.gov.ao/sigt/fe/v1"}),/Basic Auth/);
});
test('AGT HTTP client accepts only exact HTTPS homologation endpoint',()=>{
  const h=loadHelpers(), config=h.resolveAgtConfig({AGT_API_BASE_URL:"https://sifphml.minfin.gov.ao/sigt/fe/v1",AGT_BASIC_AUTH_USER:"mock-user",AGT_BASIC_AUTH_PASS:"mock-pass"});
  assert.equal(config.baseUrl,"https://sifphml.minfin.gov.ao/sigt/fe/v1");
  assert.match(config.authorization,/^Basic /);
  assert.throws(()=>h.resolveAgtConfig({AGT_API_BASE_URL:"https://sifp.minfin.gov.ao/sigt/fe/v1",AGT_BASIC_AUTH_USER:"u",AGT_BASIC_AUTH_PASS:"p"}),/bloqueado/);
  assert.throws(()=>h.resolveAgtConfig({AGT_API_BASE_URL:"http://sifphml.minfin.gov.ao/sigt/fe/v1",AGT_BASIC_AUTH_USER:"u",AGT_BASIC_AUTH_PASS:"p"}),/bloqueado/);
});
test('registarFactura mock receives requestID and Basic Auth only on server request',async()=>{
  const h=loadHelpers(); let sent;
  const result=await h.agtHttpRequest("https://sifphml.minfin.gov.ao/sigt/fe/v1","registarFactura",{submissionUUID:"mock-guid"},"Basic mock",async(url,options)=>{sent={url,options};return {ok:true,status:200,text:async()=>JSON.stringify({requestID:"123456789012345"})};});
  assert.equal(result.data.requestID,"123456789012345");
  assert.equal(sent.url,"https://sifphml.minfin.gov.ao/sigt/fe/v1/registarFactura");
  assert.equal(sent.options.headers.Authorization,"Basic mock");
});
test('obterEstado mock maps resultCode 0 to VALIDADO',async()=>{
  const h=loadHelpers(), result=await h.agtHttpRequest("https://sifphml.minfin.gov.ao/sigt/fe/v1","obterEstado",{requestID:"123"},"Basic mock",async()=>({ok:true,status:200,text:async()=>JSON.stringify({resultCode:0,documentStatusList:[]})}));
  assert.equal(h.mapAgtResult(result.data.resultCode),"VALIDADO");
});
test('obterEstado mock preserves rejected schema errors',async()=>{
  const h=loadHelpers(), result=await h.agtHttpRequest("https://sifphml.minfin.gov.ao/sigt/fe/v1","obterEstado",{requestID:"123"},"Basic mock",async()=>({ok:true,status:200,text:async()=>JSON.stringify({resultCode:2,requestErrorList:[{errorCode:"SCHEMA",description:"invalid document"}]})}));
  assert.equal(h.mapAgtResult(result.data.resultCode),"REJEITADO");
  assert.equal(result.data.requestErrorList[0].errorCode,"SCHEMA");
});
test('AGT HTTP client converts fetch abort into timeout failure',async()=>{
  const h=loadHelpers();
  await assert.rejects(h.agtHttpRequest("https://sifphml.minfin.gov.ao/sigt/fe/v1","obterEstado",{},"Basic mock",(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener("abort",()=>reject(Object.assign(new Error("aborted"),{name:"AbortError"})))),5),/AGT_TIMEOUT/);
});
test('AGT queue is unique per document and stores audit data without exposing credentials',()=>{
  assert.ok(source.includes('from("ks_agt_submissions")'));
  assert.ok(migrationSource.includes('unique(company_id, document_id)'));
  assert.ok(migrationSource.includes('enable row level security'));
  assert.ok(migrationSource.includes('revoke all on public.ks_agt_submissions from anon, authenticated'));
  assert.ok(source.includes('environment:homologation'));
  assert.ok(source.includes("AGT_BASIC_AUTH_USER")&&source.includes("AGT_BASIC_AUTH_PASS")&&source.includes("AGT_API_BASE_URL"));
  assert.ok(source.includes("A submissão duplicada foi bloqueada"));
  assert.ok(!source.includes("console.log(agtConfig.authorization)"));
});

test('AGT Basic Auth token accepts a Basic-prefixed base64 value',()=>{
  const h=loadHelpers(), config=h.resolveAgtConfig({AGT_API_BASE_URL:"https://sifphml.minfin.gov.ao/sigt/fe/v1",AGT_BASIC_AUTH_TOKEN:"Basic dXNlcjpwYXNz"});
  assert.equal(config.authorization,"Basic dXNlcjpwYXNz");
});
test('AGT HTTP requests refuse redirects to prevent leaving homologation',async()=>{
  const h=loadHelpers(); let sent;
  await h.agtHttpRequest("https://sifphml.minfin.gov.ao/sigt/fe/v1","obterEstado",{},"Basic mock",async(_url,options)=>{sent=options;return {ok:true,status:200,text:async()=>"{}"};});
  assert.equal(sent.redirect,"error");
});
