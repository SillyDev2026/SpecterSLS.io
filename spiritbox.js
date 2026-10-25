/* SpecterSLS Spirit Box v2.3
 * Honest modes: synthesized RF-style noise, user-provided sound clips,
 * or real internet-radio streams. Does NOT tune AM/FM radio hardware.
 */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const ui = Object.fromEntries(["boxMode","boxBand","boxDirection","boxGenre","boxRate","boxRateText","boxVolume","boxVolumeText","boxFrequency","boxStation","boxState","boxSweepCount","boxStart","boxMark","boxLoadStations","boxCountry","boxDirectoryStatus","boxClipInput","boxClipStatus","boxScope","boxHelp","boxRecord","boxRecordTime"].map(id => [id, $(id)]));
  if (!ui.boxStart) return;
  const KEY = "spectersls.spiritbox.settings.v1";
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } })();
  const options = {mode:"rf",band:"FM",direction:"up",rate:250,volume:35};
  for (const key of Object.keys(options)) if (typeof saved[key] === typeof options[key]) options[key] = saved[key];
  if (!["rf","clips","web"].includes(options.mode)) options.mode="rf";
  if (!["FM","AM"].includes(options.band)) options.band="FM";
  if (!["up","down","random"].includes(options.direction)) options.direction="up";
  options.rate = Math.min(30000,Math.max(50,options.rate));
  options.volume = Math.min(100,Math.max(0,options.volume));
  let context=null,noise=null,bandpass=null,lowpass=null,tone=null,toneGain=null,master=null,analyser=null,recordTap=null;
  let clipAudio=new Audio(),clipNode=null,streamAudio=new Audio(),clipSources=[],stations=[],active=false,stepTimer=0,animation=0;
  let index=0,stationIndex=0,cycle=0,recording=null,recordChunks=[],recordStart=0,recordTimer=0,previousMode="",currentName="";
  let scopeCtx = ui.boxScope.getContext("2d");
  const persist = () => { try { localStorage.setItem(KEY,JSON.stringify(options)); } catch {} };
  const log = (title,description) => {
    if (typeof window.SpecterSLS?.log === "function") window.SpecterSLS.log("audio",title,description);
  };
  const say = (msg,error=false) => {
    ui.boxState.textContent = msg;
    ui.boxState.classList.toggle("box-error",error);
  };
  function bandFrequency(idx) {
    if (options.band==="AM") return {value:530+(idx%118)*10,unit:"kHz",total:118};
    return {value:88+(idx%101)*0.2,unit:"MHz",total:101};
  }
  function frequencyLabel() {
    const f=bandFrequency(index);
    return (options.band==="FM"?f.value.toFixed(1):String(f.value))+" "+f.unit;
  }
  function setHeadline(){
    ui.boxFrequency.textContent=options.mode==="web"?"WEB "+String(stationIndex+1).padStart(2,"0"):options.mode==="clips"?"AUDIO "+String(index+1).padStart(2,"0"):frequencyLabel();
    ui.boxStation.textContent=currentName||"STANDBY";
    ui.boxSweepCount.textContent=cycle.toLocaleString();
  }
  function advanceIndex(max){
    if (max<=1) return 0;
    if (options.direction==="random") return Math.floor(Math.random()*max);
    return (index+(options.direction==="down"?max-1:1))%max;
  }
  function duration() {
    return options.mode==="web" ? Math.max(3000,options.rate) : options.rate;
  }
  function rateLabel(){
    const effective=duration();
    ui.boxRateText.textContent=effective<1000?effective+" ms":(effective/1000).toFixed(effective%1000?2:0)+" s";
    ui.boxHelp.textContent=options.mode==="web"?"Real HTTPS internet audio streams. Station handoff takes time; minimum 3 seconds per station. Network and licensing restrictions may interrupt playback.":options.mode==="clips"?"Load your own recordings. The box switches between them and samples short snippets; no radio tuner is involved.":"Synthetic AM/FM-style static and filter hopping. Displayed frequencies are illustrative—not live radio reception.";
  }
  function updateInputs(){
    ui.boxMode.value=options.mode;ui.boxBand.value=options.band;ui.boxDirection.value=options.direction;
    ui.boxRate.value=String(options.rate);ui.boxVolume.value=String(options.volume);
    ui.boxVolumeText.textContent=options.volume+"%";
    rateLabel();setHeadline();
    ui.boxBand.disabled=options.mode!=="rf";
    ui.boxCountry.disabled=options.mode!=="web";ui.boxGenre.disabled=options.mode!=="web";
    ui.boxLoadStations.disabled=options.mode!=="web";
    ui.boxClipInput.disabled=options.mode!=="clips";
    ui.boxRecord.disabled=options.mode==="web" || !active || !recordTap || typeof MediaRecorder==="undefined";
  }
  async function initAudio() {
    if (context) { await context.resume(); return; }
    const Context=window.AudioContext || window.webkitAudioContext;
    if (!Context) throw Error("Web Audio is unavailable in this browser.");
    context=new Context();
    master=context.createGain(); master.gain.value=0;
    analyser=context.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.55;
    recordTap=context.createMediaStreamDestination();
    master.connect(analyser);analyser.connect(context.destination);master.connect(recordTap);
    const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);
    const samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
    noise=context.createBufferSource();noise.buffer=buffer;noise.loop=true;
    bandpass=context.createBiquadFilter();bandpass.type="bandpass";bandpass.Q.value=.65;bandpass.frequency.value=900;
    lowpass=context.createBiquadFilter();lowpass.type="lowpass";lowpass.frequency.value=3600;
    noise.connect(bandpass);bandpass.connect(lowpass);lowpass.connect(master);
    noise.start();
    tone=context.createOscillator();tone.type="sine";tone.frequency.value=630;
    toneGain=context.createGain();toneGain.gain.value=.016;
    tone.connect(toneGain);toneGain.connect(master);tone.start();
    clipAudio.preload="auto";
    clipNode=context.createMediaElementSource(clipAudio);clipNode.connect(master);
    await context.resume();
  }
  function gainForVolume(){ return Math.pow(options.volume/100,1.7)*.30; }
  function rfStep() {
    index=advanceIndex(bandFrequency(0).total);
    const f=bandFrequency(index);
    const t=context.currentTime;
    // Per-step filtering and amplitude mimic analog scanning static; no fake voices.
    const center=options.band==="AM"?320+((f.value-530)/1170)*2300:650+((f.value-88)/20)*4100;
    bandpass.frequency.setTargetAtTime(center,t,.01);
    bandpass.Q.setTargetAtTime(.30+Math.random()*.95,t,.01);
    lowpass.frequency.setTargetAtTime(Math.min(7200,center*2),t,.012);
    tone.frequency.setTargetAtTime(180+Math.random()*950,t,.015);
    toneGain.gain.setTargetAtTime(Math.random()>.88?.012:0,t,.008);
    master.gain.setTargetAtTime(gainForVolume()*(.65+Math.random()*.65),t,.01);
    currentName="RF-STYLE STATIC · SYNTHETIC";
  }
  function clipStep(){
    if (!clipSources.length){say("LOAD AUDIO FILES FIRST",true);stop();return;}
    index=advanceIndex(clipSources.length);
    const entry=clipSources[index];
    clipAudio.pause();
    if (clipAudio.src!==entry.url)clipAudio.src=entry.url;
    try {
      const length=Number.isFinite(clipAudio.duration)?clipAudio.duration:0;
      if (length>.4)clipAudio.currentTime=Math.max(0,Math.random()*(length-.35));
    } catch {}
    master.gain.setTargetAtTime(gainForVolume()*2,context.currentTime,.01);
    clipAudio.play().catch(()=>say("CLIP PLAYBACK NEEDS ANOTHER TAP",true));
    currentName=entry.name;
  }
  async function loadStations() {
    ui.boxLoadStations.disabled=true;
    ui.boxDirectoryStatus.textContent="SEARCHING HTTPS STREAMS...";
    const country=ui.boxCountry.value,genre=ui.boxGenre.value;
    const hosts=["https://de1.api.radio-browser.info","https://nl1.api.radio-browser.info"];
    for (const host of hosts) {
      try {
        const url=host+"/json/stations/search?countrycode="+encodeURIComponent(country)+"&hidebroken=true&order=clickcount&reverse=true&limit=100"+(genre==="all"?"":"&tag="+encodeURIComponent(genre));
        const response=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(8500)});
        if (!response.ok) throw Error("Directory HTTP "+response.status);
        const raw=await response.json();
        stations=raw.filter(x=>{
          const stream=String(x.url_resolved||x.url||"");
          const codec=String(x.codec||"").toLowerCase();
          return stream.startsWith("https://") && !/\.m3u8(?:[?#]|$)/i.test(stream) && !/hls/i.test(codec) && (Number(x.bitrate)||0)<400;
        }).slice(0,24).map(x=>({name:String(x.name||"Unnamed station").slice(0,70),url:String(x.url_resolved||x.url),uuid:String(x.stationuuid||"")}));
        if (!stations.length)throw Error("No HTTPS audio streams available in this search.");
        ui.boxDirectoryStatus.textContent=stations.length+" HTTPS STATIONS READY";
        ui.boxLoadStations.disabled=false;
        return;
      }catch(e){ ui.boxDirectoryStatus.textContent="Directory issue: "+e.message; }
    }
    ui.boxLoadStations.disabled=false;
    throw Error("Couldn't load playable streams. Try another country or use RF mode.");
  }
  function webStep(){
    if (!stations.length){say("LOAD INTERNET STATIONS FIRST",true);stop();return;}
    stationIndex=advanceIndex(stations.length);
    index=stationIndex;
    const entry=stations[stationIndex];
    streamAudio.pause();
    streamAudio.removeAttribute("src");
    streamAudio.load();
    streamAudio.src=entry.url;streamAudio.volume=options.volume/100;
    currentName=entry.name;
    streamAudio.play().then(()=>{if(active&&options.mode==="web")say("LIVE INTERNET STREAM");}).catch(()=>{if(active)say("STREAM BLOCKED OR OFFLINE",true);});
  }
  function step(){
    if (!active)return;
    cycle+=1;
    if(options.mode==="rf")rfStep();
    else if(options.mode==="clips")clipStep();
    else webStep();
    setHeadline();
    stepTimer=window.setTimeout(step,duration());
  }
  async function start(){
    if(active)return;
    if(options.mode==="clips"&&!clipSources.length){say("SELECT ONE OR MORE AUDIO FILES FIRST",true);return;}
    if(options.mode==="web"&&!stations.length){
      try{await loadStations();}catch(e){say(e.message,true);return;}
    }
    try{
      if(options.mode!=="web")await initAudio();
      active=true;previousMode=options.mode;
      if(context)master.gain.value=0;
      ui.boxStart.textContent="■ STOP BOX";ui.boxStart.classList.add("running");say("SWEEP ACTIVE");
      index=options.direction==="down"?(options.mode==="rf"?bandFrequency(0).total-1:options.mode==="clips"?clipSources.length-1:stations.length-1):0;
      stationIndex=index;step();updateInputs();scopeLoop();
      log("Spirit box started",options.mode.toUpperCase()+" mode · "+duration()+" ms sweep · "+options.direction);
    }catch(e){say(e.message||"Audio initialization failed",true);stop();}
  }
  function stop(){
    active=false;window.clearTimeout(stepTimer);stepTimer=0;
    clipAudio.pause();streamAudio.pause();
    if(context&&master)master.gain.setTargetAtTime(0,context.currentTime,.02);
    if(recording&&recording.state!=="inactive")recording.stop();
    ui.boxStart.textContent="▶ START SWEEP";ui.boxStart.classList.remove("running");
    say("STANDBY");updateInputs();
    if(animation)cancelAnimationFrame(animation);animation=0;
  }
  function scopeLoop(){
    if(!active||!ui.boxScope)return;
    const w=ui.boxScope.width,h=ui.boxScope.height;
    scopeCtx.fillStyle="#08141a";scopeCtx.fillRect(0,0,w,h);
    scopeCtx.strokeStyle="#203b3c";scopeCtx.lineWidth=1;
    for(let y=12;y<h;y+=18){scopeCtx.beginPath();scopeCtx.moveTo(0,y);scopeCtx.lineTo(w,y);scopeCtx.stroke();}
    if(options.mode!=="web"&&analyser){
      const bins=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(bins);
      const width=w/bins.length;
      for(let i=0;i<bins.length;i++){
        const level=bins[i]/255;
        scopeCtx.fillStyle=level>.65?"#d2ff80":"#8be76a";
        scopeCtx.fillRect(i*width,h-Math.max(1,level*h),Math.max(1,width-1),Math.max(1,level*h));
      }
    }else{
      scopeCtx.fillStyle="#9bd09b";scopeCtx.font="12px monospace";
      scopeCtx.fillText("INTERNET STREAM · AUDIO ANALYSIS UNAVAILABLE",10,h/2);
    }
    animation=requestAnimationFrame(scopeLoop);
  }
  function updateMode(){
    if(active)stop();
    options.mode=ui.boxMode.value;ui.boxDirectoryStatus.textContent=stations.length+" streams loaded";
    updateInputs();persist();
  }
  function updateRate(){
    options.rate=Number(ui.boxRate.value);persist();rateLabel();
    if(active){window.clearTimeout(stepTimer);stepTimer=setTimeout(step,duration());}
  }
  async function startRecord(){
    if(recording){recording.stop();return;}
    if(!active||!recordTap||options.mode==="web"){say("RECORDING IS FOR RF/CLIPS ONLY",true);return;}
    if(typeof MediaRecorder==="undefined"){say("RECORDING UNSUPPORTED",true);return;}
    const types=["audio/webm;codecs=opus","audio/webm","audio/mp4"];
    const type=types.find(x=>MediaRecorder.isTypeSupported(x));
    if(!type){say("NO SUPPORTED AUDIO FORMAT",true);return;}
    try {
      recording=new MediaRecorder(recordTap.stream,{mimeType:type});
      recordChunks=[];
      recording.ondataavailable=e=>{if(e.data.size)recordChunks.push(e.data);};
      recording.onstop=()=>{
        window.clearInterval(recordTimer);
        const chunks=recordChunks;recordChunks=[];
        if(chunks.length){
          const blob=new Blob(chunks,{type});
          const url=URL.createObjectURL(blob),a=document.createElement("a");
          a.href=url;a.download="SpecterSLS_spiritbox_"+new Date().toISOString().replace(/[:.]/g,"-")+(type.includes("mp4")?".m4a":".webm");
          document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
          log("Spirit box recording saved","Local "+options.mode+"-mode audio · "+Math.round(blob.size/1024)+" KB · exported to Downloads");
        }
        ui.boxRecord.textContent="● RECORD BOX";ui.boxRecordTime.textContent="00:00";recording=null;updateInputs();
      };
      recording.start(250);recordStart=Date.now();ui.boxRecord.textContent="■ STOP RECORD";
      recordTimer=setInterval(()=>{const s=Math.floor((Date.now()-recordStart)/1000);ui.boxRecordTime.textContent=String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");},500);
      say("RECORDING BOX AUDIO");
    }catch(e){say("Record error: "+e.message,true);}
  }
  function loadClips(files){
    clipAudio.pause();for(const entry of clipSources)URL.revokeObjectURL(entry.url);
    clipSources=Array.from(files||[]).filter(x=>x.type.startsWith("audio/")&&x.size<30_000_000).slice(0,20).map(x=>({name:x.name,url:URL.createObjectURL(x)}));
    ui.boxClipStatus.textContent=clipSources.length+" local audio files ready";setHeadline();
    if(active)stop();
  }
  ui.boxStart.addEventListener("click",()=>active?stop():start());
  ui.boxMode.addEventListener("change",updateMode);
  ui.boxBand.addEventListener("change",()=>{options.band=ui.boxBand.value;index=0;persist();setHeadline();});
  ui.boxDirection.addEventListener("change",()=>{options.direction=ui.boxDirection.value;persist();});
  ui.boxRate.addEventListener("change",updateRate);
  ui.boxVolume.addEventListener("input",()=>{options.volume=Number(ui.boxVolume.value);ui.boxVolumeText.textContent=options.volume+"%";persist();streamAudio.volume=options.volume/100;if(active&&options.mode==="rf"&&master)master.gain.setTargetAtTime(gainForVolume(),context.currentTime,.02);if(active&&options.mode==="clips"&&master)master.gain.setTargetAtTime(gainForVolume()*2,context.currentTime,.02);});
  ui.boxGenre.addEventListener("change",()=>{stations=[];ui.boxDirectoryStatus.textContent="Category changed. Reload stations.";if(active&&options.mode==="web")stop();});
  ui.boxLoadStations.addEventListener("click",async()=>{try{await loadStations();say("STATION LIST READY");}catch(e){say(e.message,true);}});
  ui.boxClipInput.addEventListener("change",()=>loadClips(ui.boxClipInput.files));
  ui.boxMark.addEventListener("click",()=>{log("Spirit box observation",options.mode.toUpperCase()+" · "+ui.boxFrequency.textContent+" · "+currentName+" · "+duration()+"ms");say("OBSERVATION MARKED");});
  ui.boxRecord.addEventListener("click",startRecord);
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&active){stop();say("PAUSED WHEN APP WAS HIDDEN");}});
  window.addEventListener("pagehide",()=>{stop();for(const entry of clipSources)URL.revokeObjectURL(entry.url);});
  streamAudio.preload="none";
  updateInputs();say("STANDBY");
})();