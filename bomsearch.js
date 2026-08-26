/* Smart BOM Selector V5.3K - BOM-row-driven DigiKey-style parametric selection */
(() => {
  const V53 = {
    aoa: [], headerRow: 0, headerCols: new Map(), rows: [], selected: null,
    filterOptions: null, selections: {manufacturer:new Set(),status:new Set(),packaging:new Set(),parametric:new Map()},
    apiCount: 0, lastQuery: "", localMode: false, autoSelections:new Map(), batchRunning:false, batchCache:new Map(), connectionError:"", liveProviders:[]
  };

  // Extend BOM mappings before the user uploads a file.
  const extraFields = [
    ["PartName","PART / Part Name"],["Category","Category / Type"],["Value","Value"],["Tolerance","Tolerance"],
    ["VoltageRating","Voltage Rating"],["PowerRating","Power Rating"],["TempCoefficient","Temp. Coefficient / Dielectric"],
    ["Dielectric","Dielectric"],["MountingType","Mounting Type"],["TemperatureRange","Temperature Range"],["PCBFootprint","PCB Footprint"]
  ];
  for (const f of extraFields) if(!canonicalFields.some(x=>x[0]===f[0])) canonicalFields.push(f);
  Object.assign(aliases, {
    PartName:["part","partname","part name","part_name","device","device name","devicename","component name","componentname","part type","parttype","파트명","part명","부품명"],
    Value:["value","partvalue","nominalvalue","값","정격값","용량","저항값"],
    Tolerance:["tolerance","tol","허용오차","오차"],
    VoltageRating:["voltagerating","ratedvoltage","voltage rated","정격전압","내압"],
    PowerRating:["powerrating","ratedpower","power watts","wattage","정격전력","전력"],
    TempCoefficient:["temperaturecoefficient","tempcoefficient","tempco","tcr","온도계수"],
    Dielectric:["dielectric","characteristic","유전체","온도특성"],
    MountingType:["mountingtype","mounting","실장","실장형태"],
    TemperatureRange:["temperaturerange","operatingtemperature","optemp","동작온도","사용온도"],
    PCBFootprint:["pcbfootprint","pcb footprint","footprint","pcb pattern","landpattern","land pattern","pcbdecal","pcb decal","pattern","풋프린트","pcb풋프린트","랜드패턴"]
  });

  const oldGuess = guessMapping;
  guessMapping = function(header){
    const h=norm(header);
    const extra={
      PartName:aliases.PartName,Category:aliases.Category,Value:aliases.Value,Tolerance:aliases.Tolerance,VoltageRating:aliases.VoltageRating,
      PowerRating:aliases.PowerRating,TempCoefficient:aliases.TempCoefficient,Dielectric:aliases.Dielectric,
      MountingType:aliases.MountingType,TemperatureRange:aliases.TemperatureRange,PCBFootprint:aliases.PCBFootprint
    };
    for(const [field,list] of Object.entries(extra)) if((list||[]).some(x=>norm(x)===h)) return field;
    return oldGuess(header);
  };

  // Add useful local demo passives so the BOM-driven flow can be tested without API credentials.
  const passiveDemo = [
    {MPN:"C0402C104K4RACTU",Manufacturer:"KEMET",Category:"Ceramic Capacitors",Description:"MLCC 0.1uF 16V X7R 0402 10%",Package:"0402 (1005 Metric)",TempMin:-55,TempMax:125,Lifecycle:"Active",Stock:24000,UnitPrice:.04,Currency:"USD",LeadTimeDays:28,PinCompatible:"Unknown",PCBChange:"None",DatasheetURL:"",ProductURL:"",Source:"Demo",Attributes:{"Capacitance":"0.1 µF","Tolerance":"±10%","Voltage - Rated":"16 V","Temperature Coefficient":"X7R","Package / Case":"0402 (1005 Metric)","Mounting Type":"Surface Mount"}},
    {MPN:"C0402C104J4RACTU",Manufacturer:"KEMET",Category:"Ceramic Capacitors",Description:"MLCC 0.1uF 16V X7R 0402 5%",Package:"0402 (1005 Metric)",TempMin:-55,TempMax:125,Lifecycle:"Active",Stock:8700,UnitPrice:.06,Currency:"USD",LeadTimeDays:35,PinCompatible:"Unknown",PCBChange:"None",DatasheetURL:"",ProductURL:"",Source:"Demo",Attributes:{"Capacitance":"100 nF","Tolerance":"±5%","Voltage - Rated":"16 V","Temperature Coefficient":"X7R","Package / Case":"0402 (1005 Metric)","Mounting Type":"Surface Mount"}},
    {MPN:"GRM155R71C104KA88",Manufacturer:"Murata",Category:"Ceramic Capacitors",Description:"MLCC 0.1uF 16V X7R 0402 10%",Package:"0402 (1005 Metric)",TempMin:-55,TempMax:125,Lifecycle:"Active",Stock:150000,UnitPrice:.02,Currency:"USD",LeadTimeDays:21,PinCompatible:"Unknown",PCBChange:"None",DatasheetURL:"",ProductURL:"",Source:"Demo",Attributes:{"Capacitance":"0.1 µF","Tolerance":"±10%","Voltage - Rated":"16 V","Temperature Coefficient":"X7R","Package / Case":"0402 (1005 Metric)","Mounting Type":"Surface Mount"}},
    {MPN:"CRCW040210K0FKED",Manufacturer:"Vishay",Category:"Chip Resistor - Surface Mount",Description:"10k 1% 0.063W 0402 thick film",Package:"0402 (1005 Metric)",TempMin:-55,TempMax:155,Lifecycle:"Active",Stock:54000,UnitPrice:.018,Currency:"USD",LeadTimeDays:28,PinCompatible:"Unknown",PCBChange:"None",DatasheetURL:"",ProductURL:"",Source:"Demo",Attributes:{"Resistance":"10 kOhms","Tolerance":"±1%","Power (Watts)":"0.063W, 1/16W","Temperature Coefficient":"±100ppm/°C","Package / Case":"0402 (1005 Metric)","Mounting Type":"Surface Mount"}},
    {MPN:"CRCW040210K0JNED",Manufacturer:"Vishay",Category:"Chip Resistor - Surface Mount",Description:"10k 5% 0.063W 0402 thick film",Package:"0402 (1005 Metric)",TempMin:-55,TempMax:155,Lifecycle:"Active",Stock:43000,UnitPrice:.014,Currency:"USD",LeadTimeDays:28,PinCompatible:"Unknown",PCBChange:"None",DatasheetURL:"",ProductURL:"",Source:"Demo",Attributes:{"Resistance":"10 kOhms","Tolerance":"±5%","Power (Watts)":"0.063W, 1/16W","Temperature Coefficient":"±200ppm/°C","Package / Case":"0402 (1005 Metric)","Mounting Type":"Surface Mount"}},
    {MPN:"RC0402FR-0710KL",Manufacturer:"YAGEO",Category:"Chip Resistor - Surface Mount",Description:"10k 1% 0.0625W 0402",Package:"0402 (1005 Metric)",TempMin:-55,TempMax:155,Lifecycle:"Active",Stock:190000,UnitPrice:.009,Currency:"USD",LeadTimeDays:21,PinCompatible:"Unknown",PCBChange:"None",DatasheetURL:"",ProductURL:"",Source:"Demo",Attributes:{"Resistance":"10 kOhms","Tolerance":"±1%","Power (Watts)":"0.0625W, 1/16W","Temperature Coefficient":"±100ppm/°C","Package / Case":"0402 (1005 Metric)","Mounting Type":"Surface Mount"}},
    {MPN:"DEMO-KEMET-AECQ200-MLCC",Manufacturer:"KEMET",Category:"Ceramic Capacitors",Description:"DEMO ONLY - MLCC 0.1uF 16V X7R 0402 10% AEC-Q200",Package:"0402 (1005 Metric)",TempMin:-55,TempMax:125,Lifecycle:"Active",Stock:12000,UnitPrice:.08,Currency:"USD",LeadTimeDays:35,PinCompatible:"Unknown",PCBChange:"None",DatasheetURL:"",ProductURL:"",Source:"Demo",Attributes:{"Capacitance":"0.1 µF","Tolerance":"±10%","Voltage - Rated":"16 V","Temperature Coefficient":"X7R","Package / Case":"0402 (1005 Metric)","Mounting Type":"Surface Mount","Qualification":"AEC-Q200"}},
    {MPN:"DEMO-VISHAY-AECQ200-10K",Manufacturer:"VISHAY",Category:"Chip Resistor - Surface Mount",Description:"DEMO ONLY - 10k 1% 0402 AEC-Q200 chip resistor",Package:"0402 (1005 Metric)",TempMin:-55,TempMax:155,Lifecycle:"Active",Stock:18000,UnitPrice:.03,Currency:"USD",LeadTimeDays:28,PinCompatible:"Unknown",PCBChange:"None",DatasheetURL:"",ProductURL:"",Source:"Demo",Attributes:{"Resistance":"10 kOhms","Tolerance":"±1%","Power (Watts)":"0.063W, 1/16W","Temperature Coefficient":"±100ppm/°C","Package / Case":"0402 (1005 Metric)","Mounting Type":"Surface Mount","Qualification":"AEC-Q200"}}
  ];
  for(const p of passiveDemo){ if(!sampleCandidates.some(x=>x.MPN===p.MPN)) sampleCandidates.push(p); if(!candidates.some(x=>x.MPN===p.MPN)) candidates.push(p); }
  updateCandidateCount();

  const bomFileEl=document.getElementById("bomFile");
  bomFileEl?.addEventListener("change", async e=>{
    const file=e.target.files[0]; if(!file)return;
    // Let the original loader finish first, then build an accurate BOM row model.
    setTimeout(()=>loadBomRowsV53(file).catch(err=>console.error("V5.3 BOM row load",err)),30);
  });
  document.getElementById("mappingEditor")?.addEventListener("change",()=>setTimeout(renderBomRowsV53,20));
  document.getElementById("refreshBomRowsBtn")?.addEventListener("click",renderBomRowsV53);
  document.getElementById("bomRowFilter")?.addEventListener("input",renderBomRowsV53);
  document.getElementById("dkUseBomBtn")?.addEventListener("click",()=>V53.selected&&activateBomRow(V53.selected));
  document.getElementById("dkStartSearchBtn")?.addEventListener("click",()=>performDigiKeySearch(true));
  document.getElementById("dkApplyFiltersBtn")?.addEventListener("click",()=>performDigiKeySearch(false));
  document.getElementById("dkClearFiltersBtn")?.addEventListener("click",clearDigiKeySelections);
  document.getElementById("dkScoreBtn")?.addEventListener("click",scoreCurrentCandidatesForBom);
  document.getElementById("dkOpenWebBtn")?.addEventListener("click",openDigiKeyWeb);
  document.getElementById("autoSelectAllBomBtn")?.addEventListener("click",()=>autoSelectAllBomIndustrial(false));
  document.getElementById("applyAutoSelectionBtn")?.addEventListener("click",applyAllAutoSelections);

  // If the user changes/applies BOM column mapping, rebuild rows and re-run default Industrial selection.
  ["applyMappingBtn","saveMappingBtn","mappingApplyBtn","mappingSaveBtn"].forEach(id=>{
    document.getElementById(id)?.addEventListener("click",()=>{
      setTimeout(()=>rerunAutoSelectionAfterMapping(),100);
    });
  });

  async function loadBomRowsV53(file){
    const wb=await readWorkbook(file); bomWorkbook=wb; bomSheetName=wb.SheetNames[0];
    const ws=wb.Sheets[bomSheetName]; V53.aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});
    V53.headerRow=detectHeaderRow(V53.aoa);
    V53.headerCols=new Map();
    const rawHeaders=V53.aoa[V53.headerRow]||[]; const seen={}; const headers=[];
    rawHeaders.forEach((v,i)=>{ let h=String(v||"").trim(); if(!h)return; if(seen[h])h=`${h}__${i+1}`; seen[h]=1; headers.push(h); V53.headerCols.set(h,i); });
    bomHeaders=headers;
    document.getElementById("bomSheetName").textContent=bomSheetName||"-";
    document.getElementById("bomHeaderCount").textContent=`${bomHeaders.length}개 · Header Row ${V53.headerRow+1}`;
    document.getElementById("headerPreview").className="chips";
    document.getElementById("headerPreview").innerHTML=bomHeaders.map(h=>`<span class="chip">${escapeHtml(h.replace(/__\d+$/,''))}</span>`).join("");
    loadOrAutoMapping(); renderMappingEditor();
    document.getElementById("saveMappingBtn").disabled=false; document.getElementById("resetMappingBtn").disabled=false;
    document.getElementById("refreshBomRowsBtn").disabled=false;
    document.getElementById("autoSelectAllBomBtn").disabled=false;
    document.getElementById("downloadBomBtn").disabled=false;
    renderBomRowsV53(); setStatus("BOM 리스트 분석 완료");
    // V5.3I: BOM mapping/upload complete -> always run Industrial auto-selection by default.
    if(document.getElementById("autoSelectOnBomLoad"))document.getElementById("autoSelectOnBomLoad").checked=true;
    setTimeout(()=>autoSelectAllBomIndustrial(true),120);
  }
  function detectHeaderRow(aoa){
    let best=0,bestScore=-1;
    for(let r=0;r<Math.min(20,aoa.length);r++){
      const vals=(aoa[r]||[]).map(x=>norm(x)).filter(Boolean); let score=0;
      for(const v of vals){
        if(["item","no","refdes","reference","qty","quantity","description","partnumber","mpn","manufacturer","value","package","footprint","pcbfootprint","part","partname","device","componentname","파트명","부품명","품명","품번","수량","제조사","비고"].some(k=>v.includes(norm(k)))) score+=2;
        if(v.length<25)score+=.05;
      }
      if(vals.length>=3)score+=1;
      if(score>bestScore){bestScore=score;best=r;}
    }
    return best;
  }
  function rawRowObject(rowIndex){
    const arr=V53.aoa[rowIndex]||[], raw={};
    for(const h of bomHeaders){const c=V53.headerCols.get(h);raw[h]=arr[c]??"";}
    return raw;
  }
  function canonicalFromRaw(raw){
    const out={};
    for(const [h,v] of Object.entries(raw)){
      const f=bomMapping[h]||guessMapping(h.replace(/__\d+$/,''));
      if(f && out[f]===undefined)out[f]=String(v??"").trim();
    }
    return out;
  }
  function rerunAutoSelectionAfterMapping(){
    V53.autoSelections=new Map();
    V53.batchCache=new Map();
    renderBomRowsV53();
    if(V53.rows.length){
      setTimeout(()=>autoSelectAllBomIndustrial(true),80);
    }
  }

  function renderBomRowsV53(){
    if(!V53.aoa.length){return;}
    const prevSelectedSheet=V53.selected?.sheetRow;
    const previousRows=new Map((V53.rows||[]).map(x=>[x.sheetRow,x]));
    V53.rows=[];
    for(let r=V53.headerRow+1;r<V53.aoa.length;r++){
      const raw=rawRowObject(r), f=canonicalFromRaw(raw);
      const nonempty=Object.values(raw).some(v=>String(v).trim()); if(!nonempty)continue;
      if(!f.Reference&&!f.Description&&!f.MPN&&!f.Value&&!f.Item&&!f.PartName)continue;
      const profile=buildBomProfile(f,raw);
      const prev=previousRows.get(r);
      const auto=V53.autoSelections.get(r)||null;
      V53.rows.push({
        sheetRow:r,excelRow:r+1,raw,fields:f,profile,
        selectedPart:auto?.part||prev?.selectedPart||null,
        autoSelection:auto||prev?.autoSelection||null
      });
    }
    V53.selected=V53.rows.find(x=>x.sheetRow===prevSelectedSheet)||null;

    const q=norm(document.getElementById("bomRowFilter")?.value||"");
    const visible=V53.rows.filter(row=>!q||norm(Object.values(row.fields).join(" ")).includes(q));
    const box=document.getElementById("bomRowTable");
    if(!visible.length){box.className="empty-block";box.textContent="표시할 BOM 부품 행이 없습니다. 컬럼 매핑을 확인하세요.";return;}
    box.className="bom-row-table table-wrap";
    box.innerHTML=`<table class="bom-list-table"><thead><tr>
      <th>선택</th><th class="col-refdes">RefDes</th><th class="col-partname">PART</th>
      <th class="col-desc">Value / Description</th>
      <th>Package</th><th class="col-footprint">PCB Footprint</th><th>Qty</th>
      <th class="col-selected-mpn">선정 MPN / 제조사</th>
      <th class="col-candidates">Industrial 후보군 · DigiKey/Mouser · MPN / 제조사 / Score / 판정 / 선택</th><th>상태</th>
    </tr></thead><tbody>${visible.map(row=>{
      const f=row.fields,p=row.profile,sel=V53.selected?.sheetRow===row.sheetRow;
      const a=V53.autoSelections.get(row.sheetRow);
      const part=a?.part;
      const status=a?.status||"대기";
      const statusClass=status==="자동선정"?"auto":status==="검토필요"?"review":status==="후보없음"?"noresult":status==="BOM반영"?"applied":status==="대체채택"?"manual":status==="연결실패"?"connection":"";
      return `<tr data-bom-row="${row.sheetRow}" class="${sel?'bom-selected':''}">
        <td><input type="radio" name="bomTarget" ${sel?'checked':''}></td>
        <td class="col-refdes">${formatRefDesCell(f.Reference||'-')}</td>
        <td class="col-partname">${formatPartNameCell(f.PartName||"",p)}</td>
        <td class="col-desc">${escapeHtml(f.Value||f.Description||'-')}</td>
        <td>${escapeHtml(f.Package||'-')}</td>
        <td class="col-footprint">${formatFootprintCell(f.PCBFootprint||"-",p)}</td>
        <td>${escapeHtml(f.Qty||'-')}</td>
        <td class="col-selected-mpn">${renderSelectedMpnCell(row,a)}</td>
        <td class="col-candidates">${renderCandidateGroup(row,a)}</td>
        <td><span class="bom-row-status ${statusClass}">${escapeHtml(status)}</span></td>
      </tr>`;
    }).join('')}</tbody></table>`;
    box.querySelectorAll("tr[data-bom-row]").forEach(tr=>tr.addEventListener("click",()=>{
      const row=V53.rows.find(x=>x.sheetRow===Number(tr.dataset.bomRow)); if(row)activateBomRow(row);
    }));
    const chooseCandidate=(sheetRow,idx)=>{
      const row=V53.rows.find(x=>x.sheetRow===Number(sheetRow));
      const a=V53.autoSelections.get(Number(sheetRow));
      const chosen=a?.candidates?.[Number(idx)];
      if(!row||!a||!chosen)return;
      a.part=chosen;
      a.selectedRank=Number(idx);
      a.status=Number(idx)===0?"자동선정":"대체채택";
      row.selectedPart=chosen; row.autoSelection=a;
      renderBomRowsV53();
      const info=document.getElementById("selectionInfo");
      if(info)info.textContent=`BOM Row ${row.excelRow}: ${chosen.MPN} / ${chosen.Manufacturer||"-"} (${Number(idx)===0?"1순위":`대체 ${Number(idx)}`}) 선택`;
    };
    box.querySelectorAll("[data-select-candidate]").forEach(line=>line.addEventListener("click",e=>{
      e.stopPropagation();
      chooseCandidate(line.dataset.row,line.dataset.selectCandidate);
    }));
    box.querySelectorAll("[data-candidate-index]").forEach(radio=>radio.addEventListener("click",e=>{
      e.stopPropagation();
      chooseCandidate(radio.dataset.row,radio.dataset.candidateIndex);
    }));
  }

  function normalizePartWords(text=""){
    const stop=new Set(["PART","DEVICE","COMPONENT","IC","SMD","SMT","CHIP","ELECTRONIC","ELECTRONICS","ASSY","ASSEMBLY","THE","FOR"]);
    return String(text||"").toUpperCase()
      .replace(/[_/(),:;+]+/g," ")
      .replace(/[^A-Z0-9+\-. ]/g," ")
      .split(/\s+/).map(x=>x.trim()).filter(x=>x.length>=2&&!stop.has(x));
  }
  function inferFunctionalClass(text=""){
    const t=String(text||"").toUpperCase().replace(/[_/]+/g," ");
    const has=(r)=>r.test(t);

    if(has(/\b(DISPLAYPORT|DISPLAY PORT|DP)\b/) && has(/\bREDRIVER\b/))return "dp_redriver";
    if(has(/\b(DISPLAYPORT|DISPLAY PORT|DP)\b/) && has(/\bRETIMER\b/))return "dp_retimer";
    if(has(/\bHDMI\b/) && has(/\bREDRIVER\b/))return "hdmi_redriver";
    if(has(/\bHDMI\b/) && has(/\bRETIMER\b/))return "hdmi_retimer";
    if(has(/\bUSB\b/) && has(/\bHUB\b/))return "usb_hub";
    if(has(/\bUSB\b/) && has(/\bREDRIVER\b/))return "usb_redriver";
    if(has(/\bUSB\b/) && has(/\bRETIMER\b/))return "usb_retimer";
    if(has(/\bUSB\b/) && has(/\b(SWITCH|MUX|MULTIPLEXER)\b/))return "usb_switch";
    if(has(/\bETHERNET\b/) && has(/\bPHY\b/))return "ethernet_phy";
    if(has(/\bCAN\b/) && has(/\bTRANSCEIVER\b/))return "can_transceiver";
    if(has(/\bRS[- ]?485\b/) && has(/\bTRANSCEIVER\b/))return "rs485_transceiver";
    if(has(/\bRS[- ]?232\b/) && has(/\bTRANSCEIVER\b/))return "rs232_transceiver";
    if(has(/\b(LEVEL SHIFTER|LEVEL TRANSLATOR|VOLTAGE TRANSLATOR)\b/))return "level_shifter";
    if(has(/\b(DC[- /]?DC|BUCK|BOOST|STEP DOWN|STEP UP)\b/) && has(/\b(CONVERTER|REGULATOR|CONTROLLER|POWER)\b/))return "dcdc";
    if(has(/\bLDO\b/) || has(/\bLOW DROPOUT\b/))return "ldo";
    if(has(/\b(OP AMP|OPAMP|OPERATIONAL AMPLIFIER)\b/))return "opamp";
    if(has(/\bCOMPARATOR\b/))return "comparator";
    if(has(/\b(MCU|MICROCONTROLLER)\b/))return "mcu";
    if(has(/\b(MPU|MICROPROCESSOR|PROCESSOR)\b/))return "processor";
    if(has(/\bEEPROM\b/))return "eeprom";
    if(has(/\b(NOR FLASH|NAND FLASH|FLASH MEMORY)\b/))return "flash";
    if(has(/\b(DDR[2-5]?|SDRAM|DRAM)\b/))return "dram";
    if(has(/\bOSCILLATOR\b/))return "oscillator";
    if(has(/\bCRYSTAL\b/) && !has(/\bOSCILLATOR\b/))return "crystal";
    if(has(/\bTVS\b/))return "tvs";
    if(has(/\bESD\b/) && has(/\b(PROTECTION|PROTECTOR|DIODE)\b/))return "esd";
    if(has(/\b(COMMON MODE CHOKE|CMC)\b/))return "common_mode_choke";
    if(has(/\bFERRITE\b/) && has(/\b(BEAD|CHIP)\b/))return "ferrite_bead";
    if(has(/\bMOSFET\b/))return "mosfet";
    if(has(/\bDIODE\b/))return "diode";
    if(has(/\bTRANSISTOR\b/))return "transistor";
    if(has(/\bCONNECTOR\b/))return "connector";
    if(has(/\b(MUX|MULTIPLEXER)\b/))return "mux";
    if(has(/\bSWITCH\b/))return "switch";
    if(has(/\bTRANSCEIVER\b/))return "transceiver";
    if(has(/\bREDRIVER\b/))return "redriver";
    if(has(/\bRETIMER\b/))return "retimer";
    if(has(/\bREGULATOR\b/))return "regulator";
    if(has(/\bCONTROLLER\b/))return "controller";
    if(has(/\bCAPACITOR|MLCC\b/))return "capacitor";
    if(has(/\bRESISTOR\b/))return "resistor";
    if(has(/\bINDUCTOR\b/))return "inductor";
    return "";
  }
  function functionalLabel(cls=""){
    const labels={
      dp_redriver:"DP Redriver",dp_retimer:"DP Retimer",hdmi_redriver:"HDMI Redriver",hdmi_retimer:"HDMI Retimer",
      usb_hub:"USB Hub",usb_redriver:"USB Redriver",usb_retimer:"USB Retimer",usb_switch:"USB Switch/Mux",
      ethernet_phy:"Ethernet PHY",can_transceiver:"CAN Transceiver",rs485_transceiver:"RS-485 Transceiver",
      rs232_transceiver:"RS-232 Transceiver",level_shifter:"Level Shifter",dcdc:"DC/DC",ldo:"LDO",
      opamp:"Op Amp",comparator:"Comparator",mcu:"MCU",processor:"Processor",eeprom:"EEPROM",flash:"Flash",
      dram:"DRAM",oscillator:"Oscillator",crystal:"Crystal",tvs:"TVS",esd:"ESD Protection",
      common_mode_choke:"Common Mode Choke",ferrite_bead:"Ferrite Bead",mosfet:"MOSFET",diode:"Diode",
      transistor:"Transistor",connector:"Connector",mux:"MUX",switch:"Switch",transceiver:"Transceiver",
      redriver:"Redriver",retimer:"Retimer",regulator:"Regulator",controller:"Controller",
      capacitor:"Capacitor",resistor:"Resistor",inductor:"Inductor"
    };
    return labels[cls]||cls||"";
  }
  function partCategoryFromName(partName="",desc=""){
    const cls=inferFunctionalClass(`${partName} ${desc}`);
    const map={
      dp_redriver:"DisplayPort Redriver",dp_retimer:"DisplayPort Retimer",
      hdmi_redriver:"HDMI Redriver",hdmi_retimer:"HDMI Retimer",
      usb_hub:"USB Hub Controller",usb_redriver:"USB Redriver",usb_retimer:"USB Retimer",usb_switch:"USB Switch / Multiplexer",
      ethernet_phy:"Ethernet PHY",can_transceiver:"CAN Transceiver",rs485_transceiver:"RS-485 Transceiver",
      rs232_transceiver:"RS-232 Transceiver",level_shifter:"Logic Level Translator",
      dcdc:"DC/DC Switching Regulator",ldo:"LDO Regulator",opamp:"Operational Amplifier",comparator:"Comparator",
      mcu:"Microcontroller",processor:"Processor",eeprom:"EEPROM",flash:"Flash Memory",dram:"DRAM",
      oscillator:"Oscillator",crystal:"Crystal",tvs:"TVS Diode",esd:"ESD Protection",
      common_mode_choke:"Common Mode Choke",ferrite_bead:"Ferrite Bead",
      mosfet:"MOSFET",diode:"Diode",transistor:"Transistor",connector:"Connector",
      mux:"Multiplexer",switch:"Switch",transceiver:"Transceiver",redriver:"Redriver",retimer:"Retimer",
      regulator:"Regulator",controller:"Controller",capacitor:"Ceramic Capacitor",resistor:"Chip Resistor",inductor:"Inductor"
    };
    return map[cls]||String(partName||"").trim();
  }
  function functionalKind(cls,category="",desc=""){
    if(["capacitor"].includes(cls))return "capacitor";
    if(["resistor"].includes(cls))return "resistor";
    if(["inductor","common_mode_choke","ferrite_bead","crystal"].includes(cls))return "inductor";
    if(["mosfet","diode","transistor","tvs","esd"].includes(cls))return "discrete";
    if(["connector"].includes(cls))return "connector";
    if(cls)return "ic";
    const t=`${category} ${desc}`;
    if(/capacitor|mlcc/i.test(t))return "capacitor";
    if(/resistor/i.test(t))return "resistor";
    if(/inductor|transformer|ferrite|thermistor|varistor|crystal/i.test(t))return "inductor";
    if(/diode|transistor|mosfet|igbt|thyristor|rectifier|discrete/i.test(t))return "discrete";
    if(/connector/i.test(t))return "connector";
    if(/\bic\b|redriver|retimer|driver|transceiver|regulator|controller|processor|memory|amplifier|switch|mux|interface/i.test(t))return "ic";
    return "generic";
  }
  function buildPartQuery(partName,category,desc,kind){
    const pn=String(partName||"").trim();
    if(pn && !/^(IC|PART|COMPONENT|DEVICE|SMD)$/i.test(pn))return pn;
    if(kind==="capacitor")return "ceramic capacitors";
    if(kind==="resistor")return "chip resistors";
    if(kind==="inductor")return category||"fixed inductors";
    if(kind==="connector")return category||"connectors";
    return category||desc||"electronic component";
  }
  function candidateFunctionText(c){
    let attrs="";
    try{attrs=JSON.stringify(c?.Attributes||{});}catch{}
    return `${c?.Category||""} ${c?.Description||""} ${c?.MPN||""} ${attrs}`;
  }
  function partNameCompatibility(p,c){
    const partName=String(p?.partName||"").trim();
    if(!partName)return {level:"none",score:0,reason:""};
    const expected=p.functionClass||inferFunctionalClass(`${partName} ${p.category||""}`);
    const candidateText=candidateFunctionText(c);
    const actual=inferFunctionalClass(candidateText);

    if(expected && actual){
      if(expected===actual)return {level:"match",score:14,reason:`PART 기능 일치: ${functionalLabel(expected)}`};

      // Allow generic/specific parent relations only as review, never as exact.
      const parent={
        dp_redriver:"redriver",hdmi_redriver:"redriver",usb_redriver:"redriver",
        dp_retimer:"retimer",hdmi_retimer:"retimer",usb_retimer:"retimer",
        can_transceiver:"transceiver",rs485_transceiver:"transceiver",rs232_transceiver:"transceiver"
      };
      if(parent[expected]===actual || parent[actual]===expected)
        return {level:"review",score:-3,reason:`PART 기능 상세도 확인: ${functionalLabel(expected)} ↔ ${functionalLabel(actual)}`};

      return {level:"mismatch",score:-30,reason:`PART 기능 불일치: ${functionalLabel(expected)} ≠ ${functionalLabel(actual)}`};
    }

    const words=normalizePartWords(partName);
    const text=norm(candidateText);
    const meaningful=words.filter(w=>w.length>=3);
    const hits=meaningful.filter(w=>text.includes(norm(w)));
    if(meaningful.length>=1 && hits.length>=Math.min(2,meaningful.length))
      return {level:"text",score:7,reason:`PART명 키워드 일치: ${hits.join(", ")}`};
    if(expected && !actual)
      return {level:"unknown",score:-4,reason:`후보에서 ${functionalLabel(expected)} 기능 표기 확인 필요`};
    return {level:"unknown",score:-2,reason:`PART명 '${partName}' 기능 일치 수동 확인`};
  }
  function formatPartNameCell(partName,p){
    if(!partName)return `<span class="muted">-</span>`;
    const label=functionalLabel(p?.functionClass||"");
    return `<div class="partname-box"><b>${escapeHtml(partName)}</b>${label?`<span class="part-function">${escapeHtml(label)}</span>`:""}</div>`;
  }

  const METRIC_TO_IMPERIAL={
    "0402":"01005","0603":"0201","1005":"0402","1608":"0603","2012":"0805",
    "3216":"1206","3225":"1210","4532":"1812","5025":"2010","6332":"2512"
  };
  function footprintInfo(fp=""){
    const raw=String(fp||"").trim(), u=raw.toUpperCase();
    let passive="";
    // Common CAD footprint naming: CAPC1005X..., RESC1608X..., etc. The embedded code is normally metric.
    const cadMetric=u.match(/(?:CAPC|RESC|INDC|LEDC|DIOM|FUSC|CRYSTAL|C|R|L)[_-]?(0402|0603|1005|1608|2012|3216|3225|4532|5025|6332)(?:X|_|-)/);
    if(cadMetric) passive=METRIC_TO_IMPERIAL[cadMetric[1]]||"";
    if(!passive)passive=normalizedPassiveSize(u);
    const famMatch=u.match(/\b(WQFN|VQFN|TQFN|QFN|DFN|SON|BGA|LGA|CSP|SOIC|TSSOP|SSOP|MSOP|SOP|SOT|DPAK|D2PAK|TO-\d+|DIP|PLCC|LQFP|TQFP|QFP)\b/);
    const family=famMatch?.[1]||"";
    let pins="";
    const pin1=u.match(/[-_](\d{1,3})(?:N|P|PIN|PINS)?(?:$|[_-])/);
    const pin2=u.match(/\b(\d{1,3})[- ]?(?:PIN|PINS)\b/);
    if(pin1)pins=pin1[1]; else if(pin2)pins=pin2[1];
    return {raw,passive,family,pins};
  }
  function candidatePackageInfo(c){
    const pkg=attr(c,["Package / Case","Supplier Device Package"])||c.Package||"";
    const fp=attr(c,["PCB Footprint","Footprint","Land Pattern","Recommended Land Pattern","CAD Footprint"])||c.PCBFootprint||"";
    return {pkg,fp,pi:footprintInfo(pkg),fi:footprintInfo(fp)};
  }
  function footprintCompatibility(bomFp,c){
    const b=footprintInfo(bomFp);
    if(!b.raw)return {level:"none",hard:false,reason:""};
    const cp=candidatePackageInfo(c);
    if(cp.fp && norm(cp.fp)===norm(b.raw))
      return {level:"exact",hard:false,reason:`PCB Footprint exact: ${b.raw}`};

    const candidatePassive=cp.fi.passive||cp.pi.passive;
    if(b.passive && candidatePassive){
      if(b.passive===candidatePassive)
        return {level:"compatible",hard:false,reason:`Footprint size ${b.passive} 호환`};
      return {level:"mismatch",hard:true,reason:`Footprint size ${b.passive} ≠ ${candidatePassive}`};
    }

    const candidateFamily=cp.fi.family||cp.pi.family;
    const candidatePins=cp.fi.pins||cp.pi.pins;
    if(b.family && candidateFamily){
      if(b.family!==candidateFamily)
        return {level:"mismatch",hard:true,reason:`Footprint family ${b.family} ≠ ${candidateFamily}`};
      if(b.pins && candidatePins && b.pins!==candidatePins)
        return {level:"mismatch",hard:true,reason:`Footprint pin count ${b.pins} ≠ ${candidatePins}`};
      if(b.pins && candidatePins && b.pins===candidatePins)
        return {level:"compatible",hard:false,reason:`${b.family}-${b.pins} package/footprint 호환 후보`};
      return {level:"review",hard:false,reason:`${b.family} family 일치, land pattern 수동 확인`};
    }
    return {level:"unknown",hard:false,reason:`PCB Footprint ${b.raw}: 후보 land pattern 직접 정보 없음`};
  }
  function inferPackageFromFootprint(fp=""){
    const i=footprintInfo(fp);
    if(i.passive)return i.passive;
    if(i.family)return [i.family,i.pins].filter(Boolean).join("-");
    return "";
  }
  function formatFootprintCell(fp,p){
    const val=String(fp||"-");
    if(val==="-")return "-";
    const inferred=inferPackageFromFootprint(val);
    return `<div class="footprint-text" title="${escapeHtml(val)}">${escapeHtml(val)}</div>${inferred?`<span class="footprint-badge">→ ${escapeHtml(inferred)}</span>`:""}`;
  }

  function renderSelectedMpnCell(row,a){
    const p=a?.part||row?.selectedPart||null;
    if(!p)return `<span class="candidate-none">자동선정 전</span>`;
    const rank=Number.isInteger(a?.selectedRank)?a.selectedRank:0;
    return `<div class="selected-mpn-box">
      <b>${escapeHtml(p.MPN||"-")}</b>
      <span>${escapeHtml(p.Manufacturer||"-")}</span>
      <span class="selected-auto-badge">${rank===0?"자동선정 1순위":`대체${rank} 선택`}</span>
    </div>`;
  }

  function candidateStatusClass(v){
    return v==="적합"?"pass":"conditional";
  }
  function renderCandidateGroup(row,a){
    const list=a?.candidates||[];
    if(!list.length)return `<span class="candidate-none">Industrial 조건에 맞는 후보 없음</span>`;
    const selected=a?.part?.MPN||list[0]?.MPN;
    const header=`<div class="candidate-grid-head">
      <span>순위</span><span>부품번호 (MPN)</span><span>제조사</span><span>검색처</span><span>Score</span><span>판정</span><span>선택</span>
    </div>`;
    const lines=list.slice(0,4).map((p,i)=>{
      const active=norm(p.MPN)===norm(selected);
      const rank=i===0?"1순위":`대체${i}`;
      const cls=active?(i===0?"primary":"selected-alt"):"alt";
      return `<div class="candidate-line ${cls}" data-select-candidate="${i}" data-row="${row.sheetRow}"
        title="${escapeHtml((p.Reasons||[]).join(" | "))}">
        <span class="candidate-rank">${rank}</span>
        <span class="candidate-mpn">${escapeHtml(p.MPN||"-")}${p.PriorityExact?` <span class="exact-priority">최우선</span>`:""}</span>
        <span class="candidate-maker">${escapeHtml(p.Manufacturer||"-")}</span>
        <span class="candidate-source ${String(p.Source||"").toLowerCase()}">${escapeHtml(p.Source||"Local")}</span>
        <span class="candidate-score">${escapeHtml(String(p.Score??"-"))}</span>
        <span class="candidate-verdict ${candidateStatusClass(p.Verdict)}">${escapeHtml(p.Verdict||"-")}</span>
        <span class="candidate-select-radio">
          <input type="radio" name="candidate_${row.sheetRow}" ${active?"checked":""}
            data-row="${row.sheetRow}" data-candidate-index="${i}" aria-label="${escapeHtml((p.MPN||"")+" 선택")}">
        </span>
      </div>`;
    }).join("");
    return `<div class="candidate-group">${header}${lines}</div>
      <span class="alt-count">표시 ${Math.min(list.length,4)}개 · 1순위 + 대체 ${Math.max(0,Math.min(list.length,4)-1)}개</span>`;
  }

  function splitRefDes(ref){
    const text=String(ref||"").trim();
    if(!text)return [];
    let parts=text.split(/[\s,;\/]+/).map(x=>x.trim()).filter(Boolean);
    if(parts.length<=1 && text.length>18){
      const matches=text.match(/[A-Za-z]{1,4}\d+[A-Za-z]?/g);
      if(matches?.length>1)parts=matches;
    }
    return parts.length?parts:[text];
  }
  function formatRefDesCell(ref){
    const all=splitRefDes(ref), max=10, shown=all.slice(0,max), rest=Math.max(0,all.length-max);
    return `<div class="refdes-wrap" title="${escapeHtml(String(ref||''))}">
      ${shown.map(x=>`<span class="refdes-chip">${escapeHtml(x)}</span>`).join("")}
      ${rest?`<span class="refdes-chip refdes-more">+${rest}</span>`:""}
    </div>${all.length>1?`<span class="refdes-count">${all.length} RefDes</span>`:""}`;
  }

  function buildBomProfile(f,raw){
    const all=Object.values(raw).join(" ");
    const ref=String(f.Reference||"").trim();
    const desc=String(f.Description||"").trim();
    const partName=String(f.PartName||"").trim();

    let category=String(f.Category||"").trim();
    const functionClass=inferFunctionalClass(`${partName} ${category} ${desc}`);

    // PART name has priority for non-passive function/category identification.
    if(!category && partName)category=partCategoryFromName(partName,desc);
    if(!category){
      if(/^C\d+/i.test(ref)||/\b(?:MLCC|CERAMIC CAP|CERAMIC CAPACITOR)\b/i.test(all))category="Ceramic Capacitor";
      else if(/^R\d+/i.test(ref)||/\b(?:CHIP RESISTOR|RESISTOR)\b/i.test(all))category="Chip Resistor";
      else if(/^L\d+/i.test(ref)||/\bINDUCTOR\b/i.test(all))category="Inductor";
      else if(/^(U|IC)\d+/i.test(ref))category=partName||"IC";
      else if(/^(J|CN)\d+/i.test(ref))category=partName||"Connector";
      else category=partName||desc.split(/[,;]/)[0].trim()||"Electronic Component";
    }

    const resolvedClass=functionClass||inferFunctionalClass(`${category} ${desc}`);
    const kind=functionalKind(resolvedClass,category,desc);

    let value=f.Value||"";
    if(!value){
      if(kind==="capacitor") value=(all.match(/\b\d+(?:\.\d+)?\s*(?:pF|nF|uF|µF|mF)\b/i)||[])[0]||"";
      if(kind==="resistor") value=(all.match(/\b\d+(?:\.\d+)?\s*(?:m?Ω|ohm|kohm|kΩ|Mohm|MΩ|[kKmM](?=\b))\b/i)||[])[0]||"";
    }
    const tolerance=f.Tolerance||(all.match(/(?:±|\+\/-)?\s*\d+(?:\.\d+)?\s*%/)||[])[0]||"";
    const voltage=f.VoltageRating||(all.match(/\b\d+(?:\.\d+)?\s*V(?:DC)?\b/i)||[])[0]||"";
    const power=f.PowerRating||(all.match(/\b(?:\d+\/\d+\s*W|\d+(?:\.\d+)?\s*m?W)\b/i)||[])[0]||"";
    const tempCoeff=f.TempCoefficient||f.Dielectric||(all.match(/\b(?:X7R|X5R|C0G|COG|NP0|Y5V|Z5U)\b/i)||[])[0]||"";
    const pcbFootprint=f.PCBFootprint||"";
    let pkg=f.Package||"";
    if(!pkg&&pcbFootprint)pkg=inferPackageFromFootprint(pcbFootprint);
    if(!pkg)pkg=(all.match(/\b(?:01005|0201|0402|0603|0805|1206|1210|1812|2010|2512)\b/)||[])[0]||"";

    const preferred=kind==="capacitor"?"KEMET":kind==="resistor"?"VISHAY":"";
    const query=buildPartQuery(partName,category,desc,kind);

    return {
      partName,category,kind,functionClass:resolvedClass,
      value,tolerance,voltage,power,tempCoeff,package:pkg,pcbFootprint,preferred,
      qty:Number(String(f.Qty||"1").replace(/[^0-9.]/g,""))||1,
      query,currentMpn:""
    };
  }
  function activateBomRow(row){
    V53.selected=row; const p=row.profile,f=row.fields;
    document.getElementById("dkBomTargetTitle").textContent=`Row ${row.excelRow} · ${f.Reference||f.Item||'BOM Item'} · ${p.partName||"PART 미지정"}`;
    document.getElementById("dkBomTargetMeta").textContent=[p.value,p.tolerance,p.voltage,p.power,p.tempCoeff,p.package,p.pcbFootprint?`PCB:${p.pcbFootprint}`:""].filter(Boolean).join(" · ")||f.Description||"BOM 조건";
    document.getElementById("dkUseBomBtn").disabled=false;
    const target=document.getElementById("selectedBomTarget"); target.className="selected-bom-target";
    target.innerHTML=`<strong>선정 대상: ${escapeHtml(f.Reference||f.Item||`Row ${row.excelRow}`)} · ${escapeHtml(p.category)}</strong><div class="selected-bom-fields">${[["PART",p.partName],["Function",functionalLabel(p.functionClass)],["Value",p.value],["Tolerance",p.tolerance],["Voltage",p.voltage],["Power",p.power],["Temp/Dielectric",p.tempCoeff],["Package",p.package],["PCB Footprint",p.pcbFootprint]].filter(x=>x[1]).map(x=>`<span>${x[0]}: <b>${escapeHtml(x[1])}</b></span>`).join('')}</div>`;
    document.getElementById("reqCategory").value=p.category; document.getElementById("liveQuery").value=p.query; document.getElementById("dkSearchWithin").value=p.query;
    document.getElementById("reqPackage").value=p.package||""; document.getElementById("reqPCBFootprint").value=p.pcbFootprint||""; document.getElementById("reqStock").value=String(Math.max(1,p.qty));
    if(p.kind==="capacitor"||p.kind==="resistor"){document.getElementById("reqDataRate").value="0";document.getElementById("reqLanes").value="0";}
    applyPreferredManufacturerRule(true);
    if(p.preferred)document.getElementById("reqManufacturer").value=p.preferred;
    V53.selections={manufacturer:new Set(),status:new Set(),packaging:new Set(),parametric:new Map()}; V53.filterOptions=null;
    renderFilterGrid(null); updateAppliedFilters(); renderBomRowsV53();
    document.getElementById("addBomBtn").textContent="선정 부품 → 선택 BOM 행 반영";
  }

  function openDigiKeyWeb(){
    const q=(document.getElementById("dkSearchWithin").value||V53.selected?.profile.query||"").trim();
    if(!q)return alert("검색어를 입력하세요.");
    window.open(`https://www.digikey.kr/ko/products?keywords=${encodeURIComponent(q)}`,"_blank","noopener");
  }

  function commonOptions(){
    const o=[]; if(document.getElementById("dkInStock").checked)o.push("InStock"); if(document.getElementById("dkNormallyStocking").checked)o.push("NormallyStocking");
    if(document.getElementById("dkRoHS").checked)o.push("RohsCompliant"); if(document.getElementById("dkHasDatasheet").checked)o.push("HasDatasheet"); if(document.getElementById("dkHasCad").checked)o.push("HasCadModel"); return o;
  }
  function apiFilterPayload(){
    const params=[];
    for(const [pid,set] of V53.selections.parametric.entries()) if(set.size){
      const meta=(V53.filterOptions?.parametric||[]).find(x=>String(x.parameterId)===String(pid));
      params.push({parameterId:Number(pid),categoryId:meta?.categoryId||null,valueIds:[...set]});
    }
    return {manufacturers:[...V53.selections.manufacturer],status:[...V53.selections.status],packaging:[...V53.selections.packaging],parametric:params,searchOptions:commonOptions(),excludeMarketplace:document.getElementById("dkExcludeMarketplace").checked,minimumQuantity:Number(document.getElementById("reqStock").value)||0};
  }
  async function performDigiKeySearch(initial){
    const q=(document.getElementById("dkSearchWithin").value||"").trim(); if(!q)return alert("Search Within / Keyword를 입력하세요.");
    document.getElementById("providerSelect").value="digikey"; V53.lastQuery=q;
    const btn=initial?document.getElementById("dkStartSearchBtn"):document.getElementById("dkApplyFiltersBtn"); btn.disabled=true;
    document.getElementById("dkSearchState").textContent="검색 중..."; setStatus("DigiKey식 파라메트릭 검색 중");
    try{
      if(health?.digikey){
        const j=await apiCall({mode:"digikey_search",provider:"digikey",query:q,limit:Number(document.getElementById("dkSearchLimit").value)||50,filters:initial?{searchOptions:commonOptions(),excludeMarketplace:document.getElementById("dkExcludeMarketplace").checked,minimumQuantity:Number(document.getElementById("reqStock").value)||0}:apiFilterPayload()});
        candidates=j.parts||[]; V53.apiCount=j.productsCount??candidates.length; V53.filterOptions=j.filterOptions||null; V53.localMode=false;
        document.getElementById("candidateSource").textContent="DigiKey KeywordSearch V4"; updateCandidateCount();
        if(initial){V53.selections={manufacturer:new Set(),status:new Set(),packaging:new Set(),parametric:new Map()}; autoSelectBomFilters();}
        renderFilterGrid(V53.filterOptions); updateAppliedFilters(); scoreCurrentCandidatesForBom();
        document.getElementById("dkSearchState").textContent=j.productsCount!==undefined?`현재 검색 결과 ${Number(j.productsCount).toLocaleString()}개`:`${candidates.length}개 로드`;
      } else {
        V53.localMode=true; candidates=localInitialCandidates(q); V53.apiCount=candidates.length; V53.filterOptions=deriveLocalFilters(candidates);
        if(initial){V53.selections={manufacturer:new Set(),status:new Set(),packaging:new Set(),parametric:new Map()}; autoSelectBomFilters();}
        renderFilterGrid(V53.filterOptions); updateAppliedFilters(); applyLocalFiltersAndScore();
        document.getElementById("candidateSource").textContent="Local/Excel (DigiKey-style UI)";
        document.getElementById("dkSearchState").textContent="DigiKey API 키 없음 · Excel/Demo 후보를 같은 필터 UI로 분석";
      }
      document.getElementById("dkResultsCount").textContent=Number(V53.apiCount).toLocaleString(); setStatus("검색/분석 완료");
    }catch(err){
      console.error(err); document.getElementById("dkSearchState").textContent="검색 실패";
      alert(`DigiKey 검색 실패: ${err.message}\nAPI 연결이 없으면 후보 Excel을 업로드한 뒤 다시 실행하거나 DigiKey Web 버튼을 사용하세요.`); setStatus("검색 실패");
    }finally{btn.disabled=false;}
  }
  function localInitialCandidates(q){
    const qn=norm(q),p=V53.selected?.profile;
    let source=[...candidates]; if(document.getElementById("candidateSource").textContent.includes("DigiKey KeywordSearch"))source=[...sampleCandidates];
    const tokens=qn.split(/\s+/).filter(Boolean);
    let list=source.filter(c=>{const t=norm(`${c.Category} ${c.Description} ${c.MPN}`);return tokens.length?tokens.some(x=>t.includes(x)):true;});
    if(p?.kind==="capacitor")list=source.filter(c=>/capacitor|mlcc/i.test(`${c.Category} ${c.Description}`));
    if(p?.kind==="resistor")list=source.filter(c=>/resistor/i.test(`${c.Category} ${c.Description}`));
    if(p?.partName && !["capacitor","resistor"].includes(p.kind)){
      const matched=source.filter(c=>{
        const pc=partNameCompatibility(p,c);
        return pc.level==="match"||pc.level==="text"||pc.level==="review";
      });
      if(matched.length)list=matched;
    }
    return list;
  }
  function deriveLocalFilters(parts){
    const base=(key,vals)=>[...new Set(vals.filter(Boolean))].map((v,i)=>({id:String(v),name:String(v),count:parts.filter(p=>String(p[key]||"")===String(v)).length}));
    const pnames=new Map();
    for(const p of parts)for(const [k,v] of Object.entries(p.Attributes||{})){if(!pnames.has(k))pnames.set(k,new Map());const m=pnames.get(k);m.set(String(v),(m.get(String(v))||0)+1);}
    return {manufacturers:base("Manufacturer",parts.map(p=>p.Manufacturer)),status:base("Lifecycle",parts.map(p=>p.Lifecycle)),packaging:base("Package",parts.map(p=>p.Package)),parametric:[...pnames.entries()].map(([name,m],i)=>({parameterId:`L${i}`,parameterName:name,categoryId:"LOCAL",values:[...m.entries()].map(([v,c])=>({id:v,name:v,count:c}))}))};
  }
  function applyLocalFiltersAndScore(){
    let list=localInitialCandidates(V53.lastQuery||document.getElementById("dkSearchWithin").value);
    const s=V53.selections;
    if(s.manufacturer.size)list=list.filter(p=>[...s.manufacturer].some(x=>norm(x)===norm(p.Manufacturer)));
    if(s.status.size)list=list.filter(p=>[...s.status].some(x=>norm(x)===norm(p.Lifecycle)));
    if(s.packaging.size)list=list.filter(p=>[...s.packaging].some(x=>norm(x)===norm(p.Package)));
    for(const [pid,vals] of s.parametric.entries()){
      const meta=V53.filterOptions.parametric.find(x=>String(x.parameterId)===String(pid)); if(!meta||!vals.size)continue;
      list=list.filter(p=>{const v=attr(p,[meta.parameterName]);return [...vals].some(x=>norm(x)===norm(v));});
    }
    if(document.getElementById("dkInStock").checked)list=list.filter(p=>Number(p.Stock||0)>0);
    if(document.getElementById("dkNormallyStocking").checked)list=list.filter(p=>!/(eol|obsolete|discontinued)/i.test(p.Lifecycle||""));
    candidates=list; V53.apiCount=list.length; updateCandidateCount(); document.getElementById("dkResultsCount").textContent=String(list.length); scoreCurrentCandidatesForBom();
  }

  function filterPriority(name,kind){
    const n=norm(name), lists={
      capacitor:["capacitance","tolerance","voltagerated","temperaturecoefficient","packagecase","mountingtype","operatingtemperature"],
      resistor:["resistance","tolerance","powerwatts","temperaturecoefficient","packagecase","composition","operatingtemperature"],
      ic:["packagecase","supplyvoltage","datarate","numberoflanes","interface","operatingtemperature","mountingtype"],
      generic:["packagecase","mountingtype","operatingtemperature"]
    }; const a=lists[kind]||lists.generic; const i=a.findIndex(x=>n.includes(x)); return i<0?100:i;
  }
  function renderFilterGrid(fo){
    const grid=document.getElementById("dkFilterGrid"); if(!fo){grid.innerHTML='<div class="empty-block">검색을 시작하면 DigiKey식 파라메트릭 필터가 표시됩니다.</div>';return;}
    const cards=[];
    cards.push(filterCard("Manufacturer","manufacturer",fo.manufacturers||[])); cards.push(filterCard("Product Status","status",fo.status||[])); cards.push(filterCard("Packaging","packaging",fo.packaging||[]));
    const kind=V53.selected?.profile.kind||"generic";
    const params=[...(fo.parametric||[])].sort((a,b)=>filterPriority(a.parameterName,kind)-filterPriority(b.parameterName,kind)).filter((x,i)=>i<9||filterPriority(x.parameterName,kind)<100);
    for(const p of params.slice(0,12))cards.push(filterCard(p.parameterName,`param:${p.parameterId}`,p.values||[]));
    grid.innerHTML=cards.join("");
    grid.querySelectorAll(".dk-filter-search").forEach(inp=>inp.addEventListener("input",()=>{const q=norm(inp.value),box=inp.closest(".dk-filter-card");box.querySelectorAll(".dk-filter-values label").forEach(l=>l.style.display=!q||norm(l.dataset.text).includes(q)?"grid":"none");}));
    grid.querySelectorAll("input[data-filter-kind]").forEach(ch=>ch.addEventListener("change",()=>{setSelection(ch.dataset.filterKind,ch.dataset.filterId,ch.checked);updateAppliedFilters();}));
  }
  function filterCard(title,kind,values){
    const selectedSet=getSelectionSet(kind); const p=V53.selected?.profile;
    return `<div class="dk-filter-card"><div class="dk-filter-title">${escapeHtml(title)}</div><input class="dk-filter-search" placeholder="Search Filter"><div class="dk-filter-values">${values.slice(0,120).map(v=>{const auto=isBomFilterMatch(title,v.name,p);const checked=selectedSet.has(String(v.id));return `<label data-text="${escapeHtml(v.name)}" class="${auto?'bom-auto-match':''}"><input type="checkbox" data-filter-kind="${escapeHtml(kind)}" data-filter-id="${escapeHtml(v.id)}" ${checked?'checked':''}><span>${escapeHtml(v.name)}</span><span class="dk-count">${v.count??''}</span></label>`;}).join('')}</div></div>`;
  }
  function getSelectionSet(kind){
    if(kind.startsWith("param:")){const id=kind.split(":")[1];if(!V53.selections.parametric.has(id))V53.selections.parametric.set(id,new Set());return V53.selections.parametric.get(id);}
    return V53.selections[kind];
  }
  function setSelection(kind,id,on){const s=getSelectionSet(kind);on?s.add(String(id)):s.delete(String(id));}
  function autoSelectBomFilters(){
    const fo=V53.filterOptions,p=V53.selected?.profile;if(!fo||!p)return;
    if(p.preferred){const m=(fo.manufacturers||[]).find(x=>norm(x.name).includes(norm(p.preferred)));if(m)V53.selections.manufacturer.add(String(m.id));}
    for(const par of fo.parametric||[]){
      const target=targetForParameter(par.parameterName,p); if(!target)continue;
      const matches=(par.values||[]).filter(v=>valuesEquivalent(par.parameterName,target,v.name));
      if(matches.length){if(!V53.selections.parametric.has(String(par.parameterId)))V53.selections.parametric.set(String(par.parameterId),new Set());for(const m of matches.slice(0,3))V53.selections.parametric.get(String(par.parameterId)).add(String(m.id));}
    }
  }
  function targetForParameter(name,p){const n=norm(name);if(/capacitance/.test(n))return p.value;if(/resistance/.test(n))return p.value;if(/tolerance/.test(n))return p.tolerance;if(/voltagerated|voltage.*rating/.test(n))return p.voltage;if(/powerwatts|powerrating/.test(n))return p.power;if(/temperaturecoefficient|dielectric|characteristic/.test(n))return p.tempCoeff;if(/packagecase|suppliedpackage/.test(n))return p.package;if(/mountingtype/.test(n))return "Surface Mount";if(/qualification|aec|automotive/.test(n)){const prof=currentSelectionProfile();if(prof==="aecq200")return "AEC-Q200";if(prof==="automotive")return expectedAutomotiveQualification(p.category,p.category);return "";}return "";}
  function isBomFilterMatch(name,value,p){const t=targetForParameter(name,p||{});return !!t&&valuesEquivalent(name,t,value);}
  function valuesEquivalent(name,a,b){
    if(!a||!b)return false; const n=norm(name);
    if(/capacitance/.test(n)){const x=parseCap(a),y=parseCap(b);return x&&y&&Math.abs(x-y)<=Math.max(x,y)*1e-6;}
    if(/resistance/.test(n)){const x=parseRes(a),y=parseRes(b);return x!=null&&y!=null&&Math.abs(x-y)<=Math.max(1,x,y)*1e-6;}
    if(/tolerance/.test(n)){const x=parsePct(a),y=parsePct(b);return x!=null&&y!=null&&Math.abs(x-y)<.001;}
    if(/voltagerated|voltage.*rating/.test(n)){const x=parseNum(a),y=parseNum(b);return x!=null&&y!=null&&Math.abs(x-y)<.001;}
    if(/power/.test(n)){const x=parsePower(a),y=parsePower(b);return x&&y&&Math.abs(x-y)<=Math.max(x,y)*.01;}
    if(/package/.test(n)){return norm(b).includes(norm(a))||norm(a).includes(norm(b));}
    return norm(a)===norm(b)||norm(b).includes(norm(a));
  }
  function updateAppliedFilters(){
    const chips=[]; const fo=V53.filterOptions;
    const add=(label,items,set)=>{for(const id of set){const v=(items||[]).find(x=>String(x.id)===String(id));chips.push(`${label}: ${v?.name||id}`);}};
    if(fo){add("Manufacturer",fo.manufacturers,V53.selections.manufacturer);add("Status",fo.status,V53.selections.status);add("Packaging",fo.packaging,V53.selections.packaging);for(const [pid,set] of V53.selections.parametric){const p=fo.parametric.find(x=>String(x.parameterId)===String(pid));if(p)add(p.parameterName,p.values,set);}}
    const prof=profileConfig(); chips.unshift(`Profile: ${prof.label}`);
    const el=document.getElementById("dkAppliedFilters");el.innerHTML=chips.length?chips.map(x=>`<span class="chip">${escapeHtml(x)}</span>`).join(''):'<span class="muted">없음</span>';
  }
  function clearDigiKeySelections(){V53.selections={manufacturer:new Set(),status:new Set(),packaging:new Set(),parametric:new Map()};renderFilterGrid(V53.filterOptions);updateAppliedFilters();if(V53.localMode)applyLocalFiltersAndScore();}

  function scoreCurrentCandidatesForBom(){
    const p=V53.selected?.profile;
    if(!p){results=candidates.map(c=>evaluate(c,getRequirements())).sort(sortResults);renderResults();return;}
    results=candidates.map(c=>evaluateBomCandidate(c,p)).sort(sortResults); selectedIndex=null; renderResults();
    const match=results.filter(x=>x.Verdict!=="부적합").length; document.getElementById("dkBomMatchCount").textContent=String(match); document.getElementById("dkResultsCount").textContent=String(V53.apiCount||candidates.length);
  }
  function evaluateBomCandidate(c,p){
    let r=evaluate(c,getRequirements()), hard=[],warn=[],pos=[],score=r.Score;

    if(p.partName){
      const pc=partNameCompatibility(p,c);
      score+=pc.score;
      if(pc.level==="match"||pc.level==="text")pos.push(pc.reason);
      else if(pc.level==="mismatch")hard.push(pc.reason);
      else if(pc.reason)warn.push(pc.reason);
    }

    const pkg=attr(c,["Package / Case","Supplier Device Package"])||c.Package;
    if(p.package){if(packageMatch(p.package,pkg)){pos.push(`BOM Package ${p.package} 일치`);score+=4;}else if(document.getElementById("bomPackageExact")?.checked){hard.push(`BOM Package ${p.package} ≠ ${pkg||'미상'}`);score-=20;}else{warn.push(`Package ${pkg||'미상'} 검토`);score-=8;}}
    if(p.pcbFootprint){
      const fc=footprintCompatibility(p.pcbFootprint,c);
      if(fc.level==="exact"){pos.push(fc.reason);score+=10;}
      else if(fc.level==="compatible"){pos.push(fc.reason);score+=7;}
      else if(fc.level==="review"){warn.push(fc.reason);score-=2;}
      else if(fc.level==="mismatch"){
        if(document.getElementById("bomPackageExact")?.checked){hard.push(fc.reason);score-=25;}
        else {warn.push(fc.reason);score-=12;}
      }else if(fc.level==="unknown"){warn.push(fc.reason);score-=3;}
    }
    if(p.kind==="capacitor"){
      compareExactEng("Capacitance",p.value,attr(c,["Capacitance"]),parseCap,hard,warn,pos);
      compareMaxAllowed("Tolerance",p.tolerance,attr(c,["Tolerance"]),parsePct,hard,warn,pos);
      compareMinRating("Voltage Rating",p.voltage,attr(c,["Voltage - Rated","Voltage Rated","Voltage"]),parseNum,hard,warn,pos);
      if(p.tempCoeff){const v=attr(c,["Temperature Coefficient","Characteristics"]);if(v){if(norm(v).includes(norm(p.tempCoeff)))pos.push(`Dielectric/TempCoeff ${p.tempCoeff}`);else{hard.push(`${p.tempCoeff} ≠ ${v}`);score-=15;}}else warn.push("Dielectric/TempCoeff 정보 없음");}
    } else if(p.kind==="resistor"){
      compareExactEng("Resistance",p.value,attr(c,["Resistance"]),parseRes,hard,warn,pos);
      compareMaxAllowed("Tolerance",p.tolerance,attr(c,["Tolerance"]),parsePct,hard,warn,pos);
      compareMinRating("Power",p.power,attr(c,["Power (Watts)","Power Rating"]),parsePower,hard,warn,pos);
    }
    if(p.preferred){if(norm(c.Manufacturer).includes(norm(p.preferred))){pos.push(`기본 선호 제조사 ${p.preferred}`);score+=5;}else{warn.push(`선호 제조사 ${p.preferred} 아님`);score-=4;}}
    const q=evaluateQualificationProfile(c,p.category,c.Description||"");
    for(const x of q.hard) if(!hard.includes(x)) hard.push(x);
    for(const x of q.warn) if(!warn.includes(x)) warn.push(x);
    for(const x of q.pos) if(!pos.includes(x)) pos.push(x);
    score=Math.max(0,Math.min(100,Math.round(score)));
    const verdict=(r.Verdict==="부적합"||hard.length)?"부적합":(score<85||warn.length>=3?"조건부":"적합");
    return {...r,Score:score,Verdict:verdict,Reasons:[...hard.map(x=>`✕ BOM ${x}`),...warn.map(x=>`△ BOM ${x}`),...pos.map(x=>`✓ BOM ${x}`),...r.Reasons]};
  }
  function compareExactEng(label,t,c,parser,hard,warn,pos){if(!t)return;if(!c){warn.push(`${label} 후보값 없음`);return;}const a=parser(t),b=parser(c);if(a==null||b==null){warn.push(`${label} 파싱 확인: ${t} / ${c}`);return;}if(Math.abs(a-b)<=Math.max(1e-30,Math.max(Math.abs(a),Math.abs(b))*1e-6))pos.push(`${label} ${t} 일치`);else hard.push(`${label} ${t} ≠ ${c}`);}
  function compareMaxAllowed(label,t,c,parser,hard,warn,pos){if(!t)return;if(!c){warn.push(`${label} 후보값 없음`);return;}const a=parser(t),b=parser(c);if(a==null||b==null){warn.push(`${label} 파싱 확인`);return;}if(b<=a+1e-9)pos.push(`${label} ${c} (요구 ${t} 이내)`);else hard.push(`${label} ${c} > 요구 ${t}`);}
  function compareMinRating(label,t,c,parser,hard,warn,pos){if(!t)return;if(!c){warn.push(`${label} 후보값 없음`);return;}const a=parser(t),b=parser(c);if(a==null||b==null){warn.push(`${label} 파싱 확인`);return;}if(b+1e-12>=a)pos.push(`${label} ${c} ≥ ${t}`);else hard.push(`${label} ${c} < 요구 ${t}`);}
  function attr(c,patterns){const e=Object.entries(c.Attributes||{});for(const p of patterns){const pn=norm(p);const h=e.find(([k])=>norm(k)===pn||norm(k).includes(pn));if(h)return String(h[1]||"");}return "";}
  function parseNum(s){const m=String(s||"").replace(/,/g,'').match(/[-+]?\d+(?:\.\d+)?/);return m?Number(m[0]):null;}
  function parsePct(s){const n=parseNum(s);return n==null?null:Math.abs(n);}
  function parseCap(s){const x=String(s||"").trim().replace(/μ/g,"µ");const m=x.match(/([-+]?\d+(?:\.\d+)?)\s*(pF|nF|uF|µF|mF|F)\b/i);if(!m)return null;const k={PF:1e-12,NF:1e-9,UF:1e-6,"ΜF":1e-6,"µF":1e-6,MF:1e-3,F:1};return Number(m[1])*(k[m[2].toUpperCase()]||k[m[2]]||1);}
  function parseRes(s){let x=String(s||"").trim().replace(/Ω/gi,"ohm");let m=x.match(/([-+]?\d+(?:\.\d+)?)\s*(mohm|kohm|megohm|ohm|kΩ|MΩ)\b/i);if(m){let u=m[2].toLowerCase();let mult=u.startsWith('k')?1e3:(u.startsWith('m')&&u!=='mohm'?1e6:u.startsWith('meg')?1e6:1);return Number(m[1])*mult;}m=x.match(/^([0-9]+(?:\.[0-9]+)?)([kKmM])$/);if(m)return Number(m[1])*(m[2].toLowerCase()==='k'?1e3:1e6);return /^\d+(?:\.\d+)?$/.test(x)?Number(x):null;}
  function parsePower(s){const x=String(s||"");let f=x.match(/(\d+)\s*\/\s*(\d+)\s*W/i);if(f)return Number(f[1])/Number(f[2]);let m=x.match(/(\d+(?:\.\d+)?)\s*(mW|W)\b/i);if(!m)return null;return Number(m[1])*(m[2].toLowerCase()==='mw'?1e-3:1);}
  const PASSIVE_SIZE_EQUIV={
    "01005":"01005","0402M":"01005",
    "0201":"0201","0603M":"0201",
    "0402":"0402","1005":"0402",
    "0603":"0603","1608":"0603",
    "0805":"0805","2012":"0805",
    "1206":"1206","3216":"1206",
    "1210":"1210","3225":"1210",
    "1812":"1812","4532":"1812",
    "2010":"2010","5025":"2010",
    "2512":"2512","6332":"2512"
  };
  function normalizedPassiveSize(s=""){
    const u=String(s||"").toUpperCase();
    // Prefer explicit imperial code when both are shown, e.g. "0805 (2012 Metric)".
    const imp=(u.match(/\b(?:01005|0201|0402|0603|0805|1206|1210|1812|2010|2512)\b/)||[])[0];
    if(imp)return PASSIVE_SIZE_EQUIV[imp]||imp;
    const metric=(u.match(/\b(?:0402|0603|1005|1608|2012|3216|3225|4532|5025|6332)\b/)||[])[0];
    return metric?(PASSIVE_SIZE_EQUIV[metric]||metric):"";
  }
  function packageMatch(a,b){
    if(!a||!b)return false;
    const aa=norm(a),bb=norm(b);
    if(aa===bb||bb.includes(aa)||aa.includes(bb))return true;
    const sa=normalizedPassiveSize(a),sb=normalizedPassiveSize(b);
    return !!sa&&sa===sb;
  }


  function industrialRequirementsForProfile(p){
    return {
      category:p.category||"",
      manufacturer:p.preferred||"",
      package:p.package||"",
      dataRate:0, lanes:0, tempMin:-40, tempMax:85,
      stock:Math.max(1,p.qty||1), price:null, lifecycle:"active",
      pcbChange:"any", dropIn:false, packageHard:!!p.package
    };
  }
  async function ensureLiveConnection(attempts=3){
    let last="";
    for(let i=0;i<attempts;i++){
      try{
        const r=await fetch("/api/health",{cache:"no-store"});
        const text=await r.text(); let j={}; try{j=JSON.parse(text)}catch{}
        if(!r.ok)throw new Error(j.error||text||`HTTP ${r.status}`);
        health=j.providers||{};
        const live=Object.entries(health).filter(([k,v])=>v&&(k==="digikey"||k==="mouser")).map(([k])=>k);
        if(live.length){
          V53.liveProviders=live; V53.connectionError="";
          return {ok:true,providers:live};
        }
        last=j.backendConfigured===false
          ?"Vercel API 주소 미설정"
          :"DigiKey/Mouser API 환경변수 미설정";
      }catch(e){last=e.message||String(e);}
      if(i<attempts-1)await new Promise(r=>setTimeout(r,400*(i+1)));
    }
    V53.liveProviders=[];V53.connectionError=last||"실시간 API 연결 실패";
    return {ok:false,error:V53.connectionError};
  }

  function batchQueryVariants(p){
    const full=batchQueryForProfile(p);
    const passive=["capacitor","resistor","inductor"].includes(p.kind);
    if(!passive)return [full];

    const core=[];
    if(p.kind==="capacitor")core.push("ceramic capacitor",p.value,p.voltage);
    else if(p.kind==="resistor")core.push("chip resistor",p.value);
    else core.push(p.category||"inductor",p.value);

    const size=normalizedPassiveSize(p.package||p.pcbFootprint||"");
    if(size)core.push(size);
    const metric=size?Object.entries(METRIC_TO_IMPERIAL).find(([,imperial])=>imperial===size)?.[0]:"";
    const relaxed=[...core,p.tolerance,p.tempCoeff,metric].filter(Boolean).join(" ").replace(/\s+/g," ").trim();
    const minimal=[...core,metric].filter(Boolean).join(" ").replace(/\s+/g," ").trim();
    return [...new Set([full,relaxed,minimal].filter(Boolean))];
  }

  function batchQueryForProfile(p){
    const tokens=[];
    const passive=["capacitor","resistor","inductor"].includes(p.kind);

    if(passive){
      // Electrical specification is the primary live-distributor query for passives.
      if(p.kind==="capacitor")tokens.push("ceramic capacitor");
      else if(p.kind==="resistor")tokens.push("chip resistor");
      else tokens.push(p.category||"inductor");

      tokens.push(p.value,p.voltage,p.tolerance,p.power,p.tempCoeff);

      const size=normalizedPassiveSize(p.package||p.pcbFootprint||"");
      if(size){
        tokens.push(size);
        const metric=Object.entries(METRIC_TO_IMPERIAL).find(([,imperial])=>imperial===size)?.[0];
        if(metric)tokens.push(metric);
      }else{
        tokens.push(p.package);
      }
    }else{
      if(p.partName)tokens.push(p.partName);
      if(p.query && norm(p.query)!==norm(p.partName))tokens.push(p.query);
      if(p.package)tokens.push(p.package);
    }

    return [...new Set(tokens.filter(Boolean).map(x=>String(x).trim()))].join(" ").replace(/\s+/g," ").trim();
  }
  function batchCacheKey(p){
    return [p.partName,p.functionClass,p.kind,p.value,p.tolerance,p.voltage,p.power,p.tempCoeff,p.package,p.pcbFootprint,p.preferred].map(x=>norm(x||"")).join("|");
  }
  function candidatePoolForProfile(p){
    let source=[...sampleCandidates];
    if(p.kind==="capacitor")source=source.filter(c=>/capacitor|mlcc/i.test(`${c.Category} ${c.Description}`));
    else if(p.kind==="resistor")source=source.filter(c=>/resistor/i.test(`${c.Category} ${c.Description}`));
    else if(p.kind==="inductor")source=source.filter(c=>/inductor|ferrite|transformer/i.test(`${c.Category} ${c.Description}`));
    else if(p.kind==="discrete")source=source.filter(c=>/diode|transistor|mosfet|igbt|discrete|tvs|esd/i.test(`${c.Category} ${c.Description}`));
    else if(p.kind==="ic"){
      const functionMatches=source.filter(c=>{
        const pc=partNameCompatibility(p,c);
        return pc.level==="match"||pc.level==="text"||pc.level==="review";
      });
      source=functionMatches.length?functionMatches:source.filter(c=>/IC|redriver|retimer|driver|transceiver|regulator|controller|processor|memory|amplifier|switch|mux|interface/i.test(`${c.Category} ${c.Description}`));
    }
    return source;
  }
  function passivePriorityFlags(c,p){
    if(!["capacitor","resistor","inductor"].includes(p.kind))
      return {exact:false,value:false,rating:false,size:false,footprint:false};

    let value=false,rating=true,size=false,footprint=false;
    if(p.kind==="capacitor"){
      const target=parseCap(p.value), actual=parseCap(attr(c,["Capacitance"]));
      value=target!=null&&actual!=null&&Math.abs(target-actual)<=Math.max(1e-30,Math.abs(target)*1e-6);
      if(p.voltage){
        const tv=parseNum(p.voltage),cv=parseNum(attr(c,["Voltage - Rated","Voltage Rated","Voltage"]));
        rating=tv!=null&&cv!=null&&cv>=tv;
      }
    }else if(p.kind==="resistor"){
      const target=parseRes(p.value), actual=parseRes(attr(c,["Resistance"]));
      value=target!=null&&actual!=null&&Math.abs(target-actual)<=Math.max(1e-12,Math.abs(target)*1e-6);
      if(p.power){
        const tv=parsePower(p.power),cv=parsePower(attr(c,["Power (Watts)","Power Rating"]));
        rating=tv!=null&&cv!=null&&cv>=tv;
      }
    }else{
      value=!p.value || norm(candidateFunctionText(c)).includes(norm(p.value));
    }

    const cp=attr(c,["Package / Case","Supplier Device Package"])||c.Package||"";
    size=!p.package || packageMatch(p.package,cp);

    if(p.pcbFootprint){
      const fc=footprintCompatibility(p.pcbFootprint,c);
      footprint=["exact","compatible"].includes(fc.level);
    }else footprint=true;

    return {value,rating,size,footprint,exact:value&&rating&&size&&footprint};
  }

  function evaluateBatchCandidate(c,p){
    const req=industrialRequirementsForProfile(p);
    // Batch auto selection is intentionally always Industrial Grade.
    const oldProfile=document.getElementById("selectionProfile")?.value;
    if(document.getElementById("selectionProfile"))document.getElementById("selectionProfile").value="industrial";
    let base=evaluate(c,req);
    let hard=[],warn=[],pos=[],score=base.Score;

    if(p.partName){
      const pc=partNameCompatibility(p,c);
      score+=pc.score;
      if(pc.level==="match"||pc.level==="text")pos.push(pc.reason);
      else if(pc.level==="mismatch")hard.push(pc.reason);
      else if(pc.reason)warn.push(pc.reason);
    }

    const pkg=attr(c,["Package / Case","Supplier Device Package"])||c.Package;
    if(p.package){
      if(packageMatch(p.package,pkg)){pos.push(`Package ${p.package}`);score+=5;}
      else {hard.push(`Package ${p.package} ≠ ${pkg||"미상"}`);score-=20;}
    }
    if(p.pcbFootprint){
      const fc=footprintCompatibility(p.pcbFootprint,c);
      if(fc.level==="exact"){pos.push(fc.reason);score+=10;}
      else if(fc.level==="compatible"){pos.push(fc.reason);score+=8;}
      else if(fc.level==="review"){warn.push(fc.reason);score-=2;}
      else if(fc.level==="mismatch"){hard.push(fc.reason);score-=25;}
      else if(fc.level==="unknown"){warn.push(fc.reason);score-=3;}
    }
    if(p.kind==="capacitor"){
      compareExactEng("Capacitance",p.value,attr(c,["Capacitance"]),parseCap,hard,warn,pos);
      compareMaxAllowed("Tolerance",p.tolerance,attr(c,["Tolerance"]),parsePct,hard,warn,pos);
      compareMinRating("Voltage Rating",p.voltage,attr(c,["Voltage - Rated","Voltage Rated","Voltage"]),parseNum,hard,warn,pos);
      if(p.tempCoeff){
        const v=attr(c,["Temperature Coefficient","Characteristics"]);
        if(v && norm(v).includes(norm(p.tempCoeff)))pos.push(`Dielectric ${p.tempCoeff}`);
        else if(v)hard.push(`${p.tempCoeff} ≠ ${v}`);
        else warn.push("Dielectric 정보 없음");
      }
    }else if(p.kind==="resistor"){
      compareExactEng("Resistance",p.value,attr(c,["Resistance"]),parseRes,hard,warn,pos);
      compareMaxAllowed("Tolerance",p.tolerance,attr(c,["Tolerance"]),parsePct,hard,warn,pos);
      compareMinRating("Power",p.power,attr(c,["Power (Watts)","Power Rating"]),parsePower,hard,warn,pos);
    }
    const pf=passivePriorityFlags(c,p);
    if(pf.exact){score+=15;pos.push("전기적 사양 + Package/PCB Footprint 최우선 일치");}
    else if(["capacitor","resistor","inductor"].includes(p.kind)){
      if(pf.value)score+=5;
      if(pf.rating)score+=3;
      if(pf.size)score+=4;
      if(pf.footprint)score+=4;
    }

    if(p.preferred){
      if(norm(c.Manufacturer).includes(norm(p.preferred))){score+=7;pos.push(`선호 Maker ${p.preferred}`);}
      else {score-=3;warn.push(`선호 Maker ${p.preferred} 아님`);}
    }
    score=Math.max(0,Math.min(100,Math.round(score)));
    const verdict=(base.Verdict==="부적합"||hard.length)?"부적합":(score>=85?"적합":"조건부");
    if(document.getElementById("selectionProfile") && oldProfile)document.getElementById("selectionProfile").value=oldProfile;
    return {...base,Score:score,Verdict:verdict,PriorityExact:pf.exact,
      Reasons:[...hard.map(x=>`✕ ${x}`),...warn.map(x=>`△ ${x}`),...pos.map(x=>`✓ ${x}`),...base.Reasons]};
  }
  async function fetchBatchCandidates(p){
    const key=batchCacheKey(p);
    if(V53.batchCache.has(key))return V53.batchCache.get(key);

    const conn=await ensureLiveConnection(2);
    if(!conn.ok){
      const result={parts:[],connectionError:conn.error,queries:[]};
      V53.batchCache.set(key,result);
      return result;
    }

    const queries=batchQueryVariants(p);
    let parts=[],warnings=[],usedQuery="";
    for(const q of queries){
      try{
        const j=await apiCallWithRetry({
          mode:"priority_search",
          provider:"auto",
          query:q,
          limit:50,
          filters:{
            searchOptions:["InStock","NormallyStocking","RohsCompliant","HasDatasheet"],
            excludeMarketplace:true,
            minimumQuantity:Math.max(1,p.qty||1)
          }
        },3);
        warnings.push(...(j.warnings||[]));
        if(j.parts?.length){
          parts=j.parts; usedQuery=q;
          break;
        }
      }catch(e){
        warnings.push(e.message||String(e));
        // Retry next relaxed query only after connection re-check.
        const chk=await ensureLiveConnection(1);
        if(!chk.ok){
          const result={parts:[],connectionError:chk.error,warnings,queries};
          V53.batchCache.set(key,result);
          return result;
        }
      }
    }

    const result={parts,connectionError:"",warnings:[...new Set(warnings)],queries,usedQuery};
    V53.batchCache.set(key,result);
    return result;
  }
  function setBatchProgress(done,total,text){
    const wrap=document.getElementById("bomAutoProgress");
    wrap?.classList.remove("hidden");
    const pct=total?Math.round(done/total*100):0;
    const bar=document.getElementById("bomAutoProgressBar"); if(bar)bar.style.width=`${pct}%`;
    const label=document.getElementById("bomAutoProgressText"); if(label)label.textContent=`${done}/${total} · ${text||""}`;
  }
  async function autoSelectAllBomIndustrial(autoTriggered=false){
    if(V53.batchRunning||!V53.rows.length)return;
    V53.batchRunning=true; V53.batchCache=new Map();
    const btn=document.getElementById("autoSelectAllBomBtn"); if(btn)btn.disabled=true;
    const profileEl=document.getElementById("selectionProfile");
    if(profileEl){profileEl.value="industrial";applySelectionProfileUI();}
    const tempPreset=document.getElementById("reqTempPreset");
    if(tempPreset){tempPreset.value="-40,85";applyTemperaturePreset();}
    setStatus("전체 BOM Industrial 자동선정 중");

    let ok=0,review=0,none=0,connectionFail=0;
    try{
      const initialConnection=await ensureLiveConnection(3);
      if(!initialConnection.ok){
        V53.rows.forEach(row=>{
          V53.autoSelections.set(row.sheetRow,{part:null,candidates:[],status:"연결실패",selectedRank:null,source:"",industrial:true,error:initialConnection.error});
          row.selectedPart=null;row.autoSelection=V53.autoSelections.get(row.sheetRow);
        });
        renderBomRowsV53();
        const summary=document.getElementById("bomAutoSummary");
        if(summary)summary.innerHTML=`<div class="connection-error-box"><b>DigiKey/Mouser 연결 실패</b> · ${escapeHtml(initialConnection.error)}<br>Demo 후보로 대체하지 않았습니다. 상단 Vercel API 주소 및 Provider 상태를 확인하세요.</div>`;
        setStatus("자동선정 중단 · 실시간 API 연결 실패");
        return;
      }

      const rows=[...V53.rows];
      for(let i=0;i<rows.length;i++){
        const row=rows[i],p=row.profile;
        setBatchProgress(i,rows.length,`${row.fields.PartName||row.fields.Reference||row.fields.Item||`Row ${row.excelRow}`} 검색`);
        const fetched=await fetchBatchCandidates(p);
        if(fetched.connectionError){
          V53.autoSelections.set(row.sheetRow,{part:null,candidates:[],status:"연결실패",selectedRank:null,source:"",industrial:true,error:fetched.connectionError});
          row.selectedPart=null;row.autoSelection=V53.autoSelections.get(row.sheetRow);
          connectionFail++;
          if(i%3===2||i===rows.length-1)renderBomRowsV53();
          continue;
        }
        const pool=fetched.parts||[];
        const scored=pool.map(c=>evaluateBatchCandidate(c,p)).sort((a,b)=>{
          if(!!a.PriorityExact!==!!b.PriorityExact)return a.PriorityExact?-1:1;
          return sortResults(a,b);
        });
        const viable=scored.filter(x=>
          x.MPN && x.Manufacturer &&
          (x.Verdict==="적합" || (x.Verdict==="조건부" && x.Score>=70))
        );
        const candidateGroup=viable.slice(0,4);
        let best=candidateGroup.find(x=>x.Verdict==="적합") || candidateGroup[0] || null;
        let status=best?(best.Verdict==="적합"?"자동선정":"검토필요"):"후보없음";
        if(best){
          V53.autoSelections.set(row.sheetRow,{
            part:best,candidates:candidateGroup,status,selectedRank:0,
            source:(best.Source||((health?.digikey||health?.mouser)?"Live/Local":"Local")),industrial:true
          });
          row.selectedPart=best;
          row.autoSelection=V53.autoSelections.get(row.sheetRow);
          status==="자동선정"?ok++:review++;
        }else{
          V53.autoSelections.set(row.sheetRow,{part:null,candidates:[],status:"후보없음",selectedRank:null,source:"",industrial:true});
          none++;
        }
        if(i%3===2||i===rows.length-1)renderBomRowsV53();
      }
      setBatchProgress(rows.length,rows.length,"완료");
      const summary=document.getElementById("bomAutoSummary");
      const withAlternatives=rows.filter(r=>(V53.autoSelections.get(r.sheetRow)?.candidates?.length||0)>1).length;
      const providers=(V53.liveProviders||[]).map(x=>x==="digikey"?"DigiKey":"Mouser").join(" + ");
      if(summary)summary.innerHTML=`<b>Industrial 자동선정 완료 · 1순위 기본선택</b> · ${escapeHtml(providers||"Live API")} · 적합 ${ok} · 검토필요 ${review} · 후보없음 ${none} · 연결실패 ${connectionFail} · 대체후보 확보 ${withAlternatives}행 · 총 ${rows.length}행`;
      document.getElementById("applyAutoSelectionBtn").disabled=(ok+review)===0;
      setStatus("전체 BOM Industrial 자동선정 완료 · 각 행 1순위 기본선택");
      const info=document.getElementById("selectionInfo");
      if(info)info.textContent="신규 선정 모드: BOM 사양 기준 Industrial 자동선정을 완료했습니다. 각 행의 1순위가 선정 MPN / 제조사에 기본 표시됩니다.";
      setTimeout(()=>document.getElementById("bomAutoProgress")?.classList.add("hidden"),700);
    }finally{
      V53.batchRunning=false;if(btn)btn.disabled=false;
    }
  }
  function writePartToSpecificBomRow(row,p,markStatus=true){
    if(!row||!p||!bomWorkbook)return false;
    const ws=bomWorkbook.Sheets[bomSheetName];
    const writable=new Set(["MPN","Manufacturer","Description","Package","PCBFootprint","Lifecycle","Stock","UnitPrice","DatasheetURL","Source","Remark"]);
    for(const h of bomHeaders){
      const field=bomMapping[h]||guessMapping(h.replace(/__\d+$/,''));
      if(!writable.has(field))continue;
      const col=V53.headerCols.get(h);if(col==null)continue;
      let value=valueForField(field,p,row.fields.Item||row.excelRow);
      if(field==="PCBFootprint"){
        const explicitCandidateFp=attr(p,["PCB Footprint","Footprint","Land Pattern","Recommended Land Pattern","CAD Footprint"])||p.PCBFootprint||"";
        // Never replace the board's existing footprint with a generic package string.
        value=explicitCandidateFp || row.fields.PCBFootprint || row.raw[h] || "";
      }
      if(field==="Remark"){
        const old=String(row.raw[h]||"").trim();
        const auto=V53.autoSelections.get(row.sheetRow);
        const alts=(auto?.candidates||[]).filter(x=>norm(x.MPN)!==norm(p.MPN)).slice(0,3).map(x=>x.MPN);
        const fp=row.profile?.pcbFootprint?footprintCompatibility(row.profile.pcbFootprint,p):null;
        value=[old,
          row.profile?.partName?`PART:${row.profile.partName}`:"",
          `AutoIndustrial:${p.MPN}, Score:${p.Score}, Risk:${p.Risk}`,
          fp?.reason?`Footprint:${fp.reason}`:"",
          alts.length?`Alternatives:${alts.join(",")}`:""
        ].filter(Boolean).join(" | ");
      }
      XLSX.utils.sheet_add_aoa(ws,[[value]],{origin:{r:row.sheetRow,c:col}});
      V53.aoa[row.sheetRow][col]=value;row.raw[h]=value;row.fields[field]=String(value??"");
    }
    row.selectedPart=p;bomDirty=true;
    if(markStatus){
      const a=V53.autoSelections.get(row.sheetRow)||{part:p};
      a.part=p;a.status="BOM반영";V53.autoSelections.set(row.sheetRow,a);
    }
    return true;
  }
  function applyAllAutoSelections(){
    let applied=0,review=0;
    for(const row of V53.rows){
      const a=V53.autoSelections.get(row.sheetRow);
      if(!a?.part)continue;
      if(a.status==="검토필요"){review++;continue;}
      if(writePartToSpecificBomRow(row,a.part,true))applied++;
    }
    bomDirty=applied>0||bomDirty;
    document.getElementById("downloadBomBtn").disabled=!bomDirty;
    renderBomRowsV53();
    document.getElementById("bomAutoSummary").innerHTML=`<b>BOM 반영 ${applied}행</b>${review?` · 검토필요 ${review}행은 자동 반영하지 않음`:""}`;
    document.getElementById("selectionInfo").textContent=`Industrial 자동선정 ${applied}개를 BOM에 반영했습니다. 검토필요 항목은 개별 확인 후 반영하세요.`;
  }

  function applySelectedPartToBom(p){
    const row=V53.selected;if(!row||!bomWorkbook)return false;
    const ok=writePartToSpecificBomRow(row,p,true);
    if(ok){
      document.getElementById("downloadBomBtn").disabled=false;
      document.getElementById("selectionInfo").textContent=`BOM Row ${row.excelRow} (${row.fields.Reference||row.fields.Item||''})에 ${p.MPN} 반영 완료`;
      renderBomRowsV53();
    }
    return ok;
  }

  window.smartBomV53={
    hasSelectedBomRow:()=>!!V53.selected,
    applySelectedPartToBom,
    getSelectedBomRow:()=>V53.selected,
    getState:()=>V53,
    autoSelectIndustrial:()=>autoSelectAllBomIndustrial(false),
    applyAllAutoSelections,
    refreshProfile:()=>{
      if(V53.filterOptions){
        V53.selections={manufacturer:new Set(),status:new Set(),packaging:new Set(),parametric:new Map()};
        autoSelectBomFilters(); renderFilterGrid(V53.filterOptions);
      }
      updateAppliedFilters();
      if(candidates?.length) scoreCurrentCandidatesForBom();
    }
  };
})();
