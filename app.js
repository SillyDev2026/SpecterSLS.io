(function specterApp() {
  "use strict";
  const $ = id => document.getElementById(id);
  const ids = ["stage","cameraVideo","cameraCanvas","idleArt","loadingPanel","loadingTitle","loadingSubtitle","poseNotice","poseNoticeTitle","poseNoticeSubtitle","startBtn","startText","photoBtn","recordBtn","recordGlyph","recordText","markBtn","flipBtn","torchBtn","fullscreenBtn","cameraName","recordLed","hudMode","hudClock","engineLabel","displaySize","stateBadge","stateLabel","sessionIdentifier","poseMetric","fpsMetric","durationMetric","eventMetric","sessionName","sessionInfo","newSessionBtn","sessionPicker","audioStatus","audioMetric","waveCanvas","micCheck","audioMarkCheck","timelineCount","timeline","eventFilter","exportBtn","csvBtn","importBtn","importFile","clearBtn","thresholdRange","thresholdLabel","speedSelect","skeletonCheck","trailCheck","wakeCheck","diagModel","diagCamera","diagStorage","markModal","closeModalBtn","cancelMarkBtn","markCategory","markNote","saveMarkBtn","toast","installBtn","dotDensity","dotDensityLabel","dotSensitivity","dotSensitivityLabel","figureView","figureCutoff","figureCutoffLabel","figureStability","figureDetails","figureStatus","figureShapeCount","figureConfidence","figureMaskStatus","renderFpsMetric","dotPalette","dotView","dotOverlay","dotCount","opticalPointLabel","dotActions","freezeDotBtn","exportDotBtn"];
  const ui = Object.fromEntries(ids.map(id => [id,$(id)]));
  const canvas = ui.cameraCanvas, video = ui.cameraVideo, ctx = canvas.getContext("2d",{alpha:false});
  const waveCtx = ui.waveCanvas.getContext("2d");
  const LINKS = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[0,11],[0,12]];
  const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
  const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
  const TASKS_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs";
  const STORE_KEY = "spectersls.v2.sessions";
  const SET_KEY = "spectersls.v2.settings";
  const defaultSettings = {mode:"sls",visibility:55,speed:"balanced",skeleton:true,trails:true,wake:false,dotDensity:3,dotSensitivity:3,dotPalette:"lime",dotView:"surface",dotOverlay:false,figureView:"outline",figureCutoff:55,figureStability:true};
  let settings = {...defaultSettings}, sessions = [], activeId = "";
  try {
    const fromStorage = JSON.parse(localStorage.getItem(SET_KEY)||"{}");
    if (fromStorage && typeof fromStorage === "object") for (const key of Object.keys(defaultSettings)) {
      if (typeof fromStorage[key] === typeof defaultSettings[key]) settings[key] = fromStorage[key];
    }
  } catch {}
  const allowedModes = ["sls","night","mono","normal","dots","figure"];
  if (!allowedModes.includes(settings.mode)) settings.mode = "sls";
  if (!["balanced","battery","fast","turbo","ultra"].includes(settings.speed)) settings.speed = "balanced";
  settings.visibility = Math.max(20,Math.min(90,Math.round(settings.visibility / 5) * 5));
  settings.dotDensity=Math.max(1,Math.min(5,Math.round(settings.dotDensity)));
  settings.dotSensitivity=Math.max(1,Math.min(5,Math.round(settings.dotSensitivity)));
  if(!["lime","cyan","thermal"].includes(settings.dotPalette))settings.dotPalette="lime";
  if(!["surface","edges","all"].includes(settings.dotView))settings.dotView="surface";
  if(!["outline","silhouette","xray","boxes"].includes(settings.figureView))settings.figureView="outline";
  settings.figureCutoff=Math.min(85,Math.max(35,Math.round(settings.figureCutoff/5)*5));
  try {
    const stored = JSON.parse(localStorage.getItem(STORE_KEY)||"{}");
    if (Array.isArray(stored.sessions)) {
      sessions = stored.sessions.slice(0,25).filter(s=>s && typeof s.id==="string" && Array.isArray(s.events))
        .map(s=>({id:s.id,name:String(s.name||"Investigation").slice(0,64),created:s.created||new Date().toISOString(),
          events:s.events.slice(0,200).filter(e=>e && typeof e.title==="string" && typeof e.date==="string")}));
      activeId = stored.active || "";
    }
  } catch {}
  const makeSession = () => ({id:globalThis.crypto?.randomUUID?.() || `s-${Date.now()}-${Math.random()}`,name:`Investigation ${sessions.length+1}`,created:new Date().toISOString(),events:[]});
  if (!sessions.length) sessions = [makeSession()];
  if (!sessions.some(s=>s.id === activeId)) activeId = sessions[0].id;
  const session = () => sessions.find(s=>s.id === activeId) || sessions[0];
  const persistSettings = () => {try{localStorage.setItem(SET_KEY,JSON.stringify(settings));}catch{}};
  function persist() {
    try {localStorage.setItem(STORE_KEY,JSON.stringify({version:2,active:activeId,sessions}));ui.diagStorage.textContent="LOCAL · SAVED";}
    catch {ui.diagStorage.textContent="STORAGE UNAVAILABLE";toast("Storage is unavailable. Export your work to keep it.",true);}
  }
  function toast(message,error=false) {
    ui.toast.textContent=message;
    ui.toast.className=`toast show${error?" error":""}`;
    clearTimeout(toast.timer);
    toast.timer=setTimeout(()=>ui.toast.className="toast",4500);
  }
  function saveAs(blob,name) {
    const url=URL.createObjectURL(blob), link=document.createElement("a");
    link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  const timestamp = () => new Date().toISOString().replace(/[:.]/g,"-");
  const fmtTime = (ms,long=false) => {
    const s=Math.floor(Math.max(0,ms)/1000);
    return long ? [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(x=>String(x).padStart(2,"0")).join(":")
      :[Math.floor(s/60),s%60].map(x=>String(x).padStart(2,"0")).join(":");
  };
  function appendEvent(kind,title,description) {
    const s=session();
    s.events.unshift({id:globalThis.crypto?.randomUUID?.()||String(Date.now()+Math.random()),date:new Date().toISOString(),
      kind,title:String(title).slice(0,80),description:String(description||"").slice(0,500)});
    s.events=s.events.slice(0,200);
    persist();renderSessions();
  }
  function renderSessions() {
    const s=session();
    ui.sessionName.value=s.name;
    ui.sessionPicker.replaceChildren();
    for(const item of sessions){
      const option=document.createElement("option");
      option.value=item.id;option.textContent=`${item.name} (${item.events.length})`;ui.sessionPicker.append(option);
    }
    ui.sessionPicker.value=s.id;
    ui.sessionInfo.textContent=new Date(s.created).toLocaleDateString();
    ui.sessionIdentifier.textContent=s.name.toUpperCase().slice(0,22);
    renderTimeline();
  }
  function renderTimeline() {
    const s=session(), mode=ui.eventFilter.value||"all";
    const events=mode==="all" ? s.events : s.events.filter(e=>e.kind===mode);
    ui.timelineCount.textContent=`${s.events.length} ITEMS`;ui.eventMetric.textContent=String(s.events.length);
    ui.timeline.replaceChildren();
    if(!events.length){
      const div=document.createElement("div");div.className="timeline-empty";
      const ico=document.createElement("span");ico.textContent="◇";
      const title=document.createElement("b");title.textContent="NOTHING RECORDED";
      const note=document.createElement("small");note.textContent="Pose detections, sound peaks and field observations appear here.";
      div.append(ico,title,note);ui.timeline.append(div);return;
    }
    for(const e of events){
      const row=document.createElement("div");row.className="event";
      const ico=document.createElement("span");ico.className="event-symbol";ico.textContent={pose:"◎",audio:"⌁",capture:"▣",manual:"✎"}[e.kind]||"◇";
      const body=document.createElement("div"), title=document.createElement("div"), description=document.createElement("div"), time=document.createElement("span");
      title.className="event-name";title.textContent=e.title;
      description.className="event-note";description.textContent=e.description;
      time.className="event-date";time.textContent=new Date(e.date).toLocaleTimeString();
      body.append(title,description);row.append(ico,body,time);ui.timeline.append(row);
    }
  }
  function exportJson() {
    const body={format:"SpecterSLS-investigation-v2",version:"2.0.0",exportedAt:new Date().toISOString(),
      disclaimer:"Camera pose estimates and microphone levels cannot establish paranormal phenomena.",session:session()};
    saveAs(new Blob([JSON.stringify(body,null,2)],{type:"application/json"}),`SpecterSLS_${timestamp()}.json`);
    toast("Investigation exported.");
  }
  function exportCsv(){
    const quoted=s=>`"${String(s??"").replaceAll('"','""')}"`;
    const rows=[["timestamp","category","title","description"].join(","),
      ...session().events.map(e=>[e.date,e.kind,e.title,e.description].map(quoted).join(","))];
    saveAs(new Blob(["\ufeff",rows.join("\r\n")],{type:"text/csv;charset=utf-8"}),`SpecterSLS_${timestamp()}.csv`);
    toast("CSV exported.");
  }
  async function importJson(file){
    if(!file)return;
    try{
      if(file.size>2000000)throw Error("File must be smaller than 2 MB.");
      const data=JSON.parse(await file.text());
      if(data.format!=="SpecterSLS-investigation-v2"||!Array.isArray(data.session?.events))throw Error("Not a valid SpecterSLS v2 export.");
      const next=makeSession();next.name=`${String(data.session.name||"Imported").slice(0,47)} (imported)`;
      next.events=data.session.events.slice(0,200).filter(e=>["pose","audio","manual","capture"].includes(e?.kind)&&typeof e?.title==="string"&&typeof e?.date==="string")
        .map(e=>({id:globalThis.crypto?.randomUUID?.()||String(Math.random()),date:e.date.slice(0,40),kind:e.kind,title:e.title.slice(0,80),description:String(e.description||"").slice(0,500)}));
      sessions.unshift(next);sessions=sessions.slice(0,25);activeId=next.id;persist();renderSessions();toast("Investigation imported.");
    }catch(e){toast(`Import failed: ${e.message}`,true);}
    ui.importFile.value="";
  }
  let stream=null,landmarker=null,scanning=false,starting=false,switching=false,recording=false,modelFailed=false;
  let lastVideoTime=-1,lastModelTime=0,inferenceTimes=[],sessionStart=0,raf=0,front=false,torch=false,wakeLock=null;
  let currentPoses=[],trails=[],tracked=[],nextTrackId=1,modelStatus="STANDBY",recorder=null,recorderStream=null,parts=[];
  let micStream=null,audioContext=null,analyser=null,audioBuffer=null,audioRaf=0,peakSince=0,lastPeak=0,installPrompt=null;
  const dotSampler=document.createElement("canvas");
  const dotContext=dotSampler.getContext("2d",{willReadFrequently:true});
  let prevDotLight=null,dotParticles=[],lastDotUpdate=0,dotsFrozen=false;
  const figureEngine=window.SpecterFigureEngine?.create({canvas,video,ctx});
  let configuringMasks=false,maskOptionEnabled=false,maskSyncTask=null;
  const dotEngine=window.SpecterDotEngine?.create({
    canvas,video,ctx,getFront:()=>front,getSettings:()=>settings,
    onSample:(points)=>{dotParticles=points;ui.dotCount.textContent=points.length.toLocaleString();}
  });
  // Higher camera/overlay FPS is independent of slower, synchronous AI inference.
  // Target rates are upper bounds, not a claim of measured device performance.
  const speedInterval=()=>({battery:170,balanced:100,fast:50,turbo:33,ultra:28})[settings.speed]||100;
  let renderFrames=0,renderWindowAt=0,lastHudTime=0,averageInferenceMs=0;
  let dynamicModelInterval=0;
  function scannerStatus(mode){
    ui.stateLabel.textContent=mode;
    ui.stateBadge.className=`state-badge ${mode==="SCANNING"?"active":mode==="RECORDING"?"recording":""}`;
    ui.recordLed.className=`red-led${mode==="RECORDING"?" recording":""}`;
  }
  function renderButtons(){
    ui.startBtn.disabled=starting||switching;
    ui.startText.textContent=starting?"CONNECTING...":scanning?"STOP SCANNER":"START SCANNER";
    ui.photoBtn.disabled=!scanning;ui.recordBtn.disabled=!scanning;
    ui.flipBtn.disabled=!scanning||switching;
    ui.torchBtn.disabled=!scanning||!stream?.getVideoTracks()?.[0]?.getCapabilities?.()?.torch;
    ui.recordText.textContent=recording?"STOP REC":"RECORD";
    ui.recordGlyph.textContent=recording?"■":"●";
    ui.cameraName.textContent=front?"CAM 02 · FRONT":"CAM 01 · REAR";
  }
  const showLoading=(title,note)=>{ui.loadingPanel.hidden=false;ui.loadingTitle.textContent=title;ui.loadingSubtitle.textContent=note;};
  const hideLoading=()=>ui.loadingPanel.hidden=true;
  function resizeCanvas() {
    // Conservative canvas scaling avoids exhausting the GPU fill-rate on foldable displays.
    const maxDpr=({battery:1,balanced:1.15,fast:1.25,turbo:1.45,ultra:1.5})[settings.speed]||1.15;
    const dpr=Math.min(maxDpr,window.devicePixelRatio||1);
    // Hidden mobile tabs report zero-size; do not destroy a running recording canvas.
    if(ui.stage.clientWidth<16||ui.stage.clientHeight<16)return;
    const w=Math.max(1,Math.round(ui.stage.clientWidth*dpr)),h=Math.max(1,Math.round(ui.stage.clientHeight*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;ui.displaySize.textContent=`${w} × ${h}`;dotEngine?.invalidate();}
  }
  function coverParams(){
    const sw=video.videoWidth||1,sh=video.videoHeight||1,cw=canvas.width,ch=canvas.height;
    const scale=Math.max(cw/sw,ch/sh),width=sw*scale,height=sh*scale;
    return {width,height,left:(cw-width)/2,top:(ch-height)/2};
  }
  function drawVideo(){
    if(!video.videoWidth)return;
    ctx.save();
    if(settings.mode==="night")ctx.filter="grayscale(1) sepia(1) hue-rotate(48deg) saturate(3) brightness(1.3) contrast(1.3)";
    else if(settings.mode==="mono")ctx.filter="grayscale(1) contrast(1.55)";
    else if(settings.mode==="sls")ctx.filter="grayscale(1) sepia(.6) hue-rotate(58deg) saturate(1.6) brightness(.85)";
    else if(settings.mode==="figure")ctx.filter="contrast(1.27) brightness(1.12) saturate(.72)";
    else if(settings.mode==="dots"){ctx.filter="grayscale(1) sepia(.8) hue-rotate(45deg) saturate(2) brightness(.7)";ctx.globalAlpha=settings.dotOverlay?.24:0;}
    const a=coverParams();
    if(front){ctx.translate(canvas.width,0);ctx.scale(-1,1);}
    ctx.drawImage(video,a.left,a.top,a.width,a.height);
    ctx.restore();
  }
  function point(p){
    const a=coverParams();
    return {x:front?canvas.width-(a.left+p.x*a.width):a.left+p.x*a.width,y:a.top+p.y*a.height};
  }
  function drawDotCloud(now){
    if(dotEngine){dotEngine.draw(now,dotsFrozen);return;}
    ui.dotCount.textContent="0";
  }
  function renderFrame(){
    if(!scanning)return;
    // Request the next frame immediately so the canvas keeps up with camera refresh.
    raf=requestAnimationFrame(renderFrame);
    resizeCanvas();
    const now=performance.now();
    if(!renderWindowAt)renderWindowAt=now;
    renderFrames++;
    if(now-renderWindowAt>=850){
      ui.renderFpsMetric.textContent=String(Math.round(renderFrames*1000/(now-renderWindowAt)));
      renderFrames=0;renderWindowAt=now;
      inferenceTimes=inferenceTimes.filter(t=>now-t<1000);
      ui.fpsMetric.textContent=String(inferenceTimes.length);
    }
    ctx.fillStyle="#091219";ctx.fillRect(0,0,canvas.width,canvas.height);
    if(settings.mode!=="dots"||settings.dotOverlay)drawVideo();
    if(settings.mode==="dots")drawDotCloud(now);
    // Video/currentTime gating prevents wasted inference of duplicate camera frames.
    // Adaptively limit ML CPU/GPU work when a detection takes longer than budget.
    const modelBudget=Math.max(speedInterval(),dynamicModelInterval);
    if(landmarker && !configuringMasks && video.readyState>=2 && now-lastModelTime>=modelBudget && video.currentTime!==lastVideoTime){
      lastModelTime=now;lastVideoTime=video.currentTime;
      try{
        const started=performance.now();
        const result=landmarker.detectForVideo(video,now);
        const elapsed=performance.now()-started;
        averageInferenceMs=averageInferenceMs?averageInferenceMs*.82+elapsed*.18:elapsed;
        dynamicModelInterval=Math.min(220,Math.max(0,averageInferenceMs*1.2));
        currentPoses=(result.landmarks||[]).slice(0,3);
        updateTracking(currentPoses,now);
        if(settings.mode==="figure")figureEngine?.update(result,now);
        else for(const mask of result.segmentationMasks||[])try{mask.close?.();}catch{}
        inferenceTimes.push(now);
      }catch(e){
        if(!modelFailed){modelFailed=true;ui.diagModel.textContent="INFERENCE FAILED";toast("Pose model failed: "+e.message,true);}
        landmarker?.close?.();landmarker=null;
      }
    }
    if(settings.mode==="figure"&&figureEngine){
      figureEngine.draw({...settings,cover:coverParams(),front},now);
    }
    if(settings.skeleton)drawPoses(now);
    if(now-lastModelTime>1800&&currentPoses.length){
      currentPoses=[];tracked=[];figureEngine?.reset();
      ui.poseMetric.textContent="0";ui.poseNotice.hidden=true;
    }
    if(settings.mode==="figure"&&now-lastHudTime>250){
      const fig=figureEngine?.details();
      ui.figureShapeCount.textContent=String(fig?.poseCount||0);
      ui.figureConfidence.textContent=fig?.poseCount?Math.round((fig.confidence||0)*100)+"%":"—";
      ui.figureMaskStatus.textContent=fig?.hasMasks?"REAL PIXEL MASK":fig?.poseCount?"LANDMARKS ONLY":"NO FIGURE";
      ui.figureStatus.textContent=fig?.poseCount?"BODY PATTERN DETECTED":"NO PERSON SHAPE";
    }
    if(now-lastHudTime>150){
      ui.hudClock.textContent=fmtTime(Date.now()-sessionStart,true);
      ui.durationMetric.textContent=fmtTime(Date.now()-sessionStart);
      lastHudTime=now;
    }
  }
  function updateTracking(poses,now){
    const found=[];
    for(const landmarks of poses){
      const core=[landmarks[11],landmarks[12],landmarks[23],landmarks[24]].filter(Boolean);
      if(!core.length)continue;
      const cx=core.reduce((n,v)=>n+v.x,0)/core.length,cy=core.reduce((n,v)=>n+v.y,0)/core.length;
      let track=null,min=0.20;
      for(const candidate of tracked){
        const dist=Math.hypot(candidate.cx-cx,candidate.cy-cy);
        if(!found.includes(candidate)&&dist<min){track=candidate;min=dist;}
      }
      if(!track){track={id:nextTrackId++,cx,cy,first:now,last:now,confirmed:false,landmarks};tracked.push(track);}
      else{track.cx=track.cx*.35+cx*.65;track.cy=track.cy*.35+cy*.65;track.last=now;track.landmarks=landmarks;}
      found.push(track);
      if(!track.confirmed && now-track.first>900){
        track.confirmed=true;
        appendEvent("pose",`Pose pattern #${track.id}`,`Human-like body pattern sustained for ≥0.9 seconds. This is not evidence of paranormal activity.`);
      }
    }
    tracked=tracked.filter(t=>now-t.last<1100);
    ui.poseMetric.textContent=String(found.length);
    ui.poseNotice.hidden=!found.length;
    if(found.length){
      ui.poseNoticeTitle.textContent=`${found.length} HUMAN-LIKE ${found.length===1?"SHAPE":"SHAPES"}`;
      ui.poseNoticeSubtitle.textContent="Computer-vision pose estimate · not paranormal proof";
    }
    if(settings.trails){
      for(const t of found)trails.push({p:point({x:t.cx,y:t.cy}),at:now,color:["#afff6b","#6cfff0","#f5c77f"][t.id%3]});
    }
    trails=trails.filter(t=>now-t.at<1300).slice(-120);
  }
  function drawPoses(now){
    ctx.save();
    const threshold=settings.visibility/100;
    if(settings.trails)for(const t of trails){
      const opacity=Math.max(0,1-(now-t.at)/1300);
      ctx.fillStyle=t.color;ctx.globalAlpha=opacity*.35;ctx.beginPath();ctx.arc(t.p.x,t.p.y,7*canvas.width/700,0,2*Math.PI);ctx.fill();
    }
    ctx.globalAlpha=1;ctx.lineCap="round";ctx.lineJoin="round";
    const s=Math.max(.75,canvas.width/750);
    for(let i=0;i<currentPoses.length;i++){
      const landmarks=currentPoses[i],color=["#afff6b","#6cfff0","#f5c77f"][i],ok=p=>p&&(p.visibility??1)>=threshold;
      ctx.shadowColor=color;ctx.shadowBlur=10*s;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=3*s;
      for(const [a,b] of LINKS){if(!ok(landmarks[a])||!ok(landmarks[b]))continue;const p=point(landmarks[a]),q=point(landmarks[b]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
      for(const index of [0,11,12,13,14,15,16,23,24,25,26,27,28]){const item=landmarks[index];if(!ok(item))continue;const p=point(item);ctx.beginPath();ctx.arc(p.x,p.y,4*s,0,Math.PI*2);ctx.fill();}
      const t=tracked.find(t=>t.landmarks===landmarks);
      if(t){const p=point({x:t.cx,y:t.cy});ctx.font=`${12*s}px monospace`;ctx.fillText(`SLS-${String(t.id).padStart(3,"0")}`,p.x+12*s,p.y-12*s);}
    }
    ctx.restore();
  }
  async function ensureModel(){
    if(landmarker)return true;
    showLoading("Loading pose analysis","Downloading the on-device computer-vision model...");
    ui.diagModel.textContent="LOADING";
    try{
      const vision=await import(TASKS_URL);
      const fileset=await vision.FilesetResolver.forVisionTasks(WASM_URL);
      const create=delegate=>vision.PoseLandmarker.createFromOptions(fileset,{baseOptions:{modelAssetPath:MODEL_URL,delegate},runningMode:"VIDEO",numPoses:3,
        minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,minTrackingConfidence:.58,
        outputSegmentationMasks:settings.mode==="figure"});
      try{landmarker=await create("GPU");}catch{landmarker=await create("CPU");}
      maskOptionEnabled=settings.mode==="figure";
      ui.diagModel.textContent="READY";
      ui.engineLabel.textContent="MEDIAPIPE POSE · ON DEVICE";
      return true;
    }catch(e){
      modelFailed=true;ui.diagModel.textContent="UNAVAILABLE";ui.engineLabel.textContent="CAMERA ONLY · POSE MODEL FAILED";
      toast(`Camera works, but pose tracking could not load: ${e.message}`,true);
      return false;
    }
  }
  async function syncFigureOptions(){
    if(!landmarker||maskSyncTask)return maskSyncTask;
    maskSyncTask=(async()=>{
      while(landmarker && maskOptionEnabled!==(settings.mode==="figure")){
        const enabled=settings.mode==="figure";
        configuringMasks=true;
        try{await landmarker.setOptions({outputSegmentationMasks:enabled});maskOptionEnabled=enabled;}
        catch(e){ui.figureStatus.textContent="MASK UNAVAILABLE · LANDMARKS ONLY";break;}
        finally{configuringMasks=false;}
      }
    })();
    try{await maskSyncTask;}finally{maskSyncTask=null;}
  }
  async function startScanner(){
    if(starting||scanning)return;
    if(!navigator.mediaDevices?.getUserMedia){toast("Camera needs HTTPS and browser permission.",true);return;}
    starting=true;renderButtons();showLoading("Connecting camera","Requesting video permission...");
    try{
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:front?"user":"environment"},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:settings.speed==="ultra"?60:settings.speed==="turbo"?60:30,max:60}},audio:false});
      video.srcObject=stream;await video.play();
      ui.diagCamera.textContent="CONNECTED";
      scannerStatus("SCANNING");
      scanning=true;sessionStart=Date.now();
      ui.idleArt.hidden=true;
      if(settings.skeleton)await ensureModel();
      else{ui.diagModel.textContent="SKIPPED FOR DOT FPS";ui.engineLabel.textContent="OPTICAL SCANNER ONLY";}
      hideLoading();renderButtons();resizeCanvas();
      requestAnimationFrame(renderFrame);
      if(settings.wake)acquireWake();
      toast("Camera active. Pose estimates are not ghost detections.");
    }catch(e){
      hideLoading();stopStream();ui.idleArt.hidden=false;scannerStatus("IDLE");
      ui.diagCamera.textContent="ERROR";
      toast(`Cannot start camera: ${e.message}`,true);
    }finally{starting=false;renderButtons();}
  }
  function stopStream(){stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;torch=false;}
  function stopScanner(){
    if(!scanning && !starting)return;
    if(recording)stopRecording();
    scanning=false;cancelAnimationFrame(raf);stopStream();releaseWake();figureEngine?.reset();
    ui.idleArt.hidden=false;hideLoading();currentPoses=[];tracked=[];trails=[];inferenceTimes=[];
    ui.poseNotice.hidden=true;ui.poseMetric.textContent="0";ui.fpsMetric.textContent="0";ui.renderFpsMetric.textContent="0";renderFrames=0;renderWindowAt=0;dynamicModelInterval=0;averageInferenceMs=0;ui.dotCount.textContent="0";dotEngine?.clear();dotsFrozen=false;ui.freezeDotBtn.textContent="❄ FREEZE DOTS";
    ui.engineLabel.textContent=landmarker?"MODEL READY":"AI MODEL STANDBY";
    ui.diagCamera.textContent="OFFLINE";scannerStatus("IDLE");renderButtons();
  }
  async function flipCamera(){
    if(!scanning||switching)return;
    switching=true;front=!front;renderButtons();stopStream();
    try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:front?"user":"environment"}}});video.srcObject=stream;await video.play();
      lastVideoTime=-1;tracked=[];trails=[];renderButtons();}
    catch(e){toast(`Camera switch failed: ${e.message}`,true);stopScanner();}
    finally{switching=false;renderButtons();}
  }
  async function toggleTorch(){
    const track=stream?.getVideoTracks()?.[0];
    if(!track?.getCapabilities?.()?.torch)return;
    try{torch=!torch;await track.applyConstraints({advanced:[{torch}]});toast(torch?"Flashlight on.":"Flashlight off.");}
    catch(e){torch=false;toast(`Flashlight unavailable: ${e.message}`,true);}
  }
  function capture(){
    if(!scanning)return;
    canvas.toBlob(blob=>{if(!blob){toast("Photo capture failed.",true);return;}
      const name=`SpecterSLS_photo_${timestamp()}.png`;saveAs(blob,name);appendEvent("capture","Snapshot saved",`Saved ${name} on device; image not stored in the journal.`);toast("PNG snapshot downloaded.");
    },"image/png");
  }
  function stopRecording(){if(recorder?.state!=="inactive")recorder?.stop();}
  function toggleRecording(){
    if(recording){stopRecording();return;}
    if(!scanning||typeof MediaRecorder==="undefined"||!canvas.captureStream){toast("Video recording unsupported on this browser.",true);return;}
    try{
      const format=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"].find(s=>MediaRecorder.isTypeSupported(s));
      if(!format)throw Error("WebM video is not supported.");
      recorderStream=canvas.captureStream(24);
      if(micStream)for(const track of micStream.getAudioTracks())recorderStream.addTrack(track);
      recorder=new MediaRecorder(recorderStream,{mimeType:format,videoBitsPerSecond:2500000});parts=[];
      recorder.ondataavailable=e=>{if(e.data?.size)parts.push(e.data);};
      recorder.onerror=()=>toast("An error occurred while recording.",true);
      recorder.onstop=()=>{
        const blob=new Blob(parts,{type:format});parts=[];recorderStream?.getVideoTracks().forEach(t=>t.stop());recorderStream=null;recorder=null;
        recording=false;scannerStatus(scanning?"SCANNING":"IDLE");renderButtons();
        if(blob.size){const name=`SpecterSLS_${timestamp()}.webm`;saveAs(blob,name);
          appendEvent("capture","Video saved",`${name} (${(blob.size/1048576).toFixed(1)} MB) saved on this device.`);toast("Video downloaded.");}
        else toast("No video data was recorded.",true);
      };
      recorder.start(1000);recording=true;scannerStatus("RECORDING");renderButtons();
      toast(micStream?"Recording video with microphone audio.":"Recording silent video. Turn on mic first for audio.");
    }catch(e){recorderStream?.getVideoTracks().forEach(t=>t.stop());recorderStream=null;toast(e.message,true);}
  }
  function sizeWave(){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const rect=ui.waveCanvas.getBoundingClientRect();ui.waveCanvas.width=Math.max(1,Math.round(rect.width*dpr));
    ui.waveCanvas.height=Math.max(1,Math.round(rect.height*dpr));
  }
  async function startMic(){
    if(micStream)return;
    try{
      micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
      audioContext=new (window.AudioContext||window.webkitAudioContext)();await audioContext.resume();
      analyser=audioContext.createAnalyser();analyser.fftSize=1024;
      audioContext.createMediaStreamSource(micStream).connect(analyser);
      audioBuffer=new Uint8Array(analyser.fftSize);
      ui.audioStatus.textContent="MIC LIVE";ui.audioStatus.style.color="var(--lime)";
      toast("Audio meter active. Measurements are uncalibrated dBFS.");
    }catch(e){stopMic();ui.micCheck.checked=false;toast(`Microphone failed: ${e.message}`,true);}
  }
  function stopMic(){
    micStream?.getTracks().forEach(t=>t.stop());micStream=null;audioContext?.close?.().catch(()=>{});
    audioContext=null;analyser=null;audioBuffer=null;peakSince=0;
    ui.audioStatus.textContent="MIC OFF";ui.audioStatus.style.color="";ui.audioMetric.textContent="—";
  }
  function drawWave(){
    const w=ui.waveCanvas.width,h=ui.waveCanvas.height;
    waveCtx.fillStyle="#0d171d";waveCtx.fillRect(0,0,w,h);
    waveCtx.strokeStyle="#2d4e41";waveCtx.beginPath();waveCtx.moveTo(0,h/2);waveCtx.lineTo(w,h/2);waveCtx.stroke();
    if(analyser&&audioBuffer){
      analyser.getByteTimeDomainData(audioBuffer);let sum=0;
      waveCtx.strokeStyle="#adff76";waveCtx.lineWidth=Math.max(1,w/450);waveCtx.beginPath();
      for(let i=0;i<audioBuffer.length;i++){
        const sample=(audioBuffer[i]-128)/128;sum+=sample*sample;
        const x=i/(audioBuffer.length-1)*w,y=h/2+sample*h*.44;
        if(i===0)waveCtx.moveTo(x,y);else waveCtx.lineTo(x,y);
      }
      waveCtx.stroke();
      const rms=Math.sqrt(sum/audioBuffer.length),db=rms>0?20*Math.log10(rms):-90;
      ui.audioMetric.textContent=`${Math.max(-90,db).toFixed(1)} dBFS`;
      const now=performance.now();
      if(ui.audioMarkCheck.checked&&db>-14){
        if(!peakSince)peakSince=now;
        if(now-peakSince>350&&now-lastPeak>12000){
          lastPeak=now;appendEvent("audio","Audio level peak",`Loud digital microphone level: ${db.toFixed(1)} dBFS. Not an EVP detection.`);
        }
      }else peakSince=0;
    }
    audioRaf=requestAnimationFrame(drawWave);
  }
  async function acquireWake(){
    if(!scanning||!settings.wake||!navigator.wakeLock?.request)return;
    try{wakeLock=await navigator.wakeLock.request("screen");}catch{toast("Screen wake lock unsupported.",true);}
  }
  function releaseWake(){wakeLock?.release?.().catch(()=>{});wakeLock=null;}
  function switchTab(tab){
    document.querySelector(".app-grid").dataset.mobileTab=tab;
    for(const b of document.querySelectorAll("[data-tab]")){
      b.classList.toggle("selected",b.dataset.tab===tab);
      b.setAttribute("aria-pressed",String(b.dataset.tab===tab));
    }
  }
  function setMode(mode){
    if(!allowedModes.includes(mode))return;
    settings.mode=mode;ui.hudMode.textContent=({sls:"SLS GREEN",night:"NIGHT VISION",mono:"MONO",normal:"NATURAL",dots:"OPTICAL DOT CLOUD",figure:"FIGURE SCAN"})[mode];
    ui.opticalPointLabel.textContent=mode==="dots"?"LIVE CAMERA PIXEL DOTS":mode==="figure"?"BODY FIGURE OVERLAY":"OPTICAL DOT FIELD";
    ui.figureDetails.hidden=mode!=="figure";
    if(scanning&&mode==="figure"&&!landmarker)ensureModel().finally(hideLoading);
    if(scanning&&landmarker)syncFigureOptions();
    ui.dotActions.hidden=mode!=="dots";
    if(mode!=="dots"){dotsFrozen=false;ui.freezeDotBtn.textContent="❄ FREEZE DOTS";}
    if(mode!=="dots")ui.dotCount.textContent="0";
    for(const b of document.querySelectorAll("[data-mode]")){
      b.classList.toggle("active",b.dataset.mode===mode);
      b.setAttribute("aria-pressed",String(b.dataset.mode===mode));
    }
    persistSettings();
  }
  function closeModal(){ui.markModal.hidden=true;ui.markBtn.focus();}
  function attach(){
    ui.startBtn.addEventListener("click",()=>scanning?stopScanner():startScanner());
    ui.photoBtn.addEventListener("click",capture);ui.recordBtn.addEventListener("click",toggleRecording);
    ui.flipBtn.addEventListener("click",flipCamera);ui.torchBtn.addEventListener("click",toggleTorch);
    ui.fullscreenBtn.addEventListener("click",async()=>{
      try{if(document.fullscreenElement)await document.exitFullscreen();else if(ui.stage.requestFullscreen)await ui.stage.requestFullscreen();else throw Error("Fullscreen unsupported.");}
      catch(e){toast(e.message,true);}
    });
    ui.markBtn.addEventListener("click",()=>{ui.markModal.hidden=false;ui.markNote.value="";ui.markNote.focus();});
    ui.closeModalBtn.addEventListener("click",closeModal);ui.cancelMarkBtn.addEventListener("click",closeModal);
    ui.markModal.addEventListener("click",e=>{if(e.target===ui.markModal)closeModal();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!ui.markModal.hidden)closeModal();});
    ui.saveMarkBtn.addEventListener("click",()=>{
      const note=ui.markNote.value.trim();if(!note){toast("Write a note first.",true);return;}
      appendEvent("manual",ui.markCategory.selectedOptions[0].textContent,note);closeModal();toast("Observation saved.");
    });
    document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
    document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
    ui.sessionName.addEventListener("input",()=>{session().name=ui.sessionName.value.slice(0,64)||"Untitled";
      ui.sessionIdentifier.textContent=session().name.toUpperCase().slice(0,22);persist();});
    ui.sessionName.addEventListener("change",renderSessions);
    ui.newSessionBtn.addEventListener("click",()=>{
      if(recording){toast("Stop video recording before changing investigation.",true);return;}
      if(scanning)stopScanner();
      sessions.unshift(makeSession());sessions=sessions.slice(0,25);activeId=sessions[0].id;persist();renderSessions();toast("New investigation ready.");
    });
    ui.sessionPicker.addEventListener("change",()=>{
      if(recording){ui.sessionPicker.value=activeId;toast("Stop recording before changing session.",true);return;}
      if(scanning)stopScanner();activeId=ui.sessionPicker.value;persist();renderSessions();
    });
    ui.eventFilter.addEventListener("change",renderTimeline);
    ui.exportBtn.addEventListener("click",exportJson);ui.csvBtn.addEventListener("click",exportCsv);
    ui.importBtn.addEventListener("click",()=>ui.importFile.click());
    ui.importFile.addEventListener("change",()=>importJson(ui.importFile.files?.[0]));
    ui.clearBtn.addEventListener("click",()=>{
      if(!session().events.length){toast("This session is already empty.");return;}
      if(!confirm("Permanently erase this session's observations? Export a backup first."))return;
      session().events=[];persist();renderSessions();toast("Session events cleared.");
    });
    ui.thresholdRange.addEventListener("input",()=>{
      settings.visibility=Number(ui.thresholdRange.value);ui.thresholdLabel.textContent=`${settings.visibility}%`;persistSettings();
    });
    ui.freezeDotBtn.addEventListener("click",()=>{
      if(!scanning){toast("Start the camera before freezing dots.",true);return;}
      dotsFrozen=!dotsFrozen;ui.freezeDotBtn.textContent=dotsFrozen?"▶ RESUME DOTS":"❄ FREEZE DOTS";
      toast(dotsFrozen?"Optical point positions frozen.":"Optical point field resumed.");
    });
    ui.exportDotBtn.addEventListener("click",()=>{
      if(!scanning||!dotParticles.length){toast("Scan with Dot Cloud first.",true);return;}
      const normalized=dotParticles.map((p,i)=>({n:i,x:Number((p.x/canvas.width).toFixed(5)),
        y:Number((p.y/canvas.height).toFixed(5)),edgeStrength:Number(p.e.toFixed(3)),motion:Boolean(p.m)}));
      const out={format:"SpecterSLS-optical-points-v1",capturedAt:new Date().toISOString(),
        source:"2D camera brightness gradients and frame change; NOT 3D or LiDAR",
        width:canvas.width,height:canvas.height,points:normalized};
      const name=`SpecterSLS_optical_points_${timestamp()}.json`;
      saveAs(new Blob([JSON.stringify(out)],{type:"application/json"}),name);
      appendEvent("capture","Optical dot map saved",`${normalized.length} 2D camera-derived dots exported to ${name}`);
      toast("2D optical dot map downloaded.");
    });
    ui.speedSelect.addEventListener("change",()=>{settings.speed=ui.speedSelect.value;resizeCanvas();dotEngine?.invalidate();persistSettings();toast("Performance target updated. Actual FPS depends on device and camera.");});
    ui.dotDensity.addEventListener("input",()=>{settings.dotDensity=Number(ui.dotDensity.value);
      ui.dotDensityLabel.textContent=["","Low","Medium","High","Very high","Ultra"][settings.dotDensity];dotEngine?.invalidate();persistSettings();});
    ui.dotSensitivity.addEventListener("input",()=>{settings.dotSensitivity=Number(ui.dotSensitivity.value);
      ui.dotSensitivityLabel.textContent=["","Low","Medium","High","Very high","Ultra"][settings.dotSensitivity];dotEngine?.invalidate();persistSettings();});
    ui.dotPalette.addEventListener("change",()=>{settings.dotPalette=ui.dotPalette.value;dotEngine?.invalidate();persistSettings();});
    ui.dotView.addEventListener("change",()=>{settings.dotView=ui.dotView.value;dotEngine?.invalidate();persistSettings();});
    ui.dotOverlay.addEventListener("change",()=>{settings.dotOverlay=ui.dotOverlay.checked;persistSettings();});
    ui.figureView.addEventListener("change",()=>{settings.figureView=ui.figureView.value;persistSettings();});
    ui.figureCutoff.addEventListener("input",()=>{settings.figureCutoff=Number(ui.figureCutoff.value);ui.figureCutoffLabel.textContent=settings.figureCutoff+"%";persistSettings();});
    ui.figureStability.addEventListener("change",()=>{settings.figureStability=ui.figureStability.checked;persistSettings();});
    ui.skeletonCheck.addEventListener("change",()=>{settings.skeleton=ui.skeletonCheck.checked;persistSettings();if(scanning&&settings.skeleton&&!landmarker)ensureModel().finally(hideLoading);});
    ui.trailCheck.addEventListener("change",()=>{settings.trails=ui.trailCheck.checked;trails=[];persistSettings();});
    ui.wakeCheck.addEventListener("change",()=>{
      settings.wake=ui.wakeCheck.checked;persistSettings();if(settings.wake)acquireWake();else releaseWake();
    });
    ui.micCheck.addEventListener("change",()=>{
      if(recording){ui.micCheck.checked=!!micStream;toast("Stop recording before changing microphone.",true);return;}
      if(ui.micCheck.checked)startMic();else stopMic();
    });
    window.addEventListener("resize",()=>{resizeCanvas();sizeWave();});
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&settings.wake)acquireWake();});
    window.addEventListener("pagehide",()=>{if(recording)stopRecording();if(scanning)stopScanner();stopMic();});
    window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;ui.installBtn.hidden=false;});
    ui.installBtn.addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;ui.installBtn.hidden=true;});
  }
  // A narrow integration bridge for the separate spirit-box engine.
  window.SpecterSLS={log:(kind,title,description)=>appendEvent(kind,title,description)};
  function boot(){
    ui.thresholdRange.value=settings.visibility;ui.thresholdLabel.textContent=`${settings.visibility}%`;
    ui.speedSelect.value=settings.speed;
    ui.dotDensity.value=settings.dotDensity;ui.dotDensityLabel.textContent=["","Low","Medium","High","Very high","Ultra"][settings.dotDensity];
    ui.dotSensitivity.value=settings.dotSensitivity;ui.dotSensitivityLabel.textContent=["","Low","Medium","High","Very high","Ultra"][settings.dotSensitivity];
    ui.dotPalette.value=settings.dotPalette;ui.dotView.value=settings.dotView;ui.dotOverlay.checked=settings.dotOverlay;
    ui.figureView.value=settings.figureView;ui.figureCutoff.value=settings.figureCutoff;ui.figureCutoffLabel.textContent=settings.figureCutoff+"%";ui.figureStability.checked=settings.figureStability;
    ui.skeletonCheck.checked=settings.skeleton;
    ui.trailCheck.checked=settings.trails;ui.wakeCheck.checked=settings.wake;
    setMode(settings.mode);persist();renderSessions();renderButtons();resizeCanvas();sizeWave();attach();drawWave();switchTab("scan");
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){ui.diagCamera.textContent="HTTPS REQUIRED";ui.engineLabel.textContent="HTTPS NEEDED"; }
    if("serviceWorker" in navigator&&window.isSecureContext)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  }
  boot();
})();
