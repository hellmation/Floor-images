import { useEffect, useRef, type RefObject } from 'react'

/* "Seven Threads" silk field, ported from the Mudawwana splash shader (same geometry, motion, lighting and mouse response),
   with the palette moved toward the UAE flag: green, red, gold, pearl white and charcoal, in a holographic register.
   WebGL fragment shader; gradient fallback without WebGL; one still frame under reduced motion. */
const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
const FS = `precision highp float;
uniform vec2 R;uniform float T;uniform vec2 M;uniform float MS;uniform float CONV;uniform float DARK;uniform vec2 WH;uniform float INT;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
  vec2 uv=gl_FragCoord.xy/R; float asp=R.x/R.y;
  float ang=-0.32; mat2 rot=mat2(cos(ang),-sin(ang),sin(ang),cos(ang));
  vec2 q=rot*vec2((uv.x-0.5)*asp,uv.y-0.5);
  vec2 mq=rot*vec2((M.x-0.5)*asp,M.y-0.5); float md=length(q-mq); float push=exp(-md*md*22.)*0.035*MS;
  vec2 wq=rot*vec2((WH.x-0.5)*asp,WH.y-0.5); float wd=length(q-wq); float bend=exp(-wd*wd*60.)*0.02;
  vec3 col=vec3(0.); float acc=0.;
  vec3 pal[7];
  pal[0]=vec3(0.300,0.780,0.550); pal[1]=vec3(0.920,0.350,0.420); pal[2]=vec3(0.886,0.761,0.478); pal[3]=vec3(0.880,0.900,0.940); pal[4]=vec3(0.450,0.470,0.520); pal[5]=vec3(0.250,0.720,0.500); pal[6]=vec3(0.860,0.250,0.330);
  vec3 hi[7]; hi[0]=vec3(0.700,0.940,0.820); hi[1]=vec3(0.990,0.720,0.760); hi[2]=vec3(0.961,0.890,0.690); hi[3]=vec3(0.980,0.980,1.000); hi[4]=vec3(0.780,0.800,0.860); hi[5]=vec3(0.660,0.920,0.800); hi[6]=vec3(0.980,0.660,0.700);
  for(int i=0;i<7;i++){
    float fi=float(i); float ph=fi*1.7; float base=-0.42+fi*0.14;
    float y=base+0.08*sin(q.x*1.6+T*0.045+ph)+0.045*sin(q.x*3.1-T*0.03+ph*2.3)+0.02*noise(vec2(q.x*2.+fi,T*0.02));
    y+=push*sign(q.y-y)+bend*sign(q.y-y); y=mix(y,0.0,CONV*CONV);
    float w=0.012+0.009*sin(q.x*2.2+T*0.05+ph)+0.004*noise(vec2(q.x*5.+fi*3.,T*0.03)); w*=1.0-0.7*CONV;
    float d=abs(q.y-y); float body=1.0-smoothstep(w*0.55,w,d);
    float sh=sqrt(max(0.,1.0-pow(d/max(w,1e-4),2.))); float light=mix(1.0,0.55+0.45*sh*(0.6+0.4*sign(q.y-y)),mix(0.5,1.0,DARK));
    float a=body*(0.11+0.07*sin(q.x*0.9+T*0.02+ph))*mix(1.6,2.9,DARK)*(1.0-CONV*0.9)*INT;
    vec3 dk=(i==1||i==6)?vec3(0.70,0.22,0.28):(i==0||i==5)?vec3(0.16,0.55,0.36):(i==2)?vec3(0.84,0.64,0.26):(i==3)?vec3(0.70,0.74,0.82):vec3(0.35,0.37,0.42);
    vec3 dh=(i==1||i==6)?vec3(1.0,0.70,0.74):(i==0||i==5)?vec3(0.70,0.95,0.80):(i==2)?vec3(1.0,0.92,0.66):(i==3)?vec3(0.97,0.98,1.0):vec3(0.80,0.82,0.88);
    float edge=sh*(0.65+0.35*sign(q.y-y)); float spec=pow(sh,6.0)*(0.5+0.5*sin(q.x*7.0+T*0.06+ph));
    vec3 lc=mix(pal[i],hi[i],edge); vec3 dc=mix(dk,dh,edge*0.8+spec*0.6); vec3 c=mix(lc,dc,DARK)*light;
    col=col*(1.0-a)+c*a; acc=acc+a*(1.0-acc);
  }
  float g=(hash(gl_FragCoord.xy+fract(T))-0.5)*0.03; float vig=smoothstep(1.3,0.35,length(uv-0.5))*smoothstep(0.03,0.24,uv.y)*smoothstep(1.0,0.9,uv.y);
  float alpha=clamp(acc*vig+abs(g),0.,1.); vec3 oc=mix(col/max(acc,1e-4),col,DARK); gl_FragColor=vec4((oc+g)*alpha,alpha);
}`

export function Field({ intensity = 1, className = '', anchorRef, parallaxRef }: { intensity?: number; className?: string; anchorRef?: RefObject<HTMLElement | null>; parallaxRef?: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!; let gl: WebGLRenderingContext | null = null
    try { gl = cv.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true }) } catch { /* no webgl */ }
    if (!gl) { cv.style.background = 'radial-gradient(ellipse at 30% 20%, rgba(182,138,53,.14), transparent 60%)'; cv.classList.add('on'); return }
    const g = gl
    const sh = (t: number, src: string) => { const x = g.createShader(t)!; g.shaderSource(x, src); g.compileShader(x); return x }
    const prog = g.createProgram()!; g.attachShader(prog, sh(g.VERTEX_SHADER, VS)); g.attachShader(prog, sh(g.FRAGMENT_SHADER, FS)); g.linkProgram(prog); g.useProgram(prog)
    const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW)
    const loc = g.getAttribLocation(prog, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0)
    const U: Record<string, WebGLUniformLocation | null> = {}; ['R', 'T', 'M', 'MS', 'CONV', 'DARK', 'WH', 'INT'].forEach(n => { U[n] = g.getUniformLocation(prog, n) })
    g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA)
    const st = { mouse: [0.5, 0.5], target: [0.5, 0.5], ms: 0, running: true, raf: 0 }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const resize = () => { const dpr = Math.min(devicePixelRatio || 1, 1.5); const r = cv.getBoundingClientRect(); cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); g.viewport(0, 0, cv.width, cv.height) }
    const t0 = performance.now()
    const draw = (t: number) => {
      const cr = cv.getBoundingClientRect(); let wh: [number, number] = [0.5, 0.62]
      const a = anchorRef?.current; if (a) { const r = a.getBoundingClientRect(); wh = [((r.left + r.width / 2) - cr.left) / Math.max(1, cr.width), 1 - ((r.top + r.height / 2) - cr.top) / Math.max(1, cr.height)] }
      g.uniform2f(U.R, cv.width, cv.height); g.uniform1f(U.T, t); g.uniform2f(U.M, st.mouse[0], st.mouse[1]); g.uniform1f(U.MS, Math.max(0, st.ms)); g.uniform1f(U.CONV, 0)
      g.uniform1f(U.DARK, document.documentElement.classList.contains('dark') ? 1 : 0); g.uniform2f(U.WH, wh[0], wh[1]); g.uniform1f(U.INT, intensity)
      g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT); g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
    }
    const frame = (now: number) => {
      if (!st.running || document.hidden) return
      st.mouse[0] += (st.target[0] - st.mouse[0]) * 0.08; st.mouse[1] += (st.target[1] - st.mouse[1]) * 0.08; st.ms += (0 - st.ms) * 0.02
      draw((now - t0) / 1000)
      const p = parallaxRef?.current; if (p) { const tx = Math.round((st.mouse[0] - 0.5) * 20) / 10, ty = Math.round((0.5 - st.mouse[1]) * 20) / 10; const v = `translate(${tx}px, ${ty}px)`; if (p.style.transform !== v) p.style.transform = v }
      st.raf = requestAnimationFrame(frame)
    }
    const onMove = (e: PointerEvent) => { const cr = cv.getBoundingClientRect(); st.target = [(e.clientX - cr.left) / Math.max(1, cr.width), 1 - (e.clientY - cr.top) / Math.max(1, cr.height)]; st.ms = 1 }
    const onVis = () => { if (!document.hidden && st.running && !reduced) { cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(frame) } }
    resize(); if (reduced) draw(0); else st.raf = requestAnimationFrame(frame); cv.classList.add('on')
    addEventListener('resize', resize); addEventListener('pointermove', onMove, { passive: true }); document.addEventListener('visibilitychange', onVis)
    const ro = new ResizeObserver(resize); ro.observe(cv)
    return () => { st.running = false; cancelAnimationFrame(st.raf); removeEventListener('resize', resize); removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis); ro.disconnect() }
  }, [intensity, anchorRef, parallaxRef])
  return <canvas ref={ref} className={`field ${className}`} aria-hidden="true" />
}
