const $ = (id) => document.getElementById(id);

const sampleCandidates = [
  {MPN:"SAMPLE-DP-001",Manufacturer:"Vendor A",Category:"DisplayPort Redriver",Description:"4-lane DP redriver HBR3 sample",Package:"WQFN",SupplyVoltage:"3.3V",DataRateGbps:8.1,Lanes:4,TempMin:-40,TempMax:85,Lifecycle:"Active",Stock:1250,UnitPrice:3.25,Currency:"USD",LeadTimeDays:35,PinCompatible:"Yes",PCBChange:"None",DatasheetURL:"",ProductURL:"",Source:"Demo",Attributes:{"Package / Case":"WQFN","Data Rate":"8.1 Gbps","Operating Temperature":"-40°C to 85°C","Number of Lanes":"4"}},
  {MPN:"SAMPLE-DP-002",Manufacturer:"Vendor B",Category:"DisplayPort Redriver",Description:"4-lane high-speed linear redriver sample",Package:"QFN",SupplyVoltage:"3.3V",DataRateGbps:10,Lanes:4,TempMin:-40,TempMax:105,Lifecycle:"Active",Stock:410,UnitPrice:4.10,Currency:"USD",LeadTimeDays:70,PinCompatible:"No",PCBChange:"Minor",DatasheetURL:"",ProductURL:"",Source:"Demo",Attributes:{"Package / Case":"QFN","Data Rate":"10 Gbps","Operating Temperature":"-40°C to 105°C","Number of Lanes":"4"}},
  {MPN:"SAMPLE-DP-003",Manufacturer:"Vendor C",Category:"DisplayPort Redriver",Description:"DP redriver lower data rate sample",Package:"WQFN",SupplyVoltage:"3.3V",DataRateGbps:5.4,Lanes:4,TempMin:-40,TempMax:85,Lifecycle:"Active",Stock:860,UnitPrice:2.20,Currency:"USD",LeadTimeDays:42,PinCompatible:"Yes",PCBChange:"None",DatasheetURL:"",ProductURL:"",Source:"Demo",Attributes:{"Package / Case":"WQFN","Data Rate":"5.4 Gbps","Operating Temperature":"-40°C to 85°C","Number of Lanes":"4"}},
  {MPN:"SAMPLE-DP-004",Manufacturer:"Vendor A",Category:"DisplayPort Redriver",Description:"4-lane redriver lifecycle risk sample",Package:"WQFN",SupplyVoltage:"3.3V",DataRateGbps:8.1,Lanes:4,TempMin:-40,TempMax:85,Lifecycle:"NRND",Stock:35,UnitPrice:2.95,Currency:"USD",LeadTimeDays:140,PinCompatible:"Yes",PCBChange:"None",DatasheetURL:"",ProductURL:"",Source:"Demo",Attributes:{"Package / Case":"WQFN","Data Rate":"8.1 Gbps","Operating Temperature":"-40°C to 85°C","Number of Lanes":"4"}},
  {MPN:"SAMPLE-DP-005",Manufacturer:"Vendor D",Category:"DisplayPort Redriver",Description:"High-speed DP redriver no stock sample",Package:"QFN",SupplyVoltage:"3.3V",DataRateGbps:8.1,Lanes:4,TempMin:-40,TempMax:85,Lifecycle:"Active",Stock:0,UnitPrice:3.05,Currency:"USD",LeadTimeDays:180,PinCompatible:"Unknown",PCBChange:"Major",DatasheetURL:"",ProductURL:"",Source:"Demo",Attributes:{"Package / Case":"QFN","Data Rate":"8.1 Gbps","Operating Temperature":"-40°C to 85°C","Number of Lanes":"4"}}
];

const demoBase = {MPN:"SN65DP141RLJ",Manufacturer:"Texas Instruments",Category:"DisplayPort Redriver",Description:"Demo base part",Package:"WQFN",DataRateGbps:8.1,Lanes:4,TempMin:-40,TempMax:85,Lifecycle:"NRND",Stock:0,UnitPrice:0,Currency:"USD",LeadTimeDays:0,Source:"Demo",DatasheetURL:"",ProductURL:"",Attributes:{"Package / Case":"WQFN","Data Rate":"8.1 Gbps","Number of Lanes":"4","Operating Temperature":"-40°C to 85°C"}};

const demoReplacement = [
  {...sampleCandidates[0],MPN:"ALT-DP-101",Manufacturer:"Vendor A",ReplacementBasis:"Demo similar",PinCompatible:"Unknown"},
  {...sampleCandidates[1],MPN:"ALT-DP-102",Manufacturer:"Vendor B",ReplacementBasis:"Demo similar",PinCompatible:"Unknown"},
  {...sampleCandidates[3],MPN:"ALT-DP-103",Manufacturer:"Vendor C",Lifecycle:"Active",Stock:280,LeadTimeDays:56,ReplacementBasis:"Demo similar",PinCompatible:"Unknown"}
];

const canonicalFields = [
  ["","사용 안 함"],["Item","Item / No"],["PartName","PART / Part Name"],["MPN","Manufacturer Part Number"],["Description","Description"],
  ["Manufacturer","Manufacturer"],["Qty","Qty"],["Reference","Reference Designator"],["Package","Package"],["PCBFootprint","PCB Footprint"],
  ["Lifecycle","Lifecycle"],["Stock","Stock"],["UnitPrice","Unit Price"],["DatasheetURL","Datasheet URL"],
  ["Remark","Remark / Note"],["Source","Data Source"]
];

const aliases = {
  PartName:["part","partname","part name","part_name","device","device name","devicename","component name","componentname","part type","parttype","파트명","part명","부품명"],
  MPN:["mpn","manufacturerpartnumber","manufacturerp/n","mfrpartnumber","partnumber","pn","품번","제조사품번"],
  Manufacturer:["manufacturer","mfr","maker","vendor","제조사","메이커"],
  Category:["category","type","분류","종류","용도"],Description:["description","desc","품명","설명"],
  Package:["package","pkg","패키지"],PCBFootprint:["pcbfootprint","pcb footprint","footprint","pcb pattern","land pattern","pcbdecal","풋프린트","pcb풋프린트","랜드패턴"],SupplyVoltage:["supplyvoltage","voltage","vcc","전압","공급전압"],
  DataRateGbps:["datarategbps","datarate","gbps","rate","속도"],Lanes:["lanes","lane","lane수","채널"],
  TempMin:["tempmin","mintemp","minimumtemperature","최저온도"],TempMax:["tempmax","maxtemp","maximumtemperature","최고온도"],
  Lifecycle:["lifecycle","life cycle","status","상태"],Stock:["stock","inventory","qtyavailable","재고"],
  UnitPrice:["unitprice","price","단가","가격"],Currency:["currency","통화"],LeadTimeDays:["leadtimedays","leadtime","리드타임","납기"],
  PinCompatible:["pincompatible","pincompatibility","dropin","pintopin","핀호환"],PCBChange:["pcbchange","boardchange","pcb변경","회로변경"],
  DatasheetURL:["datasheeturl","datasheet","데이터시트"],ProductURL:["producturl","productlink","상품링크"],Source:["source","datasource","출처"]
};

let candidates = [...sampleCandidates], results = [], selectedIndex = null, originalPart = null;
let bomWorkbook = null, bomSheetName = null, bomHeaders = [], bomMapping = {}, bomDirty = false;
let currentMode = "requirements", health = {mouser:false,digikey:false,nexar:false};

function norm(s){ return String(s ?? "").trim().toLowerCase().replace(/[\s_\-./()]/g,""); }
function num(v,fallback=0){ if(v===""||v===null||v===undefined)return fallback; const n=Number(String(v).replace(/[^0-9+\-.]/g,"")); return Number.isFinite(n)?n:fallback; }
function boolYes(v){ return ["yes","y","true","1","가능","호환","compatible","direct"].includes(norm(v)); }
function pcbLevel(v){ const s=norm(v); if(["none","no","없음","불필요","0"].includes(s))return 0; if(["minor","small","최소","소폭","1"].includes(s))return 1; if(["unknown","미상",""].includes(s))return 3; return 2; }
function lifecycleClass(v){ const s=norm(v); if(/eol|endoflife|obsolete|discontinued/.test(s))return "bad"; if(/nrnd|notrecommended/.test(s))return "warn"; if(/active|production|new/.test(s))return "good"; return "warn"; }
function setStatus(t){ $("appStatus").textContent=t; }
function escapeHtml(v){ return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

async function loadHealth(){
  setStatus("API 상태 확인");
  try{
    const r=await fetch("/api/health",{cache:"no-store"});
    const text=await r.text(); let j={}; try{j=JSON.parse(text)}catch{}
    if(!r.ok)throw new Error(j.error||text||`HTTP ${r.status}`);
    health=j.providers||{};
    setApiStatus("statusMouser",health.mouser,"Mouser");
    setApiStatus("statusDigiKey",health.digikey,"DigiKey");
    setApiStatus("statusNexar",health.nexar,"Nexar");
    const on=Object.entries(health).filter(([,v])=>v).map(([k])=>k);
    if(on.length){
      $("apiHint").textContent=`실시간 연결 정상: ${on.join(", ")}. DigiKey/Mouser 중 한쪽만 정상이어도 자동선정을 계속합니다.`;
      setStatus("실시간 API 준비됨");
      return {ok:true,providers:health,detail:j};
    }
    const reason=j.backendConfigured===false?"Vercel API 주소가 설정되지 않았습니다.":"Vercel에는 연결됐지만 DigiKey/Mouser API 설정이 없습니다.";
    $("apiHint").textContent=reason;
    setStatus("실시간 API 미설정");
    return {ok:false,providers:health,detail:j,error:reason};
  }catch(e){
    health={mouser:false,digikey:false,nexar:false};
    ["statusMouser","statusDigiKey","statusNexar"].forEach(id=>{ const el=$(id); el.className="api-dot err"; el.textContent="연결 실패"; });
    $("apiHint").textContent=`실시간 API 연결 실패: ${e.message}. Demo 부품으로 대체하지 않습니다.`;
    setStatus("API 연결 실패");
    return {ok:false,providers:health,error:e.message};
  }
}
function setApiStatus(id,on){ const el=$(id); el.className=`api-dot ${on?"on":"off"}`; el.textContent=on?"연결 설정됨":"키 없음"; }
$("healthRefresh").addEventListener("click",loadHealth);

document.querySelectorAll(".mode-tab").forEach(btn=>btn.addEventListener("click",()=>{
  currentMode=btn.dataset.mode;
  document.querySelectorAll(".mode-tab").forEach(x=>x.classList.toggle("active",x===btn));
  $("requirementsPanel").classList.toggle("active",currentMode==="requirements");
  $("replacementPanel").classList.toggle("active",currentMode==="replacement");
  results=[]; selectedIndex=null; renderResults();
}));

async function readWorkbook(file){ const buf=await file.arrayBuffer(); return XLSX.read(buf,{type:"array"}); }

$("bomFile").addEventListener("change",async(e)=>{
  const file=e.target.files[0]; if(!file)return;
  try{
    setStatus("BOM 읽는 중"); bomWorkbook=await readWorkbook(file); bomSheetName=bomWorkbook.SheetNames[0];
    const ws=bomWorkbook.Sheets[bomSheetName], aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
    bomHeaders=(aoa[0]||[]).map(v=>String(v).trim()).filter(Boolean);
    $("bomFileName").textContent=file.name; $("bomSheetName").textContent=bomSheetName||"-"; $("bomHeaderCount").textContent=`${bomHeaders.length}개`;
    $("headerPreview").className="chips"; $("headerPreview").innerHTML=bomHeaders.map(h=>`<span class="chip">${escapeHtml(h)}</span>`).join("");
    loadOrAutoMapping(); renderMappingEditor(); $("saveMappingBtn").disabled=false; $("resetMappingBtn").disabled=false; $("downloadBomBtn").disabled=false;
    setStatus("BOM 로드 완료");
  }catch(err){ console.error(err); alert("BOM 파일을 읽지 못했습니다."); setStatus("오류"); }
});

function guessMapping(header){
  const h=norm(header);
  const map={Item:["item","no","번호","순번"],PartName:aliases.PartName,MPN:aliases.MPN,Description:aliases.Description,Manufacturer:aliases.Manufacturer,Qty:["qty","quantity","수량"],Reference:["reference","refdes","designator","reference designator","ref","위치","레퍼런스"],Package:aliases.Package,PCBFootprint:aliases.PCBFootprint,Lifecycle:aliases.Lifecycle,Stock:aliases.Stock,UnitPrice:aliases.UnitPrice,DatasheetURL:aliases.DatasheetURL,Remark:["remark","remarks","note","비고"],Source:aliases.Source};
  for(const [field,list] of Object.entries(map)) if(list.some(x=>norm(x)===h)) return field;
  return "";
}
function mappingKey(){ return "smartBomV2Mapping:"+bomHeaders.join("|"); }
function loadOrAutoMapping(){
  try{ const saved=localStorage.getItem(mappingKey()); if(saved){ bomMapping=JSON.parse(saved); $("mappingState").textContent="저장된 매핑"; return; }}catch{}
  bomMapping={}; bomHeaders.forEach(h=>bomMapping[h]=guessMapping(h)); $("mappingState").textContent="자동";
}
function renderMappingEditor(){
  if(!bomHeaders.length){ $("mappingEditor").innerHTML="BOM 파일을 먼저 업로드하세요."; return; }
  $("mappingEditor").className="mapping-editor";
  $("mappingEditor").innerHTML=bomHeaders.map((h,i)=>`<div class="mapping-row"><code>${escapeHtml(h)}</code><select data-header="${escapeHtml(h)}">${canonicalFields.map(([v,l])=>`<option value="${v}" ${bomMapping[h]===v?"selected":""}>${l}</option>`).join("")}</select></div>`).join("");
  $("mappingEditor").querySelectorAll("select").forEach(s=>s.addEventListener("change",()=>{bomMapping[s.dataset.header]=s.value;$("mappingState").textContent="수정됨";}));
}
$("saveMappingBtn").addEventListener("click",()=>{ localStorage.setItem(mappingKey(),JSON.stringify(bomMapping)); $("mappingState").textContent="저장됨"; });
$("resetMappingBtn").addEventListener("click",()=>{ localStorage.removeItem(mappingKey()); bomMapping={}; bomHeaders.forEach(h=>bomMapping[h]=guessMapping(h)); renderMappingEditor(); $("mappingState").textContent="자동"; });

$("candidateFile").addEventListener("change",async(e)=>{
  const file=e.target.files[0]; if(!file)return;
  try{
    const wb=await readWorkbook(file), ws=wb.Sheets[wb.SheetNames[0]], rows=XLSX.utils.sheet_to_json(ws,{defval:""});
    const mapped=rows.map(canonicalizeRow).filter(x=>x.MPN); if(!mapped.length)throw new Error("no MPN");
    candidates=mapped; $("candidateSource").textContent=file.name; updateCandidateCount(); setStatus("후보 리스트 로드 완료");
  }catch(err){ console.error(err); alert("후보 리스트를 읽지 못했습니다. MPN/Part Number 컬럼을 확인하세요."); }
});
function canonicalizeRow(row){
  const out={}; Object.entries(row).forEach(([key,value])=>{ const nk=norm(key); for(const [canon,list] of Object.entries(aliases)){ if(list.some(a=>norm(a)===nk)){out[canon]=value;break;} }});
  return {MPN:String(out.MPN??"").trim(),Manufacturer:String(out.Manufacturer??"").trim(),Category:String(out.Category??"").trim(),Description:String(out.Description??"").trim(),Package:String(out.Package??"").trim(),SupplyVoltage:String(out.SupplyVoltage??"").trim(),DataRateGbps:num(out.DataRateGbps,0),Lanes:num(out.Lanes,0),TempMin:num(out.TempMin,25),TempMax:num(out.TempMax,25),Lifecycle:String(out.Lifecycle??"Unknown").trim(),Stock:num(out.Stock,0),UnitPrice:num(out.UnitPrice,0),Currency:String(out.Currency??"").trim(),LeadTimeDays:num(out.LeadTimeDays,0),PinCompatible:String(out.PinCompatible??"Unknown").trim(),PCBChange:String(out.PCBChange??"Unknown").trim(),DatasheetURL:String(out.DatasheetURL??"").trim(),ProductURL:String(out.ProductURL??"").trim(),Source:String(out.Source??"Excel").trim(),Attributes:{}};
}

async function apiCall(payload){
  const r=await fetch("/api/components",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const text=await r.text(); let j; try{j=JSON.parse(text)}catch{throw new Error(text||`HTTP ${r.status}`)}
  if(!r.ok)throw new Error(j.error||j.message||`HTTP ${r.status}`);
  return j;
}

async function apiCallWithRetry(payload,attempts=3){
  let last;
  for(let i=0;i<attempts;i++){
    try{return await apiCall(payload);}
    catch(e){
      last=e;
      if(i<attempts-1)await new Promise(r=>setTimeout(r,350*(i+1)));
    }
  }
  throw last||new Error("API request failed");
}

$("liveSearchBtn").addEventListener("click",async()=>{
  const q=$("liveQuery").value.trim(); if(!q)return alert("API 검색어를 입력하세요.");
  try{
    setStatus("실시간 부품 검색 중"); $("liveSearchBtn").disabled=true;
    const j=await apiCallWithRetry({mode:"search",provider:$("providerSelect").value,query:q,manufacturer:$("reqManufacturer").value.trim(),limit:30},3);
    if(!j.parts?.length)throw new Error("검색 결과가 없습니다.");
    candidates=j.parts; originalPart=null; $("candidateSource").textContent=`API: ${j.providers?.join(", ")||$("providerSelect").value}`; updateCandidateCount();
    $("analyzeBtn").click(); setStatus("실시간 후보 분석 완료");
    if(j.warnings?.length) $("apiHint").textContent=j.warnings.join(" / ");
  }catch(err){ alert(`실시간 검색 실패: ${err.message}\nDigiKey/Mouser 연결 상태와 Vercel API 설정을 확인하세요.`); setStatus("검색 실패"); }
  finally{$("liveSearchBtn").disabled=false;}
});

$("replacementSearchBtn").addEventListener("click",async()=>{
  const mpn=$("baseMpn").value.trim(); if(!mpn)return alert("기존 MPN을 입력하세요.");
  try{
    setStatus("기존 부품/대체품 검색 중"); $("replacementSearchBtn").disabled=true;
    const j=await apiCall({mode:"replacement",provider:$("providerSelect").value,query:mpn,limit:num($("replacementLimit").value,15)});
    originalPart=j.original||null; candidates=j.parts||[]; if(!originalPart&&!candidates.length)throw new Error("대체품 결과가 없습니다.");
    $("candidateSource").textContent=`Replacement API: ${j.providers?.join(", ")||$("providerSelect").value}`; updateCandidateCount(); renderBasePart();
    analyzeReplacement(); setStatus("대체품 분석 완료"); if(j.warnings?.length)$("apiHint").textContent=j.warnings.join(" / ");
  }catch(err){ alert(`대체품 검색 실패: ${err.message}`); setStatus("검색 실패"); }
  finally{$("replacementSearchBtn").disabled=false;}
});
$("demoReplacementBtn").addEventListener("click",()=>{ originalPart={...demoBase}; candidates=demoReplacement.map(x=>({...x})); $("candidateSource").textContent="Demo Replacement"; updateCandidateCount(); renderBasePart(); analyzeReplacement(); setStatus("Demo 대체품 분석 완료"); });

function renderBasePart(){
  if(!originalPart){$("basePartCard").className="base-part muted";$("basePartCard").textContent="기준 부품 정보가 없습니다.";return;}
  $("basePartCard").className="base-part";
  $("basePartCard").innerHTML=`<strong>${escapeHtml(originalPart.MPN)}</strong> · ${escapeHtml(originalPart.Manufacturer||"-")} <span class="badge ${lifecycleClass(originalPart.Lifecycle)}">${escapeHtml(originalPart.Lifecycle||"Unknown")}</span>
  <div class="base-grid">
    <div><span>Package</span><b>${escapeHtml(originalPart.Package||"-")}</b></div>
    <div><span>Data Rate</span><b>${originalPart.DataRateGbps||"-"} Gbps</b></div>
    <div><span>Lane</span><b>${originalPart.Lanes||"-"}</b></div>
    <div><span>Stock</span><b>${originalPart.Stock??"-"}</b></div>
    <div><span>Source</span><b>${escapeHtml(originalPart.Source||"-")}</b></div>
  </div>`;
}

function getRequirements(){
  return {category:$("reqCategory").value.trim(),manufacturer:$("reqManufacturer").value.trim(),package:$("reqPackage").value.trim(),dataRate:num($("reqDataRate").value,0),lanes:num($("reqLanes").value,0),tempMin:num($("reqTempMin").value,-40),tempMax:num($("reqTempMax").value,85),stock:num($("reqStock").value,0),price:$("reqPrice").value===""?null:num($("reqPrice").value,0),lifecycle:$("reqLifecycle").value,pcbChange:$("reqPCBChange").value,dropIn:$("reqDropIn").checked,packageHard:$("reqPackageHard").checked};
}
function isLifecycleActive(v){ const s=norm(v); return /active|production|new/.test(s) && !/notactive/.test(s); }
function riskAssessment(c){
  let points=0, notes=[];
  const lc=lifecycleClass(c.Lifecycle); if(lc==="bad"){points+=4;notes.push("EOL/Obsolete");} else if(lc==="warn"){points+=2;notes.push("Lifecycle 주의");}
  if(num(c.Stock,0)<=0){points+=4;notes.push("재고 없음");} else if(c.Stock<50){points+=2;notes.push("재고 낮음");}
  if(c.LeadTimeDays>=120){points+=3;notes.push("Lead time 장기");} else if(c.LeadTimeDays>=84){points+=1;notes.push("Lead time 주의");}
  if(!c.DatasheetURL){points+=1;notes.push("Datasheet 링크 없음");}
  const level=points>=5?"High":points>=2?"Medium":"Low";
  return {level,notes,points};
}
function evaluate(c,r){
  let score=100, hard=[], warn=[], pos=[];
  const text=norm([c.Category,c.Description,c.MPN].join(" "));
  if(r.category){ const ts=r.category.toLowerCase().split(/\s+/).filter(Boolean), m=ts.filter(t=>text.includes(norm(t))).length; if(m===0){score-=15;warn.push("Category 일치도 낮음");} else pos.push("용도/설명 일치"); }
  if(c.DataRateGbps && c.DataRateGbps<r.dataRate)hard.push(`Data Rate ${c.DataRateGbps} < ${r.dataRate} Gbps`); else if(c.DataRateGbps)pos.push("Data Rate 충족"); else if(r.dataRate)warn.push("Data Rate API 값 없음");
  if(c.Lanes && c.Lanes<r.lanes)hard.push(`Lane ${c.Lanes} < ${r.lanes}`); else if(c.Lanes)pos.push("Lane 충족"); else if(r.lanes)warn.push("Lane API 값 없음");
  if(c.TempMin!==undefined&&c.TempMax!==undefined&&!(c.TempMin===25&&c.TempMax===25)){ if(c.TempMin>r.tempMin)hard.push(`최저온도 ${c.TempMin}°C 미충족`); if(c.TempMax<r.tempMax)hard.push(`최고온도 ${c.TempMax}°C 미충족`); } else warn.push("온도 API 값 없음");
  if(r.lifecycle==="active"&&!isLifecycleActive(c.Lifecycle))hard.push(`Lifecycle=${c.Lifecycle||"Unknown"}`);
  if(c.Stock<r.stock)hard.push(`재고 ${c.Stock} < ${r.stock}`); else if(c.Stock>=r.stock)pos.push("재고 충족");
  if(r.price!==null&&c.UnitPrice>r.price){score-=10;warn.push("단가 기준 초과");}
  if(r.manufacturer&&norm(c.Manufacturer)!==norm(r.manufacturer)){score-=6;warn.push("선호 제조사 아님");} else if(r.manufacturer)pos.push("선호 제조사");
  if(r.package){ if(norm(c.Package)===norm(r.package))pos.push("Package 일치"); else if(r.packageHard)hard.push(`Package ${c.Package||"Unknown"} ≠ ${r.package}`); else {score-=8;warn.push("Package 불일치");} }
  if(r.dropIn){ if(boolYes(c.PinCompatible))pos.push("Pin-to-Pin 표시됨"); else hard.push("Pin-to-Pin 검증 정보 없음"); }
  const pl=pcbLevel(c.PCBChange); if(r.pcbChange==="none"&&pl>0)hard.push(`PCB 변경 상태=${c.PCBChange||"Unknown"}`); if(r.pcbChange==="minor"&&pl===2)hard.push("PCB Major 변경 필요"); if(pl===1){score-=5;warn.push("PCB 소폭 변경");} if(pl===2){score-=10;warn.push("PCB 변경 큼");} if(pl===3)warn.push("PCB 변경 수준 미상");
  const qual=evaluateQualificationProfile(c,r.category,c.Description);
  hard.push(...qual.hard); warn.push(...qual.warn); pos.push(...qual.pos); score+=qual.delta;

  const risk=riskAssessment(c); score-=risk.level==="High"?12:risk.level==="Medium"?5:0; score=Math.max(0,Math.min(100,Math.round(score)));
  const verdict=hard.length?"부적합":(score<85||warn.length>=3?"조건부":"적합");
  return {...c,Score:score,Verdict:verdict,Risk:risk.level,RiskNotes:risk.notes,Reasons:[...hard.map(x=>`✕ ${x}`),...warn.map(x=>`△ ${x}`),...pos.slice(0,4).map(x=>`✓ ${x}`)]};
}

function inferReplacementPCB(c,base){
  if(c.PCBChange&&norm(c.PCBChange)!=="unknown")return c.PCBChange;
  if(base?.Package&&c.Package&&norm(base.Package)===norm(c.Package))return "Unknown"; // package equality is not pin equality
  return "Major";
}
function analyzeReplacement(){
  const goal=$("replacementGoal").value;
  results=candidates.map(c=>{
    const cc={...c,PCBChange:inferReplacementPCB(c,originalPart)};
    let score=100, hard=[],warn=[],pos=[];
    if(originalPart){
      if(originalPart.Package&&cc.Package){ if(norm(originalPart.Package)===norm(cc.Package)){score+=3;pos.push("Package 동일");} else {score-=18;warn.push(`Package 변경: ${originalPart.Package} → ${cc.Package}`); if(goal==="dropin")hard.push("Drop-in 목표인데 Package 불일치");} } else warn.push("Package 비교 정보 부족");
      if(originalPart.DataRateGbps&&cc.DataRateGbps){ if(cc.DataRateGbps<originalPart.DataRateGbps)hard.push("Data Rate 하향"); else pos.push("Data Rate 동등/상향"); }
      if(originalPart.Lanes&&cc.Lanes&&cc.Lanes<originalPart.Lanes)hard.push("Lane 수 하향");
      if(originalPart.TempMin!==undefined&&cc.TempMin!==undefined&&cc.TempMin>originalPart.TempMin)warn.push("최저온도 범위 축소");
      if(originalPart.TempMax!==undefined&&cc.TempMax!==undefined&&cc.TempMax<originalPart.TempMax)warn.push("최고온도 범위 축소");
    }
    if(cc.ReplacementBasis)pos.push(`후보 근거: ${cc.ReplacementBasis}`);
    if(/direct|substitut/i.test(cc.SubstituteType||""))pos.push(`API Substitute: ${cc.SubstituteType}`);
    if(boolYes(cc.PinCompatible))pos.push("Pin 호환 표시"); else warn.push("Pin-to-Pin 미검증");
    if(goal==="dropin"&&!boolYes(cc.PinCompatible))score-=8;
    if(!isLifecycleActive(cc.Lifecycle)){ if(lifecycleClass(cc.Lifecycle)==="bad")hard.push(`Lifecycle=${cc.Lifecycle}`); else warn.push(`Lifecycle=${cc.Lifecycle}`); }
    if(cc.Stock<=0)hard.push("재고 0"); else if(cc.Stock<50)warn.push("재고 낮음");
    const risk=riskAssessment(cc); score-=risk.level==="High"?12:risk.level==="Medium"?5:0; score=Math.max(0,Math.min(100,Math.round(score)));
    const verdict=hard.length?"부적합":(score<82||warn.length>=3?"조건부":"적합");
    return {...cc,Score:score,Verdict:verdict,Risk:risk.level,RiskNotes:risk.notes,Reasons:[...hard.map(x=>`✕ ${x}`),...warn.map(x=>`△ ${x}`),...pos.map(x=>`✓ ${x}`)]};
  }).sort(sortResults);
  selectedIndex=null; renderResults();
}
function sortResults(a,b){const rank={"적합":0,"조건부":1,"부적합":2};return (rank[a.Verdict]-rank[b.Verdict])||(b.Score-a.Score);}

$("analyzeBtn").addEventListener("click",()=>{ results=candidates.map(c=>evaluate(c,getRequirements())).sort(sortResults); selectedIndex=null; renderResults(); setStatus("분석 완료"); });

function renderResults(){
  const body=$("resultBody");
  if(!results.length){body.innerHTML=`<tr><td colspan="17" class="empty">분석 결과가 없습니다.</td></tr>`; ["kpiAll","kpiPass","kpiConditional","kpiFail","kpiRisk"].forEach(id=>$(id).textContent="0"); updateSelection(); return;}
  body.innerHTML=results.map((r,i)=>{
    const cls=r.Verdict==="적합"?"good":r.Verdict==="조건부"?"warn":"bad", riskCls=r.Risk==="Low"?"good":r.Risk==="Medium"?"warn":"bad";
    const links=[r.DatasheetURL?`<a target="_blank" rel="noopener" href="${escapeHtml(r.DatasheetURL)}">Datasheet</a>`:"",r.ProductURL?`<a target="_blank" rel="noopener" href="${escapeHtml(r.ProductURL)}">Product</a>`:""].filter(Boolean).join("");
    return `<tr data-index="${i}" class="${selectedIndex===i?"selected":""}">
      <td><input type="radio" name="pick" ${selectedIndex===i?"checked":""}></td>
      <td><span class="badge ${cls}">${r.Verdict}</span></td><td class="score">${r.Score}</td><td><span class="badge ${riskCls}">${r.Risk||"?"}</span></td>
      <td><b>${escapeHtml(r.MPN)}</b></td><td>${escapeHtml(r.Manufacturer||"-")}</td><td><span class="badge info">${escapeHtml(r.Source||"-")}</span></td>
      <td>${escapeHtml(r.Package||"-")}</td><td>${r.DataRateGbps||"-"}</td><td>${r.Lanes||"-"}</td><td>${formatTemp(r)}</td>
      <td><span class="badge ${lifecycleClass(r.Lifecycle)}">${escapeHtml(r.Lifecycle||"Unknown")}</span></td><td>${r.Stock??"-"}</td><td>${r.LeadTimeDays?`${r.LeadTimeDays}d`:"-"}</td>
      <td>${r.UnitPrice?`${r.UnitPrice} ${escapeHtml(r.Currency||"")}`:"-"}</td><td class="reason">${r.Reasons.map(escapeHtml).join("<br>")}</td><td class="link-cell">${links||"-"}</td>
    </tr>`;
  }).join("");
  body.querySelectorAll("tr[data-index]").forEach(tr=>tr.addEventListener("click",()=>{selectedIndex=Number(tr.dataset.index);renderResults();updateSelection();}));
  $("kpiAll").textContent=results.length;$("kpiPass").textContent=results.filter(x=>x.Verdict==="적합").length;$("kpiConditional").textContent=results.filter(x=>x.Verdict==="조건부").length;$("kpiFail").textContent=results.filter(x=>x.Verdict==="부적합").length;$("kpiRisk").textContent=results.filter(x=>x.Risk==="High").length;
  $("exportReportBtn").disabled=false;
}
function formatTemp(r){ if(r.TempMin===undefined||r.TempMax===undefined||(r.TempMin===25&&r.TempMax===25))return "-"; return `${r.TempMin}~${r.TempMax}°C`; }
function updateSelection(){
  const r=results[selectedIndex], enabled=!!r; $("addBomBtn").disabled=!enabled; $("compareBtn").disabled=!enabled||!originalPart;
  $("selectionInfo").className=enabled?"selection-info":"selection-info muted"; $("selectionInfo").textContent=enabled?`선정: ${r.MPN} / ${r.Manufacturer||"-"} / ${r.Verdict} / Score ${r.Score} / Risk ${r.Risk}`:"선정된 부품이 없습니다.";
}

$("compareBtn").addEventListener("click",()=>{ const c=results[selectedIndex]; if(!c||!originalPart)return; renderComparison(originalPart,c); document.getElementById("comparisonCard").scrollIntoView({behavior:"smooth"}); });
function attrMap(p){
  const m={...(p.Attributes||{})};
  if(p.Package)m["Package / Case"]??=p.Package;if(p.DataRateGbps)m["Data Rate"]??=`${p.DataRateGbps} Gbps`;if(p.Lanes)m["Number of Lanes"]??=String(p.Lanes);
  if(!(p.TempMin===25&&p.TempMax===25)&&p.TempMin!==undefined)m["Operating Temperature"]??=`${p.TempMin}°C to ${p.TempMax}°C`;
  m["Lifecycle"]??=p.Lifecycle||"Unknown";m["Stock"]??=String(p.Stock??"");m["Lead Time"]??=p.LeadTimeDays?`${p.LeadTimeDays} days`:"";
  return m;
}
function renderComparison(a,b){
  const am=attrMap(a),bm=attrMap(b), keys=[...new Set([...Object.keys(am),...Object.keys(bm)])].sort();
  $("comparisonArea").className="table-wrap";
  $("comparisonArea").innerHTML=`<table class="compare-table"><thead><tr><th>Spec / Attribute</th><th>${escapeHtml(a.MPN)}</th><th>${escapeHtml(b.MPN)}</th><th>판정</th></tr></thead><tbody>${keys.map(k=>{const av=String(am[k]??""),bv=String(bm[k]??"");const same=norm(av)&&norm(av)===norm(bv);const cls=!av||!bv?"compare-missing":same?"compare-same":"compare-diff";return `<tr class="${cls}"><td><b>${escapeHtml(k)}</b></td><td>${escapeHtml(av||"-")}</td><td>${escapeHtml(bv||"-")}</td><td>${!av||!bv?"정보 부족":same?"동일":"검토 필요"}</td></tr>`}).join("")}</tbody></table>`;
}

function ensureBomWorkbook(){
  if(bomWorkbook)return;
  bomWorkbook=XLSX.utils.book_new();bomSheetName="BOM";bomHeaders=["Item","PART","Part Number","Description","Manufacturer","Qty","Package","Lifecycle","Stock","Remark"];
  bomMapping={"Item":"Item","PART":"PartName","Part Number":"MPN","Description":"Description","Manufacturer":"Manufacturer","Qty":"Qty","Package":"Package","Lifecycle":"Lifecycle","Stock":"Stock","Remark":"Remark"};
  XLSX.utils.book_append_sheet(bomWorkbook,XLSX.utils.aoa_to_sheet([bomHeaders]),bomSheetName);$("bomFileName").textContent="새 BOM";$("bomSheetName").textContent=bomSheetName;$("bomHeaderCount").textContent=`${bomHeaders.length}개`;
}
function valueForField(field,p,itemNo){ const map={Item:itemNo,PartName:(p.PartName||p.Category||""),MPN:p.MPN,Description:p.Description,Manufacturer:p.Manufacturer,Qty:1,Reference:"",Package:p.Package,PCBFootprint:(p.PCBFootprint||p.Attributes?.["PCB Footprint"]||p.Attributes?.["Footprint"]||""),Lifecycle:p.Lifecycle,Stock:p.Stock,UnitPrice:p.UnitPrice,DatasheetURL:p.DatasheetURL,Remark:`Selector:${p.Verdict}, Score:${p.Score}, Risk:${p.Risk}`,Source:p.Source}; return map[field]??""; }
$("addBomBtn").addEventListener("click",()=>{
  const p=results[selectedIndex];if(!p)return;
  if(window.smartBomV53?.hasSelectedBomRow?.() && window.smartBomV53.applySelectedPartToBom(p)) return;
  ensureBomWorkbook();const ws=bomWorkbook.Sheets[bomSheetName],aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:""}),itemNo=Math.max(1,aoa.length);
  const row=bomHeaders.map(h=>valueForField(bomMapping[h]||guessMapping(h),p,itemNo));XLSX.utils.sheet_add_aoa(ws,[row],{origin:-1});bomDirty=true;$("downloadBomBtn").disabled=false;$("selectionInfo").textContent=`BOM 추가 완료: ${p.MPN}`;
});
$("downloadBomBtn").addEventListener("click",()=>{ensureBomWorkbook();XLSX.writeFile(bomWorkbook,bomDirty?"BOM_Selected_V5_3.xlsx":"BOM_Copy_V5_3.xlsx");});
$("exportReportBtn").addEventListener("click",()=>{
  if(!results.length)return;const wb=XLSX.utils.book_new(), rows=results.map(r=>({Verdict:r.Verdict,Score:r.Score,Risk:r.Risk,MPN:r.MPN,Manufacturer:r.Manufacturer,Source:r.Source,Package:r.Package,DataRateGbps:r.DataRateGbps,Lanes:r.Lanes,TempMin:r.TempMin,TempMax:r.TempMax,Lifecycle:r.Lifecycle,Stock:r.Stock,LeadTimeDays:r.LeadTimeDays,UnitPrice:r.UnitPrice,Currency:r.Currency,ReplacementBasis:r.ReplacementBasis||"",Reasons:r.Reasons.join(" | "),Datasheet:r.DatasheetURL,ProductURL:r.ProductURL}));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"Selection_Report");
  if(originalPart)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([originalPart]),"Base_Part");
  XLSX.writeFile(wb,"Component_Selection_Report_V5_3.xlsx");
});

function updateCandidateCount(){$("candidateCount").textContent=`${candidates.length}개`;$("kpiAll").textContent=candidates.length;}
updateCandidateCount(); loadHealth();


// V3 Datasheet module bridge. The PDF module reads only the current selected/base metadata.
window.smartBomBridge = {
  getOriginalPart: () => originalPart ? {...originalPart} : null,
  getSelectedPart: () => (selectedIndex !== null && results[selectedIndex]) ? {...results[selectedIndex]} : null,
  getMode: () => currentMode
};



// V5.3A qualification profiles
const SELECTION_PROFILES = {
  industrial: {
    label: "Industrial Grade",
    description: "기본 프로파일. 선택한 동작온도, Active/Production, 재고 및 일반 산업용 적합성을 우선합니다. AEC 인증은 필수가 아닙니다."
  },
  aecq200: {
    label: "AEC-Q200",
    description: "수동 전기부품 전용. 후보에서 AEC-Q200 qualification 근거가 확인되어야 적합으로 판정합니다."
  },
  automotive: {
    label: "Automotive",
    description: "품목에 따라 AEC-Q100(IC), Q101(Discrete), Q102(Optoelectronic), Q104(MCM), Q200(Passive)을 자동 기대 규격으로 적용합니다."
  },
  mil_ground: {
    label: "Military / Ground Hi-Rel",
    description: "지상 군용/Hi-Rel 검토 프로파일. MIL/QPL/QML/JAN/Hi-Rel 근거를 우선하되 자동 군용 승인은 하지 않습니다."
  }
};

function currentSelectionProfile(){
  return $("selectionProfile")?.value || "industrial";
}
function profileConfig(){
  return SELECTION_PROFILES[currentSelectionProfile()] || SELECTION_PROFILES.industrial;
}
function inferQualificationKind(category="", description=""){
  const t=`${category} ${description}`.toLowerCase();
  if(/capacitor|resistor|inductor|transformer|thermistor|varistor|crystal|ferrite|passive|mlcc/.test(t)) return "passive";
  if(/opto|led|laser|photodiode|phototransistor|optical/.test(t)) return "opto";
  if(/mcm|multi.?chip|module.*semiconductor/.test(t)) return "mcm";
  if(/diode|transistor|mosfet|igbt|thyristor|rectifier|discrete/.test(t)) return "discrete";
  if(/\bic\b|redriver|driver|transceiver|regulator|controller|processor|memory|amplifier|switch|mux|interface/.test(t)) return "ic";
  return "generic";
}
function expectedAutomotiveQualification(category="", description=""){
  const k=inferQualificationKind(category,description);
  return ({passive:"AEC-Q200",ic:"AEC-Q100",discrete:"AEC-Q101",opto:"AEC-Q102",mcm:"AEC-Q104"})[k] || "";
}
function candidateQualificationText(c){
  let attrs="";
  try{attrs=JSON.stringify(c?.Attributes||{});}catch{}
  return `${c?.Category||""} ${c?.Description||""} ${c?.Lifecycle||""} ${attrs}`.toUpperCase();
}
function hasQualification(c, q){
  const t=candidateQualificationText(c);
  const qq=String(q||"").toUpperCase().replace(/\s+/g,"");
  const tt=t.replace(/\s+/g,"");
  return !!q && tt.includes(qq);
}
function hasAutomotiveEvidence(c){
  const t=candidateQualificationText(c);
  return /AEC[\s-]?Q(?:100|101|102|104|200)|AUTOMOTIVE|AUTO GRADE|AUTOMOTIVE GRADE/.test(t);
}
function hasMilitaryEvidence(c){
  const t=candidateQualificationText(c);
  return /MIL[-\s]?PRF|MIL[-\s]?STD|QML|QPL|JANTXV|JANTX|JAN\b|HI[-\s]?REL|MILITARY/.test(t);
}
function evaluateQualificationProfile(c, category="", description=""){
  const profile=currentSelectionProfile();
  const hard=[], warn=[], pos=[];
  let delta=0;

  if(profile==="industrial"){
    if(hasAutomotiveEvidence(c)){ pos.push("Automotive/AEC qualification 추가 여유"); delta+=1; }
    return {hard,warn,pos,delta,expected:"Industrial"};
  }

  if(profile==="aecq200"){
    const kind=inferQualificationKind(category,description||c?.Description||"");
    if(kind!=="passive"){
      hard.push("AEC-Q200 프로파일은 수동부품 전용");
      delta-=20;
    } else if(hasQualification(c,"AEC-Q200")){
      pos.push("AEC-Q200 qualification 근거 확인");
      delta+=8;
    } else {
      hard.push("AEC-Q200 qualification 근거 없음");
      delta-=20;
    }
    return {hard,warn,pos,delta,expected:"AEC-Q200"};
  }

  if(profile==="automotive"){
    const expected=expectedAutomotiveQualification(category,description||c?.Description||"");
    if(expected && hasQualification(c,expected)){
      pos.push(`${expected} qualification 근거 확인`);
      delta+=8;
    } else if(hasAutomotiveEvidence(c)){
      warn.push(`${expected||"AEC"} 정확 규격 미확인, Automotive 표기만 확인`);
      delta-=4;
    } else {
      hard.push(`${expected||"Automotive/AEC"} qualification 근거 없음`);
      delta-=18;
    }
    return {hard,warn,pos,delta,expected:expected||"Automotive"};
  }

  if(profile==="mil_ground"){
    if(hasMilitaryEvidence(c)){
      pos.push("MIL/QPL/QML/JAN/Hi-Rel 근거 확인");
      delta+=8;
    } else {
      warn.push("군용/Hi-Rel qualification 근거 미확인");
      delta-=8;
    }
    return {hard,warn,pos,delta,expected:"Military / Hi-Rel"};
  }

  return {hard,warn,pos,delta,expected:""};
}
function applySelectionProfileUI(){
  const cfg=profileConfig();
  const hint=$("selectionProfileHint");
  if(hint){
    hint.innerHTML=`<b>${cfg.label}</b>: ${cfg.description}<br><span class="muted">동작온도 범위는 프로파일과 별도로 현재 선택한 -40~85/100/105/125°C 값을 Hard Constraint로 적용합니다.</span>`;
  }
}


// V5.1 default engineering selection rules
const DEFAULT_SELECTION_RULES = {
  temperatureRanges: [
    { min: -40, max: 85, label: "-40 ~ +85 °C" },
    { min: -40, max: 100, label: "-40 ~ +100 °C" },
    { min: -40, max: 105, label: "-40 ~ +105 °C" },
    { min: -40, max: 125, label: "-40 ~ +125 °C" }
  ],
  preferredManufacturers: [
    { patterns: [/ceramic\\s*capacitor/i, /\\bmlcc\\b/i, /세라믹\\s*캐패시터/i, /세라믹\\s*커패시터/i], manufacturer: "KEMET", label: "Ceramic Capacitor / MLCC" },
    { patterns: [/chip\\s*resistor/i, /chip\\s*resistance/i, /칩\\s*저항/i], manufacturer: "VISHAY", label: "Chip Resistor" }
  ]
};
let lastAutoManufacturer = "";
function preferredManufacturerForCategory(category){
  const text=String(category||"").trim();
  for(const rule of DEFAULT_SELECTION_RULES.preferredManufacturers){
    if(rule.patterns.some(rx=>rx.test(text))) return rule;
  }
  return null;
}
function applyPreferredManufacturerRule(force=false){
  const toggle=$("autoPreferredManufacturer");
  if(toggle && !toggle.checked) return;
  const rule=preferredManufacturerForCategory($("reqCategory")?.value||"");
  const input=$("reqManufacturer"); if(!input)return;
  if(rule){
    if(force || !input.value.trim() || input.value.trim()===lastAutoManufacturer){
      input.value=rule.manufacturer;
      lastAutoManufacturer=rule.manufacturer;
    }
    const hint=$("preferredManufacturerHint");
    if(hint) hint.textContent=`기본 선호 제조사 자동 적용: ${rule.label} → ${rule.manufacturer}. 필요하면 직접 변경할 수 있습니다.`;
  } else {
    if(input.value.trim()===lastAutoManufacturer){ input.value=""; lastAutoManufacturer=""; }
    const hint=$("preferredManufacturerHint");
    if(hint) hint.textContent="기본 제조사 규칙: Ceramic Capacitor / MLCC → KEMET, Chip Resistor → VISHAY. 기타 Category는 제조사 자동 지정 없음.";
  }
}
function applyTemperaturePreset(){
  const sel=$("reqTempPreset"); if(!sel)return;
  if(sel.value==="custom") return;
  const [min,max]=sel.value.split(",").map(Number);
  $("reqTempMin").value=String(min); $("reqTempMax").value=String(max);
}
function syncTemperaturePresetFromInputs(){
  const sel=$("reqTempPreset"); if(!sel)return;
  const key=`${Number($("reqTempMin").value)},${Number($("reqTempMax").value)}`;
  const opt=[...sel.options].find(o=>o.value===key);
  sel.value=opt?key:"custom";
}
window.addEventListener("DOMContentLoaded",()=>{
  $("selectionProfile")?.addEventListener("change",()=>{
    applySelectionProfileUI();
    if(window.smartBomV53?.refreshProfile) window.smartBomV53.refreshProfile();
  });
  applySelectionProfileUI();
  $("reqTempPreset")?.addEventListener("change",applyTemperaturePreset);
  $("reqTempMin")?.addEventListener("input",syncTemperaturePresetFromInputs);
  $("reqTempMax")?.addEventListener("input",syncTemperaturePresetFromInputs);
  $("reqCategory")?.addEventListener("input",()=>applyPreferredManufacturerRule(false));
  $("autoPreferredManufacturer")?.addEventListener("change",()=>applyPreferredManufacturerRule(true));
  $("reqManufacturer")?.addEventListener("input",()=>{ if($("reqManufacturer").value.trim()!==lastAutoManufacturer) lastAutoManufacturer=""; });
  applyTemperaturePreset();
  applyPreferredManufacturerRule(false);
});

