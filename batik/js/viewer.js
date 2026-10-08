/* Art Tap · native WebGL objects. All UVs refer to the original, uncut cloth. */
(function (global) {
  'use strict';

  const SHIRT = [[.12,.21],[.32,.1],[.4,.1],[.42,.18],[.58,.18],[.6,.1],[.68,.1],[.88,.21],[.98,.42],[.79,.53],[.72,.42],[.72,.91],[.28,.91],[.28,.42],[.21,.53],[.02,.42]];
  const VERTEX = `
    attribute vec3 aPosition; attribute vec3 aNormal;
    attribute vec2 aUV; attribute float aMaterial;
    uniform mat4 uModel; uniform mat4 uMVP;
    varying vec3 vNormal; varying vec3 vPosition;
    varying vec2 vUV; varying float vMaterial;
    void main() {
      gl_Position = uMVP * vec4(aPosition, 1.0);
      vNormal = mat3(uModel) * aNormal;
      vPosition = (uModel * vec4(aPosition, 1.0)).xyz;
      vUV = aUV; vMaterial = aMaterial;
    }`;
  const FRAGMENT = `
    precision mediump float;
    uniform sampler2D uTexture;
    varying vec3 vNormal; varying vec3 vPosition;
    varying vec2 vUV; varying float vMaterial;
    void main() {
      if (vMaterial > 4.5) {
        vec2 p = (vUV - .5) * 2.0;
        float a = exp(-dot(p,p) * 3.5) * .19;
        gl_FragColor = vec4(.22,.27,.25,a); return;
      }
      vec3 n = normalize(vNormal);
      vec3 base;
      if (vMaterial < .5) {
        base = texture2D(uTexture, vUV).rgb;
        float fiber = sin(vUV.x * 1300.0) * sin(vUV.y * 1400.0);
        base *= .98 + fiber * .022;
      } else if (vMaterial < 1.5) {
        float grain = sin(vUV.x * 250.0 + sin(vUV.y * 18.0) * 2.0);
        base = vec3(.49,.35,.23) + grain * .025;
      } else if (vMaterial < 2.5) {
        base = vec3(.65,.57,.45) + sin(vUV.y * 460.0) * .02;
      } else if (vMaterial < 3.5) {
        base = mix(texture2D(uTexture, vUV).rgb, vec3(.79,.77,.66), .23);
        base *= .95 + .05 * sin(vUV.y * 850.0);
      } else {
        base = vec3(.72,.67,.55) + sin(vUV.x * 400.0) * sin(vUV.y * 100.0) * .016;
      }
      float diffuse = max(dot(n, normalize(vec3(-.55,.8,1.0))), 0.0);
      float fill = max(dot(n, normalize(vec3(.7,.3,-.5))),0.0);
      float rim = pow(1.0 - abs(n.z), 3.0);
      vec3 color = base * (.68 + .29 * diffuse + .12 * fill) + rim * .028;
      gl_FragColor = vec4(color, 1.0);
    }`;

  const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
  function normalized(v) {
    const n = Math.hypot(v[0],v[1],v[2]) || 1;
    return v.map(x => x / n);
  }
  function cross(a,b) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
  function subtract(a,b) { return a.map((v,i)=>v-b[i]); }
  function identity() { return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]); }
  function multiply(a,b) {
    const out = new Float32Array(16);
    for(let c=0;c<4;c++) for(let r=0;r<4;r++) for(let k=0;k<4;k++) out[c*4+r] += a[k*4+r]*b[c*4+k];
    return out;
  }
  function perspective(aspect, distance) {
    const f=1/Math.tan(Math.PI/8), near=.1, far=100;
    const p=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
    const view=identity(); view[14]=-distance;
    return multiply(p,view);
  }
  function rotation(yaw,pitch,lift) {
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
    const ry=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]);
    const rx=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]);
    const m=multiply(rx,ry); m[13]=lift; return m;
  }

  function buildMesh(carrier) {
    const data=[];
    function vertex(p,n,uv,material) { data.push(...p,...n,...uv,material); }
    function triangle(a,b,c,ua,ub,uc,material,na,nb,nc) {
      const normal=normalized(cross(subtract(b,a),subtract(c,a)));
      vertex(a,na||normal,ua,material); vertex(b,nb||normal,ub,material); vertex(c,nc||normal,uc,material);
    }
    function quad(a,b,c,d,ua,ub,uc,ud,material,normal) {
      triangle(a,b,c,ua,ub,uc,material,normal,normal,normal);
      triangle(a,c,d,ua,uc,ud,material,normal,normal,normal);
    }
    function box(x,y,z,w,h,d,material) {
      const a=[x-w/2,y-h/2,z-d/2],b=[x+w/2,y-h/2,z-d/2],c=[x+w/2,y+h/2,z-d/2],e=[x-w/2,y+h/2,z-d/2];
      const f=[a[0],a[1],z+d/2],g=[b[0],b[1],z+d/2],j=[c[0],c[1],z+d/2],k=[e[0],e[1],z+d/2];
      const uv=[[0,0],[1,0],[1,1],[0,1]];
      [[f,g,j,k,[0,0,1]],[b,a,e,c,[0,0,-1]],[a,f,k,e,[-1,0,0]],[g,b,c,j,[1,0,0]],[e,k,j,c,[0,1,0]],[a,b,g,f,[0,-1,0]]].forEach(s=>quad(s[0],s[1],s[2],s[3],...uv,material,s[4]));
    }
    function sampleNormal(fn,u,v,side) {
      const du=subtract(fn(u+.0001,v),fn(u-.0001,v));
      const dv=subtract(fn(u,v+.0001),fn(u,v-.0001));
      return normalized(cross(dv,du)).map(n=>n*side);
    }
    function grid(fn,u0,v0,u1,v1,cols,rows,side,material) {
      for(let y=0;y<rows;y++) for(let x=0;x<cols;x++) {
        const u=u0+(u1-u0)*x/cols, v=v0+(v1-v0)*y/rows;
        const uu=u0+(u1-u0)*(x+1)/cols,vv=v0+(v1-v0)*(y+1)/rows;
        const uv=[[u,v],[uu,v],[uu,vv],[u,vv]],p=uv.map(q=>fn(...q)),n=uv.map(q=>sampleNormal(fn,...q,side));
        triangle(p[0],p[1],p[2],uv[0],uv[1],uv[2],material,n[0],n[1],n[2]);
        triangle(p[0],p[2],p[3],uv[0],uv[2],uv[3],material,n[0],n[2],n[3]);
      }
    }
    function seam(a,b,front,back,steps) {
      for(let i=0;i<steps;i++) {
        const u=a.map((v,j)=>v+(b[j]-v)*i/steps),v=a.map((n,j)=>n+(b[j]-n)*(i+1)/steps);
        const p=front(...u),q=front(...v),r=back(...v),s=back(...u);
        quad(p,q,r,s,u,v,v,u,3);
      }
    }
    if(carrier==='coaster') {
      const scale=2.9,radius=.38,segments=100;
      const rings=[[radius-.018,.075],[radius-.004,.061],[radius,.031],[radius,-.031],[radius-.004,-.061],[radius-.018,-.075]];
      const point=(r,y,t)=>[Math.cos(t)*r*scale,y,Math.sin(t)*r*scale];
      const uv=(r,t)=>[.5+Math.cos(t)*r,.5+Math.sin(t)*r];
      for(let i=0;i<segments;i++) {
        const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
        triangle([0,.075,0],point(rings[0][0],.075,a),point(rings[0][0],.075,b),[.5,.5],uv(rings[0][0],a),uv(rings[0][0],b),0,[0,1,0],[0,1,0],[0,1,0]);
        triangle([0,-.075,0],point(rings[5][0],-.075,b),point(rings[5][0],-.075,a),[.5,.5],uv(rings[5][0],b),uv(rings[5][0],a),0,[0,-1,0],[0,-1,0],[0,-1,0]);
        for(let k=0;k<rings.length-1;k++) {
          const [r,y]=rings[k],[rr,yy]=rings[k+1];
          const na=normalized([Math.cos(a),k===0?.8:k===4?-.8:0,Math.sin(a)]),nb=normalized([Math.cos(b),k===0?.8:k===4?-.8:0,Math.sin(b)]);
          const pa=point(r,y,a),pb=point(r,y,b),pc=point(rr,yy,b),pd=point(rr,yy,a);
          triangle(pa,pb,pc,uv(r,a),uv(r,b),uv(rr,b),3,na,nb,nb); triangle(pa,pc,pd,uv(r,a),uv(rr,b),uv(rr,a),3,na,nb,na);
        }
      }
    } else if(carrier==='bag') {
      const panel=side=>(u,v)=>{
        const x=(u-.18)/.64,y=(v-.18)/.67;
        const bulge=.11+.18*Math.sin(Math.PI*x)*Math.sin(Math.PI*y);
        return [(u-.5)*2.7*(1-.035*Math.sin(Math.PI*y)),(.5-v)*2.7+.018*Math.sin(x*Math.PI*4)*y,side*(bulge+.015*Math.sin(x*28+y*3)*Math.sin(Math.PI*x)*Math.sin(Math.PI*y))];
      };
      const front=panel(1),back=panel(-1);
      grid(front,.18,.18,.82,.85,36,36,1,0); grid(back,.18,.18,.82,.85,36,36,-1,0);
      seam([.18,.18],[.18,.85],front,back,36); seam([.18,.85],[.82,.85],front,back,36); seam([.82,.85],[.82,.18],front,back,36);
      // The open top has a visible inner lining; two rounded handles are closed 3D loops.
      box(0,.77,0,1.63,.04,.19,2);
      for(const depth of [-.13,.13]) for(let i=0;i<80;i++) for(let j=0;j<8;j++) {
        const make=(t,s)=>{
          const a=t*Math.PI*2/80,b=s*Math.PI*2/8;
          return [(.38+.034*Math.cos(b))*Math.cos(a),1.06+(.43+.034*Math.cos(b))*Math.sin(a),depth+.025*Math.sin(b)];
        };
        const a=make(i,j),b=make(i+1,j),c=make(i+1,j+1),d=make(i,j+1);
        quad(a,b,c,d,[i/80,j/8],[(i+1)/80,j/8],[(i+1)/80,(j+1)/8],[i/80,(j+1)/8],4);
      }
    } else if(carrier==='shirt') {
      const panel=side=>(u,v)=>{
        const t=clamp((v-.1)/.81,0,1);
        const torso=Math.exp(-Math.pow((u-.5)/.27,2));
        const drape=.12+.15*torso*Math.sin(Math.PI*t)+.017*Math.sin(u*37)*Math.sin(Math.PI*t);
        return [(u-.5)*2.85,(.5-v)*2.85+.015*Math.cos(u*30)*t,side*drape];
      };
      const front=panel(1),back=panel(-1);
      const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      const indices=SHIRT.map((_,i)=>i),triangles=[];
      function inside(p,a,b,c) { return area(a,b,p)>=-1e-9&&area(b,c,p)>=-1e-9&&area(c,a,p)>=-1e-9; }
      for(let guard=0;indices.length>3&&guard<100;guard++) {
        let clipped=false;
        for(let i=0;i<indices.length;i++) {
          const ia=indices[(i+indices.length-1)%indices.length],ib=indices[i],ic=indices[(i+1)%indices.length];
          const a=SHIRT[ia],b=SHIRT[ib],c=SHIRT[ic];
          if(area(a,b,c)<=1e-9||indices.some(j=>j!==ia&&j!==ib&&j!==ic&&inside(SHIRT[j],a,b,c))) continue;
          triangles.push([a,b,c]);indices.splice(i,1);clipped=true;break;
        }
        if(!clipped) break;
      }
      if(indices.length===3) triangles.push(indices.map(i=>SHIRT[i]));
      const midpoint=(a,b)=>a.map((n,i)=>(n+b[i])/2);
      function subdivide(a,b,c,depth,fn,side) {
        if(depth) { const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);[[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]].forEach(t=>subdivide(...t,depth-1,fn,side)); return; }
        triangle(fn(...a),fn(...b),fn(...c),a,b,c,0,sampleNormal(fn,...a,side),sampleNormal(fn,...b,side),sampleNormal(fn,...c,side));
      }
      triangles.forEach(t=>{subdivide(...t,4,front,1);subdivide(...t,4,back,-1);});
      SHIRT.forEach((a,i)=>seam(a,SHIRT[(i+1)%SHIRT.length],front,back,18));
    } else {
      const front=(u,v)=>[(u-.5)*2.7,(.5-v)*2.7,.105+.005*Math.sin(u*60)*Math.sin(v*50)];
      grid(front,.1,.1,.9,.9,24,24,1,0);
      box(0,0,-.02,2.23,2.23,.13,2);
      box(-1.145,0,.025,.13,2.42,.2,1);box(1.145,0,.025,.13,2.42,.2,1);
      box(0,1.145,.025,2.16,.13,.2,1);box(0,-1.145,.025,2.16,.13,.2,1);
      // Small rear hanging fixture gives the back an unmistakable depth cue.
      box(0,.87,-.11,.22,.035,.045,4);
    }
    return new Float32Array(data);
  }

  function fallback(container, texture, carrier, oldCanvas) {
    if(oldCanvas) oldCanvas.remove();
    const canvas=document.createElement('canvas');canvas.className='result-canvas viewer-fallback';
    canvas.width=900;canvas.height=900;canvas.style.cssText='display:block;width:100%;height:100%;object-fit:contain;';
    canvas.setAttribute('role','img');canvas.setAttribute('aria-label','当前设备不支持 WebGL，显示裁切后的蜡染平面纹样预览');
    const note=document.createElement('p');note.className='viewer-fallback-note';note.textContent='当前设备未启用 WebGL，正在显示平面纹样。启用硬件加速后可查看立体成品。';
    note.style.cssText='position:absolute;bottom:16px;left:24px;right:24px;text-align:center;font-size:12px;line-height:1.7;color:#576d69;';
    container.append(canvas,note);
    const ctx=canvas.getContext('2d');
    function paint(source) {
      ctx.clearRect(0,0,900,900);ctx.fillStyle='#f2f1e9';ctx.fillRect(0,0,900,900);ctx.save();ctx.translate(60,60);ctx.scale(780,780);ctx.beginPath();
      if(carrier==='coaster') ctx.arc(.5,.5,.38,0,Math.PI*2);
      else if(carrier==='bag') ctx.rect(.18,.18,.64,.67);
      else if(carrier==='shirt') {SHIRT.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();}
      else ctx.rect(.1,.1,.8,.8);
      ctx.clip();ctx.drawImage(source,0,0,1,1);ctx.restore();
    }
    paint(texture);
    return {canvas,destroy(){canvas.remove();note.remove();},resetView(){},setTexture:paint,capture(){return canvas.toDataURL('image/png');}};
  }

  function create(container, textureCanvas, selectedCarrier) {
    const raw=typeof selectedCarrier==='string'?selectedCarrier:(selectedCarrier&& (selectedCarrier.id||selectedCarrier.key))||'hanging';
    const carrier=({frame:'hanging',painting:'hanging',wall:'hanging',tote:'bag',top:'shirt',clothing:'shirt',clothes:'shirt'})[raw]||raw;
    const canvas=document.createElement('canvas');canvas.className='result-canvas';
    canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','可旋转的三维蜡染成品。拖动或方向键旋转，双指或滚轮缩放，加减键缩放，Home 键复位。');
    canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline-offset:-5px;';
    container.appendChild(canvas);
    let gl;
    try {gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true})||canvas.getContext('experimental-webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true});} catch (_) {gl=null;}
    if(!gl) return fallback(container,textureCanvas,carrier,canvas);
    const resources=[],listeners=[],pointers=new Map();
    let program,texture,meshBuffer,shadowBuffer;
    function shader(type,source) {const s=gl.createShader(type);resources.push(['shader',s]);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));return s;}
    function cleanupResources() {resources.forEach(([type,r])=>{if(type==='shader') gl.deleteShader(r);else if(type==='buffer') gl.deleteBuffer(r);else if(type==='texture') gl.deleteTexture(r);else gl.deleteProgram(r);});resources.length=0;}
    try {
      program=gl.createProgram();resources.push(['program',program]);gl.attachShader(program,shader(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      meshBuffer=gl.createBuffer();resources.push(['buffer',meshBuffer]);gl.bindBuffer(gl.ARRAY_BUFFER,meshBuffer);const mesh=buildMesh(carrier);gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);meshBuffer.vertexCount=mesh.length/9;
      const y=carrier==='coaster'?-.9:-1.35,shadow=[];
      [[-1.45,y-.14,0,0,0],[1.45,y-.14,0,1,0],[1.45,y+.14,0,1,1],[-1.45,y-.14,0,0,0],[1.45,y+.14,0,1,1],[-1.45,y+.14,0,0,1]].forEach(p=>shadow.push(p[0],p[1],-.5,0,0,1,p[3],p[4],5));
      shadowBuffer=gl.createBuffer();resources.push(['buffer',shadowBuffer]);gl.bindBuffer(gl.ARRAY_BUFFER,shadowBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(shadow),gl.STATIC_DRAW);
      texture=gl.createTexture();resources.push(['texture',texture]);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,textureCanvas);
    } catch (error) {console.warn('Art Tap 3D preview unavailable:',error);cleanupResources();return fallback(container,textureCanvas,carrier,canvas);}
    const position=gl.getAttribLocation(program,'aPosition'),normal=gl.getAttribLocation(program,'aNormal'),uv=gl.getAttribLocation(program,'aUV'),material=gl.getAttribLocation(program,'aMaterial');
    const modelUniform=gl.getUniformLocation(program,'uModel'),mvpUniform=gl.getUniformLocation(program,'uMVP');
    const motion=global.matchMedia?global.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
    let reducedMotion=motion.matches,destroyed=false,contextLost=false,frame=0,yaw=-.28,pitch=carrier==='coaster'?1.04:.13,zoom=1,lastInteraction=performance.now(),lastFrame=performance.now(),pinchDistance=0,observer;
    function listen(target,type,handler,options) {target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));}
    function resize() {const bounds=container.getBoundingClientRect(),dpr=Math.min(global.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(bounds.width*dpr));canvas.height=Math.max(1,Math.round((bounds.height||bounds.width*.85)*dpr));render(performance.now());}
    function bind(buffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      [[position,3,0],[normal,3,12],[uv,2,24],[material,1,32]].forEach(([location,count,offset])=>{gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,count,gl.FLOAT,false,36,offset);});
    }
    function render(time) {
      if(destroyed||contextLost) return;
      gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.949,.953,.925,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(gl.getUniformLocation(program,'uTexture'),0);
      const aspect=canvas.width/canvas.height,projection=perspective(aspect,(aspect<.9?5.7:5.0)/zoom);
      gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);
      bind(shadowBuffer);gl.uniformMatrix4fv(modelUniform,false,identity());gl.uniformMatrix4fv(mvpUniform,false,projection);gl.drawArrays(gl.TRIANGLES,0,6);
      gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);bind(meshBuffer);
      const lift=reducedMotion?0:Math.sin(time*.0008)*.032;
      const model=rotation(yaw,pitch,lift);gl.uniformMatrix4fv(modelUniform,false,model);gl.uniformMatrix4fv(mvpUniform,false,multiply(projection,model));gl.drawArrays(gl.TRIANGLES,0,meshBuffer.vertexCount);
    }
    function tick(time) {if(destroyed)return;const dt=Math.min(64,time-lastFrame);lastFrame=time;if(!document.hidden&&!contextLost){if(!reducedMotion&&!pointers.size&&time-lastInteraction>4000)yaw+=dt*.000105;render(time);}frame=requestAnimationFrame(tick);}
    function interact() {lastInteraction=performance.now();}
    function distance() {const p=Array.from(pointers.values());return p.length>=2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0;}
    function end(event) {pointers.delete(event.pointerId);pinchDistance=distance();if(canvas.hasPointerCapture&&canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(!pointers.size)canvas.style.cursor='grab';interact();}
    listen(canvas,'pointerdown',event=>{if(event.pointerType==='mouse'&&event.button!==0)return;interact();canvas.focus({preventScroll:true});pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});pinchDistance=distance();canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';});
    listen(canvas,'pointermove',event=>{const previous=pointers.get(event.pointerId);if(!previous)return;interact();const dx=event.clientX-previous.x,dy=event.clientY-previous.y;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size>=2){const next=distance();if(pinchDistance>0)zoom=clamp(zoom*next/pinchDistance,.65,2.1);pinchDistance=next;}else{yaw+=dx*.009;pitch=clamp(pitch+dy*.009,-1.45,1.45);}render(performance.now());});
    listen(canvas,'pointerup',end);listen(canvas,'pointercancel',end);listen(canvas,'lostpointercapture',event=>{pointers.delete(event.pointerId);pinchDistance=distance();canvas.style.cursor=pointers.size?'grabbing':'grab';interact();});
    listen(canvas,'wheel',event=>{event.preventDefault();interact();const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1);zoom=clamp(zoom*Math.exp(-delta*.001),.65,2.1);render(performance.now());},{passive:false});
    function resetView() {yaw=-.28;pitch=carrier==='coaster'?1.04:.13;zoom=1;interact();render(performance.now());}
    listen(canvas,'keydown',event=>{let handled=true;if(event.key==='ArrowLeft')yaw-=.15;else if(event.key==='ArrowRight')yaw+=.15;else if(event.key==='ArrowUp')pitch=clamp(pitch-.12,-1.45,1.45);else if(event.key==='ArrowDown')pitch=clamp(pitch+.12,-1.45,1.45);else if(event.key==='+'||event.key==='=')zoom=clamp(zoom*1.12,.65,2.1);else if(event.key==='-')zoom=clamp(zoom/1.12,.65,2.1);else if(event.key==='Home')resetView();else handled=false;if(handled){event.preventDefault();interact();render(performance.now());}});
    listen(canvas,'webglcontextlost',event=>{event.preventDefault();contextLost=true;canvas.setAttribute('aria-label','三维绘图暂时中断，请重新进入成品页恢复。');});
    listen(canvas,'webglcontextrestored',()=>{canvas.setAttribute('aria-label','三维绘图需要重新载入，请重新进入成品页恢复。');});
    if(motion.addEventListener)listen(motion,'change',event=>{reducedMotion=event.matches;render(performance.now());});
    if(global.ResizeObserver){observer=new ResizeObserver(resize);observer.observe(container);}else listen(global,'resize',resize);
    resize();frame=requestAnimationFrame(tick);
    return {
      canvas,
      resetView,
      setTexture(source) {if(destroyed||contextLost)return;gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);render(performance.now());},
      capture() {render(performance.now());return canvas.toDataURL('image/png');},
      destroy() {if(destroyed)return;destroyed=true;cancelAnimationFrame(frame);listeners.forEach(remove=>remove());pointers.clear();if(observer)observer.disconnect();cleanupResources();const lose=gl.getExtension('WEBGL_lose_context');if(lose)lose.loseContext();canvas.remove();}
    };
  }
  global.ArtTapViewer={create};
})(window);
