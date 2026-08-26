const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8765);

loadEnv(path.join(ROOT, ".env"));
loadEnv(path.join(ROOT, ".env.local"));

const healthHandler = require("./api/health");
const componentsHandler = require("./api/components");

const mime = {
  ".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".txt":"text/plain; charset=utf-8",
  ".dat":"text/plain; charset=utf-8",".csv":"text/csv; charset=utf-8",".xlsx":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

const server=http.createServer(async (req,res)=>{
  const parsed=url.parse(req.url,true);
  if(parsed.pathname==="/api/health") return invoke(healthHandler,req,res);
  if(parsed.pathname==="/api/components"){
    if(req.method==="POST"){
      try{req.body=JSON.parse(await body(req)||"{}");}
      catch{return json(res,400,{error:"Invalid JSON"});}
    }
    return invoke(componentsHandler,req,res);
  }

  let rel=decodeURIComponent(parsed.pathname||"/");
  if(rel==="/") rel="/index.html";
  const file=path.normalize(path.join(ROOT,rel));
  if(!file.startsWith(ROOT))return json(res,403,{error:"Forbidden"});
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile())return json(res,404,{error:"Not found"});
    res.writeHead(200,{"Content-Type":mime[path.extname(file).toLowerCase()]||"application/octet-stream","Cache-Control":"no-cache"});
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT,"127.0.0.1",()=>{
  console.log("");
  console.log("Smart BOM Selector V5 is running.");
  console.log(`Open: http://127.0.0.1:${PORT}`);
  console.log("Press Ctrl+C to stop.");
});

function invoke(handler,req,res){
  res.status=(code)=>{res.statusCode=code;return res;};
  res.json=(obj)=>{if(!res.headersSent)res.setHeader("Content-Type","application/json; charset=utf-8");res.end(JSON.stringify(obj));return res;};
  Promise.resolve(handler(req,res)).catch(e=>json(res,500,{error:e.message||"Server error"}));
}
function json(res,code,obj){res.statusCode=code;res.setHeader("Content-Type","application/json; charset=utf-8");res.end(JSON.stringify(obj));}
function body(req){return new Promise((resolve,reject)=>{let d="";req.on("data",c=>{d+=c;if(d.length>5e6){reject(new Error("Body too large"));req.destroy();}});req.on("end",()=>resolve(d));req.on("error",reject);});}
function loadEnv(file){
  if(!fs.existsSync(file))return;
  const text=fs.readFileSync(file,"utf8");
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim(); if(!line||line.startsWith("#"))continue;
    const i=line.indexOf("="); if(i<1)continue;
    const k=line.slice(0,i).trim(),v=line.slice(i+1).trim().replace(/^['"]|['"]$/g,"");
    if(!(k in process.env))process.env[k]=v;
  }
}
