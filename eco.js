const $ = (id) => document.getElementById(id);

const ecoState = { report: null };

function esc(v){
  return String(v ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function norm(s){ return String(s ?? "").trim().toLowerCase().replace(/[\s_\-./()]/g,""); }
function uniq(a){ return [...new Set((a||[]).filter(Boolean))]; }
function pages(items){ return uniq((items||[]).map(x=>x.page)).sort((a,b)=>a-b); }
function pageText(items, prefix="PDF"){
  const p=pages(items);
  return p.length ? `${prefix} p.${p.join(", p.")}` : "자동 근거 없음";
}
function hasEvidence(obj,key){ return Array.isArray(obj?.[key]) && obj[key].length>0; }
function getPdfState(){ return window.smartBomDatasheetBridge?.getState?.() || {base:null,candidate:null,comparison:null}; }
function getParts(){
  return {
    base: window.smartBomBridge?.getOriginalPart?.() || null,
    candidate: window.smartBomBridge?.getSelectedPart?.() || null
  };
}
function getContext(){
  return {
    project: $("ecoProject").value.trim(),
    impedance: Number($("ecoBoardImpedance").value)||null,
    supply: Number($("ecoBoardSupply").value)||null,
    pcbPolicy: $("ecoPcbPolicy").value,
    fwPolicy: $("ecoFwPolicy").value,
    target: $("ecoTarget").value
  };
}

window.addEventListener("smartbom:datasheet-comparison-ready", ()=>{
  $("generateEcoBtn").disabled=false;
  $("ecoReadyHint").textContent="PDF 비교가 완료되었습니다. 설계변경 영향 분석을 생성할 수 있습니다.";
  const basePart=window.smartBomBridge?.getOriginalPart?.();
  const candPart=window.smartBomBridge?.getSelectedPart?.();
  if(!$("ecoProject").value && basePart?.MPN && candPart?.MPN) $("ecoProject").value=`${basePart.MPN} → ${candPart.MPN}`;
});

$("generateEcoBtn").addEventListener("click", ()=>{
  const pdf=getPdfState();
  if(!pdf.comparison) return alert("먼저 PDF 데이터시트 자동 비교를 완료하세요.");
  ecoState.report=buildEcoReport(pdf,getParts(),getContext());
  renderEco(ecoState.report);
  $("exportEcoBtn").disabled=false;
  $("copyEcoSummaryBtn").disabled=false;
});

function item(id,title,severity,domains,change,action,evidence,reason="",gate="Review"){
  return {id,title,severity,domains,change,action,evidence,reason,gate,owner:"",status:"Open"};
}
function buildEcoReport(pdf,parts,ctx){
  const {base,candidate,comparison}=pdf;
  const items=[];
  let seq=1;
  const add=(...args)=>items.push(item(`ECO-${String(seq++).padStart(3,"0")}`,...args));
  const rowMap=Object.fromEntries((comparison.rows||[]).map(r=>[r.label,r]));

  // 1. Package / Footprint
  const pkg=rowMap["Package"];
  if(pkg?.status==="FAIL"){
    add("Package / Footprint 변경","Critical",["PCB","Mechanical","Assembly"],
      `${pkg.base} → ${pkg.candidate}`,
      "후보 패키지 land pattern, body size, exposed pad, courtyard 및 조립 공정을 기준 PCB footprint와 비교하고 신규 footprint를 승인한다.",
      `${pageText(base.package?.evidence,"Base")} / ${pageText(candidate.package?.evidence,"Cand")}`,
      "패키지 변경은 동일 핀 기능 여부와 무관하게 PCB 수정 가능성이 높음.","ECO required");
  } else if(pkg?.status==="UNKNOWN"){
    add("Package 자동 추출 미확인","Major",["PCB","Mechanical"],
      "한쪽 또는 양쪽 Package 값을 PDF에서 확정하지 못함",
      "Ordering information 및 package drawing에서 정확한 package code와 dimensions를 수동 확인한다.",
      `${pageText(base.package?.evidence,"Base")} / ${pageText(candidate.package?.evidence,"Cand")}`,
      "Drop-in 판단 전에 package 확인 필수.");
  }

  // 2. Pin mapping
  const pin=comparison.pins;
  if(pin?.status==="FAIL"){
    add("Pin Map 불일치","Critical",["Schematic","PCB","Functional"],
      `${pin.matched}/${pin.baseCount} 기준 핀명 일치, ${pin.different}개 차이/누락`,
      "Pin-by-pin 연결표를 작성하고 모든 net의 기능/방향/전원/GND/NC 조건을 재검증한다. 기존 footprint 재사용을 자동 승인하지 않는다.",
      pin.rows?.filter(r=>r.status!=="OK").slice(0,8).map(r=>`Pin ${r.pin}: ${r.base} → ${r.candidate}`).join(" | ") || "Pin table",
      "동일 package라도 pin assignment가 다를 수 있음.","ECO required");
  } else if(pin?.status==="REVIEW"){
    add("Pin Map 부분 차이","Major",["Schematic","PCB"],
      `${pin.matched}/${pin.baseCount} 기준 핀명 일치, ${pin.different}개 검토 필요`,
      "차이/누락 Pin을 회로도와 PCB net에 대조하여 기능 동등성을 확인한다.",
      pin.rows?.filter(r=>r.status!=="OK").slice(0,8).map(r=>`Pin ${r.pin}: ${r.base} → ${r.candidate}`).join(" | ") || "Pin table",
      pin.note||"Pin 비교 검토 필요.");
  } else if(pin?.status==="UNKNOWN"){
    add("Pin-to-Pin 자동판정 불가","Major",["Schematic","PCB"],
      `Base ${pin.baseCount||0} pins / Candidate ${pin.candidateCount||0} pins 추출`,
      "PDF Pin Functions 표 또는 package pinout을 수동 대조한다. Pin-to-Pin으로 간주하지 않는다.",
      "PDF table extraction confidence insufficient",
      "자동 추출량 부족.","Manual gate");
  }

  // 3. Data rate and lanes
  for(const label of ["Max Data Rate","Lane Count"]){
    const r=rowMap[label];
    if(r?.status==="FAIL"){
      add(`${label} 하향`,"Critical",["Functional","SI","Validation"],
        `${r.base} → ${r.candidate}`,
        "시스템 요구 대역폭과 protocol mode를 다시 확인하고 eye/jitter/link training 검증을 수행한다.",
        `${pageText(base.dataRate?.evidence,"Base")} / ${pageText(candidate.dataRate?.evidence,"Cand")}`,
        r.note,"Performance gate");
    } else if(r?.status==="UNKNOWN"){
      add(`${label} 확인 필요`,"Minor",["Functional","Validation"],
        `${r?.base||"-"} → ${r?.candidate||"-"}`,
        "Features / Electrical Characteristics에서 해당 성능값을 수동 확인한다.",
        "PDF automatic extraction incomplete");
    }
  }

  // 4. Operating temperature
  const temp=rowMap["Operating Temperature"];
  if(temp?.status==="REVIEW"){
    add("동작온도 범위 변경","Major",["Qualification","Thermal","Reliability"],
      `${temp.base} → ${temp.candidate}`,
      "제품 환경등급 요구와 대조하고 필요 시 온도 cycling / high-low temperature validation을 재수행한다.",
      `${pageText(base.temp?.evidence,"Base")} / ${pageText(candidate.temp?.evidence,"Cand")}`,
      temp.note);
  }

  // 5. Supply voltage / rail impact
  const supply=rowMap["Supply Voltage (자동 추출)"];
  if(supply?.status==="FAIL"){
    add("전원 Rail 호환성 위험","Critical",["Schematic","Power","PCB"],
      `${supply.base} → ${supply.candidate}`,
      "Recommended Operating Conditions의 VCC/VDD 및 I/O supply를 직접 비교하고 regulator/level shifter/decoupling 변경 여부를 결정한다.",
      `${pageText(base.supply?.evidence,"Base")} / ${pageText(candidate.supply?.evidence,"Cand")}`,
      `현재 Board rail 입력값: ${ctx.supply ?? "-"} V`,"Power gate");
  } else {
    const candVals=candidate.supply?.values||[];
    if(ctx.supply && candVals.length && !candVals.some(v=>Math.abs(v-ctx.supply)<=0.25)){
      add("현재 Board 전원과 후보 PDF 값 재확인","Major",["Schematic","Power"],
        `Board ${ctx.supply} V / Candidate extracted ${candVals.join(", ")} V`,
        "후보의 실제 recommended operating supply가 현재 rail에서 동작 가능한지 표 원문으로 확인한다.",
        pageText(candidate.supply?.evidence,"Candidate"),
        "PDF 자동 추출 숫자에는 absolute max/test condition 숫자가 섞일 수 있으므로 수동 검증 필요.");
    } else if(supply?.status==="REVIEW" || supply?.status==="UNKNOWN"){
      add("전원조건 수동 검증","Minor",["Schematic","Power"],
        `${supply?.base||"-"} → ${supply?.candidate||"-"}`,
        "Recommended Operating Conditions, I/O supply, power sequence를 수동 대조한다.",
        `${pageText(base.supply?.evidence,"Base")} / ${pageText(candidate.supply?.evidence,"Cand")}`);
    }
  }

  // 6. Differential impedance
  const bZ=base.impedanceValues||[], cZ=candidate.impedanceValues||[];
  if(bZ.length || cZ.length){
    const boardZ=ctx.impedance;
    const candMatch=boardZ ? cZ.some(z=>Math.abs(z-boardZ)<=5) : false;
    const baseMatch=boardZ ? bZ.some(z=>Math.abs(z-boardZ)<=5) : false;
    let sev="Minor";
    if(boardZ && baseMatch && cZ.length && !candMatch) sev="Major";
    add("Differential Impedance / SI 검토",sev,["PCB","SI","Validation"],
      `Board ${boardZ??"-"} Ω / Base evidence ${bZ.join(", ")||"-"} Ω / Candidate evidence ${cZ.join(", ")||"-"} Ω`,
      "각 Ω 값이 PCB routing, receiver termination, transmitter load, test condition 중 무엇을 의미하는지 원문에서 구분하고 channel impedance/S-parameter/eye 검증 필요 여부를 결정한다.",
      `${pageText(base.impedance,"Base")} / ${pageText(candidate.impedance,"Cand")}`,
      "85Ω/100Ω 숫자 자체만으로 호환 판정 금지.","SI gate");
  } else {
    add("Differential Impedance 근거 미추출","Minor",["PCB","SI"],
      "PDF에서 명시적 Ω 근거를 찾지 못함",
      "Layout Guidelines, Electrical Characteristics, termination 항목을 수동 확인한다.",
      "No automatic impedance evidence");
  }

  // 7. AC coupling
  const bAc=hasEvidence(base,"acCoupling"), cAc=hasEvidence(candidate,"acCoupling");
  if(bAc!==cAc){
    add("AC Coupling 요구조건 차이 가능성","Major",["Schematic","PCB","SI"],
      `Base evidence ${bAc?"있음":"없음"} / Candidate evidence ${cAc?"있음":"없음"}`,
      "AC coupling capacitor의 필요 여부, 값, 배치 위치(TX/RX 측), 내장/외장 여부를 비교하여 capacitor와 layout 변경을 결정한다.",
      `${pageText(base.acCoupling,"Base")} / ${pageText(candidate.acCoupling,"Cand")}`,
      "한쪽 문서에서만 coupling 관련 근거가 추출됨.");
  } else if(bAc || cAc){
    add("AC Coupling 위치/값 확인","Minor",["Schematic","PCB","SI"],
      "양쪽 PDF에 AC coupling 관련 근거 존재",
      "Capacitor value와 권장 placement가 동일한지 원문에서 확인한다.",
      `${pageText(base.acCoupling,"Base")} / ${pageText(candidate.acCoupling,"Cand")}`);
  }

  // 8. AUX / HPD
  const bAux=hasEvidence(base,"auxHpd"), cAux=hasEvidence(candidate,"auxHpd");
  if(bAux || cAux){
    const sev=(bAux!==cAux)?"Major":"Minor";
    add("AUX / HPD / Sideband Interface 검토",sev,["Schematic","Firmware","Validation"],
      `Base evidence ${bAux?"있음":"없음"} / Candidate evidence ${cAux?"있음":"없음"}`,
      "AUX/HPD 방향, voltage level, pull-up/down, pass-through/monitoring 동작 및 FW 제어 여부를 비교한다.",
      `${pageText(base.auxHpd,"Base")} / ${pageText(candidate.auxHpd,"Cand")}`,
      "Sideband 동작 차이는 링크 인식/Hot-plug 동작에 영향을 줄 수 있음.");
  }

  // 9. Equalization / configuration
  const bEq=hasEvidence(base,"equalization"), cEq=hasEvidence(candidate,"equalization");
  if(bEq || cEq){
    add("EQ / CTLE / DFE / Redriver 설정 검토","Major",["Schematic","Firmware","SI","Validation"],
      `Base evidence ${bEq?"있음":"없음"} / Candidate evidence ${cEq?"있음":"없음"}`,
      "EQ gain/boost, mode strap, I2C/SMBus register, auto-adaptation 조건을 비교한다. Strap resistor 및 FW 초기화 변경 여부를 결정한다.",
      `${pageText(base.equalization,"Base")} / ${pageText(candidate.equalization,"Cand")}`,
      ctx.fwPolicy==="none" ? "FW 변경 불가 정책이므로 후보가 register 설정을 요구하면 적용 불가 가능성." : "Configuration 차이 확인 필요.",
      ctx.fwPolicy==="none" ? "FW gate" : "Review");
  }

  // 10. Absolute max / protection
  if(hasEvidence(base,"absoluteMax") || hasEvidence(candidate,"absoluteMax")){
    add("Absolute Maximum / 보호조건 재검증","Major",["Schematic","Reliability","Power"],
      "Absolute Maximum 표 자동 문장 추출됨",
      "모든 supply/I/O pin의 abs max, overshoot/undershoot, ESD, clamp 조건을 표 단위로 대조한다. 기존 보호소자/series resistor의 적합성을 확인한다.",
      `${pageText(base.absoluteMax,"Base")} / ${pageText(candidate.absoluteMax,"Cand")}`,
      "V4는 Absolute Maximum 숫자 자동 승인하지 않음.","Reliability gate");
  }

  // 11. Lifecycle/stock from API metadata
  const cp=parts.candidate;
  if(cp){
    const lc=norm(cp.Lifecycle);
    if(/eol|obsolete|discontinued|nrnd|notrecommended/.test(lc)){
      add("후보 Lifecycle 위험","Critical",["BOM","Supply Chain"],
        `Candidate lifecycle: ${cp.Lifecycle}`,
        "양산 적용 후보에서 제외하거나 제조사 PCN/LTB 계획과 승인 예외 절차를 검토한다.",
        `${cp.Source||"API"} lifecycle metadata`,
        "설계변경 목적이 수급개선이라면 lifecycle 위험 후보는 부적합.");
    } else if(Number(cp.Stock||0)<=0){
      add("후보 재고 부족","Major",["BOM","Supply Chain"],
        `Stock: ${cp.Stock||0}`,
        "Lead time, authorized distributor stock, MOQ, NCNR 조건을 확인하고 구매 승인 전에 수급성을 재평가한다.",
        `${cp.Source||"API"} stock metadata`);
    }
  }

  // Context policy gates
  if(ctx.pcbPolicy==="none" && items.some(x=>x.domains.includes("PCB") && ["Critical","Major"].includes(x.severity))){
    add("PCB 변경 정책과 충돌","Critical",["Project","PCB"],
      "PCB 변경 불가 정책인데 Major/Critical PCB 영향 항목 존재",
      "대체 후보를 재선정하거나 PCB 변경 정책 예외 승인을 받아야 한다.",
      "User design context","Policy gate","Stop");
  }
  if(ctx.fwPolicy==="none" && items.some(x=>x.domains.includes("Firmware") && ["Critical","Major"].includes(x.severity))){
    add("FW 변경 정책과 충돌","Major",["Project","Firmware"],
      "FW 변경 불가 정책인데 FW 영향 가능 항목 존재",
      "Register/initialization 변경이 필요 없는지 확인하고 필요 시 다른 후보를 검토한다.",
      "User design context","Policy gate");
  }

  // If everything is clean, still create validation item
  if(!items.some(x=>["Critical","Major"].includes(x.severity))){
    add("Drop-in 최종 검증","Minor",["Validation","Quality"],
      "자동 비교상 큰 변경점 미확인",
      "원문 pinout, recommended operating conditions, layout guide를 수동 확인한 뒤 기능/온도/EMI 기본 검증을 수행한다.",
      "V4 automated comparison","자동 비교만으로 승인하지 않음.");
  }

  const counts=countSeverity(items);
  const confidence=calcConfidence(base,candidate,comparison);
  const changeClass=classifyChange(items,comparison,ctx);
  const checklist=buildChecklist(items);
  const summary=makeSummary(items,counts,confidence,changeClass,pdf,parts,ctx);
  return {items,counts,confidence,changeClass,checklist,summary,context:ctx,base,candidate,comparison,parts};
}

function countSeverity(items){
  const c={Critical:0,Major:0,Minor:0,Info:0};
  items.forEach(x=>c[x.severity]=(c[x.severity]||0)+1);
  return c;
}
function calcConfidence(base,candidate,comparison){
  let score=100;
  const checks=[
    [!!base.package?.value && !!candidate.package?.value,12],
    [base.dataRate?.value!=null && candidate.dataRate?.value!=null,10],
    [base.lanes?.value!=null && candidate.lanes?.value!=null,8],
    [base.temp?.min!=null && candidate.temp?.min!=null,10],
    [(comparison.pins?.baseCount||0)>=4 && (comparison.pins?.candidateCount||0)>=4,25],
    [hasEvidence(base,"absoluteMax") && hasEvidence(candidate,"absoluteMax"),10],
    [(base.impedanceValues?.length||0)>0 || (candidate.impedanceValues?.length||0)>0,10],
    [hasEvidence(base,"acCoupling") || hasEvidence(candidate,"acCoupling"),5],
    [hasEvidence(base,"auxHpd") || hasEvidence(candidate,"auxHpd"),5],
    [base.pageCount>0 && candidate.pageCount>0,5]
  ];
  for(const [ok,penalty] of checks) if(!ok) score-=penalty;
  score=Math.max(0,score);
  return {score,label:score>=80?"High":score>=60?"Medium":"Low"};
}
function classifyChange(items,comparison,ctx){
  const critical=items.filter(x=>x.severity==="Critical");
  const major=items.filter(x=>x.severity==="Major");
  const pcbCritical=items.some(x=>x.domains.includes("PCB")&&x.severity==="Critical");
  const policyStop=items.some(x=>x.gate==="Stop");
  if(policyStop || pcbCritical || critical.length>=2) return {code:"D",name:"Major Redesign / Candidate Reconsideration",className:"change-class-d"};
  if(critical.length || major.some(x=>x.domains.includes("PCB")||x.domains.includes("Schematic")||x.domains.includes("Firmware"))) return {code:"C",name:"Design Change Required",className:"change-class-c"};
  if(major.length || comparison.pins?.status==="UNKNOWN") return {code:"B",name:"Minor ECO / Manual Confirmation",className:"change-class-b"};
  return {code:"A",name:"Drop-in Candidate (Verification Required)",className:"change-class-a"};
}
function buildChecklist(items){
  const base=[
    ["SCH","회로도 Pin/Net 연결 검증","Pin assignment, signal direction, NC/Reserved 조건 확인"],
    ["PWR","전원/Power Sequence 검증","Recommended operating supply, I/O rail, decoupling, sequencing 확인"],
    ["PCB","Footprint / Land Pattern 검증","Package drawing, exposed pad, courtyard, assembly 조건 확인"],
    ["SI","고속 SI / Impedance 검증","Routing Z, termination, AC coupling, eye/jitter margin 확인"],
    ["CTRL","Strap / I2C / Register 검증","EQ/mode/configuration 초기화 및 FW 영향 확인"],
    ["SIDE","AUX / HPD / Sideband 검증","Voltage level, pull resistor, direction/behavior 확인"],
    ["ABS","Absolute Maximum 검증","Overshoot/undershoot, ESD, protection 조건 확인"],
    ["TEMP","온도 / Thermal 검증","Operating temp, junction/thermal 조건 및 qualification 확인"],
    ["SUPPLY","Lifecycle / 공급망 검증","Active status, PCN/EOL, stock, lead time, authorized source 확인"],
    ["FUNC","기능 검증","부팅/링크/모드 전환/에러 recovery 포함 기본 기능 시험"],
    ["EMC","EMI/EMC 영향 검토","고속 인터페이스 또는 package/layout 변경 시 재평가"],
    ["DOC","BOM / 회로도 / PCB / ECO 문서 반영","Part number, manufacturer, revision, 변경 사유 기록"]
  ];
  const relevant=new Set(["SCH","PWR","SUPPLY","FUNC","DOC"]);
  for(const x of items){
    for(const d of x.domains){
      if(["PCB","Mechanical","Assembly"].includes(d))relevant.add("PCB");
      if(["SI"].includes(d))relevant.add("SI");
      if(["Firmware"].includes(d))relevant.add("CTRL");
      if(["Schematic"].includes(d))relevant.add("SCH");
      if(["Power"].includes(d))relevant.add("PWR");
      if(["Reliability"].includes(d))relevant.add("ABS");
      if(["Thermal","Qualification"].includes(d))relevant.add("TEMP");
      if(["Supply Chain","BOM"].includes(d))relevant.add("SUPPLY");
      if(["Validation","Functional"].includes(d))relevant.add("FUNC");
    }
    if(/AUX|HPD|Sideband/i.test(x.title)) relevant.add("SIDE");
  }
  if(items.some(x=>["Critical","Major"].includes(x.severity)&&x.domains.includes("PCB")))relevant.add("EMC");
  return base.filter(x=>relevant.has(x[0])).map(([code,title,detail])=>({code,title,detail,done:false}));
}
function makeSummary(items,counts,confidence,changeClass,pdf,parts,ctx){
  const baseMpn=parts.base?.MPN || $("dsBaseMpn")?.value || "Base part";
  const candMpn=parts.candidate?.MPN || $("dsCandidateMpn")?.value || "Candidate part";
  const top=items.filter(x=>["Critical","Major"].includes(x.severity)).slice(0,6);
  const lines=[
    `[Smart BOM Selector V4 - ECO Preliminary Review]`,
    `Project: ${ctx.project||"-"}`,
    `Change: ${baseMpn} → ${candMpn}`,
    `Change Class: ${changeClass.code} - ${changeClass.name}`,
    `Impact Count: Critical ${counts.Critical}, Major ${counts.Major}, Minor ${counts.Minor}`,
    `PDF Extraction Confidence: ${confidence.label} (${confidence.score}/100)`,
    ``,
    `주요 변경/검토 항목:`
  ];
  if(top.length) top.forEach((x,i)=>lines.push(`${i+1}. [${x.severity}] ${x.title} - ${x.change}`));
  else lines.push(`1. 자동 비교상 Critical/Major 변경점 미확인`);
  lines.push(``,`필수 원칙: 자동 비교 결과만으로 Drop-in/양산 승인을 결정하지 않고, 데이터시트 원문·회로도·PCB·검증 결과를 근거로 ECO 승인한다.`);
  return lines.join("\n");
}

function severityBadge(s){
  const c={Critical:"sev-critical",Major:"sev-major",Minor:"sev-minor",Info:"sev-info"}[s]||"sev-info";
  return `<span class="impact-pill ${c}">${esc(s)}</span>`;
}
function renderEco(report){
  $("ecoClass").innerHTML=`<span class="${report.changeClass.className}">${esc(report.changeClass.code)}</span>`;
  $("ecoCritical").textContent=report.counts.Critical||0;
  $("ecoMajor").textContent=report.counts.Major||0;
  $("ecoMinor").textContent=report.counts.Minor||0;
  $("ecoConfidence").textContent=`${report.confidence.label} ${report.confidence.score}`;
  const headlineClass=report.changeClass.code==="A"?"good":report.changeClass.code==="B"?"warn":"bad";
  $("ecoHeadline").className=`eco-headline ${headlineClass}`;
  $("ecoHeadline").textContent=`Class ${report.changeClass.code}: ${report.changeClass.name}`;

  $("ecoChangeArea").className="table-wrap";
  $("ecoChangeArea").innerHTML=`<table class="eco-impact-table">
    <thead><tr><th>ID</th><th>Severity</th><th>영향영역</th><th>변경/차이</th><th>필요 조치</th><th>근거</th><th>Gate</th><th>Owner</th><th>Status</th></tr></thead>
    <tbody>${report.items.map((x,i)=>`<tr data-eco-index="${i}">
      <td><b>${esc(x.id)}</b><br>${esc(x.title)}</td>
      <td>${severityBadge(x.severity)}</td>
      <td><div class="domain-tags">${x.domains.map(d=>`<span class="domain-tag">${esc(d)}</span>`).join("")}</div></td>
      <td>${esc(x.change)}${x.reason?`<div class="evidence-ref">${esc(x.reason)}</div>`:""}</td>
      <td>${esc(x.action)}</td>
      <td class="evidence-ref">${esc(x.evidence||"-")}</td>
      <td>${esc(x.gate||"Review")}</td>
      <td><input class="eco-owner" data-owner="${i}" placeholder="Owner" value="${esc(x.owner)}"></td>
      <td><select class="eco-status" data-status="${i}">
        <option value="Open">Open</option><option value="Reviewing">Reviewing</option><option value="Done">Done</option><option value="N/A">N/A</option>
      </select></td>
    </tr>`).join("")}</tbody>
  </table>`;

  $("ecoChecklist").className="eco-checklist";
  $("ecoChecklist").innerHTML=report.checklist.map((x,i)=>`<label class="eco-check-item">
    <input type="checkbox" data-check="${i}">
    <div><b>${esc(x.code)} · ${esc(x.title)}</b><span>${esc(x.detail)}</span></div>
  </label>`).join("");

  $("ecoSummaryText").textContent=report.summary;

  document.querySelectorAll("[data-owner]").forEach(el=>el.addEventListener("input",()=>report.items[Number(el.dataset.owner)].owner=el.value));
  document.querySelectorAll("[data-status]").forEach(el=>el.addEventListener("change",()=>report.items[Number(el.dataset.status)].status=el.value));
  document.querySelectorAll("[data-check]").forEach(el=>el.addEventListener("change",()=>report.checklist[Number(el.dataset.check)].done=el.checked));
}

$("copyEcoSummaryBtn").addEventListener("click", async ()=>{
  if(!ecoState.report)return;
  try{
    await navigator.clipboard.writeText(ecoState.report.summary);
    const old=$("copyEcoSummaryBtn").textContent;
    $("copyEcoSummaryBtn").textContent="복사 완료";
    setTimeout(()=>$("copyEcoSummaryBtn").textContent=old,1000);
  }catch{
    alert("브라우저에서 클립보드 접근이 허용되지 않았습니다. ECO Summary 영역을 직접 복사하세요.");
  }
});

$("exportEcoBtn").addEventListener("click", ()=>{
  const r=ecoState.report;
  if(!r || typeof XLSX==="undefined")return;
  const wb=XLSX.utils.book_new();

  const summaryRows=[
    {Field:"Project",Value:r.context.project||""},
    {Field:"Base MPN",Value:r.parts.base?.MPN||$("dsBaseMpn")?.value||""},
    {Field:"Candidate MPN",Value:r.parts.candidate?.MPN||$("dsCandidateMpn")?.value||""},
    {Field:"Change Class",Value:`${r.changeClass.code} - ${r.changeClass.name}`},
    {Field:"Critical",Value:r.counts.Critical},
    {Field:"Major",Value:r.counts.Major},
    {Field:"Minor",Value:r.counts.Minor},
    {Field:"Extraction Confidence",Value:`${r.confidence.label} (${r.confidence.score}/100)`},
    {Field:"Board Differential Z",Value:r.context.impedance??""},
    {Field:"Board Supply",Value:r.context.supply??""},
    {Field:"PCB Policy",Value:r.context.pcbPolicy},
    {Field:"FW Policy",Value:r.context.fwPolicy},
    {Field:"Target",Value:r.context.target},
    {Field:"Auto Summary",Value:r.summary}
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(summaryRows),"ECO_Summary");

  const changes=r.items.map(x=>({
    ID:x.id,Severity:x.severity,Title:x.title,Domains:x.domains.join(", "),
    Change:x.change,RequiredAction:x.action,Evidence:x.evidence,Reason:x.reason,Gate:x.gate,
    Owner:x.owner,Status:x.status
  }));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(changes),"Change_Items");

  const checklist=r.checklist.map(x=>({Code:x.code,Checklist:x.title,Detail:x.detail,Done:x.done?"YES":"NO"}));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(checklist),"Verification_Checklist");

  if(r.comparison?.pins?.rows?.length){
    const pinRows=r.comparison.pins.rows.map(x=>({
      Pin:x.pin,BasePin:x.base,CandidatePin:x.candidate,Status:x.status,
      BasePage:x.basePage,CandidatePage:x.candidatePage
    }));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(pinRows),"Pin_Delta");
  }

  const evidence=[];
  for(const [label,key] of [["Impedance","impedance"],["AC Coupling","acCoupling"],["AUX_HPD","auxHpd"],["Absolute Max","absoluteMax"],["Equalization","equalization"]]){
    for(const [side,obj] of [["Base",r.base],["Candidate",r.candidate]]){
      for(const e of obj?.[key]||[]) evidence.push({Category:label,Side:side,Page:e.page,Evidence:e.text});
    }
  }
  if(evidence.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(evidence),"PDF_Evidence");

  const circuit = window.smartBomCircuitBridge?.getReport?.();
  if(circuit){
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(circuit.rows.map(x=>({
      Pin:x.pin,Net:x.net,NetType:x.netType,BasePin:x.basePin,CandidatePin:x.candidatePin,
      Status:x.status,Risk:x.risk,Judgement:x.note
    }))),"Circuit_Pin_Impact");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(circuit.changes.map(x=>({
      Severity:x.severity,Domain:x.domain,Title:x.title,Detail:x.detail,RequiredAction:x.action
    }))),"Circuit_Changes");
  }

  const safe=s=>String(s||"PART").replace(/[\\/:*?"<>|]/g,"_").slice(0,60);
  const b=safe(r.parts.base?.MPN||$("dsBaseMpn")?.value||"BASE");
  const c=safe(r.parts.candidate?.MPN||$("dsCandidateMpn")?.value||"CANDIDATE");
  XLSX.writeFile(wb,`ECO_Review_${b}_to_${c}_V4.xlsx`);
});

window.addEventListener("smartbom:circuit-report-ready", e=>{
  const r=window.smartBomCircuitBridge?.getReport?.();
  if(!r)return;
  const hint=document.getElementById("ecoReadyHint");
  if(hint) hint.textContent=`PDF 비교 + 실제 회로 분석 준비됨 · Circuit Class ${r.class.code} · ${r.changes.length} changes`;
});
