import { OVERWORLD } from './world_overworld.js';
import { DUNGEONS } from './world_dungeons.js';
export const WORLD = {
  start: { area: 'overworld', room: 'ov_1_3', x: 150, y: 96 },
  areas: { overworld: OVERWORLD, ...DUNGEONS },
};
