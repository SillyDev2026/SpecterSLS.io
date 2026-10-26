/* SpecterSLS Figure Scan · v2.5.1
   Camera-person visualization with real MediaPipe segmentation pixels.
   Never infers ghosts or draws imaginary body shapes.
*/
(function (root) {
  "use strict";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function create({canvas,video,ctx}){
    const maskCanvas=document.createElement("canvas"),maskContext=maskCanvas.getContext("2d",{willReadFrequently:true});
    const matteCanvas=document.createElement("canvas"),matteContext=matteCanvas.getContext("2d");
    let segmentationReady=false,hasMasks=false,poseCount=0,confidence=0,revision=0;
    let shapeInfo=[],lastResultTime=0,maskError="";
    let matteRevision=-1,matteMode="",matteCutoff=-1;
    const sampleWidth=128,sampleHeight=128;
    function reset(){
      segmentationReady=false;hasMasks=false;poseCount=0;confidence=0;shapeInfo=[];lastResultTime=0;maskError="";matteRevision=-1;
      if(matteContext)matteContext.clearRect(0,0,matteCanvas.width,matteCanvas.height);
    }
    function expire(now=performance.now()){
      if(poseCount&&now-lastResultTime>750)reset();
    }
    function update(result,now=performance.now()){
      const poses=(result?.landmarks||[]).slice(0,3);
      const masks=result?.segmentationMasks||[];
      const selectedMasks=Array.isArray(result?.maskIndices)?result.maskIndices.map(i=>masks[i]).filter(Boolean):masks.slice(0,poses.length);
      poseCount=poses.length;hasMasks=false;shapeInfo=[];lastResultTime=now;
      const vis=poses.flatMap(p=>[11,12,23,24].map(i=>p[i]?.visibility).filter(v=>Number.isFinite(v)));
      confidence=vis.length?vis.reduce((a,b)=>a+b,0)/vis.length:0;
      for(const [index,landmarks] of poses.entries()){
        const points=landmarks.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>=.4);
        if(points.length<4)continue;
        const minX=clamp(Math.min(...points.map(p=>p.x)),0,1);
        const maxX=clamp(Math.max(...points.map(p=>p.x)),0,1);
        const minY=clamp(Math.min(...points.map(p=>p.y)),0,1);
        const maxY=clamp(Math.max(...points.map(p=>p.y)),0,1);
        shapeInfo.push({minX,maxX,minY,maxY,id:result.trackIds?.[index]??index+1,score:points.reduce((n,p)=>n+(p.visibility??1),0)/points.length});
      }
      try{
        if(poses.length&&selectedMasks.length&&maskContext){
          // The MediaPipe mask is a probability of PERSON pixels.
          // Copy it before releasing the media task result's GPU/CPU buffers.
          const outputW=sampleWidth,outputH=sampleHeight;
          if(maskCanvas.width!==outputW||maskCanvas.height!==outputH){maskCanvas.width=outputW;maskCanvas.height=outputH;}
          const pixels=maskContext.createImageData(outputW,outputH);
          const data=pixels.data;
          const maps=selectedMasks.slice(0,3).map(m=>({w:m.width|0,h:m.height|0,array:m.getAsFloat32Array()}));
          if(maps.some(m=>m.w<1||m.h<1||m.w>4096||m.h>4096||m.array.length<m.w*m.h))throw Error("Invalid body mask dimensions");
          for(let y=0;y<outputH;y++){
            for(let x=0;x<outputW;x++){
              let person=0;
              for(const map of maps){
                const iy=Math.min(map.h-1,Math.floor(y/outputH*map.h));
                const ix=Math.min(map.w-1,Math.floor(x/outputW*map.w));
                const p=map.array[iy*map.w+ix];
                if(Number.isFinite(p))person=Math.max(person,p);
              }
              const i=(y*outputW+x)*4;
              data[i]=255;data[i+1]=255;data[i+2]=255;
              data[i+3]=Math.round(clamp(person,0,1)*255);
            }
          }
          maskContext.putImageData(pixels,0,0);
          hasMasks=true;segmentationReady=true;revision++;maskError="";
        }else if(!masks.length){hasMasks=false;}
      }catch(err){
        hasMasks=false;maskError=String(err?.message||err).slice(0,100);
      }finally{
        // Uncloned segmentation masks need closing after pixel conversion.
        for(const m of masks)try{m.close?.();}catch{}
      }
      return {poseCount,hasMasks,confidence,maskError};
    }
    function bounds(lm,transform){
      const x1=transform.left+lm.minX*transform.width, x2=transform.left+lm.maxX*transform.width;
      const left=transform.mirror?canvas.width-x2:x1,right=transform.mirror?canvas.width-x1:x2;
      const top=transform.top+lm.minY*transform.height,bottom=transform.top+lm.maxY*transform.height;
      return {left:clamp(left,0,canvas.width),right:clamp(right,0,canvas.width),
        top:clamp(top,0,canvas.height),bottom:clamp(bottom,0,canvas.height)};
    }
    function draw(settings,now=performance.now()){
      expire(now);
      if(!poseCount)return;
      const mode=settings.figureView||"outline";
      const a={
        width:settings.cover.width,height:settings.cover.height,
        left:settings.cover.left,top:settings.cover.top,mirror:settings.front
      };
      ctx.save();
      if(hasMasks&&maskContext&&mode!=="boxes"){
        const cutoff=clamp(settings.figureCutoff??58,20,95)/100;
        const ww=maskCanvas.width,hh=maskCanvas.height;
        if(matteCanvas.width!==ww||matteCanvas.height!==hh){matteCanvas.width=ww;matteCanvas.height=hh;}
        if(matteContext){
          // Preserve cached matte on display frames without a new inference.
          if(matteRevision!==revision||matteMode!==mode||matteCutoff!==cutoff){
          matteContext.clearRect(0,0,ww,hh);
          const raw=maskContext.getImageData(0,0,ww,hh);
          const src=raw.data;
          const output=matteContext.createImageData(ww,hh);
          const dst=output.data;
          const limit=cutoff*255;
          for(let y=0;y<hh;y++)for(let x=0;x<ww;x++){
            const j=(y*ww+x)*4;if(src[j+3]<limit)continue;
            const left=x>0?src[j-1]:0,right=x<ww-1?src[j+7]:0;
            const up=y>0?src[j-ww*4+3]:0,down=y<hh-1?src[j+ww*4+3]:0;
            const isOutline=left<limit||right<limit||up<limit||down<limit;
            const visible=mode==="silhouette"||mode==="xray"||isOutline;
            if(!visible)continue;
            const op=mode==="silhouette"?115:mode==="xray"?65:255;
            dst[j]=mode==="xray"?67:150;dst[j+1]=255;dst[j+2]=mode==="xray"?255:109;dst[j+3]=op;
          }
          matteContext.putImageData(output,0,0);
          matteRevision=revision;matteMode=mode;matteCutoff=cutoff;
          }
          if(settings.front){ctx.translate(canvas.width,0);ctx.scale(-1,1);}
          ctx.imageSmoothingEnabled=true;
          ctx.drawImage(matteCanvas,a.left,a.top,a.width,a.height);
          if(settings.front){ctx.restore();ctx.save();}
        }
      }
      // Bounding regions are computed from *observed* landmarks only.
      const stroke=mode==="xray"?"#74e5ff":"#b6ff70";
      ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(1.5,canvas.width/400);
      ctx.setLineDash([Math.max(4,canvas.width/120),Math.max(4,canvas.width/180)]);
      for(let i=0;i<shapeInfo.length;i++){
        const b=bounds(shapeInfo[i],a);
        if(b.right-b.left<6||b.bottom-b.top<10)continue;
        ctx.strokeRect(b.left,b.top,b.right-b.left,b.bottom-b.top);
        ctx.setLineDash([]);
        const size=clamp(canvas.width/60,11,19);
        ctx.font="600 "+size+"px monospace";
        const caption="BODY "+shapeInfo[i].id+" · "+Math.round(shapeInfo[i].score*100)+"% VIS";
        const width=ctx.measureText(caption).width;
        const yy=Math.max(size+4,b.top-5);
        ctx.fillStyle="#081813";
        ctx.fillRect(b.left,yy-size-4,width+10,size+7);
        ctx.fillStyle=stroke;ctx.fillText(caption,b.left+5,yy);
        ctx.setLineDash([Math.max(4,canvas.width/120),Math.max(4,canvas.width/180)]);
      }
      ctx.restore();
    }
    function preview(target,front=false){
      expire();
      if(!target)return false;
      const p=target.getContext("2d");if(!p)return false;
      const w=target.width,h=target.height;
      p.fillStyle="#07130e";p.fillRect(0,0,w,h);
      if(!shapeInfo.length||!video.videoWidth||!video.videoHeight){
        p.fillStyle="#668377";p.font="12px monospace";p.fillText("NO CAMERA FIGURE",Math.max(4,w*.16),h*.53);
        return false;
      }
      const b=shapeInfo[0];
      let x0=Math.max(0,b.minX-.12),y0=Math.max(0,b.minY-.16);
      let x1=Math.min(1,b.maxX+.12),y1=Math.min(1,b.maxY+.16);
      const sx=x0*video.videoWidth,sy=y0*video.videoHeight;
      const sw=Math.max(2,(x1-x0)*video.videoWidth),sh=Math.max(2,(y1-y0)*video.videoHeight);
      // Original optical pixels only: focus/zoom is a crop, not appearance generation.
      p.save();p.filter="brightness(1.32) contrast(1.23) saturate(.88)";
      if(front){p.translate(w,0);p.scale(-1,1);}
      const scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale;
      p.drawImage(video,sx,sy,sw,sh,(w-dw)*.5,(h-dh)*.5,dw,dh);
      p.restore();
      return true;
    }
    function details(){expire();return {poseCount,hasMasks,confidence,segmentationReady,maskError,revision};}
    return {update,draw,details,preview,reset};
  }
  root.SpecterFigureEngine={create};
})(window);
