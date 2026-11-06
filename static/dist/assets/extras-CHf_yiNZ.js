import{M as F,B as U,G as C,D,T as G,S as N,V as _,a as I,b as A,c as $,d as V,P as W,e as E}from"./three-dQ1cnJTf.js";import{l as O}from"./mascot-C1TsHr-z.js";const w=document.querySelector('meta[name="static-root"]')?.content||"/static/",L=`
  float bh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float bn(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(bh(i), bh(i + vec3(1,0,0)), f.x), mix(bh(i + vec3(0,1,0)), bh(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(bh(i + vec3(0,0,1)), bh(i + vec3(1,0,1)), f.x), mix(bh(i + vec3(0,1,1)), bh(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
`,R=`
  // ---- BANDRIP spray front ----
  vec2 gUv = vec2(vObj.x / uSize.x + 0.5, vObj.y / uSize.y + 0.5);
  if (vObjN.z < -0.15) gUv.x = 1.0 - gUv.x;                 // back panel mirrored so it also reads left-to-right
  vec4 graf = texture2D(uGraffiti, gUv);
  float front = gUv.x * 0.78 + (1.0 - gUv.y) * 0.12 + bn(vObj * 7.0) * 0.22;
  float reach = uProgress * 1.25 - 0.05;
  float wet = smoothstep(reach + 0.015, reach - 0.015, front);
  float speck = step(0.83, bh(floor(vObj * 260.0))) * smoothstep(reach + 0.09, reach, front) * (1.0 - wet);
  float paint = clamp(wet + speck * 0.9, 0.0, 1.0) * graf.a;
  diffuseColor.rgb = mix(diffuseColor.rgb, graf.rgb, paint);
`;async function Y(d,{onProgress:M,mobile:m=!1}={}){const[p,h]=await Promise.all([O(`${w}models/hoodie.glb`,M),O(`${w}models/spraycan.glb`)]),r=await new G().loadAsync(`${w}img/graffiti/hoodie_graffiti.webp`);r.colorSpace=N,r.anisotropy=4;const l={uGraffiti:{value:r},uProgress:{value:0},uSize:{value:new _(1.84,1)}},n=new C,s=p.scene,o=new I().setFromObject(s).getSize(new A);l.uSize.value.set(o.x,o.y),s.traverse(t=>{t.isMesh&&(t.material.envMapIntensity=.25,t.material.onBeforeCompile=i=>{Object.assign(i.uniforms,l),i.vertexShader=i.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vObj;
varying vec3 vObjN;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vObj = position;
vObjN = normal;`),i.fragmentShader=i.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vObj;
varying vec3 vObjN;
uniform sampler2D uGraffiti;
uniform float uProgress;
uniform vec2 uSize;
${L}`).replace("#include <map_fragment>",`#include <map_fragment>
${R}`)},t.material.needsUpdate=!0)}),n.add(s);const u=h.scene;u.scale.setScalar(.42);const f=new C;f.add(u),u.rotation.set(0,Math.PI*.5,0),n.add(f);const g=380,c=new Float32Array(g*3),b=new Float32Array(g),v=new Float32Array(g*3),P=new $;P.setAttribute("position",new V(c,3));const B=new W({color:15086120,size:.02,transparent:!0,opacity:.85,depthWrite:!1}),z=new E(P,B);z.frustumCulled=!1,n.add(z),n.position.set(m?.1:1.15,m?-1.15:.25,0),n.scale.setScalar(m?1.15:1.75),n.visible=!1,d.scene.add(n);let x=0,j=!1,y=0;const S=new A;return d.onFrame(t=>{if(!n.visible)return;y+=t,s.rotation.y=Math.sin(y*.35)*.22+(x-.5)*.4,s.position.y=Math.sin(y*.8)*.015;const i=(Math.min(1,x*1.25)-.5)*o.x*.9,k=Math.sin(x*18)*.18+.05;f.position.set(i+.12,k+.18,.62),f.rotation.set(.35,-.5,-.25+Math.sin(y*9)*(j?.03:0)),S.set(i+.02,k+.27,.48);for(let e=0;e<g;e++)b[e]<=0&&j&&Math.random()<.5&&(b[e]=.35+Math.random()*.2,c[e*3]=S.x,c[e*3+1]=S.y,c[e*3+2]=S.z,v[e*3]=(Math.random()-.6)*.5,v[e*3+1]=(Math.random()-.65)*.5,v[e*3+2]=-1.2-Math.random()*.8),b[e]>0?(b[e]-=t,c[e*3]+=v[e*3]*t,c[e*3+1]+=v[e*3+1]*t,c[e*3+2]+=v[e*3+2]*t,c[e*3+2]<.12&&(b[e]=0)):c[e*3+2]=-50;P.attributes.position.needsUpdate=!0}),{group:n,setProgress(t,i=0){x=t,l.uProgress.value=t,j=t>.01&&t<.99&&Math.abs(i)>.05,f.visible=t>.005&&t<.995},setVisible(t){n.visible=t}}}async function q(d,{onProgress:M,mobile:m=!1}={}){const p=await O(`${w}models/skater.glb`,M),h={Jacket:"#E63228",Legs:"#2A2927",Shoes:"#F2F0E9",Skateboard:"#E4DCCB",Hair:"#151515",Arm:"#D8CFC4",Head:"#D8CFC4"};p.scene.traverse(a=>{if(!a.isMesh)return;const o=a.material.name||"",u=Object.keys(h).find(f=>o.startsWith(f));if(o.includes("Ink")){a.material=new F({color:1381653,side:U});return}u&&(a.material=a.material.clone(),a.material.color.set(h[u]),a.material.map=null,a.material.needsUpdate=!0),(o.startsWith("Chain")||o.startsWith("Necklace")||o.startsWith("Earring"))&&(a.material.metalness=1,a.material.roughness=.25)});const r=new C;r.add(p.scene),p.scene.rotation.y=-Math.PI*.5,r.scale.setScalar(1.05),r.visible=!1,d.scene.add(r);const l=new D(16773604,1.6);l.position.set(-2,3,6),l.target=r,r.add(l);let n=0,s=0;return d.onFrame(a=>{r.visible&&(n+=a,r.position.set((m?.3:1.75)+(1-s)*4.6,(m?.9:1.08)+Math.abs(Math.sin(n*6))*.01*(1-s),.3),r.rotation.z=(1-s)*.04*Math.sin(n*8),r.rotation.y=.35*s)}),{group:r,setProgress(a){s=a},setVisible(a){r.visible=a}}}export{Y as createDrop,q as createSkater};
