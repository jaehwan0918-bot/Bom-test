const P = require("../lib/providers");

module.exports = async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"POST only"});
  const {mode="search",provider="auto",query="",manufacturer="",limit=20,filters={}}=req.body||{};
  if(!String(query).trim())return res.status(400).json({error:"query is required"});
  try{
    if(mode==="digikey_search"){
      const r=await P.searchDigiKey({query:String(query).trim(),limit:Number(limit)||50,filters:filters||{}});
      return res.status(200).json({providers:["digikey"],...r});
    }
    if(mode==="priority_search"){
      return res.status(200).json(await prioritySearch({
        query:String(query).trim(),
        manufacturer:String(manufacturer||"").trim(),
        limit:Number(limit)||50,
        filters:filters||{}
      }));
    }
    if(mode==="replacement")return res.status(200).json(await replacement(provider,{query:String(query).trim(),limit:Number(limit)||15}));
    if(mode==="detail"){
      if(provider!=="digikey"&&provider!=="auto")return res.status(400).json({error:"V2 detail mode currently uses DigiKey."});
      const original=await P.digiDetails(String(query).trim()); return res.status(200).json({providers:["digikey"],original,parts:[]});
    }
    return res.status(200).json(await search(provider,{query:String(query).trim(),manufacturer:String(manufacturer||"").trim(),limit:Number(limit)||20}));
  }catch(e){ console.error(e); return res.status(500).json({error:e.message||"API error"}); }
};


async function retryProvider(label,fn,attempts=2){
  let last;
  for(let i=0;i<attempts;i++){
    try{return await fn();}
    catch(e){
      last=e;
      if(i<attempts-1)await new Promise(r=>setTimeout(r,250*(i+1)));
    }
  }
  throw new Error(`${label}: ${last?.message||last||"request failed"}`);
}

async function prioritySearch(args){
  const warnings=[],providers=[],parts=[];
  const perProvider=Math.max(10,Math.min(50,Number(args.limit)||50));

  if(P.digikeyConfigured()){
    try{
      const d=await retryProvider("DigiKey",()=>P.searchDigiKey({
        query:args.query,
        limit:perProvider,
        filters:{
          searchOptions:args.filters?.searchOptions?.length?args.filters.searchOptions:["InStock","NormallyStocking","RohsCompliant","HasDatasheet"],
          excludeMarketplace:args.filters?.excludeMarketplace!==false,
          minimumQuantity:Number(args.filters?.minimumQuantity)||0
        }
      }),2);
      parts.push(...(d.parts||[]));
      providers.push("digikey");
    }catch(e){warnings.push(e.message);}
  }

  if(P.mouserConfigured()){
    try{
      const m=await retryProvider("Mouser",()=>P.searchMouser({
        query:args.query,
        manufacturer:"",
        limit:perProvider
      }),2);
      parts.push(...(m||[]));
      providers.push("mouser");
    }catch(e){warnings.push(e.message);}
  }

  if(!providers.length){
    const configured=[];
    if(P.digikeyConfigured())configured.push("DigiKey");
    if(P.mouserConfigured())configured.push("Mouser");
    if(!configured.length)throw new Error("DigiKey/Mouser API 환경변수가 설정되지 않았습니다.");
    throw new Error(`DigiKey/Mouser 연결 실패: ${warnings.join(" / ")||"provider unavailable"}`);
  }

  return {
    providers,
    parts:P.dedupe(parts).slice(0,Math.min(100,perProvider*2)),
    warnings:[...new Set(warnings)]
  };
}

async function search(provider,args){
  const warnings=[],sets=[],providers=[];
  const run=async(name,fn)=>{try{const p=await fn();if(p?.length){sets.push(...p);providers.push(name);}}catch(e){warnings.push(`${name}: ${e.message}`);}};
  if(provider==="mouser")await run("mouser",()=>P.searchMouser(args));
  else if(provider==="nexar")await run("nexar",()=>P.searchNexar({...args,mpn:false}));
  else if(provider==="digikey"){
    try{const r=await P.searchDigiKey({...args,filters:{searchOptions:["InStock"],excludeMarketplace:true}});sets.push(...r.parts);providers.push("digikey");}catch(e){warnings.push(`digikey: ${e.message}`);}
  } else {
    if(P.mouserConfigured())await run("mouser",()=>P.searchMouser(args));
    if(P.nexarConfigured())await run("nexar",()=>P.searchNexar({...args,mpn:false}));
    if(!P.mouserConfigured()&&!P.nexarConfigured()&&P.digikeyConfigured())await run("digikey",async()=>{const d=await P.digiDetails(args.query);return d?[d]:[];});
  }
  return {providers,parts:P.dedupe(sets).slice(0,args.limit),warnings};
}

async function replacement(provider,args){
  const configured={mouser:P.mouserConfigured(),digikey:P.digikeyConfigured(),nexar:P.nexarConfigured()};
  if(provider==="digikey")return addProviders(await P.replacementDigiKey(args),["digikey"]);
  if(provider==="mouser")return addProviders(await P.replacementMouser(args),["mouser"]);
  if(provider==="nexar")return addProviders(await P.replacementNexar(args),["nexar"]);

  const warnings=[],providers=[],parts=[]; let original=null;
  if(configured.digikey){
    try{const r=await P.replacementDigiKey(args);original=original||r.original;parts.push(...r.parts);warnings.push(...r.warnings);providers.push("digikey");}catch(e){warnings.push(`digikey: ${e.message}`);}
  }
  if(configured.mouser){
    try{const r=await P.replacementMouser(args);original=original||r.original;parts.push(...r.parts);warnings.push(...r.warnings);providers.push("mouser");}catch(e){warnings.push(`mouser: ${e.message}`);}
  }
  if(configured.nexar && parts.length<args.limit){
    try{const r=await P.replacementNexar(args);original=original||r.original;parts.push(...r.parts);warnings.push(...r.warnings);providers.push("nexar");}catch(e){warnings.push(`nexar: ${e.message}`);}
  }
  if(!providers.length)throw new Error("연결된 API가 없습니다. Vercel 환경변수를 설정하거나 Demo 대체품을 사용하세요.");
  return {providers,original,parts:P.dedupe(parts).slice(0,args.limit),warnings:[...new Set(warnings)]};
}
function addProviders(obj,providers){return {...obj,providers};}
