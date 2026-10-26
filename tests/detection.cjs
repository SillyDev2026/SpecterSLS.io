"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
function pose(x = .5, confidence = .9) {
  const p = Array.from({length:33}, (_, i) => ({x:x + (i % 2 ? -.08 : .08), y:.15 + i * .021, z:0, visibility:confidence, presence:.95}));
  p[11].y = p[12].y = .35;
  p[23].y = p[24].y = .6;
  return p;
}
function harness() {
  let now = 0;
  const events = [], draws = [], elements = new Map();
  const ctx = new Proxy({
    drawImage(...args) { draws.push(args); },
    measureText(text) { return {width:text.length * 8}; },
    createImageData(w,h) { return {data:new Uint8ClampedArray(w*h*4)}; },
    getImageData(x,y,w,h) { return {data:new Uint8ClampedArray(w*h*4)}; }
  }, {get(target,key) { return key in target ? target[key] : () => {}; }});
  const cameraRequests=[];
  const element = () => ({width:540,height:960,videoWidth:1280,videoHeight:720,readyState:2,currentTime:1,play:async()=>{},
    clientWidth:540,clientHeight:960,getContext:() => ctx,classList:{toggle(){}},setAttribute(){}});
  const document = {getElementById(id) { if (!elements.has(id)) elements.set(id,element()); return elements.get(id); },
    createElement:element,querySelectorAll:() => []};
  const sandbox = {window:{},document,navigator:{mediaDevices:{getUserMedia:options=>new Promise(resolve=>cameraRequests.push({options,resolve}))}},localStorage:{getItem:() => null},performance:{now:() => now},
    requestAnimationFrame:() => 1,cancelAnimationFrame(){},setTimeout:() => 1,clearTimeout(){},Uint8ClampedArray};
  vm.createContext(sandbox);
  vm.runInContext(read("figureengine.js"),sandbox);
  const expose = `
    appendEvent = (...args) => testEvents.push(args);
    window.testApp = {
      update: updateTracking,
      state: () => ({poses:currentPoses,tracks:tracked,events:testEvents}),
      settings,
      frame: renderFrame,
      flip: flipCamera,
      stop: stopScanner,
      setModel: model => {landmarker=model; scanning=true;},
      figure: figureEngine,
      ui,
      reset: () => {currentPoses=[];tracked=[];trails=[];}
    };`;
  sandbox.testEvents = events;
  vm.runInContext(read("app.js").replace(/  boot\(\);\s*\}\)\(\);\s*$/,expose + "\n})();"),sandbox);
  return {...sandbox.window.testApp,draws,cameraRequests,tick(t) {now=t;},canvas:element(),ctx,window:sandbox.window};
}

test("short appearances separated by misses never become a sustained event", () => {
  const app = harness();
  for (let t=0;t<=2400;t+=400) {
    app.update([pose()],t);
    app.update([],t+100);
  }
  assert.equal(app.state().events.length,0);
});
test("expired tracks cannot be resurrected and immediately confirmed", () => {
  const app = harness();app.update([pose()],0);
  const oldId = app.state().tracks[0].id;
  app.update([pose()],2000);
  assert.notEqual(app.state().tracks[0].id,oldId);
  assert.equal(app.state().events.length,0);
});
test("non-finite, missing-confidence and collapsed landmarks are rejected", () => {
  for (const bad of [pose().map(p=>({...p,x:NaN})),pose().map(({visibility,presence,...p})=>p),pose().map(p=>({...p,x:.5,y:.5}))]) {
    const app = harness();app.update([bad],0);
    assert.equal(app.state().poses.length,0);
  }
});
test("visible upper body remains usable when hips are occluded", () => {
  const app = harness(), p = pose();p[23].visibility=p[24].visibility=.05;
  app.update([p],0);
  assert.equal(app.state().poses.length,1);
});
test("continuous evidence logs once and reordered subjects keep their IDs", () => {
  const app = harness();
  for (let t=0;t<=2000;t+=100) app.update(t%200 ? [pose(.75),pose(.25)] : [pose(.25),pose(.75)],t);
  assert.equal(app.state().events.length,2);
  assert.equal(app.state().tracks.find(t=>t.cx<.5).id,1);
  assert.equal(app.state().tracks.find(t=>t.cx>.5).id,2);
});
test("figure rendering rejects the same low confidence detections as the skeleton", () => {
  const app=harness();app.settings.mode="figure";
  app.setModel({detectForVideo:() => ({landmarks:[pose(.5,.1)]})});
  app.tick(200);app.frame();
  assert.equal(app.state().poses.length,0);
  assert.equal(app.figure.details().poseCount,0);
});
test("figure preview expires when the camera stops delivering detections", () => {
  const app=harness();app.figure.update({landmarks:[pose()]},100);
  app.tick(200);assert.equal(app.figure.preview(app.canvas),true);
  app.tick(2100);assert.equal(app.figure.preview(app.canvas),false);
  assert.equal(app.figure.details().poseCount,0);
});
test("turning off pose overlays stops model work outside Figure Scan", () => {
  const app=harness();let count=0;app.settings.skeleton=false;
  app.setModel({detectForVideo() {count++;return {landmarks:[]};}});
  app.tick(200);app.frame();assert.equal(count,0);
});
test("camera switching clears detections before permission resolves", async () => {
  const app=harness();app.setModel({});app.update([pose()],0);app.figure.update({landmarks:[pose()]},0);
  const pending=app.flip();
  assert.equal(app.state().poses.length,0);
  assert.equal(app.figure.details().poseCount,0);
  app.cameraRequests[0].resolve({getTracks:()=>[],getVideoTracks:()=>[]});await pending;
});
test("stopping during camera switch releases the late stream", async () => {
  const app=harness();app.setModel({});let stopped=0;
  const pending=app.flip();app.stop();
  app.cameraRequests[0].resolve({getTracks:()=>[{stop(){stopped++;}}],getVideoTracks:()=>[]});await pending;
  assert.equal(stopped,1);assert.equal(app.ui.cameraVideo.srcObject,null);
});
test("accepted body keeps its matching mask and every mask is closed", () => {
  const app=harness(),reads=[],closed=[];
  const masks=[0,1,2].map(i=>({width:2,height:2,getAsFloat32Array(){reads.push(i);return new Float32Array(4).fill(.8);},close(){closed.push(i);}}));
  app.figure.update({landmarks:[pose()],segmentationMasks:masks,maskIndices:[1]},100);
  assert.deepEqual(reads,[1]);assert.deepEqual(closed,[0,1,2]);
  assert.equal(app.figure.details().hasMasks,true);
});
test("broken masks close their resources and leave landmarks usable", () => {
  const app=harness();let closed=0;
  app.figure.update({landmarks:[pose()],segmentationMasks:[{width:2,height:2,getAsFloat32Array(){throw Error('mask unavailable');},close(){closed++;}}]},100);
  assert.equal(closed,1);assert.equal(app.figure.details().hasMasks,false);
  assert.equal(app.figure.details().poseCount,1);
});
test("tracking tolerates a modest visibility dip without accepting a weak new body", () => {
  const app=harness();app.update([pose()],0);const id=app.state().tracks[0].id;
  app.update([pose(.5,.47),pose(.8,.47)],100);
  assert.equal(app.state().poses.length,1);assert.equal(app.state().tracks[0].id,id);
});
test("smoothing damps tiny jitter but follows larger movements", () => {
  const app=harness();app.update([pose()],0);
  app.update([pose(.502)],33);
  const first=app.state().poses[0][11].x;
  assert(first>.42&&first<.422);
  app.update([pose(.62)],133);
  assert(app.state().poses[0][11].x>.5);
});
