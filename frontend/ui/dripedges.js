// Chapter colour runs down into the next chapter as paint drips, scrubbed by scroll.
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const NS = 'http://www.w3.org/2000/svg';

export function dripEdges(root = document, { reduced = false } = {}) {
  const sections = [...root.querySelectorAll('[data-drip]')];
  sections.forEach((sec, si) => {
    const color = sec.dataset.drip && sec.dataset.drip.startsWith('#') ? sec.dataset.drip : (sec.dataset.field || '#151515');
    const edge = document.createElement('div');
    edge.className = 'drip-edge';
    edge.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('preserveAspectRatio', 'none');
    edge.appendChild(svg);
    sec.after(edge);
    let drips = [];
    function build() {
      const W = sec.clientWidth;
      const maxH = Math.min(260, window.innerHeight * 0.32);
      svg.setAttribute('viewBox', `0 0 ${W} ${maxH}`);
      svg.style.height = `${maxH}px`;
      svg.innerHTML = '';
      const band = document.createElementNS(NS, 'path');
      let d = `M0 0 H${W} V10`;
      for (let x = W; x >= 0; x -= 40) d += ` Q${x - 20} ${14 + ((x * 7 + si * 13) % 9)} ${x - 40} 10`;
      band.setAttribute('d', `${d} Z`);
      band.setAttribute('fill', color);
      svg.appendChild(band);
      drips = [];
      const n = Math.round(W / 70);
      for (let i = 0; i < n; i++) {
        const seed = (i * 97 + si * 31) % 101;
        const w = 6 + (seed % 7) * 2.2;
        const x = (i + 0.5) * (W / n) + ((seed % 9) - 4) * 4;
        const len = 18 + ((seed * 13) % 100) / 100 * (maxH - 30);
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('fill', color);
        svg.appendChild(p);
        drips.push({ p, x, w, len, delay: (seed % 10) / 25 });
      }
      update(st ? st.progress : 0);
    }
    function update(prog) {
      drips.forEach((dr) => {
        const k = reduced ? 1 : Math.max(0, Math.min(1, (prog - dr.delay) / (1 - dr.delay)));
        const L = 10 + dr.len * k * k;
        const r = dr.w / 2;
        dr.p.setAttribute('d', `M${dr.x - r} 0 V${L} A${r} ${r} 0 0 0 ${dr.x + r} ${L} V0 Z M${dr.x} ${L} m${-r * 1.25} 0 a${r * 1.25} ${r * 1.25} 0 1 0 ${r * 2.5} 0 a${r * 1.25} ${r * 1.25} 0 1 0 ${-r * 2.5} 0`);
      });
    }
    const st = reduced ? null : ScrollTrigger.create({ trigger: sec, start: 'bottom 95%', end: 'bottom 35%', scrub: 0.6, onUpdate: (self) => update(self.progress) });
    build();
    new ResizeObserver(build).observe(sec);
  });
}
