import { Easing, interpolate, interpolateColors, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, Envelope, Sprite, Stage, clamp } from './shared.jsx';

// Search & outreach: type the search, whip-pan a lot of grey cars while an envelope lands on
// each one, and lock the viewfinder on the one blue Miata.
const QUERY = 'Mariner Blue Miata, manual';
const GROUND = 470, CENTER = 480, SPACING = 560, CAR = 1.3;

// Side-view silhouettes in a 400 × 154 box, ground at y = 154: body, windows, wheels [x, r].
const CARS = {
  sedan: ['M18 128 L14 104 Q16 90 40 86 L118 80 Q140 52 168 44 Q190 40 226 40 L262 40 Q292 42 318 74 L370 84 Q392 90 394 108 L392 128 Z',
    ['M136 78 L160 54 Q170 49 196 49 L206 49 L206 78 Z', 'M216 78 L216 49 L258 49 Q282 51 300 76 Z'], [[100, 28], [318, 28]]],
  suv: ['M14 132 L12 70 Q14 46 36 42 L252 38 Q276 38 296 52 L338 82 L378 90 Q394 94 394 112 L392 132 Z',
    ['M40 80 L44 54 L118 52 L118 80 Z', 'M128 80 L128 52 L208 50 L208 80 Z', 'M218 80 L218 50 L256 50 Q272 52 290 64 L314 80 Z'], [[92, 31], [318, 31]]],
  pickup: ['M12 130 L12 84 L150 84 L156 82 L176 44 Q180 40 190 40 L256 40 Q270 40 282 54 L306 84 L374 92 Q394 96 394 114 L392 130 Z',
    ['M172 80 L190 50 L222 50 L222 80 Z', 'M232 80 L232 50 L262 50 Q270 50 278 60 L294 80 Z'], [[86, 30], [320, 30]]],
  hatch: ['M40 128 L36 90 Q36 70 52 56 L84 46 Q120 40 200 40 L232 40 Q256 42 282 72 L340 84 Q360 88 362 106 L360 128 Z',
    ['M64 78 L80 54 L140 50 L140 78 Z', 'M150 78 L150 50 L228 50 Q244 52 266 76 Z'], [[106, 27], [300, 27]]],
  van: ['M14 132 L12 46 Q12 30 30 30 L272 30 Q290 30 304 46 L346 84 L380 92 Q394 96 394 114 L392 132 Z',
    ['M34 76 L34 44 L120 44 L120 76 Z', 'M130 76 L130 44 L230 44 L230 76 Z', 'M240 76 L240 44 L276 44 Q286 44 294 54 L314 76 Z'], [[92, 29], [320, 29]]],
  coupe: ['M20 128 L18 106 Q20 92 46 88 L130 80 Q168 50 210 48 L250 48 Q280 50 310 78 L376 90 Q394 94 394 110 L392 128 Z',
    ['M150 78 L176 58 Q190 54 214 54 L214 78 Z', 'M224 78 L224 54 L248 54 Q270 56 292 78 Z'], [[100, 27], [322, 27]]],
};
const LOT = ['suv', 'sedan', 'pickup', 'hatch', 'van', 'coupe', 'sedan'];
const MIATA = LOT.length; // the Miata parks after the grey cars

let ctx;
const textWidth = text => {
  ctx ??= document.createElement('canvas').getContext('2d');
  ctx.font = '400 38px Inter';
  ctx.letterSpacing = '-0.8px';
  return ctx.measureText(text).width;
};

const Car = ({ type, x }) => {
  const [body, windows, wheels] = CARS[type];
  return (
    <g transform={`translate(${x} ${GROUND}) scale(${CAR}) translate(-200 -154)`}>
      <path d={body} fill={C.car} />
      {wheels.map(([cx, r]) => <circle key={cx} cx={cx} cy={154 - r} r={r + 6} fill={C.sage} />)}
      {windows.map(d => <path key={d} d={d} fill={C.glass} />)}
      {wheels.map(([cx, r]) => <g key={cx}><circle cx={cx} cy={154 - r} r={r} fill={C.tyre} /><circle cx={cx} cy={154 - r} r={r * .48} fill={C.hub} /></g>)}
    </g>
  );
};

const PAN_START = 46, PAN_END = 116;
const pan = f => interpolate(f, [PAN_START, PAN_END], [0, MIATA * SPACING], { ...clamp, easing: Easing.bezier(.55, 0, .12, 1) });
const panFrames = Array.from({ length: 151 }, (_, f) => pan(f));
const frameAtPan = p => panFrames.findIndex(v => v >= p);
// Envelope i leaves the search box and lands on car i's roof as that car slides through the frame.
const LAUNCHES = LOT.map((_, i) => {
  const land = Math.max(40 + i * 3 + 12, frameAtPan(i * SPACING - 140));
  return { launch: 36 + i * 3, land };
});

export const Search = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const offset = pan(frame);
  const blur = Math.min(Math.abs(pan(frame + 1) - offset) / 3.5, 14);
  const screenX = i => CENTER + i * SPACING - offset;

  const boxIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 12 });
  const typed = QUERY.slice(0, Math.round(interpolate(frame, [8, 34], [0, QUERY.length], clamp)));
  const caret = frame < 40 && Math.floor(frame / 7) % 2 === 0;
  const press = interpolate(frame, [36, 39, 43], [1, .97, 1], clamp);

  const lock = spring({ frame: frame - (PAN_END - 4), fps, config: { damping: 11, stiffness: 160 } });
  const box = { l: interpolate(lock, [0, 1], [96, 196]), r: interpolate(lock, [0, 1], [864, 764]), t: interpolate(lock, [0, 1], [164, 236]), b: interpolate(lock, [0, 1], [526, 500]) };
  const bracketColor = interpolateColors(Math.min(lock, 1), [0, 1], ['rgba(17,17,17,.28)', C.green]);
  const corner = 44;
  const hop = -Math.max(0, Math.sin(Math.min(Math.max((frame - PAN_END + 2) / 9, 0), 1) * Math.PI)) * 10;
  const found = spring({ frame: frame - PAN_END - 4, fps, config: { damping: 14 } });

  const miataX = screenX(MIATA);
  return (
    <Stage overlay={
      <Sprite src="mascot/side-lg.webp" frameWidth={319} height={124} scale={1.62} x={miataX - 258} y={GROUND - 201 + hop}
        style={{ filter: blur > .3 ? `blur(${blur / 3}px)` : 'none' }} />
    }>
      <defs>
        <filter id="motion" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={`${blur} 0`} /></filter>
      </defs>

      <g filter={blur > .3 ? 'url(#motion)' : undefined}>
        <path d={`M-40 ${GROUND + 2}H1000`} stroke={C.ground} strokeWidth={3} />
        {[...LOT, 'miata'].map((_, i) => <path key={i} d={`M${screenX(i) - SPACING / 2} ${GROUND + 16}v40`} stroke={C.paper} strokeWidth={5} strokeLinecap="round" />)}
        {LOT.map((type, i) => <Car key={i} type={type} x={screenX(i)} />)}
      </g>

      {/* Viewfinder: loose and grey while scanning, tight and green once the Miata is in it. */}
      <g fill="none" stroke={bracketColor} strokeWidth={interpolate(lock, [0, 1], [3, 6])} strokeLinecap="round" strokeLinejoin="round">
        <path d={`M${box.l} ${box.t + corner}V${box.t}H${box.l + corner}`} />
        <path d={`M${box.r - corner} ${box.t}H${box.r}V${box.t + corner}`} />
        <path d={`M${box.l} ${box.b - corner}V${box.b}H${box.l + corner}`} />
        <path d={`M${box.r - corner} ${box.b}H${box.r}V${box.b - corner}`} />
      </g>

      {/* Envelopes home in on each car and ride along on its roof. */}
      {LAUNCHES.map(({ launch, land }, i) => {
        if (frame < launch) return null;
        const p = interpolate(frame, [launch, land], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
        const roofY = GROUND - (154 - (LOT[i] === 'van' ? 30 : LOT[i] === 'suv' ? 38 : 40)) * CAR - 34;
        const x = interpolate(p, [0, 1], [CENTER, screenX(i)]);
        const y = interpolate(p, [0, 1], [130, roofY]) - Math.sin(p * Math.PI) * 60;
        const settle = spring({ frame: frame - land, fps, config: { damping: 12 } });
        const s = p < 1 ? interpolate(p, [0, .15, 1], [.3, 1, .9]) : .9 + settle * .1 - (1 - settle) * .1;
        return <g key={i} transform={`translate(${x} ${y}) rotate(${p < 1 ? (1 - p) * 18 : 0})`} filter={blur > .3 && p >= 1 ? 'url(#motion)' : undefined}><Envelope size={s * 1.4} /></g>;
      })}

      {/* The search box. */}
      <g transform={`translate(480 78) scale(${(.92 + boxIn * .08) * press}) translate(-480 -78)`} opacity={boxIn}>
        <rect x={110} y={34} width={740} height={88} rx={14} fill={C.paper} stroke="#D6D8D3" strokeWidth={2} />
        <g transform="translate(160 78)" fill="none" stroke={C.ink} strokeWidth={3.6} strokeLinecap="round"><circle cx={-3} cy={-3} r={13} /><path d="m7 7 10 10" /></g>
        <text x={200} y={92} fontFamily="Inter" fontWeight={400} fontSize={38} letterSpacing={-.8} fill={C.ink}>{typed}</text>
        {caret && <rect x={203 + textWidth(typed)} y={58} width={3} height={42} fill={C.ink} />}
        <g transform={`translate(800 78) scale(${found * 1.2})`} opacity={found}>
          <circle r={19} fill={C.green} />
          <path d="m-8 0 5.5 5.5L9 -6" fill="none" stroke={C.paper} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </Stage>
  );
};
