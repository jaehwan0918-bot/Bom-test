import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.worker.min.mjs";

const $ = (id) => document.getElementById(id);
const state = { base: null, candidate: null, comparison: null };
window.smartBomDatasheetBridge = {
  getState: () => ({ base: state.base, candidate: state.candidate, comparison: state.comparison })
};

function esc(v) {
  return String(v ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function norm(s){ return String(s ?? "").trim().toLowerCase().replace(/[\s_\-./()]/g,""); }
function nums(s){ return (String(s ?? "").match(/[-+]?\d+(?:\.\d+)?/g)||[]).map(Number); }
function unique(arr){ return [...new Set((arr||[]).filter(Boolean))]; }
function setProgress(p, text){
  $("datasheetProgress").classList.remove("hidden");
  $("datasheetProgressBar").style.width = `${Math.max(0,Math.min(100,p))}%`;
  $("datasheetProgressText").textContent = text;
}
function hideProgress(){ setTimeout(()=>$("datasheetProgress").classList.add("hidden"), 450); }
function fileLabel(file){ return file ? `${file.name} · ${(file.size/1024/1024).toFixed(1)} MB` : "PDF 선택"; }

$("baseDatasheetFile").addEventListener("change", e => {
  $("baseDatasheetName").textContent = fileLabel(e.target.files[0]);
  $("baseParseState").textContent = "PDF 선택됨";
});
$("candidateDatasheetFile").addEventListener("change", e => {
  $("candidateDatasheetName").textContent = fileLabel(e.target.files[0]);
  $("candidateParseState").textContent = "PDF 선택됨";
});

$("fillBaseMpnBtn").addEventListener("click", ()=>{
  const p = window.smartBomBridge?.getOriginalPart?.();
  if (p?.MPN) $("dsBaseMpn").value = p.MPN;
  else if ($("baseMpn")?.value) $("dsBaseMpn").value = $("baseMpn").value.trim();
});
$("fillCandidateMpnBtn").addEventListener("click", ()=>{
  const p = window.smartBomBridge?.getSelectedPart?.();
  if (p?.MPN) $("dsCandidateMpn").value = p.MPN;
  else alert("먼저 위의 선정 결과에서 후보 부품을 선택하세요.");
});

document.querySelectorAll(".ds-tab").forEach(btn => btn.addEventListener("click", ()=>{
  document.querySelectorAll(".ds-tab").forEach(x=>x.classList.toggle("active",x===btn));
  document.querySelectorAll(".ds-panel").forEach(p=>p.classList.remove("active"));
  const map = {summary:"dsPanelSummary",pins:"dsPanelPins",evidence:"dsPanelEvidence",raw:"dsPanelRaw"};
  $(map[btn.dataset.dstab]).classList.add("active");
}));

$("clearDatasheetBtn").addEventListener("click", ()=>{
  state.base = state.candidate = state.comparison = null;
  $("baseDatasheetFile").value = ""; $("candidateDatasheetFile").value = "";
  $("baseDatasheetName").textContent = "PDF 선택"; $("candidateDatasheetName").textContent = "PDF 선택";
  $("baseParseState").textContent = "아직 분석하지 않았습니다."; $("candidateParseState").textContent = "아직 분석하지 않았습니다.";
  $("datasheetSummaryArea").className = "empty-block"; $("datasheetSummaryArea").textContent = "비교 결과가 여기에 표시됩니다.";
  $("pinCompareArea").className = "empty-block"; $("pinCompareArea").textContent = "Pin Functions / Terminal Functions 표를 찾으면 핀별 비교를 표시합니다.";
  $("evidenceCompareArea").className = "empty-block"; $("evidenceCompareArea").textContent = "설계 관련 근거 문장을 표시합니다.";
  $("rawExtractArea").className = "empty-block"; $("rawExtractArea").textContent = "자동 추출된 항목 및 페이지 정보를 표시합니다.";
  $("datasheetVerdict").className = "datasheet-verdict neutral";
  $("datasheetVerdict").innerHTML = "<div><span>자동 예비판정</span><strong>PDF 2개를 선택하면 비교를 시작할 수 있습니다.</strong></div>";
  $("exportDatasheetReportBtn").disabled = true;
});

$("parseDatasheetsBtn").addEventListener("click", async ()=>{
  const baseFile = $("baseDatasheetFile").files[0];
  const candFile = $("candidateDatasheetFile").files[0];
  if (!baseFile || !candFile) return alert("기준 부품과 후보 부품의 PDF 데이터시트 2개를 모두 선택하세요.");
  $("parseDatasheetsBtn").disabled = true;
  try{
    setProgress(3,"기준 데이터시트 읽는 중");
    state.base = await parsePdf(baseFile, p=>setProgress(3 + p*0.42, `기준 PDF 분석 ${Math.round(p)}%`));
    $("baseParseState").textContent = `${state.base.pages.length} pages · ${state.base.text.length.toLocaleString()} chars · 분석 완료`;

    setProgress(48,"후보 데이터시트 읽는 중");
    state.candidate = await parsePdf(candFile, p=>setProgress(48 + p*0.42, `후보 PDF 분석 ${Math.round(p)}%`));
    $("candidateParseState").textContent = `${state.candidate.pages.length} pages · ${state.candidate.text.length.toLocaleString()} chars · 분석 완료`;

    setProgress(92,"Spec / Pin / 설계 근거 비교 중");
    state.comparison = compareDatasheets(state.base, state.candidate);
    renderAll();
    window.smartBomDatasheetBridge = {
      getState: () => ({
        base: state.base,
        candidate: state.candidate,
        comparison: state.comparison
      })
    };
    window.dispatchEvent(new CustomEvent("smartbom:datasheet-comparison-ready", {
      detail: {
        baseFile: state.base?.fileName || "",
        candidateFile: state.candidate?.fileName || "",
        score: state.comparison?.score ?? null
      }
    }));
    setProgress(100,"자동 비교 완료");
    $("exportDatasheetReportBtn").disabled = false;
    hideProgress();
  }catch(err){
    console.error(err);
    alert(`PDF 분석 실패: ${err.message}`);
    $("datasheetVerdict").className = "datasheet-verdict bad";
    $("datasheetVerdict").innerHTML = `<div><span>분석 오류</span><strong>${esc(err.message)}</strong></div>`;
    hideProgress();
  }finally{
    $("parseDatasheetsBtn").disabled = false;
  }
});

async function parsePdf(file, onProgress){
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjsLib.getDocument({data, useSystemFonts:true});
  const pdf = await task.promise;
  const pages = [];
  let whole = "";
  for(let i=1;i<=pdf.numPages;i++){
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = rebuildLines(content.items);
    const text = lines.join("\n");
    pages.push({page:i, text, lines});
    whole += `\n--- PAGE ${i} ---\n${text}`;
    onProgress?.(i/pdf.numPages*100);
  }
  const extracted = extractEngineeringData(pages, whole);
  return {fileName:file.name, pages, text:whole, ...extracted};
}

function rebuildLines(items){
  const lines=[]; let current="", lastY=null;
  for(const item of items){
    const s=String(item.str||"").trim();
    if(!s) continue;
    const y = item.transform?.[5] ?? null;
    if(lastY!==null && y!==null && Math.abs(y-lastY)>2.2){
      if(current.trim()) lines.push(cleanLine(current));
      current = s;
    } else {
      current += (current && !/[-/(\[]$/.test(current) ? " " : "") + s;
    }
    if(item.hasEOL){
      if(current.trim()) lines.push(cleanLine(current));
      current="";
    }
    lastY=y;
  }
  if(current.trim()) lines.push(cleanLine(current));
  return lines.filter(x=>x.length>1);
}
function cleanLine(s){ return String(s).replace(/\s+/g," ").replace(/\s+([,.;:])/g,"$1").trim(); }

function extractEngineeringData(pages, whole){
  const data = {
    package: findPackage(pages),
    supply: findSupply(pages),
    dataRate: findDataRate(pages),
    lanes: findLanes(pages),
    temp: findOperatingTemp(pages),
    absoluteMax: findEvidence(pages, [/absolute maximum/i,/absolute max/i], 8, 10),
    impedance: findEvidence(pages, [/differential.{0,35}impedance/i,/impedance.{0,35}differential/i,/\b85\s*[ΩΩ]|85\s*ohm/i,/\b100\s*[ΩΩ]|100\s*ohm/i], 2, 12),
    acCoupling: findEvidence(pages, [/\bac[- ]?coupl/i,/coupling capacitor/i,/ac coupling capacitor/i], 2, 12),
    auxHpd: findEvidence(pages, [/\bAUX\b/i,/\bHPD\b/i,/hot plug detect/i,/displayport.*aux/i], 2, 14),
    equalization: findEvidence(pages, [/\bequalization\b/i,/\bCTLE\b/i,/\bDFE\b/i,/\bredriver\b/i], 2, 10),
    pins: extractPins(pages),
    pageCount: pages.length
  };
  data.impedanceValues = extractOhmValues(data.impedance);
  return data;
}
function contextsAround(lines, index, radius=1){
  const start=Math.max(0,index-radius), end=Math.min(lines.length,index+radius+1);
  return cleanLine(lines.slice(start,end).join(" "));
}
function evidenceItem(page, text){ return {page, text:cleanLine(text).slice(0,620)}; }
function findEvidence(pages, patterns, radius=1, limit=10){
  const out=[];
  for(const p of pages){
    for(let i=0;i<p.lines.length;i++){
      const line=p.lines[i];
      if(patterns.some(rx=>rx.test(line))){
        const ctx=contextsAround(p.lines,i,radius);
        if(!out.some(x=>norm(x.text)===norm(ctx))) out.push(evidenceItem(p.page,ctx));
        if(out.length>=limit)return out;
      }
    }
  }
  return out;
}
function findPackage(pages){
  const evidence=findEvidence(pages,[/package\s*\/?\s*case/i,/package type/i,/package option/i,/package information/i,/\bW?QFN\b/i,/\bBGA\b/i,/\bTSSOP\b/i,/\bVQFN\b/i],1,12);
  const candidates=[];
  for(const e of evidence){
    const hits=e.text.match(/\b(?:WQFN|VQFN|QFN|BGA|VFBGA|LGA|TSSOP|HTQFP|QFP|SOIC|SSOP|SOT|DFN)[A-Z0-9\-]*\b/ig)||[];
    candidates.push(...hits.map(x=>x.toUpperCase()));
  }
  return {value:mostCommon(candidates), evidence};
}
function findSupply(pages){
  const evidence=findEvidence(pages,[/supply voltage/i,/operating supply/i,/\bVCC\b.*\bV\b/i,/\bVDD\b.*\bV\b/i],1,14);
  const vals=[];
  for(const e of evidence){
    const ms=e.text.match(/[-+]?\d+(?:\.\d+)?\s*(?:V|volt)/ig)||[];
    vals.push(...ms.map(x=>Number(x.match(/[-+]?\d+(?:\.\d+)?/)[0])).filter(x=>x>0.3&&x<20));
  }
  const sorted=unique(vals).sort((a,b)=>a-b);
  return {min:sorted.length?sorted[0]:null,max:sorted.length?sorted[sorted.length-1]:null,values:sorted,evidence};
}
function findDataRate(pages){
  const evidence=findEvidence(pages,[/data rate/i,/Gbps/i,/Gb\/s/i,/Gbit\/s/i,/HBR3/i,/HBR2/i],1,16);
  const vals=[];
  for(const e of evidence){
    const re=/(\d+(?:\.\d+)?)\s*(Gbps|Gb\/s|Gbit\/s|GT\/s)/ig; let m;
    while((m=re.exec(e.text))) vals.push(Number(m[1]));
  }
  return {value:vals.length?Math.max(...vals):null, values:unique(vals).sort((a,b)=>a-b), evidence};
}
function findLanes(pages){
  const evidence=findEvidence(pages,[/\b[1-8][ -]?lane/i,/number of lanes/i,/lane count/i,/four lanes/i],1,12);
  const vals=[];
  for(const e of evidence){
    let m=e.text.match(/\b([1-8])\s*[- ]?lane/i); if(m)vals.push(Number(m[1]));
    if(/\bfour lanes?\b/i.test(e.text))vals.push(4);
    if(/\btwo lanes?\b/i.test(e.text))vals.push(2);
  }
  return {value:vals.length?Math.max(...vals):null,evidence};
}
function findOperatingTemp(pages){
  const evidence=findEvidence(pages,[/operating temperature/i,/ambient temperature/i,/free-air temperature/i,/junction temperature/i],1,14);
  const pairs=[];
  for(const e of evidence){
    const ns=nums(e.text).filter(x=>x>=-100&&x<=250);
    for(let i=0;i<ns.length-1;i++){
      if(ns[i] < ns[i+1] && ns[i]<=25 && ns[i+1]>=50) pairs.push([ns[i],ns[i+1]]);
    }
  }
  if(!pairs.length)return {min:null,max:null,evidence};
  pairs.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]));
  return {min:pairs[0][0],max:pairs[0][1],evidence};
}
function extractOhmValues(items){
  const vals=[];
  for(const e of items||[]){
    const re=/(\d+(?:\.\d+)?)\s*(?:Ω|Ω|ohm)/ig; let m; while((m=re.exec(e.text))) vals.push(Number(m[1]));
  }
  return unique(vals).filter(x=>x>=20&&x<=300).sort((a,b)=>a-b);
}
function mostCommon(arr){
  if(!arr.length)return null; const c={}; arr.forEach(x=>c[x]=(c[x]||0)+1);
  return Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0];
}

function extractPins(pages){
  const headings=[/pin functions/i,/pin description/i,/terminal functions/i,/terminal description/i,/pin assignments/i,/pin configuration/i];
  const raw=[]; const parsed=[];
  for(const p of pages){
    for(let i=0;i<p.lines.length;i++){
      if(!headings.some(rx=>rx.test(p.lines[i])))continue;
      const block=p.lines.slice(i,Math.min(p.lines.length,i+85));
      raw.push({page:p.page, heading:p.lines[i], lines:block.slice(0,70)});
      for(const line of block){
        const pin=parsePinLine(line,p.page);
        if(pin && !parsed.some(x=>x.number===pin.number && norm(x.name)===norm(pin.name))) parsed.push(pin);
      }
      if(parsed.length>0 && raw.length>=4) break;
    }
  }
  // Secondary pass for strong table-like pin lines if heading extraction failed.
  if(parsed.length<4){
    for(const p of pages){
      for(const line of p.lines){
        const pin=parsePinLine(line,p.page);
        if(pin && /^(?:IN|OUT|VCC|VDD|GND|AUX|HPD|SCL|SDA|RX|TX|NC|EN|EQ|MODE|SEL)/i.test(pin.name)){
          if(!parsed.some(x=>x.number===pin.number && norm(x.name)===norm(pin.name)))parsed.push(pin);
        }
        if(parsed.length>100)break;
      }
    }
  }
  return {items:parsed.slice(0,160), raw};
}
function parsePinLine(line,page){
  const s=cleanLine(line);
  let m=s.match(/^([A-Z]?\d{1,3}|[A-Z]\d{1,2})\s+([A-Z][A-Z0-9_+\-/#.]{1,24})\s+(.{3,})$/);
  if(!m) m=s.match(/^([A-Z][A-Z0-9_+\-/#.]{1,24})\s+([A-Z]?\d{1,3}|[A-Z]\d{1,2})\s+(.{3,})$/);
  if(!m)return null;
  let number,name,desc;
  if(/^\d|^[A-Z]\d/.test(m[1])){number=m[1];name=m[2];desc=m[3];}
  else{name=m[1];number=m[2];desc=m[3];}
  if(/^(table|figure|page|rev|www|copyright)$/i.test(name))return null;
  return {number,name,description:desc.slice(0,260),page};
}

function compareDatasheets(a,b){
  const rows=[];
  rows.push(compareText("Package",a.package.value,b.package.value,true));
  rows.push(compareNumericMin("Max Data Rate",a.dataRate.value,b.dataRate.value,"Gbps"));
  rows.push(compareNumericMin("Lane Count",a.lanes.value,b.lanes.value,""));
  rows.push(compareTemp(a.temp,b.temp));
  rows.push(compareSupply(a.supply,b.supply));
  rows.push(compareImpedance(a.impedanceValues,b.impedanceValues));
  const pins=comparePins(a.pins.items,b.pins.items);
  const criticalFail=rows.some(x=>x.status==="FAIL") || pins.status==="FAIL";
  const reviews=rows.filter(x=>x.status==="REVIEW"||x.status==="UNKNOWN").length + (pins.status==="REVIEW"?1:0);
  let verdict,cls,score=100;
  for(const r of rows){ if(r.status==="FAIL")score-=25; else if(r.status==="REVIEW")score-=10; else if(r.status==="UNKNOWN")score-=5; }
  if(pins.status==="FAIL")score-=30; else if(pins.status==="REVIEW")score-=15; else if(pins.status==="UNKNOWN")score-=7;
  score=Math.max(0,score);
  if(criticalFail){verdict="자동 비교상 중요한 차이가 있습니다. 설계 변경 검토가 필요합니다.";cls="bad";}
  else if(reviews>=2){verdict="치명적 차이는 확인되지 않았지만 미확인/차이 항목이 있어 엔지니어 검토가 필요합니다.";cls="warn";}
  else {verdict="추출된 주요 항목 기준으로 큰 차이는 확인되지 않았습니다. 원문 검증 후 승인하세요.";cls="good";}
  return {rows,pins,verdict,cls,score};
}
function compareText(label,av,bv,critical=false){
  if(!av||!bv)return {label,base:av||"-",candidate:bv||"-",status:"UNKNOWN",note:"한쪽 PDF에서 값을 찾지 못함"};
  const same=norm(av)===norm(bv);
  return {label,base:av,candidate:bv,status:same?"OK":critical?"FAIL":"REVIEW",note:same?"동일":critical?"Package 변경 가능성":"값 차이"};
}
function compareNumericMin(label,av,bv,unit){
  if(av==null||bv==null)return {label,base:av==null?"-":`${av} ${unit}`,candidate:bv==null?"-":`${bv} ${unit}`,status:"UNKNOWN",note:"값 추출 부족"};
  return {label,base:`${av} ${unit}`.trim(),candidate:`${bv} ${unit}`.trim(),status:bv>=av?"OK":"FAIL",note:bv>=av?"동등/상향":"후보가 기준보다 낮음"};
}
function compareTemp(a,b){
  if(a.min==null||a.max==null||b.min==null||b.max==null)return {label:"Operating Temperature",base:fmtRange(a),candidate:fmtRange(b),status:"UNKNOWN",note:"온도 범위 추출 부족"};
  const ok=b.min<=a.min&&b.max>=a.max;
  return {label:"Operating Temperature",base:`${a.min}~${a.max} °C`,candidate:`${b.min}~${b.max} °C`,status:ok?"OK":"REVIEW",note:ok?"후보 범위가 기준을 포함":"후보 온도 범위가 기준보다 좁을 수 있음"};
}
function fmtRange(x){return x.min==null||x.max==null?"-":`${x.min}~${x.max}`;}
function compareSupply(a,b){
  if(a.min==null||a.max==null||b.min==null||b.max==null)return {label:"Supply Voltage (자동 추출)",base:fmtSupply(a),candidate:fmtSupply(b),status:"UNKNOWN",note:"전원값은 표/조건 문맥 재확인 필요"};
  const overlap=Math.max(a.min,b.min)<=Math.min(a.max,b.max);
  return {label:"Supply Voltage (자동 추출)",base:fmtSupply(a),candidate:fmtSupply(b),status:overlap?"REVIEW":"FAIL",note:overlap?"범위 중첩 확인됨. 실제 권장동작조건 재확인":"전원 범위 불일치 가능성"};
}
function fmtSupply(x){return x.values?.length?x.values.join(", ")+" V":"-";}
function compareImpedance(a,b){
  if(!a.length&&!b.length)return {label:"Differential Impedance",base:"-",candidate:"-",status:"UNKNOWN",note:"PDF 문구에서 Ω 값을 찾지 못함"};
  const common=a.filter(x=>b.includes(x));
  return {label:"Differential Impedance evidence",base:a.length?a.join(", ")+" Ω":"-",candidate:b.length?b.join(", ")+" Ω":"-",status:common.length?"REVIEW":"UNKNOWN",note:common.length?`공통 값 ${common.join(", ")} Ω 발견. 입력/출력 위치 확인 필요`:"값/문맥을 원문에서 확인"};
}
function comparePins(a,b){
  if(a.length<4||b.length<4)return {status:"UNKNOWN",matched:0,different:0,baseCount:a.length,candidateCount:b.length,rows:[],note:"충분한 Pin table을 자동 추출하지 못함"};
  const bm=new Map(b.map(x=>[String(x.number).toUpperCase(),x]));
  const rows=[]; let matched=0,different=0;
  for(const p of a){
    const q=bm.get(String(p.number).toUpperCase());
    if(!q){rows.push({pin:p.number,base:p.name,candidate:"-",status:"MISS",basePage:p.page,candidatePage:null});different++;continue;}
    const same=pinNamesEquivalent(p.name,q.name);
    rows.push({pin:p.number,base:p.name,candidate:q.name,status:same?"OK":"DIFF",basePage:p.page,candidatePage:q.page}); same?matched++:different++;
  }
  const ratio=matched/Math.max(1,a.length);
  const status=ratio>=0.9&&different<=2?"OK":ratio>=0.65?"REVIEW":"FAIL";
  return {status,matched,different,baseCount:a.length,candidateCount:b.length,rows,note:`동일 핀명 비율 ${(ratio*100).toFixed(0)}%`};
}
function pinNamesEquivalent(a,b){
  const clean=x=>norm(x).replace(/(?:p|n)$/,"");
  if(norm(a)===norm(b))return true;
  const aa=clean(a),bb=clean(b);
  return aa.length>=3&&aa===bb;
}

function statusHtml(s){
  const map={OK:["status-ok","✓ OK"],REVIEW:["status-review","△ REVIEW"],FAIL:["status-fail","✕ FAIL"],UNKNOWN:["status-unknown","? UNKNOWN"]};
  const [c,t]=map[s]||map.UNKNOWN; return `<span class="${c}">${t}</span>`;
}
function renderAll(){
  const c=state.comparison;
  $("datasheetVerdict").className=`datasheet-verdict ${c.cls}`;
  $("datasheetVerdict").innerHTML=`<div><span>자동 예비판정 · ${c.score}/100</span><strong>${esc(c.verdict)}</strong></div>`;
  renderSummary(c); renderPins(c.pins); renderEvidence(); renderRaw();
}
function renderSummary(c){
  $("datasheetSummaryArea").className="table-wrap";
  $("datasheetSummaryArea").innerHTML=`<table class="ds-summary-table"><thead><tr><th>비교 항목</th><th>${esc($("dsBaseMpn").value||"기준 PDF")}</th><th>${esc($("dsCandidateMpn").value||"후보 PDF")}</th><th>판정</th><th>자동 판단</th></tr></thead><tbody>
    ${c.rows.map(r=>`<tr><td><b>${esc(r.label)}</b></td><td>${esc(r.base)}</td><td>${esc(r.candidate)}</td><td>${statusHtml(r.status)}</td><td>${esc(r.note)}</td></tr>`).join("")}
    <tr><td><b>Pin Map</b></td><td>${c.pins.baseCount} pins extracted</td><td>${c.pins.candidateCount} pins extracted</td><td>${statusHtml(c.pins.status)}</td><td>${esc(c.pins.note)}</td></tr>
  </tbody></table>`;
}
function renderPins(p){
  $("pinCompareArea").className="";
  if(!p.rows.length){
    $("pinCompareArea").innerHTML=`<div class="empty-block">${esc(p.note)}<br>PDF의 Pin Functions / Terminal Functions 표를 원문에서 확인하세요.</div>`;
    return;
  }
  $("pinCompareArea").innerHTML=`<div class="pin-stats">
    <div class="pin-stat">기준 추출 <b>${p.baseCount}</b></div><div class="pin-stat">후보 추출 <b>${p.candidateCount}</b></div>
    <div class="pin-stat">일치 <b>${p.matched}</b></div><div class="pin-stat">차이/누락 <b>${p.different}</b></div><div class="pin-stat">판정 <b>${p.status}</b></div>
  </div>
  <div class="table-wrap"><table><thead><tr><th>Pin</th><th>기준 Pin Name</th><th>후보 Pin Name</th><th>판정</th><th>근거 Page</th></tr></thead><tbody>
  ${p.rows.map(r=>`<tr><td>${esc(r.pin)}</td><td>${esc(r.base)}</td><td>${esc(r.candidate)}</td><td>${statusHtml(r.status==="OK"?"OK":r.status==="DIFF"?"FAIL":"REVIEW")}</td><td>Base p.${r.basePage||"-"} / Candidate p.${r.candidatePage||"-"}</td></tr>`).join("")}
  </tbody></table></div>`;
}
function renderEvidence(){
  const groups=[
    ["Differential Impedance","impedance"],["AC Coupling","acCoupling"],["AUX / HPD / Interface","auxHpd"],
    ["Absolute Maximum","absoluteMax"],["Equalization / Redriver","equalization"]
  ];
  $("evidenceCompareArea").className="evidence-grid";
  $("evidenceCompareArea").innerHTML=groups.map(([title,key])=>`<div class="evidence-box"><h4>${esc(title)}</h4>
    ${sideEvidence("기준",state.base[key])}${sideEvidence("후보",state.candidate[key])}
  </div>`).join("");
}
function sideEvidence(label,items){
  const list=(items||[]).slice(0,6);
  if(!list.length)return `<div class="evidence-item"><b>${label}</b>: 자동 추출 근거 없음</div>`;
  return `<div class="evidence-item"><b>${label}</b></div>`+list.map(x=>`<div class="evidence-item"><span class="page-tag">p.${x.page}</span>${esc(x.text)}</div>`).join("");
}
function renderRaw(){
  $("rawExtractArea").className="raw-grid";
  $("rawExtractArea").innerHTML=`<div class="raw-box"><h4>${esc($("dsBaseMpn").value||state.base.fileName)}</h4><pre>${esc(rawSummary(state.base))}</pre></div>
  <div class="raw-box"><h4>${esc($("dsCandidateMpn").value||state.candidate.fileName)}</h4><pre>${esc(rawSummary(state.candidate))}</pre></div>`;
}
function rawSummary(x){
  return JSON.stringify({
    file:x.fileName,pages:x.pageCount,
    package:x.package.value,supplyVoltages:x.supply.values,maxDataRateGbps:x.dataRate.value,
    lanes:x.lanes.value,operatingTemperature:{min:x.temp.min,max:x.temp.max},
    differentialImpedanceOhm:x.impedanceValues,pinsExtracted:x.pins.items.length,
    pinTableSections:x.pins.raw.map(r=>({page:r.page,heading:r.heading}))
  },null,2);
}

$("exportDatasheetReportBtn").addEventListener("click", ()=>{
  if(!state.comparison || typeof XLSX==="undefined")return;
  const wb=XLSX.utils.book_new();
  const summary=state.comparison.rows.map(r=>({Item:r.label,Base:r.base,Candidate:r.candidate,Status:r.status,AutoJudgement:r.note}));
  summary.push({Item:"Pin Map",Base:`${state.comparison.pins.baseCount} pins`,Candidate:`${state.comparison.pins.candidateCount} pins`,Status:state.comparison.pins.status,AutoJudgement:state.comparison.pins.note});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(summary),"Auto_Comparison");

  if(state.comparison.pins.rows.length){
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.comparison.pins.rows.map(r=>({
      Pin:r.pin,BasePin:r.base,CandidatePin:r.candidate,Status:r.status,BasePage:r.basePage,CandidatePage:r.candidatePage
    }))),"Pin_Comparison");
  }
  const ev=[];
  for(const [label,key] of [["Impedance","impedance"],["AC Coupling","acCoupling"],["AUX_HPD","auxHpd"],["Absolute Max","absoluteMax"],["Equalization","equalization"]]){
    for(const side of ["base","candidate"]){
      for(const x of state[side][key]||[])ev.push({Category:label,Side:side,Page:x.page,Evidence:x.text});
    }
  }
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(ev),"Evidence");
  XLSX.writeFile(wb,`Datasheet_Comparison_${$("dsBaseMpn").value||"BASE"}_vs_${$("dsCandidateMpn").value||"CANDIDATE"}.xlsx`);
});
