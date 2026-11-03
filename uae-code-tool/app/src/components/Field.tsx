import { useEffect, useRef } from 'react'

/* Holographic silk field: seven threads in UAE flag colours (red, green, white, black) with an iridescent sheen.
   WebGL fragment shader; falls back to a static gradient when WebGL is unavailable. Static frame under reduced motion. */
const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
const FS = `precision highp float;
uniform vec2 R; uniform float T; uniform vec2 M; uniform float DARK; uniform float INT;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int k=0;k<4;k++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
vec3 holo(float t){return .55+.45*cos(6.2831*(t+vec3(0.,.33,.67)));}
void main(){
  vec2 uv=gl_FragCoord.xy/R; float asp=R.x/R.y; vec2 q=vec2(uv.x*asp,uv.y);
  vec3 pal[7]; pal[0]=vec3(.78,.06,.18); pal[1]=vec3(0.,.52,.24); pal[2]=vec3(.96,.95,.92); pal[3]=vec3(.10,.10,.11);
  pal[4]=vec3(.86,.25,.30); pal[5]=vec3(.20,.66,.40); pal[6]=vec3(.75,.58,.24);
  float base[7]; base[0]=.18; base[1]=.34; base[2]=.47; base[3]=.58; base[4]=.70; base[5]=.82; base[6]=.26;
  vec3 col=vec3(0.); float acc=0.;
  for(int i=0;i<7;i++){
    float fi=float(i); float sp=.045+.012*fi; float ph=fi*1.7;
    float y=base[i]+.16*(fbm(vec2(q.x*.9+T*sp+ph,fi*3.1+T*.02))-.5)+.10*sin(q.x*1.3+ph+T*.08)+(M.y-.5)*.04*(1.+fi*.15)+(q.x-.5*asp)*(.12-.03*fi);
    float w=.028+.012*fbm(vec2(q.x*2.+fi,T*.05));
    float d=abs(q.y-y);
    float a=smoothstep(w,0.,d)*(.55+.45*fbm(vec2(q.x*3.+T*.1+fi,fi)));
    float sheen=pow(smoothstep(w,0.,abs(d-w*.35)),2.)*.9;
    float ir=fbm(vec2(q.x*1.6-T*.12+fi*.5,q.y*2.))+(q.x-q.y)*.25;
    float band=smoothstep(.35,.75,fbm(vec2(q.x*2.2-T*.15+fi,q.y*3.+fi)));
    vec3 c=mix(pal[i],holo(ir),.14+.5*sheen*band);
    c=mix(c,c*1.15+.06,sheen*.6);
    a*=INT; if(DARK>.5){a*=.85;} 
    col=col*(1.-a)+c*a; acc=acc+a*(1.-acc);
  }
  float vig=smoothstep(1.25,.3,length(uv-.5));
  float alpha=clamp(acc*vig,0.,1.);
  vec3 oc=col/max(acc,1e-4);
  if(DARK>.5){oc=oc*.95;} else {oc=mix(oc,vec3(1.),.05);}
  float g=(hash(gl_FragCoord.xy+fract(T))-.5)*.025;
  gl_FragColor=vec4((oc+g)*alpha,alpha);
}`

export function Field({ intensity = 0.6, className = '' }: { intensity?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!; let gl: WebGLRenderingContext | null = null
    try { gl = cv.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true }) } catch { /* no webgl */ }
    if (!gl) { cv.style.background = 'linear-gradient(120deg, rgba(200,16,46,.18), rgba(0,132,61,.18) 45%, rgba(182,138,53,.18))'; return }
    const g = gl
    const sh = (t: number, src: string) => { const x = g.createShader(t)!; g.shaderSource(x, src); g.compileShader(x); return x }
    const prog = g.createProgram()!; g.attachShader(prog, sh(g.VERTEX_SHADER, VS)); g.attachShader(prog, sh(g.FRAGMENT_SHADER, FS)); g.linkProgram(prog); g.useProgram(prog)
    const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW)
    const loc = g.getAttribLocation(prog, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0)
    const u = { R: g.getUniformLocation(prog, 'R'), T: g.getUniformLocation(prog, 'T'), M: g.getUniformLocation(prog, 'M'), DARK: g.getUniformLocation(prog, 'DARK'), INT: g.getUniformLocation(prog, 'INT') }
    g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA)
    let mouse = [0.5, 0.5], target = [0.5, 0.5], raf = 0, running = true
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const resize = () => { const dpr = Math.min(devicePixelRatio || 1, 1.5); const r = cv.getBoundingClientRect(); cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); g.viewport(0, 0, cv.width, cv.height) }
    const t0 = performance.now()
    const frame = () => {
      if (!running) return
      mouse = [mouse[0] + (target[0] - mouse[0]) * .04, mouse[1] + (target[1] - mouse[1]) * .04]
      g.uniform2f(u.R, cv.width, cv.height); g.uniform1f(u.T, (performance.now() - t0) / 1000); g.uniform2f(u.M, mouse[0], mouse[1])
      g.uniform1f(u.DARK, document.documentElement.classList.contains('dark') ? 1 : 0); g.uniform1f(u.INT, intensity)
      g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT); g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
      if (!reduced) raf = requestAnimationFrame(frame)
    }
    const onMove = (e: PointerEvent) => { target = [e.clientX / innerWidth, 1 - e.clientY / innerHeight] }
    const onVis = () => { if (!document.hidden && running && !reduced) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame) } }
    resize(); frame(); cv.classList.add('on')
    addEventListener('resize', resize); addEventListener('pointermove', onMove, { passive: true }); document.addEventListener('visibilitychange', onVis)
    const ro = new ResizeObserver(resize); ro.observe(cv)
    return () => { running = false; cancelAnimationFrame(raf); removeEventListener('resize', resize); removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis); ro.disconnect() }
  }, [intensity])
  return <canvas ref={ref} className={`field ${className}`} aria-hidden="true" />
}
