const TOKEN_CACHE = { digikey: null, nexar: null };

function env(name){ return process.env[name] || ""; }
function n(v, fallback=0){ if(v===null||v===undefined||v==="")return fallback; const x=Number(String(v).replace(/[^0-9+.\-]/g,"")); return Number.isFinite(x)?x:fallback; }
function clean(s){ return String(s ?? "").trim(); }
function norm(s){ return clean(s).toLowerCase().replace(/[\s_\-./()]/g,""); }
function firstPrice(prices=[]){ if(!Array.isArray(prices)||!prices.length)return {price:0,currency:""}; const one=prices.find(x=>Number(x.Quantity||x.quantity)===1)||prices[0]; return {price:n(one.Price??one.price??one.convertedPrice,0),currency:clean(one.Currency??one.currency??one.convertedCurrency)}; }
function parseStock(v){ return n(v,0); }
function parseLeadDays(v){ const s=clean(v); if(!s)return 0; const weeks=s.match(/([\d.]+)\s*week/i); if(weeks)return Math.round(Number(weeks[1])*7); return Math.round(n(s,0)); }
function normalizeLifecycle(v, flags={}){
  const s=norm(v);
  if(flags.eol||flags.discontinued||/eol|endoflife|obsolete|discontinued/.test(s))return "EOL/Obsolete";
  if(/nrnd|notrecommended/.test(s))return "NRND";
  if(/production|active|new/.test(s))return "Active";
  return clean(v)||"Unknown";
}
function attrObj(arr=[], nameKey="AttributeName", valueKey="AttributeValue"){
  const out={}; for(const a of arr||[]){ const k=clean(a?.[nameKey]); if(k)out[k]=clean(a?.[valueKey]); } return out;
}
function attrObjDigi(arr=[]){ const out={}; for(const a of arr||[]){ const k=clean(a.ParameterText||a.Parameter); const v=clean(a.ValueText||a.Value); if(k)out[k]=v; } return out; }
function attrObjNexar(arr=[]){ const out={}; for(const a of arr||[]){ const k=clean(a?.attribute?.name); if(k)out[k]=clean(a.displayValue||a.value); } return out; }
function findAttr(attrs, patterns){
  const entries=Object.entries(attrs||{}); for(const p of patterns){ const rx=new RegExp(p,"i"); const hit=entries.find(([k])=>rx.test(k)); if(hit)return hit[1]; } return "";
}
function parseRate(attrs){
  const v=findAttr(attrs,["data.?rate","bandwidth","transfer.?rate","maximum.?data"]); const s=clean(v); if(!s)return 0;
  const m=s.match(/([\d.]+)\s*(gbps|gb\/s|gbit|gt\/s)/i); if(m)return Number(m[1]); const mb=s.match(/([\d.]+)\s*(mbps|mb\/s)/i); if(mb)return Number(mb[1])/1000; return 0;
}
function parseLanes(attrs){ const v=findAttr(attrs,["number of lanes","lane count","channels","number of channels"]); return Math.round(n(v,0)); }
function parseTemp(attrs){
  const v=findAttr(attrs,["operating temperature","temperature range","min operating temperature"]);
  const nums=(clean(v).match(/[-+]?\d+(?:\.\d+)?/g)||[]).map(Number); if(nums.length>=2)return {min:Math.min(...nums),max:Math.max(...nums)};
  const min=n(findAttr(attrs,["min operating temperature","minimum operating temperature"]),25), max=n(findAttr(attrs,["max operating temperature","maximum operating temperature"]),25);
  return {min,max};
}
function inferPackage(attrs, fallback=""){ return clean(findAttr(attrs,["package.?case","package","case package","supplier device package"]))||clean(fallback); }

async function fetchJson(url, options={}){
  const r=await fetch(url,options), text=await r.text(); let data; try{data=JSON.parse(text)}catch{data={raw:text}};
  if(!r.ok){ const msg=data?.ErrorMessage||data?.detail||data?.title||data?.raw||`HTTP ${r.status}`; throw new Error(String(msg).slice(0,700)); }
  return data;
}

function mouserConfigured(){ return !!env("MOUSER_API_KEY"); }
async function mouserRequest(endpoint,body){
  const url=`https://api.mouser.com${endpoint}?apiKey=${encodeURIComponent(env("MOUSER_API_KEY"))}`;
  return fetchJson(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
}
function mapMouserPart(p){
  const attrs=attrObj(p.ProductAttributes||[]), temp=parseTemp(attrs), price=firstPrice(p.PriceBreaks||[]);
  return {MPN:clean(p.ManufacturerPartNumber),Manufacturer:clean(p.Manufacturer),Category:clean(p.Category||p.MouserProductCategory),Description:clean(p.Description),Package:inferPackage(attrs),SupplyVoltage:findAttr(attrs,["supply voltage","operating supply"]),DataRateGbps:parseRate(attrs),Lanes:parseLanes(attrs),TempMin:temp.min,TempMax:temp.max,Lifecycle:normalizeLifecycle(p.LifecycleStatus,{discontinued:/true/i.test(clean(p.IsDiscontinued))}),Stock:parseStock(p.AvailabilityInStock||p.FactoryStock||p.Availability),UnitPrice:price.price,Currency:price.currency,LeadTimeDays:parseLeadDays(p.LeadTime),RoHS:clean(p.ROHSStatus),PinCompatible:"Unknown",PCBChange:"Unknown",DatasheetURL:clean(p.DataSheetUrl),ProductURL:clean(p.ProductDetailUrl),Source:"Mouser",Attributes:attrs,ReplacementBasis:clean(p.SuggestedReplacement)?"Mouser SuggestedReplacement":"",SuggestedReplacement:clean(p.SuggestedReplacement)};
}
async function searchMouser({query,manufacturer="",limit=30,exact=false}){
  if(!mouserConfigured())throw new Error("MOUSER_API_KEY not configured");
  if(exact){
    const body={SearchByPartMfrNameRequest:{manufacturerName:manufacturer,mouserPartNumber:query,partSearchOptions:"Exact",mouserPaysCustomsAndDuties:false}};
    const j=await mouserRequest("/api/v2/search/partnumberandmanufacturer",body);
    return (j.SearchResults?.Parts||[]).slice(0,limit).map(mapMouserPart);
  }
  const body={SearchByKeywordMfrNameRequest:{manufacturerName:manufacturer,keyword:query,records:Math.min(limit,50),pageNumber:1,searchOptions:"None",searchWithYourSignUpLanguage:"false",mouserPaysCustomsAndDuties:false}};
  const j=await mouserRequest("/api/v2/search/keywordandmanufacturer",body);
  return (j.SearchResults?.Parts||[]).slice(0,limit).map(mapMouserPart);
}
async function replacementMouser({query,limit=15}){
  const originals=await searchMouser({query,limit:3,exact:true}), original=originals[0]||null; if(!original)return {original:null,parts:[],warnings:["Mouser에서 기준 MPN을 찾지 못했습니다."]};
  let parts=[], warnings=["Mouser 대체 후보는 SuggestedReplacement 및 카테고리/설명 검색 기반입니다. Pin-to-Pin 보장은 아닙니다."];
  if(original.SuggestedReplacement){
    try{ parts.push(...await searchMouser({query:original.SuggestedReplacement,limit:4,exact:true})); }catch{}
  }
  const keyword=original.Category||original.Description.split(" ").slice(0,6).join(" ");
  try{ parts.push(...await searchMouser({query:keyword,limit})); }catch(e){warnings.push("유사 부품 검색 일부 실패: "+e.message);}
  parts=dedupe(parts.filter(p=>norm(p.MPN)!==norm(original.MPN))).slice(0,limit).map(p=>({...p,ReplacementBasis:p.ReplacementBasis||"Mouser category/description candidate"}));
  return {original,parts,warnings};
}

function digikeyConfigured(){ return !!(env("DIGIKEY_CLIENT_ID")&&env("DIGIKEY_CLIENT_SECRET")&&env("DIGIKEY_ACCOUNT_ID")); }
async function digiToken(){
  const now=Date.now(); if(TOKEN_CACHE.digikey&&TOKEN_CACHE.digikey.expires>now+30000)return TOKEN_CACHE.digikey.token;
  const form=new URLSearchParams({client_id:env("DIGIKEY_CLIENT_ID"),client_secret:env("DIGIKEY_CLIENT_SECRET"),grant_type:"client_credentials"});
  const j=await fetchJson("https://api.digikey.com/v1/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form.toString()});
  TOKEN_CACHE.digikey={token:j.access_token,expires:now+(Number(j.expires_in||600)*1000)}; return j.access_token;
}
async function digiFetch(path){
  const token=await digiToken();
  return fetchJson(`https://api.digikey.com${path}`,{headers:{Authorization:`Bearer ${token}`,"X-DIGIKEY-Client-Id":env("DIGIKEY_CLIENT_ID"),"X-DIGIKEY-Locale-Site":env("DIGIKEY_SITE")||"KR","X-DIGIKEY-Locale-Language":env("DIGIKEY_LANGUAGE")||"ko","X-DIGIKEY-Locale-Currency":env("DIGIKEY_CURRENCY")||"KRW","X-DIGIKEY-Account-Id":env("DIGIKEY_ACCOUNT_ID")}});
}

async function digiPost(path,body){
  const token=await digiToken();
  return fetchJson(`https://api.digikey.com${path}`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json","X-DIGIKEY-Client-Id":env("DIGIKEY_CLIENT_ID"),"X-DIGIKEY-Locale-Site":env("DIGIKEY_SITE")||"KR","X-DIGIKEY-Locale-Language":env("DIGIKEY_LANGUAGE")||"ko","X-DIGIKEY-Locale-Currency":env("DIGIKEY_CURRENCY")||"KRW","X-DIGIKEY-Account-Id":env("DIGIKEY_ACCOUNT_ID")},body:JSON.stringify(body)});
}
function simplifyBaseFilters(arr=[]){return (arr||[]).map(x=>({id:String(x.Id??""),name:clean(x.Value),count:n(x.ProductCount,0)})).filter(x=>x.id&&x.name);}
function simplifyDigiFilters(fo={}){
  return {
    manufacturers:simplifyBaseFilters(fo.Manufacturers),
    status:simplifyBaseFilters(fo.Status),
    packaging:simplifyBaseFilters(fo.Packaging),
    series:simplifyBaseFilters(fo.Series),
    parametric:(fo.ParametricFilters||[]).map(p=>({parameterId:p.ParameterId,parameterName:clean(p.ParameterName),parameterType:clean(p.ParameterType),categoryId:p.Category?.Id??null,categoryName:clean(p.Category?.Value),values:(p.FilterValues||[]).map(v=>({id:String(v.ValueId??""),name:clean(v.ValueName),count:n(v.ProductCount,0),rangeType:clean(v.RangeFilterType)})).filter(v=>v.id&&v.name)})).filter(p=>p.parameterId&&p.parameterName)
  };
}
async function searchDigiKey({query,limit=50,filters={}}){
  if(!digikeyConfigured())throw new Error("DigiKey credentials or DIGIKEY_ACCOUNT_ID not configured");
  const f={};
  if(filters.manufacturers?.length)f.ManufacturerFilter=filters.manufacturers.map(Id=>({Id:String(Id)}));
  if(filters.status?.length)f.StatusFilter=filters.status.map(Id=>({Id:String(Id)}));
  if(filters.packaging?.length)f.PackagingFilter=filters.packaging.map(Id=>({Id:String(Id)}));
  f.MarketPlaceFilter=filters.excludeMarketplace?"ExcludeMarketPlace":"NoFilter";
  if(Number(filters.minimumQuantity)>0)f.MinimumQuantityAvailable=Math.round(Number(filters.minimumQuantity));
  if(filters.searchOptions?.length)f.SearchOptions=filters.searchOptions;
  if(filters.parametric?.length){
    const usable=filters.parametric.filter(x=>x.parameterId&&x.valueIds?.length);
    const categoryId=usable.find(x=>x.categoryId)?.categoryId;
    if(usable.length&&categoryId){
      f.ParameterFilterRequest={CategoryFilter:{Id:String(categoryId)},ParameterFilters:usable.filter(x=>String(x.categoryId||categoryId)===String(categoryId)).map(x=>({ParameterId:Number(x.parameterId),FilterValues:x.valueIds.map(Id=>({Id:String(Id)}))}))};
    }
  }
  const body={Keywords:String(query||"").slice(0,250),Limit:Math.max(1,Math.min(50,Number(limit)||50)),Offset:0,FilterOptionsRequest:f};
  const j=await digiPost("/products/v4/search/keyword",body);
  const currency=j.SearchLocaleUsed?.Currency||env("DIGIKEY_CURRENCY")||"KRW";
  return {parts:(j.Products||[]).map(x=>mapDigiProduct(x,currency)),productsCount:n(j.ProductsCount,(j.Products||[]).length),filterOptions:simplifyDigiFilters(j.FilterOptions||{}),applied:j.AppliedParametricFiltersDto||[],locale:j.SearchLocaleUsed||{}};
}

function mapDigiProduct(p, localeCurrency="KRW"){
  const attrs=attrObjDigi(p.Parameters||[]), temp=parseTemp(attrs), variation=(p.ProductVariations||[])[0]||{}, pkg=variation.PackageType?.Name||inferPackage(attrs), stock=n(p.QuantityAvailable,0), lc=normalizeLifecycle(p.ProductStatus?.Status||p.ProductStatus,{eol:p.EndOfLife,discontinued:p.Discontinued});
  return {MPN:clean(p.ManufacturerProductNumber),Manufacturer:clean(p.Manufacturer?.Name||p.Manufacturer),Category:clean(p.Category?.Name||p.Category?.Value||p.Category),Description:clean(p.Description?.ProductDescription||p.ProductDescription||p.DetailedDescription),Package:clean(pkg),SupplyVoltage:findAttr(attrs,["voltage","supply"]),DataRateGbps:parseRate(attrs),Lanes:parseLanes(attrs),TempMin:temp.min,TempMax:temp.max,Lifecycle:lc,Stock:stock,UnitPrice:n(p.UnitPrice,0),Currency:localeCurrency,LeadTimeDays:parseLeadDays(p.ManufacturerLeadWeeks),RoHS:clean(p.Classifications?.RohsStatus||p.RoHSStatus),PinCompatible:"Unknown",PCBChange:"Unknown",DatasheetURL:clean(p.DatasheetUrl||p.PrimaryDatasheet),ProductURL:clean(p.ProductUrl),Source:"DigiKey",Attributes:attrs,DigiKeyProductNumber:clean(variation.DigiKeyProductNumber||p.DigiKeyProductNumber)};
}
async function digiDetails(productNumber){
  if(!digikeyConfigured())throw new Error("DigiKey credentials or DIGIKEY_ACCOUNT_ID not configured");
  const j=await digiFetch(`/products/v4/search/${encodeURIComponent(productNumber)}/productdetails`); const p=j.Product; if(!p)return null;
  return mapDigiProduct(p,j.SearchLocaleUsed?.Currency||"KRW");
}
async function replacementDigiKey({query,limit=15}){
  const original=await digiDetails(query); if(!original)return {original:null,parts:[],warnings:["DigiKey에서 기준 부품을 찾지 못했습니다."]};
  const dkpn=original.DigiKeyProductNumber||query;
  const j=await digiFetch(`/products/v4/search/${encodeURIComponent(dkpn)}/substitutions`);
  const basic=(j.ProductSubstitutes||[]).slice(0,Math.min(limit,10));
  const parts=await Promise.all(basic.map(async s=>{
    try{ const d=await digiDetails(s.DigiKeyProductNumber||s.ManufacturerProductNumber); if(d)return {...d,SubstituteType:clean(s.SubstituteType),ReplacementBasis:`DigiKey substitution: ${clean(s.SubstituteType)||"unspecified"}`}; }catch{}
    return {MPN:clean(s.ManufacturerProductNumber),Manufacturer:clean(s.Manufacturer?.Name),Category:"",Description:clean(s.Description),Package:"",DataRateGbps:0,Lanes:0,TempMin:25,TempMax:25,Lifecycle:"Unknown",Stock:n(s.QuantityAvailable,0),UnitPrice:n(s.UnitPrice,0),Currency:j.SearchLocaleUsed?.Currency||"KRW",LeadTimeDays:0,PinCompatible:"Unknown",PCBChange:"Unknown",DatasheetURL:"",ProductURL:clean(s.ProductUrl),Source:"DigiKey",Attributes:{},DigiKeyProductNumber:clean(s.DigiKeyProductNumber),SubstituteType:clean(s.SubstituteType),ReplacementBasis:`DigiKey substitution: ${clean(s.SubstituteType)||"unspecified"}`};
  }));
  return {original,parts:dedupe(parts),warnings:["DigiKey Substitutions는 공식 API의 대체 후보이지만 Pin-to-Pin 호환 판정은 별도 데이터시트 검증이 필요합니다."]};
}

function nexarConfigured(){ return !!(env("NEXAR_CLIENT_ID")&&env("NEXAR_CLIENT_SECRET")); }
async function nexarToken(){
  const now=Date.now(); if(TOKEN_CACHE.nexar&&TOKEN_CACHE.nexar.expires>now+60000)return TOKEN_CACHE.nexar.token;
  const form=new URLSearchParams({grant_type:"client_credentials",client_id:env("NEXAR_CLIENT_ID"),client_secret:env("NEXAR_CLIENT_SECRET"),scope:"supply.domain"});
  const j=await fetchJson("https://identity.nexar.com/connect/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","User-Agent":"Smart-BOM-Selector-V2"},body:form.toString()});
  TOKEN_CACHE.nexar={token:j.access_token,expires:now+(Number(j.expires_in||86400)*1000)}; return j.access_token;
}
async function nexarGraphql(query,variables){
  const token=await nexarToken(); const j=await fetchJson("https://api.nexar.com/graphql",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,"User-Agent":"Smart-BOM-Selector-V2"},body:JSON.stringify({query,variables})});
  if(j.errors?.length)throw new Error(j.errors.map(x=>x.message).join("; ")); return j.data;
}
function mapNexarResult(r, specs=[]){
  const p=r.part||{}, sellers=p.sellers||[]; let stock=0,lead=0,allPrices=[]; for(const s of sellers)for(const o of s.offers||[]){stock+=n(o.inventoryLevel,0);lead=Math.max(lead,n(o.factoryLeadDays,0));allPrices.push(...(o.prices||[]));}
  const price=firstPrice(allPrices), attrs=attrObjNexar(specs||p.specs||[]), temp=parseTemp(attrs), lifecycle=normalizeLifecycle(findAttr(attrs,["lifecycle status","manufacturer lifecycle"]));
  return {MPN:clean(p.mpn),Manufacturer:clean(p.manufacturer?.name),Category:clean(p.category?.name),Description:clean(p.shortDescription||r.description),Package:inferPackage(attrs),SupplyVoltage:findAttr(attrs,["supply voltage","voltage"]),DataRateGbps:parseRate(attrs),Lanes:parseLanes(attrs),TempMin:temp.min,TempMax:temp.max,Lifecycle:lifecycle,Stock:n(p.totalAvail,stock)||stock,UnitPrice:price.price,Currency:price.currency,LeadTimeDays:n(p.estimatedFactoryLeadDays,lead)||lead,PinCompatible:"Unknown",PCBChange:"Unknown",DatasheetURL:"",ProductURL:clean(p.octopartUrl),Source:"Nexar",Attributes:attrs};
}
async function searchNexar({query,limit=20,mpn=false}){
  if(!nexarConfigured())throw new Error("Nexar credentials not configured");
  const op=mpn?"supSearchMpn":"supSearch";
  const includeSpecs=env("NEXAR_USE_SPECS")==="true";
  const specsBlock=includeSpecs?`specs { attribute { name shortname } displayValue }`:"";
  const gql=`query Search($q:String!,$limit:Int!){ ${op}(q:$q,limit:$limit,country:"KR",currency:"KRW"){ hits results { description part { mpn shortDescription totalAvail estimatedFactoryLeadDays octopartUrl manufacturer { name } category { name } ${specsBlock} sellers(authorizedOnly:true){ company { name } offers { inventoryLevel factoryLeadDays packaging prices { quantity price currency convertedPrice convertedCurrency } } } } } } }`;
  const data=await nexarGraphql(gql,{q:query,limit:Math.min(limit,50)}); return (data?.[op]?.results||[]).map(r=>mapNexarResult(r));
}
async function replacementNexar({query,limit=15}){
  const matches=await searchNexar({query,limit:Math.min(limit+1,20),mpn:true}); const original=matches.find(x=>norm(x.MPN)===norm(query))||matches[0]||null;
  const parts=matches.filter(x=>!original||norm(x.MPN)!==norm(original.MPN)).slice(0,limit).map(x=>({...x,ReplacementBasis:"Nexar MPN/similar search"}));
  return {original,parts,warnings:["Nexar MPN 검색 결과는 유사 후보 탐색용입니다. 대체 호환성은 별도 검증이 필요합니다."]};
}

function dedupe(parts){ const seen=new Set(),out=[]; for(const p of parts||[]){const k=norm(p.MPN)+"|"+norm(p.Manufacturer);if(!p.MPN||seen.has(k))continue;seen.add(k);out.push(p);}return out; }

module.exports={mouserConfigured,digikeyConfigured,nexarConfigured,searchMouser,replacementMouser,searchDigiKey,digiDetails,replacementDigiKey,searchNexar,replacementNexar,dedupe};
