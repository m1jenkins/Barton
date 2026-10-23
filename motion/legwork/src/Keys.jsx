import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, Sprite, Stage, clamp, swing } from './shared.jsx';

// Pick up the keys: tick the review boxes and sign, the paperwork drops away, the Miata rolls in,
// the key fob clicks and the pop-up headlights flip up and switch on.
const SIGNATURE = 'M0 34C8 8 22-2 26 10S14 52 22 46 44 6 54 14 44 44 56 40 76 18 84 22 78 42 90 40 108 20 116 24 112 42 124 40 140 22 150 26 146 44 160 40 184 18 200 26 214 34 232 30';
const SIGN_START = 26, SIGN_END = 52, PAPER_OUT = 58, CAR_IN = 64, CLICK = 92;
// q-lg.webp frames: 0 down, 1 half raised, 2 up, 3 up and lit.
const LIGHTS = [[0, 0], [CLICK + 6, 1], [CLICK + 9, 2], [CLICK + 13, 3]];

const Check = ({ x, y, p }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={-13} y={-13} width={26} height={26} rx={4} fill={p > 0 ? C.green : C.paper} stroke={C.green} strokeWidth={2.5} />
    <path d="m-7 0 5 5 9-10" fill="none" stroke={C.paper} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
  </g>
);

const Fob = ({ press }) => (
  <g>
    <path d="M0 -400V-112" stroke={C.ink} strokeWidth={3} />
    <circle cy={-86} r={26} fill="none" stroke="#9A9E98" strokeWidth={7} />
    <path d="M-10 -62h20v18h-20z" fill="#9A9E98" />
    <rect x={-40} y={-46} width={80} height={128} rx={26} fill="#1E201F" />
    <circle cy={-6} r={15} fill={press > 0 ? C.green : '#3A3D3B'} transform={`scale(${1 - press * .12})`} />
    <path d="M-5 -6v-4a5 5 0 0 1 10 0v4" fill="none" stroke={C.paper} strokeWidth={2.2} transform="translate(0 2)" />
    <rect x={-6} y={-6} width={12} height={9} rx={1.5} fill={C.paper} />
    <circle cy={36} r={12} fill="#3A3D3B" />
  </g>
);

export const Keys = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const paperIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 14 });
  const paperOut = interpolate(frame, [PAPER_OUT, PAPER_OUT + 12], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const tick1 = interpolate(frame, [10, 16], [0, 1], clamp), tick2 = interpolate(frame, [17, 23], [0, 1], clamp);
  const sign = interpolate(frame, [SIGN_START, SIGN_END], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });

  const roll = spring({ frame: frame - CAR_IN, fps, config: { damping: 18, stiffness: 70 } });
  const carX = interpolate(roll, [0, 1], [-640, 70]);
  const dip = Math.sin(Math.min(Math.max((frame - CAR_IN - 16) / 10, 0), 1) * Math.PI) * 5;
  const lights = LIGHTS.filter(([at]) => frame >= at).at(-1)[1];

  const keysIn = spring({ frame: frame - CAR_IN - 6, fps, config: { damping: 12, stiffness: 110 } });
  const keyAngle = swing((frame - CAR_IN - 14) / fps, 14) + swing((frame - CLICK) / fps, -5, 2);
  const press = interpolate(frame, [CLICK - 2, CLICK, CLICK + 5, CLICK + 9], [0, 1, 1, 0], clamp);
  const glow = interpolate(frame, [CLICK + 13, CLICK + 17, CLICK + 40], [0, .9, .35], clamp);

  return (
    <Stage overlay={
      <>
        <div style={{ position: 'absolute', left: carX + 40, top: 488, width: 530, height: 44, borderRadius: '50%', background: 'rgba(17,17,17,.12)', filter: 'blur(8px)', opacity: roll }} />
        <Sprite src="mascot/q-lg.webp" frameWidth={309} height={157} frame={lights} scale={1.9} x={carX} y={214 + dip} />
      </>
    }>
      {/* Paperwork: review boxes, then the signature. */}
      <g opacity={paperIn * (1 - paperOut)} transform={`translate(0 ${(1 - paperIn) * 60 + paperOut * 420}) rotate(${paperOut * -8} 480 270)`}>
        <g transform="translate(480 270) scale(1.12) translate(-480 -300)">
        <rect x={250} y={88} width={460} height={430} rx={8} fill={C.paper} stroke={C.green} strokeWidth={3} />
        <text x={292} y={150} fontFamily="Barlow" fontWeight={600} fontSize={34} fill={C.ink}>For your review</text>
        <path d="M292 172H668" stroke={C.line} strokeWidth={3} />
        <Check x={306} y={216} p={tick1} />
        <text x={336} y={226} fontFamily="Inter" fontSize={24} fill={C.ink}>Read the terms</text>
        <Check x={306} y={268} p={tick2} />
        <text x={336} y={278} fontFamily="Inter" fontSize={24} fill={C.ink}>Your decision</text>
        <path transform="translate(300 352) scale(1.45)" d={SIGNATURE} fill="none" stroke={C.ink} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - sign} />
        <path d="M292 438H668" stroke={C.muted} strokeWidth={2.5} strokeDasharray="3 8" strokeLinecap="round" />
        <text x={292} y={474} fontFamily="Inter" fontSize={20} fill={C.muted}>Your signature</text>
        </g>
      </g>

      {/* Headlight wash once the lamps are on. */}
      <ellipse cx={carX + 430} cy={470} rx={210} ry={38} fill="#FFF3C4" opacity={glow * .55} />

      {/* Key fob: drops in, swings, clicks, and the signal goes out to the car. */}
      <g transform={`translate(818 ${interpolate(keysIn, [0, 1], [-260, 200])}) scale(1.25) rotate(${frame > CAR_IN + 6 ? keyAngle : 0} 0 -86)`}>
        <Fob press={press} />
      </g>
      {[0, 1, 2].map(n => {
        const p = interpolate(frame, [CLICK + n * 3, CLICK + 14 + n * 3], [0, 1], clamp);
        if (p <= 0 || p >= 1) return null;
        return <path key={n} d={`M${758 - n * 24 - p * 40} ${150 - n * 12}a${46 + n * 24} ${46 + n * 24} 0 0 0 0 ${84 + n * 24}`} transform={`translate(${-p * 10} 0)`} fill="none" stroke={C.green} strokeWidth={5} strokeLinecap="round" opacity={1 - p} />;
      })}
    </Stage>
  );
};
