const k=`#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv, vL, vR, vT, vB;
uniform vec2 uTexel;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0); vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y); vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`,z={splat:`
    uniform sampler2D uTarget; uniform float uAspect; uniform vec2 uPoint; uniform vec3 uColor; uniform float uRadius;
    void main() {
      vec2 p = vUv - uPoint; p.x *= uAspect;
      vec3 s = exp(-dot(p, p) / uRadius) * uColor;
      o = vec4(texture(uTarget, vUv).xyz + s, 1.0);
    }`,advect:`
    uniform sampler2D uVel; uniform sampler2D uSrc; uniform vec2 uSimTexel; uniform float uDt; uniform vec4 uDiss;
    void main() {
      vec2 c = vUv - uDt * texture(uVel, vUv).xy * uSimTexel;
      o = texture(uSrc, c) / (1.0 + uDiss * uDt);
    }`,curl:`
    uniform sampler2D uVel;
    void main() {
      float L = texture(uVel, vL).y, R = texture(uVel, vR).y, T = texture(uVel, vT).x, B = texture(uVel, vB).x;
      o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
    }`,vort:`
    uniform sampler2D uVel; uniform sampler2D uCurl; uniform float uCurlK; uniform float uDt;
    void main() {
      float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x, C = texture(uCurl, vUv).x;
      vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      f /= length(f) + 1e-4; f *= uCurlK * C; f.y *= -1.0;
      vec2 v = texture(uVel, vUv).xy + f * uDt;
      o = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
    }`,div:`
    uniform sampler2D uVel;
    void main() {
      float L = texture(uVel, vL).x, R = texture(uVel, vR).x, T = texture(uVel, vT).y, B = texture(uVel, vB).y;
      vec2 C = texture(uVel, vUv).xy;
      if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x; if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
      o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }`,pressure:`
    uniform sampler2D uP; uniform sampler2D uDiv;
    void main() {
      float L = texture(uP, vL).x, R = texture(uP, vR).x, T = texture(uP, vT).x, B = texture(uP, vB).x;
      o = vec4((L + R + B + T - texture(uDiv, vUv).x) * 0.25, 0.0, 0.0, 1.0);
    }`,grad:`
    uniform sampler2D uP; uniform sampler2D uVel;
    void main() {
      float L = texture(uP, vL).x, R = texture(uP, vR).x, T = texture(uP, vT).x, B = texture(uP, vB).x;
      o = vec4(texture(uVel, vUv).xy - vec2(R - L, T - B), 0.0, 1.0);
    }`,scale:`
    uniform sampler2D uSrc; uniform float uK;
    void main() { o = texture(uSrc, vUv) * uK; }`,display:`
    uniform sampler2D uDye; uniform sampler2D uVel; uniform sampler2D uBg; uniform vec2 uBgScale; uniform float uTime;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 vel = texture(uVel, vUv).xy;
      vec2 bgUv = (vUv - 0.5) * uBgScale + 0.5;
      bgUv += vel * 0.00045;                                   // the haze itself flows
      vec3 bg = texture(uBg, vec2(bgUv.x, 1.0 - bgUv.y)).rgb;
      vec3 d = texture(uDye, vUv).rgb;
      float paint = max(d.r, 0.0);
      float soot = clamp(d.g, 0.0, 1.0);
      float chalk = clamp(d.b, 0.0, 1.0);
      vec3 col = bg;
      col = mix(col, col * vec3(0.55, 0.5, 0.48), soot * 0.75);
      col = mix(col, vec3(0.97, 0.94, 0.9), chalk * 0.55);
      col = mix(col, vec3(0.90, 0.20, 0.16), smoothstep(0.01, 0.75, paint) * 0.94);
      col = mix(col, vec3(0.62, 0.06, 0.05), smoothstep(0.9, 2.6, paint) * 0.55);   // wet, pooled paint
      col += (hash(vUv * 900.0 + uTime) - 0.5) * 0.025;       // film grain
      o = vec4(col, 1.0);
    }`};function N(o,_,v){const c=o.createShader(_);if(o.shaderSource(c,v),o.compileShader(c),!o.getShaderParameter(c,o.COMPILE_STATUS))throw new Error(o.getShaderInfoLog(c));return c}function j(o,_){const v=o.createProgram();if(o.attachShader(v,N(o,o.VERTEX_SHADER,k)),o.attachShader(v,N(o,o.FRAGMENT_SHADER,`#version 300 es
precision highp float;
in vec2 vUv, vL, vR, vT, vB;
out vec4 o;
${_}`)),o.bindAttribLocation(v,0,"aPos"),o.linkProgram(v),!o.getProgramParameter(v,o.LINK_STATUS))throw new Error(o.getProgramInfoLog(v));const c={},e=o.getProgramParameter(v,o.ACTIVE_UNIFORMS);for(let m=0;m<e;m++){const M=o.getActiveUniform(v,m);c[M.name]=o.getUniformLocation(v,M.name)}return{p:v,u:c}}function $(o,{bgUrl:_,reduced:v=!1,mobile:c=!1}={}){const e=o.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1});if(!e||!e.getExtension("EXT_color_buffer_float"))return null;e.getExtension("OES_texture_float_linear");const m=Object.fromEntries(Object.entries(z).map(([u,r])=>[u,j(e,r)])),M=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,M),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0);const P=c?96:140,A=c?384:640;function w(u,r){const t=e.createTexture();e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA16F,u,r,0,e.RGBA,e.HALF_FLOAT,null);const i=e.createFramebuffer();return e.bindFramebuffer(e.FRAMEBUFFER,i),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0),e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT),{tex:t,fb:i,w:u,h:r}}const g=(u,r)=>{let t=w(u,r),i=w(u,r);return{get r(){return t},get w(){return i},swap(){[t,i]=[i,t]}}};let D,U,F,I,a,d,b,L,R;function V(){const u=Math.min(window.devicePixelRatio||1,c?1:1.5);o.width=Math.round(o.clientWidth*u),o.height=Math.round(o.clientHeight*u);const r=o.width/o.height;D=r>=1?Math.round(P*r):P,U=r>=1?P:Math.round(P/r),F=r>=1?Math.round(A*r):A,I=r>=1?A:Math.round(A/r),a=g(D,U),d=g(F,I),R=g(D,U),b=w(D,U),L=w(D,U)}V();const S=e.createTexture();let y=16/9;e.bindTexture(e.TEXTURE_2D,S),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([233,222,211,255]));const E=new Image;E.decoding="async";const W=new Promise(u=>{E.onload=()=>{e.bindTexture(e.TEXTURE_2D,S),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,E),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.MIRRORED_REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.MIRRORED_REPEAT),y=E.width/E.height,u()},E.onerror=()=>u()});E.src=_;function T(u,r,t){e.useProgram(u.p);const i=r?r.w:o.width,l=r?r.h:o.height;e.uniform2f(u.u.uTexel,1/i,1/l),t?.(u.u),e.viewport(0,0,i,l),e.bindFramebuffer(e.FRAMEBUFFER,r?r.fb:null),e.drawArrays(e.TRIANGLES,0,3)}let x=0;const f=(u,r)=>{e.activeTexture(e.TEXTURE0+x),e.bindTexture(e.TEXTURE_2D,r),e.uniform1i(u,x),x+=1};function p(u,r,t,i,l,h=.0022){x=0,T(m.splat,a.w,s=>{f(s.uTarget,a.r.tex),e.uniform1f(s.uAspect,o.width/o.height),e.uniform2f(s.uPoint,u,r),e.uniform3f(s.uColor,t,i,0),e.uniform1f(s.uRadius,h)}),a.swap(),x=0,T(m.splat,d.w,s=>{f(s.uTarget,d.r.tex),e.uniform1f(s.uAspect,o.width/o.height),e.uniform2f(s.uPoint,u,r),e.uniform3f(s.uColor,...l),e.uniform1f(s.uRadius,h*.9)}),d.swap()}function H(u){const r=[1/D,1/U];x=0,T(m.curl,L,t=>{e.uniform2f(t.uTexel,...r),f(t.uVel,a.r.tex)}),x=0,T(m.vort,a.w,t=>{e.uniform2f(t.uTexel,...r),f(t.uVel,a.r.tex),f(t.uCurl,L.tex),e.uniform1f(t.uCurlK,22),e.uniform1f(t.uDt,u)}),a.swap(),x=0,T(m.div,b,t=>{e.uniform2f(t.uTexel,...r),f(t.uVel,a.r.tex)}),x=0,T(m.scale,R.w,t=>{f(t.uSrc,R.r.tex),e.uniform1f(t.uK,.8)}),R.swap();for(let t=0;t<(c?12:20);t++)x=0,T(m.pressure,R.w,i=>{e.uniform2f(i.uTexel,...r),f(i.uP,R.r.tex),f(i.uDiv,b.tex)}),R.swap();x=0,T(m.grad,a.w,t=>{e.uniform2f(t.uTexel,...r),f(t.uP,R.r.tex),f(t.uVel,a.r.tex)}),a.swap(),x=0,T(m.advect,a.w,t=>{f(t.uVel,a.r.tex),f(t.uSrc,a.r.tex),e.uniform2f(t.uSimTexel,...r),e.uniform1f(t.uDt,u),e.uniform4f(t.uDiss,.35,.35,.35,.35)}),a.swap(),x=0,T(m.advect,d.w,t=>{f(t.uVel,a.r.tex),f(t.uSrc,d.r.tex),e.uniform2f(t.uSimTexel,...r),e.uniform1f(t.uDt,u),e.uniform4f(t.uDiss,.42,.9,.9,.9)}),d.swap()}let X=0;function K(){const u=o.width/o.height,r=u>y?[1,y/u]:[u/y,1];x=0,T(m.display,null,t=>{f(t.uDye,d.r.tex),f(t.uVel,a.r.tex),f(t.uBg,S),e.uniform2f(t.uBgScale,r[0],r[1]),e.uniform1f(t.uTime,X%100)})}const n={x:.5,y:.5,px:.5,py:.5,down:!1,moved:!1},B=[];let C=0;function Y(u){if(X+=u,!v){if(n.moved){const r=n.x-n.px,t=n.y-n.py,i=o.width/o.height,l=Math.min(1,Math.hypot(r*i,t)*45);p(n.x,n.y,r*6e3,t*6e3,n.down?[0,0,0]:[.035+.13*l,.05,.02],.0016);const h=1+Math.round(l*(c?2:4));for(let s=0;s<h;s++){const G=Math.random()*Math.PI*2,O=.006+Math.random()*.02*(.4+l);p(n.x+Math.cos(G)*O/i,n.y+Math.sin(G)*O,r*2500,t*2500,[.22+Math.random()*.2,0,0],6e-5+Math.random()*12e-5)}n.px=n.x,n.py=n.y,n.moved=!1}if(n.down){for(let i=0;i<(c?2:3);i++){const l=Math.random()*Math.PI*2;p(n.x+Math.cos(l)*.004,n.y+Math.sin(l)*.004,Math.cos(l)*110,Math.sin(l)*110+50,[.26,0,0],7e-4)}const r=Math.random()*Math.PI*2,t=.012+Math.random()*.03;p(n.x+Math.cos(r)*t,n.y+Math.sin(r)*t,0,0,[.3,0,0],8e-5)}for(;B.length;){const[r,t]=B.pop();p(r,t,0,0,[.9,.02,0],.0022);const i=c?8:12;for(let l=0;l<i;l++){const h=l/i*Math.PI*2+Math.random()*.4,s=260+Math.random()*260;p(r+Math.cos(h)*.01,t+Math.sin(h)*.01,Math.cos(h)*s,Math.sin(h)*s,[.35,0,0],35e-5)}}if(C-=u,C<=0){C=.9+Math.random()*1.4;const r=.15+Math.random()*.7;p(r,.02,(Math.random()-.5)*220,260+Math.random()*260,Math.random()<.55?[.22,.04,0]:[0,.08,.1],.006)}H(Math.min(u,1/30))}K()}return{ready:W,frame:Y,pointer(u,r){n.x=u,n.y=r,n.moved=!0},press(u){n.down=u},burst(u,r){B.length<4&&B.push([u,r])},resize:V,dispose(){e.getExtension("WEBGL_lose_context")?.loseContext()}}}export{$ as createFluid};
