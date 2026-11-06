const H=`#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv, vL, vR, vT, vB;
uniform vec2 uTexel;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0); vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y); vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`,K={splat:`
    uniform sampler2D uTarget; uniform float uAspect; uniform vec2 uPoint; uniform vec3 uColor; uniform float uRadius;
    void main() {
      vec2 p = vUv - uPoint; p.x *= uAspect;
      vec3 s = exp(-dot(p, p) / uRadius) * uColor;
      o = vec4(texture(uTarget, vUv).xyz + s, 1.0);
    }`,advect:`
    uniform sampler2D uVel; uniform sampler2D uSrc; uniform vec2 uSimTexel; uniform float uDt; uniform float uDiss;
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
      float paint = clamp(d.r, 0.0, 1.0);
      float soot = clamp(d.g, 0.0, 1.0);
      float chalk = clamp(d.b, 0.0, 1.0);
      vec3 col = bg;
      col = mix(col, col * vec3(0.55, 0.5, 0.48), soot * 0.75);
      col = mix(col, vec3(0.97, 0.94, 0.9), chalk * 0.55);
      col = mix(col, vec3(0.90, 0.20, 0.16), smoothstep(0.02, 1.4, paint) * 0.9);
      col += (hash(vUv * 900.0 + uTime) - 0.5) * 0.025;       // film grain
      o = vec4(col, 1.0);
    }`};function X(o,h,v){const c=o.createShader(h);if(o.shaderSource(c,v),o.compileShader(c),!o.getShaderParameter(c,o.COMPILE_STATUS))throw new Error(o.getShaderInfoLog(c));return c}function Y(o,h){const v=o.createProgram();if(o.attachShader(v,X(o,o.VERTEX_SHADER,H)),o.attachShader(v,X(o,o.FRAGMENT_SHADER,`#version 300 es
precision highp float;
in vec2 vUv, vL, vR, vT, vB;
out vec4 o;
${h}`)),o.bindAttribLocation(v,0,"aPos"),o.linkProgram(v),!o.getProgramParameter(v,o.LINK_STATUS))throw new Error(o.getProgramInfoLog(v));const c={},e=o.getProgramParameter(v,o.ACTIVE_UNIFORMS);for(let f=0;f<e;f++){const D=o.getActiveUniform(v,f);c[D.name]=o.getUniformLocation(v,D.name)}return{p:v,u:c}}function k(o,{bgUrl:h,reduced:v=!1,mobile:c=!1}={}){const e=o.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1});if(!e||!e.getExtension("EXT_color_buffer_float"))return null;e.getExtension("OES_texture_float_linear");const f=Object.fromEntries(Object.entries(K).map(([u,r])=>[u,Y(e,r)])),D=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,D),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0);const U=c?96:140,_=c?384:640;function A(u,r){const t=e.createTexture();e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA16F,u,r,0,e.RGBA,e.HALF_FLOAT,null);const l=e.createFramebuffer();return e.bindFramebuffer(e.FRAMEBUFFER,l),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0),e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT),{tex:t,fb:l,w:u,h:r}}const w=(u,r)=>{let t=A(u,r),l=A(u,r);return{get r(){return t},get w(){return l},swap(){[t,l]=[l,t]}}};let d,p,M,C,n,T,b,y,R;function F(){const u=Math.min(window.devicePixelRatio||1,c?1:1.5);o.width=Math.round(o.clientWidth*u),o.height=Math.round(o.clientHeight*u);const r=o.width/o.height;d=r>=1?Math.round(U*r):U,p=r>=1?U:Math.round(U/r),M=r>=1?Math.round(_*r):_,C=r>=1?_:Math.round(_/r),n=w(d,p),T=w(M,C),R=w(d,p),b=A(d,p),y=A(d,p)}F();const g=e.createTexture();let P=16/9;e.bindTexture(e.TEXTURE_2D,g),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([233,222,211,255]));const E=new Image;E.decoding="async";const G=new Promise(u=>{E.onload=()=>{e.bindTexture(e.TEXTURE_2D,g),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,E),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.MIRRORED_REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.MIRRORED_REPEAT),P=E.width/E.height,u()},E.onerror=()=>u()});E.src=h;function x(u,r,t){e.useProgram(u.p);const l=r?r.w:o.width,B=r?r.h:o.height;e.uniform2f(u.u.uTexel,1/l,1/B),t?.(u.u),e.viewport(0,0,l,B),e.bindFramebuffer(e.FRAMEBUFFER,r?r.fb:null),e.drawArrays(e.TRIANGLES,0,3)}let m=0;const a=(u,r)=>{e.activeTexture(e.TEXTURE0+m),e.bindTexture(e.TEXTURE_2D,r),e.uniform1i(u,m),m+=1};function L(u,r,t,l,B,I=.0022){m=0,x(f.splat,n.w,s=>{a(s.uTarget,n.r.tex),e.uniform1f(s.uAspect,o.width/o.height),e.uniform2f(s.uPoint,u,r),e.uniform3f(s.uColor,t,l,0),e.uniform1f(s.uRadius,I)}),n.swap(),m=0,x(f.splat,T.w,s=>{a(s.uTarget,T.r.tex),e.uniform1f(s.uAspect,o.width/o.height),e.uniform2f(s.uPoint,u,r),e.uniform3f(s.uColor,...B),e.uniform1f(s.uRadius,I*.9)}),T.swap()}function O(u){const r=[1/d,1/p];m=0,x(f.curl,y,t=>{e.uniform2f(t.uTexel,...r),a(t.uVel,n.r.tex)}),m=0,x(f.vort,n.w,t=>{e.uniform2f(t.uTexel,...r),a(t.uVel,n.r.tex),a(t.uCurl,y.tex),e.uniform1f(t.uCurlK,22),e.uniform1f(t.uDt,u)}),n.swap(),m=0,x(f.div,b,t=>{e.uniform2f(t.uTexel,...r),a(t.uVel,n.r.tex)}),m=0,x(f.scale,R.w,t=>{a(t.uSrc,R.r.tex),e.uniform1f(t.uK,.8)}),R.swap();for(let t=0;t<(c?12:20);t++)m=0,x(f.pressure,R.w,l=>{e.uniform2f(l.uTexel,...r),a(l.uP,R.r.tex),a(l.uDiv,b.tex)}),R.swap();m=0,x(f.grad,n.w,t=>{e.uniform2f(t.uTexel,...r),a(t.uP,R.r.tex),a(t.uVel,n.r.tex)}),n.swap(),m=0,x(f.advect,n.w,t=>{a(t.uVel,n.r.tex),a(t.uSrc,n.r.tex),e.uniform2f(t.uSimTexel,...r),e.uniform1f(t.uDt,u),e.uniform1f(t.uDiss,.35)}),n.swap(),m=0,x(f.advect,T.w,t=>{a(t.uVel,n.r.tex),a(t.uSrc,T.r.tex),e.uniform2f(t.uSimTexel,...r),e.uniform1f(t.uDt,u),e.uniform1f(t.uDiss,.9)}),T.swap()}let V=0;function N(){const u=o.width/o.height,r=u>P?[1,P/u]:[u/P,1];m=0,x(f.display,null,t=>{a(t.uDye,T.r.tex),a(t.uVel,n.r.tex),a(t.uBg,g),e.uniform2f(t.uBgScale,r[0],r[1]),e.uniform1f(t.uTime,V%100)})}const i={x:.5,y:.5,px:.5,py:.5,down:!1,moved:!1};let S=0;function W(u){if(V+=u,!v){if(i.moved){const r=(i.x-i.px)*6e3,t=(i.y-i.py)*6e3;L(i.x,i.y,r,t,i.down?[0,0,0]:[0,.1,.05],.0016),i.px=i.x,i.py=i.y,i.moved=!1}if(i.down){const r=Math.random()*Math.PI*2;L(i.x+Math.cos(r)*.003,i.y+Math.sin(r)*.003,Math.cos(r)*90,Math.sin(r)*90+40,[.16,0,0],45e-5)}if(S-=u,S<=0){S=.9+Math.random()*1.4;const r=.15+Math.random()*.7;L(r,.02,(Math.random()-.5)*220,260+Math.random()*260,Math.random()<.35?[.16,.05,0]:[0,.08,.1],.006)}O(Math.min(u,1/30))}N()}return{ready:G,frame:W,pointer(u,r){i.x=u,i.y=r,i.moved=!0},press(u){i.down=u},resize:F,dispose(){e.getExtension("WEBGL_lose_context")?.loseContext()}}}export{k as createFluid};
