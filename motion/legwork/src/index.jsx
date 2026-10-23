import { Composition, registerRoot } from 'remotion';
import { FPS, H, W } from './shared.jsx';
import { Search } from './Search.jsx';
import { Negotiate } from './Negotiate.jsx';
import { Keys } from './Keys.jsx';

// One composition per homepage legwork card; render.mjs writes them to assets/buying/legwork/.
const Root = () => (
  <>
    <Composition id="search" component={Search} durationInFrames={150} fps={FPS} width={W} height={H} />
    <Composition id="negotiate" component={Negotiate} durationInFrames={150} fps={FPS} width={W} height={H} />
    <Composition id="keys" component={Keys} durationInFrames={150} fps={FPS} width={W} height={H} />
  </>
);

registerRoot(Root);
