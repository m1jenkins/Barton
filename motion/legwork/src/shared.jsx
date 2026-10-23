import { AbsoluteFill, Img, continueRender, delayRender, staticFile } from 'remotion';

// The homepage palette (buying/drive-right.css); the Miata is the only saturated thing on screen.
export const C = {
  sage: '#F2F2F0', ink: '#111111', green: '#1B4D3E', muted: '#5C5C5A', line: '#E6E6E4', paper: '#FFFFFF',
  car: '#C9CCC6', glass: '#E2E4DF', tyre: '#80847E', hub: '#D5D7D2', ground: '#D9DBD6',
};
export const W = 960, H = 540, FPS = 30;
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

const fonts = [
  ['Inter', 'inter-latin.woff2', '400'], ['Inter', 'inter-semibold-latin.woff2', '600'],
  ['Barlow', 'barlow-medium-latin.woff2', '500'], ['Barlow', 'barlow-semibold-latin.woff2', '600'],
];
const fontsReady = delayRender('Loading site fonts');
Promise.all(fonts.map(([family, file, weight]) => new FontFace(family, `url(${staticFile(`fonts/${file}`)})`, { weight }).load()))
  .then(faces => { faces.forEach(face => document.fonts.add(face)); continueRender(fontsReady); });

// A damped pendulum kick: degrees at t seconds after the push.
export const swing = (t, amp, freq = 1.4, decay = 2.4) => (t < 0 ? 0 : amp * Math.exp(-decay * t) * Math.sin(2 * Math.PI * freq * t));

export const Stage = ({ children, overlay }) => (
  <AbsoluteFill style={{ background: C.sage }}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>{children}</svg>
    {overlay}
  </AbsoluteFill>
);

// Mascot sprite strips from assets/mascot/, drawn with nearest-neighbour scaling like the header.
export const Sprite = ({ src, frameWidth, height, frame = 0, scale, x, y, style }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: frameWidth * scale, height: height * scale, overflow: 'hidden', ...style }}>
    <Img src={staticFile(src)} style={{ position: 'absolute', left: -frame * frameWidth * scale, top: 0, height: height * scale, imageRendering: 'pixelated' }} />
  </div>
);

export const Envelope = ({ size = 1, fill = C.paper, stroke = C.green }) => (
  <g transform={`scale(${size})`} fill="none" stroke={stroke} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round">
    <rect x={-20} y={-14} width={40} height={28} rx={3} fill={fill} />
    <path d="M-20 -14 0 2 20 -14" />
  </g>
);
