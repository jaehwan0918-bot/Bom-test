const $ = (id) => document.getElementById(id);

const C = {
  nets: new Map(),
  components: new Map(),
  source: "",
  report: null,
  demo: false
};

function esc(v){
  return String(v ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function norm(s){ return String(s ?? "").trim().toUpperCase(); }
function clean(s){ return String(s ?? "").replace(/\s+/g," ").trim(); }
function isPassive(ref){ return /^(R|C|L|FB|FL|F|JMP|JP)\d+/i.test(ref||""); }
function compType(ref){
  const p=String(ref||"").match(/^[A-Za-z]+/)?.[0]?.toUpperCase()||"";
  if(p==="R") return "R"; if(p==="C")return "C"; if(p==="L")return "L";
  if(p==="FB"||p==="FL")return "FB"; return p;
}
function classifyNet(name){
  const n=String(name||"").toUpperCase();
  if(/^(GND|AGND|DGND|PGND)|GROUND/.test(n))return "ground";
  if(/(^|[_/])(VCC|VDD|AVDD|DVDD|PVDD|VBUS|VCORE|1V8|3V3|5V|12V)/.test(n))return "power";
  if(/(_P|_N|P$|N$|\+|\-)$/.test(n)&&/(DP|TX|RX|ML|LANE|CLK|USB|PCIE|HDMI|SERDES|DIFF)/.test(n))return "diff";
  if(/CLK|CLOCK|REFCLK/.test(n))return "clock";
  if(/AUX|HPD|RESET|RST|EN|ENABLE|SEL|MODE|SCL|SDA|I2C|SMBUS|INT|IRQ/.test(n))return "control";
  if(/DP|TX|RX|LANE|ML|HDMI|USB|PCIE|SERDES/.test(n))return "highspeed";
  return "signal";
}
function nodeKey(ref,pin){return `${norm(ref)}.${String(pin).trim().toUpperCase()}`;}
function addNode(net,ref,pin){
  net=clean(net); ref=norm(ref); pin=String(pin??"").trim();
  if(!net||!ref||!pin)return;
  if(!C.nets.has(net))C.nets.set(net,[]);
  const nodes=C.nets.get(net);
  if(!nodes.some(x=>x.ref===ref&&String(x.pin)===pin))nodes.push({ref,pin});
  if(!C.components.has(ref))C.components.set(ref,{ref,value:"",footprint:"",mpn:"",pins:new Map()});
  C.components.get(ref).pins.set(pin,net);
}
function clearCircuit(){
  C.nets=new Map(); C.components=new Map(); C.report=null; C.source=""; C.demo=false;
  $("circuitNetCount").textContent="0"; $("circuitPinCount").textContent="0"; $("circuitPinChanges").textContent="0";
  $("circuitPassiveCount").textContent="0"; $("circuitClass").textContent="-";
}

$("netlistFile").addEventListener("change", async e=>{
  const file=e.target.files[0]; if(!file)return;
  try{
    clearCircuit();
    $("netlistFileName").textContent=file.name;
    const ext=file.name.toLowerCase().split(".").pop();
    if(["xlsx","xls"].includes(ext)) await parseConnectivityWorkbook(file);
    else {
      const text=await file.text();
      if(ext==="csv")parseConnectivityCsv(text);
      else parsePstxnet(text);
    }
    C.source=file.name;
    finishNetlistLoad();
  }catch(err){
    console.error(err); alert(`Netlist 읽기 실패: ${err.message}`);
    $("netlistParseState").textContent="파싱 실패";
  }
});

$("partsFile").addEventListener("change", async e=>{
  const file=e.target.files[0]; if(!file)return;
  try{
    $("partsFileName").textContent=file.name;
    const ext=file.name.toLowerCase().split(".").pop();
    if(["xlsx","xls"].includes(ext)) await parsePartsWorkbook(file);
    else {
      const text=await file.text();
      if(ext==="csv")parsePartsCsv(text); else parsePstxprt(text);
    }
    $("partsParseState").textContent=`${C.components.size} components · 부품정보 보강 완료`;
  }catch(err){ console.error(err); alert(`부품정보 읽기 실패: ${err.message}`); }
});

async function readWorkbook(file){
  if(typeof XLSX==="undefined")throw new Error("SheetJS가 로드되지 않았습니다.");
  const buf=await file.arrayBuffer(); return XLSX.read(buf,{type:"array"});
}
async function parseConnectivityWorkbook(file){
  const wb=await readWorkbook(file),ws=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{defval:""});
  parseConnectivityRows(rows);
}
function parseConnectivityCsv(text){
  if(typeof XLSX!=="undefined"){
    const wb=XLSX.read(text,{type:"string"}),ws=wb.Sheets[wb.SheetNames[0]];
    return parseConnectivityRows(XLSX.utils.sheet_to_json(ws,{defval:""}));
  }
  const lines=text.split(/\r?\n/),headers=lines.shift().split(",").map(x=>x.trim());
  parseConnectivityRows(lines.filter(Boolean).map(line=>Object.fromEntries(line.split(",").map((v,i)=>[headers[i],v.trim()]))));
}
function parseConnectivityRows(rows){
  const find=(row,names)=>{
    for(const [k,v] of Object.entries(row)){const nk=k.toLowerCase().replace(/[\s_\-]/g,"");if(names.includes(nk))return v;} return "";
  };
  for(const row of rows){
    const net=find(row,["net","netname","signal","signalname"]);
    const ref=find(row,["refdes","reference","ref","designator","component"]);
    const pin=find(row,["pin","pinnumber","pinnum","terminal"]);
    if(net&&ref&&pin)addNode(net,ref,pin);
  }
  if(!C.nets.size)throw new Error("Net / RefDes / Pin 컬럼을 찾지 못했습니다.");
}

function parsePstxnet(text){
  // Supports common Allegro/OrCAD pstxnet.dat sections:
  // NET_NAME
  // 'NET'
  // NODE_NAME      U10 1
  // or NODE_NAME = U10 1 / U10.1 variants.
  const lines=text.split(/\r?\n/);
  let currentNet="";
  for(let i=0;i<lines.length;i++){
    let line=lines[i].trim();
    if(!line)continue;

    let m=line.match(/^NET_NAME\s*(?:=)?\s*['"]?(.+?)['"]?\s*$/i);
    if(m){
      currentNet=clean(m[1]).replace(/^['"]|['"]$/g,"");
      continue;
    }
    if(/^NET_NAME\s*$/i.test(line)){
      const next=(lines[i+1]||"").trim().replace(/^['"]|['"]$/g,"");
      if(next){currentNet=next;i++;continue;}
    }

    // Sometimes net is represented as NET_NAME 'name'
    m=line.match(/^NET_NAME\s+['"](.+?)['"]/i);
    if(m){currentNet=clean(m[1]);continue;}

    if(/^NODE_NAME\b/i.test(line)){
      let rest=line.replace(/^NODE_NAME\s*(?:=)?\s*/i,"").trim();
      rest=rest.replace(/^['"]|['"]$/g,"");
      let ref="",pin="";
      let p=rest.match(/^([A-Za-z][A-Za-z0-9_\-]*)[.\s,;:]+([A-Za-z0-9+\-]+)\b/);
      if(p){ref=p[1];pin=p[2];}
      else {
        const toks=rest.split(/\s+/);
        if(toks.length>=2){ref=toks[0];pin=toks[1];}
      }
      if(currentNet&&ref&&pin)addNode(currentNet,ref,pin);
    }
  }

  // Fallback for simple $NETS / node-like lines or user exported text.
  if(!C.nets.size){
    currentNet="";
    for(const raw of lines){
      const line=raw.trim();
      let m=line.match(/^\$?NET\s+['"]?([^'"]+)['"]?/i);
      if(m){currentNet=clean(m[1]);continue;}
      m=line.match(/^([A-Za-z][A-Za-z0-9_\-]*)[.\-]([A-Za-z0-9]+)\s+(.+)$/);
      if(m && currentNet)addNode(currentNet,m[1],m[2]);
    }
  }
  if(!C.nets.size)throw new Error("pstxnet.dat 형식을 인식하지 못했습니다. CSV Net/RefDes/Pin 형식도 사용할 수 있습니다.");
}
function finishNetlistLoad(){
  const nodes=[...C.nets.values()].reduce((a,b)=>a+b.length,0);
  $("netlistParseState").textContent=`${C.nets.size} nets · ${nodes} nodes · 파싱 완료`;
  $("circuitNetCount").textContent=C.nets.size;
  $("analyzeCircuitBtn").disabled=false;
  renderNetBrowser();
}

async function parsePartsWorkbook(file){
  const wb=await readWorkbook(file),ws=wb.Sheets[wb.SheetNames[0]];
  parsePartsRows(XLSX.utils.sheet_to_json(ws,{defval:""}));
}
function parsePartsCsv(text){
  if(typeof XLSX!=="undefined"){
    const wb=XLSX.read(text,{type:"string"}),ws=wb.Sheets[wb.SheetNames[0]];
    parsePartsRows(XLSX.utils.sheet_to_json(ws,{defval:""}));
  }
}
function parsePartsRows(rows){
  const find=(row,names)=>{
    for(const [k,v] of Object.entries(row)){const nk=k.toLowerCase().replace(/[\s_\-\/.]/g,"");if(names.includes(nk))return v;} return "";
  };
  for(const row of rows){
    const ref=norm(find(row,["refdes","reference","ref","designator","component"])); if(!ref)continue;
    if(!C.components.has(ref))C.components.set(ref,{ref,value:"",footprint:"",mpn:"",pins:new Map()});
    const c=C.components.get(ref);
    c.value=String(find(row,["value","compvalue","partvalue"])||c.value);
    c.footprint=String(find(row,["footprint","package","pcbfootprint"])||c.footprint);
    c.mpn=String(find(row,["mpn","manufacturerpartnumber","partnumber","pn"])||c.mpn);
  }
}
function parsePstxprt(text){
  // Heuristic property parser. Keeps V5 useful across variants.
  const lines=text.split(/\r?\n/); let current=null;
  for(const raw of lines){
    const line=raw.trim(); if(!line)continue;
    let m=line.match(/^(?:PART_NAME|REFDES|REFERENCE)\s*(?:=)?\s*['"]?([A-Za-z][A-Za-z0-9_\-]*)/i);
    if(m){
      current=norm(m[1]);
      if(!C.components.has(current))C.components.set(current,{ref:current,value:"",footprint:"",mpn:"",pins:new Map()});
      continue;
    }
    if(!current)continue;
    const c=C.components.get(current);
    m=line.match(/^(?:VALUE|COMP_VALUE)\s*(?:=)?\s*['"]?(.+?)['"]?$/i); if(m){c.value=clean(m[1]);continue;}
    m=line.match(/^(?:PCB_FOOTPRINT|FOOTPRINT|PACKAGE)\s*(?:=)?\s*['"]?(.+?)['"]?$/i); if(m){c.footprint=clean(m[1]);continue;}
    m=line.match(/^(?:MPN|MANUFACTURER_PART_NUMBER|PART_NUMBER)\s*(?:=)?\s*['"]?(.+?)['"]?$/i); if(m){c.mpn=clean(m[1]);continue;}
  }
}

$("loadDemoCircuitBtn").addEventListener("click",()=>{
  clearCircuit(); C.demo=true; C.source="Demo pstxnet";
  const demo=[
    ["DP_TX0_P","U10","1"],["DP_TX0_P","C101","1"],["DP_TX0_P_OUT","C101","2"],["DP_TX0_P_OUT","J1","1"],
    ["DP_TX0_N","U10","2"],["DP_TX0_N","C102","1"],["DP_TX0_N_OUT","C102","2"],["DP_TX0_N_OUT","J1","2"],
    ["DP_TX1_P","U10","3"],["DP_TX1_P","C103","1"],["DP_TX1_P_OUT","C103","2"],["DP_TX1_P_OUT","J1","3"],
    ["DP_TX1_N","U10","4"],["DP_TX1_N","C104","1"],["DP_TX1_N_OUT","C104","2"],["DP_TX1_N_OUT","J1","4"],
    ["HPD","U10","10"],["HPD","R201","1"],["3V3","R201","2"],
    ["AUX_P","U10","11"],["AUX_P","R301","1"],["AUX_P_OUT","R301","2"],["AUX_P_OUT","J1","15"],
    ["AUX_N","U10","12"],["AUX_N","R302","1"],["AUX_N_OUT","R302","2"],["AUX_N_OUT","J1","16"],
    ["3V3","U10","20"],["3V3","C201","1"],["GND","C201","2"],["GND","U10","21"],
    ["SCL","U10","22"],["SCL","R401","1"],["3V3","R401","2"],
    ["SDA","U10","23"],["SDA","R402","1"],["3V3","R402","2"],
    ["EQ_SEL","U10","24"],["EQ_SEL","R403","1"],["GND","R403","2"]
  ];
  demo.forEach(x=>addNode(...x));
  for(const [ref,value] of [["C101","0.1uF"],["C102","0.1uF"],["C103","0.1uF"],["C104","0.1uF"],["R201","100k"],["R301","0R"],["R302","0R"],["C201","0.1uF"],["R401","4.7k"],["R402","4.7k"],["R403","10k"]]){
    if(!C.components.has(ref))C.components.set(ref,{ref,value:"",footprint:"",mpn:"",pins:new Map()});
    C.components.get(ref).value=value;
  }
  $("netlistFileName").textContent="Demo OrCAD Connectivity";
  $("netlistParseState").textContent=`${C.nets.size} nets · Demo 로드 완료`;
  $("circuitNetCount").textContent=C.nets.size;
  $("analyzeCircuitBtn").disabled=false;
  renderNetBrowser();
});

document.querySelectorAll(".circuit-tab").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".circuit-tab").forEach(x=>x.classList.toggle("active",x===btn));
  document.querySelectorAll(".circuit-panel").forEach(x=>x.classList.remove("active"));
  const map={pins:"circuitPanelPins",paths:"circuitPanelPaths",changes:"circuitPanelChanges",nets:"circuitPanelNets"};
  $(map[btn.dataset.circuittab]).classList.add("active");
}));

$("netFilter").addEventListener("input",renderNetBrowser);

$("analyzeCircuitBtn").addEventListener("click",()=>{
  const ref=norm($("targetRefdes").value);
  if(!ref)return alert("분석할 기존 IC RefDes를 입력하세요.");
  if(!C.components.has(ref))return alert(`${ref}가 Netlist에서 발견되지 않았습니다.`);
  C.report=analyzeTarget(ref);
  renderReport(C.report);
  $("exportCircuitBtn").disabled=false;
  $("mergeCircuitEcoBtn").disabled=false;
});

function getPdfState(){ return window.smartBomDatasheetBridge?.getState?.() || {base:null,candidate:null,comparison:null}; }
function pdfPinMaps(){
  const s=getPdfState(), result={base:new Map(),candidate:new Map(),comparison:s.comparison};
  for(const p of s.base?.pins?.items||[])result.base.set(String(p.number).toUpperCase(),p);
  for(const p of s.candidate?.pins?.items||[])result.candidate.set(String(p.number).toUpperCase(),p);
  return result;
}
function analyzeTarget(ref){
  const comp=C.components.get(ref), pdf=pdfPinMaps(), rows=[], changes=[];
  const paths=[];
  for(const [pin,net] of [...comp.pins.entries()].sort(pinSort)){
    const bp=pdf.base.get(String(pin).toUpperCase());
    const cp=pdf.candidate.get(String(pin).toUpperCase());
    const ntype=classifyNet(net);
    let status="UNKNOWN", note="PDF Pin Map 정보 부족";
    if($("usePdfPins").checked && bp && cp){
      if(pinEquivalent(bp.name,cp.name)){status="OK";note="동일/유사 Pin function";}
      else {status="FAIL";note=`Pin function 변경: ${bp.name} → ${cp.name}`;}
    } else if(!$("usePdfPins").checked){status="REVIEW";note="PDF Pin Map 비교 비활성";}
    const neighbors=(C.nets.get(net)||[]).filter(x=>x.ref!==ref);
    const passive=neighbors.filter(x=>isPassive(x.ref));
    const direct=neighbors.filter(x=>!isPassive(x.ref));
    const pathItems=$("tracePassives").checked ? tracePassivePaths(ref,pin,net,Number($("circuitDepth").value)||2) : [];
    paths.push(...pathItems);
    const risk=netRisk(ntype,status,passive,pathItems);
    rows.push({pin,net,netType:ntype,basePin:bp?.name||"",candidatePin:cp?.name||"",status,note,risk,neighbors,passive,direct,pathItems});
  }

  // Pin delta changes
  for(const r of rows){
    if(r.status==="FAIL"){
      changes.push(change("Critical","Schematic/PCB",`Pin ${r.pin} 기능 변경`,`${r.net}: ${r.basePin||"?"} → ${r.candidatePin||"?"}`,
        "실제 Net의 신호 기능이 후보 Pin 기능과 일치하는지 확인하고 필요 시 net reroute/핀 재배치."));
    } else if(r.status==="UNKNOWN" && ["power","ground","diff","clock","highspeed","control"].includes(r.netType)){
      changes.push(change("Major","Schematic",`Pin ${r.pin} 수동 검증 필요`,`${r.net} (${r.netType})`,
        "후보 데이터시트 pinout과 실제 net 연결을 수동 대조."));
    }
  }

  // Diff pair checks
  if($("checkDiffPair").checked){
    const groups=findDiffPairs(rows);
    for(const g of groups){
      if(g.members.length===1){
        changes.push(change("Major","SI/PCB","Differential pair 상대 Net 미검출",g.base,
          "P/N pair naming 또는 실제 routing/net mapping을 확인."));
      }
      for(const m of g.members){
        if(m.status==="FAIL")changes.push(change("Critical","SI/PCB","고속 Differential Pin 기능 변경",`${m.net} / Pin ${m.pin}`,
          "후보의 TX/RX 방향, lane mapping, polarity swap 지원 여부를 검증."));
      }
    }
  }

  // Passive heuristics
  for(const p of uniquePaths(paths)){
    if(p.kind==="SERIES_C"){
      changes.push(change("Major","Schematic/SI","Series AC Coupling Capacitor 경로",p.summary,
        "후보 데이터시트의 AC coupling 내장/외장, capacitance 권장값, placement 위치와 비교."));
    }
    if(p.kind==="PULL"){
      changes.push(change("Major","Schematic/FW","Pull-up/down 또는 Strap 경로",p.summary,
        "후보 Pin의 logic threshold, internal pull, strap mode와 저항값을 재검증."));
    }
    if(p.kind==="SERIES_R"){
      changes.push(change("Minor","Schematic/SI","Series Resistor/0Ω 경로",p.summary,
        "후보 권장 series damping/termination 조건과 값 변경 여부 확인."));
    }
    if(p.kind==="DECOUPLING"){
      changes.push(change("Major","Power/PCB","Decoupling 경로",p.summary,
        "후보 전원 rail별 권장 decoupling 값/개수/배치와 비교."));
    }
  }

  const cls=classifyCircuit(changes,rows);
  return {ref,rows,paths:uniquePaths(paths),changes:dedupeChanges(changes),class:cls,netCount:C.nets.size,source:C.source};
}
function pinSort(a,b){
  const na=parseInt(a[0],10),nb=parseInt(b[0],10);
  if(Number.isFinite(na)&&Number.isFinite(nb))return na-nb;
  return String(a[0]).localeCompare(String(b[0]));
}
function pinEquivalent(a,b){
  const f=x=>norm(x).replace(/[^A-Z0-9]/g,"").replace(/[PN]$/,"");
  return norm(a)===norm(b) || (f(a).length>=3&&f(a)===f(b));
}
function netRisk(type,status,passives,paths){
  if(status==="FAIL")return "High";
  if(["power","ground","diff","clock","highspeed"].includes(type)&&status==="UNKNOWN")return "High";
  if(["control"].includes(type)||passives.length||paths.length)return "Medium";
  return status==="OK"?"Low":"Medium";
}
function tracePassivePaths(targetRef,targetPin,startNet,depth){
  const out=[], queue=[{net:startNet,path:[`${targetRef}.${targetPin}`,startNet],level:0}];
  const seen=new Set([`${startNet}|${targetRef}`]);
  while(queue.length){
    const cur=queue.shift();
    if(cur.level>=depth)continue;
    for(const node of C.nets.get(cur.net)||[]){
      if(node.ref===targetRef||!isPassive(node.ref))continue;
      const comp=C.components.get(node.ref); if(!comp)continue;
      const otherPins=[...comp.pins.entries()].filter(([p])=>String(p)!==String(node.pin));
      for(const [op,on] of otherPins){
        const key=`${on}|${node.ref}`; if(seen.has(key))continue; seen.add(key);
        const summary=[...cur.path,`${node.ref}.${node.pin}`,`${node.ref}.${op}`,on].join(" → ");
        const kind=classifyPassivePath(node.ref,comp.value,cur.net,on);
        out.push({fromNet:startNet,component:node.ref,value:comp.value||"",toNet:on,kind,summary,level:cur.level+1});
        queue.push({net:on,path:[...cur.path,`${node.ref}.${node.pin}`,`${node.ref}.${op}`,on],level:cur.level+1});
      }
    }
  }
  return out;
}
function classifyPassivePath(ref,value,fromNet,toNet){
  const t=compType(ref), a=classifyNet(fromNet), b=classifyNet(toNet), v=String(value||"").toUpperCase();
  if(t==="C" && ((a==="highspeed"||a==="diff")||(b==="highspeed"||b==="diff")))return "SERIES_C";
  if(t==="C" && ((a==="power"&&b==="ground")||(b==="power"&&a==="ground")))return "DECOUPLING";
  if(t==="R" && ((a==="power"||a==="ground")^(b==="power"||b==="ground")))return "PULL";
  if(t==="R" && (/^0(?:R|Ω|OHM)?$/.test(v.replace(/\s/g,"")) || a==="highspeed"||b==="highspeed"||a==="diff"||b==="diff"))return "SERIES_R";
  if(t==="FB"||t==="L")return "FILTER";
  return "PASSIVE";
}
function findDiffPairs(rows){
  const m=new Map();
  for(const r of rows){
    if(r.netType!=="diff")continue;
    let b=r.net.replace(/([_\-]?[PN]|[+\-])$/i,"");
    if(!m.has(b))m.set(b,[]);
    m.get(b).push(r);
  }
  return [...m.entries()].map(([base,members])=>({base,members}));
}
function change(severity,domain,title,detail,action){return {severity,domain,title,detail,action};}
function uniquePaths(paths){
  const seen=new Set(); return paths.filter(p=>{const k=p.summary;if(seen.has(k))return false;seen.add(k);return true;});
}
function dedupeChanges(changes){
  const seen=new Set(); return changes.filter(c=>{const k=`${c.title}|${c.detail}`;if(seen.has(k))return false;seen.add(k);return true;});
}
function classifyCircuit(changes,rows){
  const critical=changes.filter(x=>x.severity==="Critical").length;
  const major=changes.filter(x=>x.severity==="Major").length;
  const fail=rows.filter(x=>x.status==="FAIL").length;
  if(critical>=2||fail>=2)return {code:"D",name:"Major Redesign / Candidate Recheck"};
  if(critical||major>=3)return {code:"C",name:"Design Change Required"};
  if(major||rows.some(x=>x.status==="UNKNOWN"))return {code:"B",name:"Manual Confirmation / Minor ECO"};
  return {code:"A",name:"Drop-in Circuit Candidate"};
}

function renderReport(r){
  $("circuitNetCount").textContent=r.netCount;
  $("circuitPinCount").textContent=r.rows.length;
  $("circuitPinChanges").textContent=r.rows.filter(x=>x.status==="FAIL").length;
  $("circuitPassiveCount").textContent=r.paths.length;
  $("circuitClass").textContent=r.class.code;
  const cls=r.class.code==="A"?"good":r.class.code==="B"?"warn":"bad";
  $("circuitHeadline").className=`eco-headline ${cls}`;
  $("circuitHeadline").textContent=`Class ${r.class.code}: ${r.class.name} · ${r.ref} 실제 Net 연결 기준`;

  $("circuitPinArea").className="table-wrap";
  $("circuitPinArea").innerHTML=`<table class="circuit-pin-table"><thead><tr>
    <th>Pin</th><th>Net</th><th>Net Type</th><th>기존 Pin</th><th>후보 Pin</th><th>판정</th><th>Risk</th><th>직접 연결</th><th>Passive</th><th>판단</th>
  </tr></thead><tbody>${r.rows.map(x=>`<tr>
    <td><b>${esc(x.pin)}</b></td><td><code>${esc(x.net)}</code></td><td><span class="net-type ${esc(x.netType)}">${esc(x.netType)}</span></td>
    <td>${esc(x.basePin||"-")}</td><td>${esc(x.candidatePin||"-")}</td><td>${impactHtml(x.status)}</td><td>${esc(x.risk)}</td>
    <td>${x.direct.map(n=>`${esc(n.ref)}.${esc(n.pin)}`).join(", ")||"-"}</td>
    <td>${x.passive.map(n=>`${esc(n.ref)}.${esc(n.pin)}${C.components.get(n.ref)?.value?`(${esc(C.components.get(n.ref).value)})`:""}`).join(", ")||"-"}</td>
    <td>${esc(x.note)}</td>
  </tr>`).join("")}</tbody></table>`;

  if(!r.paths.length){
    $("circuitPathArea").className="empty-block"; $("circuitPathArea").textContent="추적된 수동소자 경로가 없습니다.";
  } else {
    $("circuitPathArea").className="";
    $("circuitPathArea").innerHTML=r.paths.map(p=>`<div class="passive-path-card">
      <h4>${esc(p.kind)} · ${esc(p.component)} ${p.value?`(${esc(p.value)})`:""}</h4>
      <p class="path-arrow">${esc(p.summary)}</p>
    </div>`).join("");
  }

  if(!r.changes.length){
    $("circuitChangeArea").className="empty-block"; $("circuitChangeArea").textContent="자동 생성된 회로 변경 항목이 없습니다. 원문 수동 검증은 필요합니다.";
  } else {
    $("circuitChangeArea").className="change-grid";
    $("circuitChangeArea").innerHTML=r.changes.map(c=>`<div class="change-card ${c.severity.toLowerCase()}">
      <h4>${esc(c.severity)} · ${esc(c.domain)}</h4><p><b>${esc(c.title)}</b></p><p>${esc(c.detail)}</p><p>→ ${esc(c.action)}</p>
    </div>`).join("");
  }
}
function impactHtml(s){
  const map={OK:["pin-impact-ok","✓ OK"],REVIEW:["pin-impact-review","△ REVIEW"],FAIL:["pin-impact-fail","✕ FAIL"],UNKNOWN:["pin-impact-unknown","? UNKNOWN"]};
  const [c,t]=map[s]||map.UNKNOWN; return `<span class="${c}">${t}</span>`;
}
function renderNetBrowser(){
  const q=norm($("netFilter")?.value||"");
  const rows=[...C.nets.entries()].filter(([net,nodes])=>{
    if(!q)return true;
    return norm(net).includes(q)||nodes.some(n=>norm(n.ref).includes(q));
  }).sort((a,b)=>a[0].localeCompare(b[0]));
  $("netBrowserCount").textContent=`${rows.length} / ${C.nets.size} nets`;
  if(!rows.length){$("circuitNetArea").className="empty-block";$("circuitNetArea").textContent="검색 결과가 없습니다.";return;}
  $("circuitNetArea").className="net-browser";
  $("circuitNetArea").innerHTML=rows.map(([net,nodes])=>`<div class="net-row">
    <div><code>${esc(net)}</code> <span class="net-type ${classifyNet(net)}">${classifyNet(net)}</span></div>
    <div class="node-chips">${nodes.map(n=>`<span class="node-chip">${esc(n.ref)}.${esc(n.pin)}</span>`).join("")}</div>
  </div>`).join("");
}

$("exportCircuitBtn").addEventListener("click",()=>{
  const r=C.report; if(!r||typeof XLSX==="undefined")return;
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(r.rows.map(x=>({
    Pin:x.pin,Net:x.net,NetType:x.netType,BasePin:x.basePin,CandidatePin:x.candidatePin,Status:x.status,Risk:x.risk,
    DirectConnections:x.direct.map(n=>`${n.ref}.${n.pin}`).join(" | "),
    PassiveConnections:x.passive.map(n=>`${n.ref}.${n.pin}`).join(" | "),Judgement:x.note
  }))),"Pin_Net_Impact");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(r.paths.map(p=>({
    Kind:p.kind,FromNet:p.fromNet,Component:p.component,Value:p.value,ToNet:p.toNet,Path:p.summary
  }))),"Passive_Paths");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(r.changes.map(c=>({
    Severity:c.severity,Domain:c.domain,Title:c.title,Detail:c.detail,RequiredAction:c.action
  }))),"Circuit_Changes");
  const nets=[];
  for(const [net,nodes] of C.nets)for(const n of nodes)nets.push({Net:net,RefDes:n.ref,Pin:n.pin,NetType:classifyNet(net)});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(nets),"Netlist");
  XLSX.writeFile(wb,`Circuit_Impact_${r.ref}_V5.xlsx`);
});

$("mergeCircuitEcoBtn").addEventListener("click",()=>{
  const r=C.report; if(!r)return;
  window.smartBomCircuitBridge={getReport:()=>r};
  window.dispatchEvent(new CustomEvent("smartbom:circuit-report-ready",{detail:{classCode:r.class.code,ref:r.ref,changes:r.changes.length}}));
  $("mergeCircuitEcoBtn").textContent="ECO 병합 데이터 준비됨";
  alert("회로 영향 분석 결과가 ECO 병합 데이터로 준비되었습니다. V5에서는 ECO Excel Report에 Circuit 시트를 추가할 수 있도록 연결됩니다.");
});

window.smartBomCircuitBridge={getReport:()=>C.report};
