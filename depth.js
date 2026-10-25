"use strict";
// Experimental WebXR Depth Sensing (CPU-based). Unlike the optical dot mode,
// these samples originate from a real depth API, but still are NOT LiDAR hardware.
const xrStart=document.getElementById("xrStart");
const xrStatus=document.getElementById("xrStatus");
const xrCanvas=document.getElementById("xrCanvas");
const xrOverlay=document.getElementById("xrOverlay");
const xrExit=document.getElementById("xrExit");
const xrMetrics=document.getElementById("xrMetrics");
const status=(message)=>{xrStatus.textContent=message;};
let xrSession=null,gl=null,refSpace=null,program=null,vertexBuffer=null;
let positionLoc=-1,depthLoc=-1,lastMetrics=0,depthFrames=0;
const vertexSource=`
attribute vec2 a_position;
attribute float a_depth;
varying float v_depth;
void main(){
  gl_Position=vec4(a_position,0.0,1.0);
  gl_PointSize=clamp(6.0/(0.6+a_depth*0.14),2.0,5.0);
  v_depth=a_depth;
}`;
const fragmentSource=`
precision mediump float;
varying float v_depth;
void main(){
  vec2 d=gl_PointCoord-vec2(0.5);
  if(dot(d,d)>0.21) discard;
  float far=clamp(v_depth/6.0,0.0,1.0);
  vec3 col=mix(vec3(0.72,1.0,0.38),vec3(0.16,0.93,0.82),far);
  gl_FragColor=vec4(col,0.96);
}`;
function compileShader(type,source){
  const shader=gl.createShader(type);
  gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
    const reason=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error("Shader: "+reason);
  }
  return shader;
}
function prepareRenderer(){
  const vert=compileShader(gl.VERTEX_SHADER,vertexSource);
  const frag=compileShader(gl.FRAGMENT_SHADER,fragmentSource);
  program=gl.createProgram();gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);
  gl.deleteShader(vert);gl.deleteShader(frag);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error("Rendering setup failed.");
  positionLoc=gl.getAttribLocation(program,"a_position");
  depthLoc=gl.getAttribLocation(program,"a_depth");
  vertexBuffer=gl.createBuffer();
  gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
}
function renderDots(frame,view){
  let info;
  try{info=frame.getDepthInformation(view);}catch{return null;}
  if(!info||typeof info.getDepthInMeters!=="function")return null;
  const samples=[],cols=56,rows=36;
  let minDepth=Infinity,maxDepth=0;
  // getDepthInMeters transforms normalized VIEW coordinates to the depth buffer.
  for(let y=1;y<rows;y++){
    const v=(y+0.5)/rows;
    for(let x=1;x<cols;x++){
      const u=(x+0.5)/cols;
      let meters;
      try{meters=info.getDepthInMeters(u,v);}catch{continue;}
      if(!Number.isFinite(meters)||meters<0.16||meters>12)continue;
      minDepth=Math.min(minDepth,meters);maxDepth=Math.max(maxDepth,meters);
      samples.push(u*2-1,1-v*2,meters);
    }
  }
  if(!samples.length)return {count:0,min:0,max:0};
  const bytes=new Float32Array(samples);
  gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,bytes,gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(positionLoc);gl.vertexAttribPointer(positionLoc,2,gl.FLOAT,false,12,0);
  gl.enableVertexAttribArray(depthLoc);gl.vertexAttribPointer(depthLoc,1,gl.FLOAT,false,12,8);
  gl.drawArrays(gl.POINTS,0,bytes.length/3);
  return {count:bytes.length/3,min:minDepth,max:maxDepth};
}
function xrFrame(now,frame){
  const session=frame.session;
  session.requestAnimationFrame(xrFrame);
  try{
    const pose=frame.getViewerPose(refSpace);
    const layer=session.renderState.baseLayer;
    gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    if(!pose)return;
    let total=0,lowest=Infinity,highest=0;
    for(const view of pose.views){
      const viewport=layer.getViewport(view);
      gl.viewport(viewport.x,viewport.y,viewport.width,viewport.height);
      const result=renderDots(frame,view);
      if(result){total+=result.count;lowest=Math.min(lowest,result.min||Infinity);highest=Math.max(highest,result.max);}
    }
    if(total)depthFrames++;
    if(now-lastMetrics>250){
      xrMetrics.textContent=total? `${total.toLocaleString()} depth dots · ${lowest.toFixed(1)}–${highest.toFixed(1)} m`
        : "WAITING FOR AR DEPTH · MOVE THE PHONE SLOWLY";
      lastMetrics=now;
    }
  }catch(e){
    if(now-lastMetrics>1000){xrMetrics.textContent="DEPTH FRAME UNAVAILABLE: "+e.message.slice(0,42);lastMetrics=now;}
  }
}
async function startSession(session){
  xrSession=session;
  session.addEventListener("end",()=>{
    xrSession=null;xrOverlay.classList.remove("active");xrStart.disabled=false;
    xrStart.textContent="START AR DEPTH SCANNER";
    status(depthFrames ? "AR session ended. Depth data was obtained." : "AR session ended; no usable depth samples received.");
    if(gl){gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
  },{once:true});
  try{
    xrStart.disabled=true;status("Initializing AR camera and depth renderer…");
    gl=xrCanvas.getContext("webgl",{alpha:true,antialias:true,xrCompatible:true});
    if(!gl)throw Error("WebGL is unavailable.");
    if(gl.makeXRCompatible)await gl.makeXRCompatible();
    prepareRenderer();
    session.updateRenderState({baseLayer:new XRWebGLLayer(session,gl,{alpha:true,depth:true})});
    refSpace=await session.requestReferenceSpace("local");
    if(session.depthUsage!=="cpu-optimized")throw Error("CPU depth access was not granted.");
    depthFrames=0;xrMetrics.textContent="WAITING FOR DEPTH MAP";xrOverlay.classList.add("active");
    status("AR depth session active. Estimated depth depends on surroundings and motion.");
    session.requestAnimationFrame(xrFrame);
  }catch(e){
    status("Could not initialize estimated depth: "+e.message);
    await session.end().catch(()=>{});
  }
}
async function checkSupport(){
  if(!window.isSecureContext){status("HTTPS is required for WebXR.");xrStart.textContent="HTTPS REQUIRED";return;}
  if(!navigator.xr||!window.XRWebGLLayer){status("This browser does not expose immersive WebXR AR.");xrStart.textContent="AR DEPTH UNAVAILABLE";return;}
  try{
    if(!(await navigator.xr.isSessionSupported("immersive-ar"))){
      status("Immersive AR is not supported in this browser. Use Optical Dot Cloud on the main scanner.");
      xrStart.textContent="AR DEPTH UNAVAILABLE";return;
    }
    status("Immersive AR is available. Actual depth support will be checked on start.");
    xrStart.disabled=false;xrStart.textContent="START AR DEPTH SCANNER";
  }catch(e){status("Cannot check XR compatibility: "+e.message);xrStart.textContent="AR CHECK FAILED";}
}
xrStart.addEventListener("click",()=>{
  if(xrSession)return;
  // Call requestSession synchronously from a click, which preserves user activation.
  const request=navigator.xr.requestSession("immersive-ar",{
    requiredFeatures:["depth-sensing","local"],
    optionalFeatures:["dom-overlay"],
    domOverlay:{root:xrOverlay},
    depthSensing:{usagePreference:["cpu-optimized"],dataFormatPreference:["luminance-alpha","float32"]}
  });
  xrStart.disabled=true;status("Requesting AR depth and camera permission…");
  request.then(startSession).catch(e=>{
    xrStart.disabled=false;xrStart.textContent="TRY AR DEPTH AGAIN";
    status("AR depth could not start: "+e.message+". Try the Dot Cloud mode instead.");
  });
});
xrExit.addEventListener("click",()=>{xrSession?.end().catch(()=>{});});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&xrSession)xrSession.end().catch(()=>{});});
checkSupport();
