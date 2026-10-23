import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, Envelope, Stage, clamp, swing } from './shared.jsx';

// Compare & negotiate: three offer tags drop onto a rail, calls and emails knock them about and
// strike their fees, two offers fall away and the last one gets a "Below MSRP" sticker slapped on.
const RAIL = 40, STRING = 52, SCALE = 1.3;
const TAGS = [{ x: 172, name: 'Offer A' }, { x: 480, name: 'Offer B' }, { x: 788, name: 'Offer C' }];
// Each hit: which tag, when it lands, and a phone or email bubble.
const HITS = [
  { tag: 0, at: 30, icon: 'phone' }, { tag: 1, at: 38, icon: 'mail' }, { tag: 2, at: 46, icon: 'phone' },
  { tag: 1, at: 56, icon: 'phone' }, { tag: 0, at: 63, icon: 'mail' }, { tag: 2, at: 70, icon: 'mail' }, { tag: 1, at: 78, icon: 'mail' },
];
const FLIGHT = 13, DROP = 90, SLAP = 108;

const Bubble = ({ icon }) => (
  <g>
    <path d="M-34 -24h68a8 8 0 0 1 8 8v28a8 8 0 0 1-8 8H-6l-12 12v-12h-16a8 8 0 0 1-8-8v-28a8 8 0 0 1 8-8Z" fill={C.ink} />
    {icon === 'mail'
      ? <g transform="translate(0 -2) scale(.72)"><Envelope fill={C.ink} stroke={C.paper} /></g>
      : <path transform="translate(-11 -14) scale(1.15)" fill={C.paper} d="M5.6 1.4 8.3 4c.7.7.7 1.8 0 2.5L6.7 8.1a11.6 11.6 0 0 0 5.2 5.2l1.6-1.6c.7-.7 1.8-.7 2.5 0l2.6 2.7c.7.7.7 1.8 0 2.5l-1.5 1.5c-1 1-2.6 1.3-3.9.7A19.6 19.6 0 0 1 2 7.9c-.6-1.3-.3-2.9.7-3.9l1.4-1.5c.7-.7 1.8-.7 2.5-1.1Z" />}
  </g>
);

const Sticker = ({ frame, fps }) => {
  const slap = spring({ frame, fps, config: { damping: 9, stiffness: 220, mass: .6 } });
  const s = interpolate(slap, [0, 1], [2.6, 1]);
  const squash = 1 + Math.max(0, 1 - s) * .9;
  return (
    <g transform={`translate(70 ${STRING + 128}) rotate(-12) scale(${s * squash} ${s / squash})`} opacity={interpolate(slap, [0, .25], [0, 1], clamp)}>
      <circle r={70} fill={C.green} />
      <circle r={60} fill="none" stroke={C.paper} strokeWidth={2} strokeDasharray="4 6" opacity={.7} />
      <text y={-5} textAnchor="middle" fontFamily="Barlow" fontWeight={600} fontSize={29} fill={C.paper}>Below</text>
      <text y={25} textAnchor="middle" fontFamily="Barlow" fontWeight={600} fontSize={29} letterSpacing={1} fill={C.paper}>MSRP</text>
    </g>
  );
};

export const Negotiate = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f => (frame - f) / fps;

  return (
    <Stage>
      <path d={`M40 ${RAIL}H920`} stroke={C.ink} strokeWidth={5} strokeLinecap="round" />

      {TAGS.map((tag, i) => {
        const dropIn = spring({ frame: frame - 2 - i * 5, fps, config: { damping: 13, stiffness: 120 } });
        const hits = HITS.filter(h => h.tag === i);
        const landed = hits.filter(h => frame >= h.at + FLIGHT);
        const winner = i === 1;
        let angle = swing(t(2 + i * 5 + 8), i === 1 ? -6 : 8);
        hits.forEach((h, n) => { angle += swing(t(h.at + FLIGHT), (n % 2 ? -1 : 1) * (i === 2 ? -11 : 11)); });
        // Losing offers fall off the rail; the winner grows a little.
        const fall = winner ? 0 : interpolate(frame, [DROP + (i ? 4 : 0), DROP + 22 + (i ? 4 : 0)], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
        if (!winner) angle += fall * (i === 0 ? -28 : 28);
        else angle += swing(t(SLAP + 3), 5);
        const grow = winner ? 1 + spring({ frame: frame - DROP - 6, fps, config: { damping: 14 } }) * .06 : 1;
        const priceWidth = 112 - landed.length * (winner ? 14 : 8) - (winner ? spring({ frame: frame - DROP - 6, fps, config: { damping: 200 } }) * 10 : 0);
        const y = interpolate(dropIn, [0, 1], [-420, 0]) + fall * 520;
        const struck = landed.length;
        return (
          <g key={i} opacity={1 - fall * .9} transform={`translate(${tag.x} ${RAIL + y}) rotate(${angle}) scale(${grow * SCALE})`}>
            <path d={`M0 0V${STRING}`} stroke={C.ink} strokeWidth={2.5} />
            <g transform={`translate(0 ${STRING})`}>
              <path d="M-34 -10H34L92 34V236a10 10 0 0 1-10 10H-82a10 10 0 0 1-10-10V34Z" fill={C.paper} stroke={C.green} strokeWidth={3} strokeLinejoin="round" />
              <circle cy={6} r={8} fill={C.sage} stroke={C.green} strokeWidth={3} />
              <text x={-66} y={70} fontFamily="Barlow" fontWeight={600} fontSize={28} fill={C.ink}>{tag.name}</text>
              <path d="M-66 86H66" stroke={C.line} strokeWidth={2.5} />
              <text x={-66} y={114} fontFamily="Inter" fontSize={15} fill={C.muted}>Car price</text>
              <rect x={-66} y={126} width={Math.max(priceWidth, 40)} height={20} rx={3} fill={C.ink} />
              <text x={-66} y={176} fontFamily="Inter" fontSize={15} fill={C.muted}>Fees</text>
              {[120, 92, 106].map((w, n) => {
                const strike = n < struck ? spring({ frame: frame - hits[n].at - FLIGHT, fps, config: { damping: 200 }, durationInFrames: 8 }) : 0;
                const gone = n < struck ? interpolate(frame, [hits[n].at + FLIGHT + 8, hits[n].at + FLIGHT + 16], [1, .25], clamp) : 1;
                return (
                  <g key={n}>
                    <rect x={-66} y={188 + n * 18} width={w} height={9} rx={2} fill="#B9BCB6" opacity={gone} />
                    {strike > 0 && <path d={`M-72 ${192.5 + n * 18}h${(w + 12) * strike}`} stroke={C.green} strokeWidth={4} strokeLinecap="round" />}
                  </g>
                );
              })}
            </g>
            {winner && frame >= SLAP && <Sticker frame={frame - SLAP} fps={fps} />}
          </g>
        );
      })}

      {/* Calls and emails thrown up from below. */}
      {HITS.map((h, n) => {
        if (frame < h.at || frame > h.at + FLIGHT + 4) return null;
        const p = interpolate(frame, [h.at, h.at + FLIGHT], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
        const fromX = 480 + (n % 2 ? 120 : -120);
        const x = interpolate(p, [0, 1], [fromX, TAGS[h.tag].x]);
        const y = interpolate(p, [0, 1], [640, RAIL + (STRING + 150) * SCALE]) - Math.sin(p * Math.PI) * 40;
        const pop = interpolate(frame, [h.at + FLIGHT, h.at + FLIGHT + 4], [1, 0], clamp);
        return <g key={n} transform={`translate(${x} ${y}) scale(${(.7 + p * .3) * (1 + (1 - pop) * .4) * SCALE}) rotate(${(1 - p) * (n % 2 ? 14 : -14)})`} opacity={pop}><Bubble icon={h.icon} /></g>;
      })}

    </Stage>
  );
};
