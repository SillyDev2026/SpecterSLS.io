"use strict";
/* npm-free CI regression checks for the SpecterSLS static web application. */
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const root=path.resolve(__dirname,"..");
const get=name=>fs.readFileSync(path.join(root,name),"utf8");
const index=get("index.html");
const app=get("app.js");
const box=get("spiritbox.js");
const engine=get("figureengine.js");
const worker=get("sw.js");
const ids=new Set([...index.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
const calls=[];
const check=(name,fn)=>{try{fn();calls.push({name,ok:true});process.stdout.write("PASS  "+name+"\n");}catch(e){calls.push({name,ok:false});process.stderr.write("FAIL  "+name+": "+e.message+"\n");}};
check("Every JavaScript engine parses",()=>{
  for(const p of ["app.js","dotengine.js","figureengine.js","spiritbox.js","depth.js","sw.js"])new vm.Script(get(p),{filename:p});
});
check("All referenced local scripts/styles exist",()=>{
  for(const m of index.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)){
    const rel=m[1].slice(2).split("?")[0];
    assert(fs.existsSync(path.join(root,rel)),rel+" missing");
  }
});
check("All app and Spirit Box controls exist",()=>{
  const jsIds=JSON.parse(app.match(/const ids = (\[[^\]]+\]);/)[1]);
  const boxIds=JSON.parse(box.match(/Object\.fromEntries\((\[[^\]]+\])\.map/)[1]);
  for(const id of [...jsIds,...boxIds])assert(ids.has(id),id+" missing in index.html");
});
check("Figure Scan controls and mask processing are present",()=>{
  for(const id of ["figureView","figureCutoff","figureStability","figurePreview","figureShapeCount","figureMaskStatus"])assert(ids.has(id),id+" missing");
  assert(app.includes("outputSegmentationMasks:masks"));
  assert(engine.includes("getAsFloat32Array"));
  assert(engine.includes("m.close?.()"));
  assert(app.includes("scanGeneration"));
});
check("Updated cache contains figure and scene engines",()=>{
  assert(worker.includes("spectersls-v2.5.1-shell"));
  for(const filename of ["figureengine.js","figure.css","responsive.css","dotengine.js","spiritbox.js"])
    assert(worker.includes(filename),filename+" missing from cache");
});
check("Figure engine renders observed pose without inventing a body",()=>{
  const testWindow={};let drawn=0,closed=0,rects=0;
  const context=()=>({
    clearRect(){},fillRect(){},strokeRect(){rects++},drawImage(){drawn++},save(){},restore(){},translate(){},scale(){},
    setLineDash(){},fillText(){},measureText(v){return {width:v.length*8}},
    createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}},
    getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4).fill(200)}},
    putImageData(){},
  });
  const dom={createElement(){return {width:0,height:0,getContext(){return context();}}}};
  vm.runInNewContext(engine,{window:testWindow,document:dom,performance:{now:()=>1000}});
  const camera={videoWidth:1280,videoHeight:720},canvas={width:540,height:960};
  const api=testWindow.SpecterFigureEngine.create({canvas,video:camera,ctx:context()});
  const pose=Array.from({length:33},(_,i)=>({x:.3+(i%6)*.07,y:.05+i*.027,visibility:.89}));
  const mask={width:64,height:64,getAsFloat32Array(){return new Float32Array(64*64).fill(.9)},close(){closed++}};
  const result=api.update({landmarks:[pose],segmentationMasks:[mask]},1000);
  assert.equal(result.poseCount,1);assert.equal(result.hasMasks,true);
  const profile={figureView:"outline",figureCutoff:55,front:false,cover:{left:0,top:0,width:540,height:960}};
  api.draw(profile,1050);api.draw(profile,1075);
  assert(rects>=2);assert(drawn>=2);assert.equal(closed,1);
  const preview={width:256,height:176,getContext:()=>context()};
  assert.equal(api.preview(preview,false),true);
  api.reset();assert.equal(api.details().poseCount,0);
});
check("Spirit Box uses separated static and clip gains",()=>{
  assert(box.includes("noise.connect(bandpass);bandpass.connect(lowpass);lowpass.connect(rfGain);"));
  assert(box.includes("clipNode=context.createMediaElementSource(clipAudio);clipNode.connect(clipGain)"));
  assert(box.includes('Tap LOAD STATIONS first'));
  assert(box.includes("streamAudio.onerror"));
});
if(calls.some(c=>!c.ok))process.exit(1);
process.stdout.write("\n"+calls.length+" checks passed.\n");
