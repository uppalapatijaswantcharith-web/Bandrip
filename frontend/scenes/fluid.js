// Hero smoke: a small GPU fluid solver (WebGL2). The cursor stirs the rendered haze;
// holding the pointer sprays signal-red paint into the flow. Written for BANDRIP.
const VERT = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv, vL, vR, vT, vB;
uniform vec2 uTexel;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0); vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y); vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = {
  splat: `
    uniform sampler2D uTarget; uniform float uAspect; uniform vec2 uPoint; uniform vec3 uColor; uniform float uRadius;
    void main() {
      vec2 p = vUv - uPoint; p.x *= uAspect;
      vec3 s = exp(-dot(p, p) / uRadius) * uColor;
      o = vec4(texture(uTarget, vUv).xyz + s, 1.0);
    }`,
  advect: `
    uniform sampler2D uVel; uniform sampler2D uSrc; uniform vec2 uSimTexel; uniform float uDt; uniform float uDiss;
    void main() {
      vec2 c = vUv - uDt * texture(uVel, vUv).xy * uSimTexel;
      o = texture(uSrc, c) / (1.0 + uDiss * uDt);
    }`,
  curl: `
    uniform sampler2D uVel;
    void main() {
      float L = texture(uVel, vL).y, R = texture(uVel, vR).y, T = texture(uVel, vT).x, B = texture(uVel, vB).x;
      o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
    }`,
  vort: `
    uniform sampler2D uVel; uniform sampler2D uCurl; uniform float uCurlK; uniform float uDt;
    void main() {
      float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x, C = texture(uCurl, vUv).x;
      vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      f /= length(f) + 1e-4; f *= uCurlK * C; f.y *= -1.0;
      vec2 v = texture(uVel, vUv).xy + f * uDt;
      o = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
    }`,
  div: `
    uniform sampler2D uVel;
    void main() {
      float L = texture(uVel, vL).x, R = texture(uVel, vR).x, T = texture(uVel, vT).y, B = texture(uVel, vB).y;
      vec2 C = texture(uVel, vUv).xy;
      if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x; if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
      o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }`,
  pressure: `
    uniform sampler2D uP; uniform sampler2D uDiv;
    void main() {
      float L = texture(uP, vL).x, R = texture(uP, vR).x, T = texture(uP, vT).x, B = texture(uP, vB).x;
      o = vec4((L + R + B + T - texture(uDiv, vUv).x) * 0.25, 0.0, 0.0, 1.0);
    }`,
  grad: `
    uniform sampler2D uP; uniform sampler2D uVel;
    void main() {
      float L = texture(uP, vL).x, R = texture(uP, vR).x, T = texture(uP, vT).x, B = texture(uP, vB).x;
      o = vec4(texture(uVel, vUv).xy - vec2(R - L, T - B), 0.0, 1.0);
    }`,
  scale: `
    uniform sampler2D uSrc; uniform float uK;
    void main() { o = texture(uSrc, vUv) * uK; }`,
  display: `
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
    }`,
};

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function program(gl, frag) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, `#version 300 es\nprecision highp float;\nin vec2 vUv, vL, vR, vT, vB;\nout vec4 o;\n${frag}`));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

export function createFluid(canvas, { bgUrl, reduced = false, mobile = false } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
  gl.getExtension('OES_texture_float_linear');
  const P = Object.fromEntries(Object.entries(FRAG).map(([k, f]) => [k, program(gl, f)]));
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const SIM = mobile ? 96 : 140;
  const DYE = mobile ? 384 : 640;
  function fbo(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fb, w, h };
  }
  const dbl = (w, h) => { let a = fbo(w, h); let b = fbo(w, h); return { get r() { return a; }, get w() { return b; }, swap() { [a, b] = [b, a]; } }; };

  let simW; let simH; let dyeW; let dyeH; let vel; let dye; let div; let curl; let pres;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    const asp = canvas.width / canvas.height;
    simW = asp >= 1 ? Math.round(SIM * asp) : SIM; simH = asp >= 1 ? SIM : Math.round(SIM / asp);
    dyeW = asp >= 1 ? Math.round(DYE * asp) : DYE; dyeH = asp >= 1 ? DYE : Math.round(DYE / asp);
    vel = dbl(simW, simH); dye = dbl(dyeW, dyeH); pres = dbl(simW, simH);
    div = fbo(simW, simH); curl = fbo(simW, simH);
  }
  resize();

  // background haze texture
  const bg = gl.createTexture();
  let bgAspect = 16 / 9;
  gl.bindTexture(gl.TEXTURE_2D, bg);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([233, 222, 211, 255]));
  const img = new Image();
  img.decoding = 'async';
  const bgReady = new Promise((res) => {
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, bg);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
      bgAspect = img.width / img.height;
      res();
    };
    img.onerror = () => res();
  });
  img.src = bgUrl;

  function pass(prog, target, setup) {
    gl.useProgram(prog.p);
    const w = target ? target.w : canvas.width;
    const h = target ? target.h : canvas.height;
    gl.uniform2f(prog.u.uTexel, 1 / w, 1 / h);
    setup?.(prog.u);
    gl.viewport(0, 0, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  let unit = 0;
  const bind = (loc, tex) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unit); unit += 1; };

  function splat(x, y, dx, dy, color, radius = 0.0022) {
    unit = 0;
    pass(P.splat, vel.w, (u) => { bind(u.uTarget, vel.r.tex); gl.uniform1f(u.uAspect, canvas.width / canvas.height); gl.uniform2f(u.uPoint, x, y); gl.uniform3f(u.uColor, dx, dy, 0); gl.uniform1f(u.uRadius, radius); });
    vel.swap();
    unit = 0;
    pass(P.splat, dye.w, (u) => { bind(u.uTarget, dye.r.tex); gl.uniform1f(u.uAspect, canvas.width / canvas.height); gl.uniform2f(u.uPoint, x, y); gl.uniform3f(u.uColor, ...color); gl.uniform1f(u.uRadius, radius * 0.9); });
    dye.swap();
  }

  function step(dt) {
    const texel = [1 / simW, 1 / simH];
    unit = 0; pass(P.curl, curl, (u) => { gl.uniform2f(u.uTexel, ...texel); bind(u.uVel, vel.r.tex); });
    unit = 0; pass(P.vort, vel.w, (u) => { gl.uniform2f(u.uTexel, ...texel); bind(u.uVel, vel.r.tex); bind(u.uCurl, curl.tex); gl.uniform1f(u.uCurlK, 22); gl.uniform1f(u.uDt, dt); }); vel.swap();
    unit = 0; pass(P.div, div, (u) => { gl.uniform2f(u.uTexel, ...texel); bind(u.uVel, vel.r.tex); });
    unit = 0; pass(P.scale, pres.w, (u) => { bind(u.uSrc, pres.r.tex); gl.uniform1f(u.uK, 0.8); }); pres.swap();
    for (let i = 0; i < (mobile ? 12 : 20); i++) {
      unit = 0; pass(P.pressure, pres.w, (u) => { gl.uniform2f(u.uTexel, ...texel); bind(u.uP, pres.r.tex); bind(u.uDiv, div.tex); }); pres.swap();
    }
    unit = 0; pass(P.grad, vel.w, (u) => { gl.uniform2f(u.uTexel, ...texel); bind(u.uP, pres.r.tex); bind(u.uVel, vel.r.tex); }); vel.swap();
    unit = 0; pass(P.advect, vel.w, (u) => { bind(u.uVel, vel.r.tex); bind(u.uSrc, vel.r.tex); gl.uniform2f(u.uSimTexel, ...texel); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uDiss, 0.35); }); vel.swap();
    unit = 0; pass(P.advect, dye.w, (u) => { bind(u.uVel, vel.r.tex); bind(u.uSrc, dye.r.tex); gl.uniform2f(u.uSimTexel, ...texel); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uDiss, 0.9); }); dye.swap();
  }

  let time = 0;
  function render() {
    const asp = canvas.width / canvas.height;
    const sc = asp > bgAspect ? [1, bgAspect / asp] : [asp / bgAspect, 1];
    unit = 0;
    pass(P.display, null, (u) => { bind(u.uDye, dye.r.tex); bind(u.uVel, vel.r.tex); bind(u.uBg, bg); gl.uniform2f(u.uBgScale, sc[0], sc[1]); gl.uniform1f(u.uTime, time % 100); });
  }

  // input
  const ptr = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, down: false, moved: false };
  let ambientT = 0;
  function frame(dt) {
    time += dt;
    if (!reduced) {
      if (ptr.moved) {
        const dx = (ptr.x - ptr.px) * 6000;
        const dy = (ptr.y - ptr.py) * 6000;
        splat(ptr.x, ptr.y, dx, dy, ptr.down ? [0.0, 0.0, 0.0] : [0.0, 0.10, 0.05], 0.0016);
        ptr.px = ptr.x; ptr.py = ptr.y; ptr.moved = false;
      }
      if (ptr.down) {
        // spray: dense red paint with a forward puff
        const a = Math.random() * Math.PI * 2;
        splat(ptr.x + Math.cos(a) * 0.003, ptr.y + Math.sin(a) * 0.003, Math.cos(a) * 90, Math.sin(a) * 90 + 40, [0.16, 0.0, 0.0], 0.00045);
      }
      ambientT -= dt;
      if (ambientT <= 0) {
        ambientT = 0.9 + Math.random() * 1.4;
        const x = 0.15 + Math.random() * 0.7;
        splat(x, 0.02, (Math.random() - 0.5) * 220, 260 + Math.random() * 260, Math.random() < 0.35 ? [0.16, 0.05, 0.0] : [0.0, 0.08, 0.10], 0.006);
      }
      step(Math.min(dt, 1 / 30));
    }
    render();
  }

  return {
    ready: bgReady,
    frame,
    pointer(x, y) { ptr.x = x; ptr.y = y; ptr.moved = true; },
    press(v) { ptr.down = v; },
    resize,
    dispose() { gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}
