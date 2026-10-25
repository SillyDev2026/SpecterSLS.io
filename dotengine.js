/* SpecterSLS 2.4 · optical structured-light style dot mapper
   Pixels are 2D camera samples. No LiDAR or measured depth is implied. */
(function(root){
  "use strict";
  const colors={
    lime:["rgba(117,255,119,.80)","rgba(141,255,178,.94)","rgba(214,255,181,.98)"],
    cyan:["rgba(63,189,247,.83)","rgba(97,236,255,.96)","rgba(222,251,255,.98)"],
    thermal:["rgba(91,160,254,.84)","rgba(253,139,107,.96)","rgba(255,239,125,.98)"]
  };
  root.SpecterDotEngine={
    create({canvas,video,ctx,getFront,getSettings,onSample}){
      const sampler=document.createElement("canvas");
      const samplerCtx=sampler.getContext("2d",{willReadFrequently:true});
      const layer=document.createElement("canvas");
      const paint=layer.getContext("2d",{alpha:true});
      let points=[],lastSample=0,lastW=0,lastH=0,grayPrev=null,dirty=true;
      const settings=()=>getSettings();
      function sample(now){
        if(!samplerCtx||!video.videoWidth||!video.videoHeight)return;
        const cfg=settings();
        const width=({1:98,2:138,3:178,4:224,5:278})[cfg.dotDensity]||178;
        const height=Math.max(28,Math.min(480,Math.round(width*canvas.height/Math.max(1,canvas.width))));
        if(sampler.width!==width||sampler.height!==height){
          sampler.width=width;sampler.height=height;grayPrev=null;
        }
        const scale=Math.max(width/video.videoWidth,height/video.videoHeight);
        const dw=video.videoWidth*scale,dh=video.videoHeight*scale;
        const ox=(width-dw)/2,oy=(height-dh)/2;
        samplerCtx.save();samplerCtx.fillStyle="#000";samplerCtx.fillRect(0,0,width,height);
        if(getFront()){samplerCtx.translate(width,0);samplerCtx.scale(-1,1);}
        samplerCtx.drawImage(video,ox,oy,dw,dh);
        samplerCtx.restore();
        const rgba=samplerCtx.getImageData(0,0,width,height).data;
        const gray=new Uint8Array(width*height);
        for(let i=0;i<gray.length;i++){
          const o=i*4;gray[i]=(rgba[o]*54+rgba[o+1]*183+rgba[o+2]*19)>>8;
        }
        const threshold=({1:100,2:76,3:55,4:38,5:24})[cfg.dotSensitivity]||55;
        const caps={battery:2500,balanced:4200,fast:6500,turbo:8200,ultra:10500};
        const max=(caps[cfg.speed]||4200);
        const skip=Math.max(1,Math.ceil(Math.sqrt(width*height/max)));
        const next=[];
        for(let y=1;y<height-1;y+=skip)for(let x=1;x<width-1;x+=skip){
          const i=y*width+x,lum=gray[i];
          const edge=Math.abs(lum-gray[i-1])+Math.abs(lum-gray[i+1])
           +Math.abs(lum-gray[i-width])+Math.abs(lum-gray[i+width]);
          const motion=grayPrev?Math.abs(lum-grayPrev[i]):0;
          const moving=motion>Math.max(13,threshold*.65),textured=edge>threshold*1.2;
          const hasPoint=cfg.dotView==="all"||(
            cfg.dotView==="edges"?(textured||moving):
            (lum>Math.max(20,threshold*.70)||textured||moving));
          if(!hasPoint)continue;
          next.push({x:(x+.5)*canvas.width/width,y:(y+.5)*canvas.height/height,
            e:Math.min(1,edge/240),m:moving,grade:moving?2:textured?1:0});
        }
        grayPrev=gray;points=next;lastSample=now;dirty=true;
        onSample(points);
      }
      function rebuild(){
        if(!paint)return;
        if(layer.width!==canvas.width||layer.height!==canvas.height){
          layer.width=canvas.width;layer.height=canvas.height;dirty=true;
        }
        if(!dirty)return;
        const p=colors[settings().dotPalette]||colors.lime;
        paint.clearRect(0,0,layer.width,layer.height);
        const size=Math.max(1.1,Math.min(3.5,canvas.width/540));
        for(let grade=0;grade<=2;grade++){
          paint.fillStyle=p[grade];
          for(let i=0;i<points.length;i++){
            const pt=points[i];if(pt.grade!==grade)continue;
            const r=size*(grade===2?1.5:grade===1?1.20:.85);
            paint.fillRect(pt.x-r/2,pt.y-r/2,r,r);
          }
        }
        dirty=false;
      }
      function draw(now,frozen=false){
        const interval=({battery:180,balanced:115,fast:75,turbo:55,ultra:45})[settings().speed]||115;
        if(!frozen && (now-lastSample>=interval || lastW!==canvas.width || lastH!==canvas.height))sample(now);
        lastW=canvas.width;lastH=canvas.height;
        rebuild();if(!layer.width)return;
        ctx.drawImage(layer,0,0);
        // Separate animated scanner sweep. Visual effect only, not distance data.
        if(!frozen){
          const y=(now*.052)%(canvas.height||1);
          ctx.save();ctx.fillStyle="rgba(125,255,167,.19)";
          ctx.fillRect(0,y,canvas.width,Math.max(1,canvas.height*.004));
          ctx.restore();
        }
      }
      return {draw,invalidate(){lastSample=0;dirty=true;grayPrev=null;},
        clear(){points=[];grayPrev=null;lastSample=0;dirty=true;onSample(points);}};
    }
  };
})(window);
