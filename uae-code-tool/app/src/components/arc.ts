/* Ring geometry shared by the donut charts and the progress rings, so every ring in the tool has the same shape. */
/** Rounded annular sector (ECharts-style borderRadius on a pie slice). Angles in radians, clockwise from 12 o'clock. */
export function sector(cx: number, cy: number, rIn: number, rOut: number, a0: number, a1: number, rad: number): string {
  const span = a1 - a0; if (span <= 0) return ''
  // a full turn has the same start and end point, which an arc cannot express: draw the ring as two half-turns, outer clockwise and inner back
  if (span >= Math.PI * 2 - 0.001) { const o = rOut.toFixed(2), i = rIn.toFixed(2)
    return `M${cx},${cy - rOut} A${o},${o} 0 1 1 ${cx},${cy + rOut} A${o},${o} 0 1 1 ${cx},${cy - rOut} Z M${cx},${cy - rIn} A${i},${i} 0 1 0 ${cx},${cy + rIn} A${i},${i} 0 1 0 ${cx},${cy - rIn} Z` }
  const pt = (r: number, a: number): [number, number] => [cx + r * Math.sin(a), cy - r * Math.cos(a)]
  const rc = Math.min(rad, (rOut - rIn) / 2, (span * rIn) / 2.2)
  const dO = Math.asin(Math.min(1, rc / (rOut - rc))), dI = Math.asin(Math.min(1, rc / (rIn + rc)))
  if (span < 2 * Math.max(dO, dI) + 0.02) { // too thin to round: plain sector
    const [x0, y0] = pt(rOut, a0), [x1, y1] = pt(rOut, a1), [x2, y2] = pt(rIn, a1), [x3, y3] = pt(rIn, a0); const la = span > Math.PI ? 1 : 0
    return `M${x0},${y0} A${rOut},${rOut} 0 ${la} 1 ${x1},${y1} L${x2},${y2} A${rIn},${rIn} 0 ${la} 0 ${x3},${y3} Z`
  }
  const eO = Math.sqrt((rOut - rc) ** 2 - rc ** 2), eI = Math.sqrt((rIn + rc) ** 2 - rc ** 2)
  const la = (a1 - a0 - 2 * dO) > Math.PI ? 1 : 0, li = (a1 - a0 - 2 * dI) > Math.PI ? 1 : 0
  const P = [pt(eI, a0), pt(eO, a0), pt(rOut, a0 + dO), pt(rOut, a1 - dO), pt(eO, a1), pt(eI, a1), pt(rIn, a1 - dI), pt(rIn, a0 + dI)]
  const f = (q: [number, number]) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`
  return `M${f(P[0])} L${f(P[1])} A${rc},${rc} 0 0 1 ${f(P[2])} A${rOut},${rOut} 0 ${la} 1 ${f(P[3])} A${rc},${rc} 0 0 1 ${f(P[4])} L${f(P[5])} A${rc},${rc} 0 0 1 ${f(P[6])} A${rIn},${rIn} 0 ${li} 0 ${f(P[7])} A${rc},${rc} 0 0 1 ${f(P[0])} Z`
}
