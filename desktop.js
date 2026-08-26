(async function(){
  const btn=document.getElementById("quitDesktopBtn");
  if(!btn)return;
  try{
    const r=await fetch("/api/health",{cache:"no-store"});
    const j=await r.json();
    if(j?.notes?.windowsExe){
      btn.style.display="inline-block";
      btn.addEventListener("click",async()=>{
        if(!confirm("Smart BOM Selector를 종료하시겠습니까?"))return;
        try{ await fetch("/api/shutdown",{method:"POST"}); }catch{}
        document.body.innerHTML='<div style="font-family:Arial,sans-serif;padding:40px"><h2>Smart BOM Selector가 종료되었습니다.</h2><p>이 창을 닫아도 됩니다.</p></div>';
      });
    }
  }catch{}
})();


(async function setupBackendConfig(){
  const input=document.getElementById("apiBaseUrlInput");
  const save=document.getElementById("saveApiBaseUrlBtn");
  const state=document.getElementById("backendConfigState");
  if(!input||!save||!state)return;

  async function readConfig(){
    try{
      const r=await fetch("/api/config",{cache:"no-store"});
      const j=await r.json();
      if(j.apiBaseUrl)input.value=j.apiBaseUrl;
      state.className=`api-dot ${j.configured?"on":"off"}`;
      state.textContent=j.configured?"Vercel 설정됨":"주소 미설정";
    }catch{
      state.className="api-dot err";state.textContent="설정 확인 실패";
    }
  }

  save.addEventListener("click",async()=>{
    const apiBaseUrl=input.value.trim().replace(/\/+$/,"");
    save.disabled=true;state.className="api-dot off";state.textContent="저장 중";
    try{
      const r=await fetch("/api/config",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({apiBaseUrl})
      });
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);
      state.className="api-dot on";state.textContent="저장됨";
      if(typeof loadHealth==="function")await loadHealth();
    }catch(e){
      state.className="api-dot err";state.textContent="저장/연결 실패";
      alert(`Vercel API 설정 실패: ${e.message}`);
    }finally{save.disabled=false;}
  });

  await readConfig();
})();
