// Tile type constants (DOM-free, shared by gfx/world/tests)
// Tile chars (world maps) -> tile types
export const T = { FLOOR: 0, WALL: 1, LIQUID: 2, OBST: 3, DECOR: 4, BRIDGE: 5, HAZARD: 6, STAIRS: 7, DOOR_OPEN: 8, DOOR_LOCKED: 9, DOOR_BOSS: 10, DOOR_SHUT: 11, BIOFILM: 12, ABSCESS: 13, PILLAR: 14, EXIT: 15, HEAL: 16, DOOR_WALL: 17, PORTAL: 18, SPECIAL: 19, PROP: 20 };
export const CHAR_TILE = { '.': T.FLOOR, '#': T.WALL, '~': T.LIQUID, 'o': T.OBST, ',': T.DECOR, '=': T.BRIDGE, '^': T.HAZARD, '>': T.STAIRS, '<': T.EXIT, 'D': T.DOOR_OPEN, 'L': T.DOOR_LOCKED, 'B': T.DOOR_BOSS, 'S': T.DOOR_SHUT, 'X': T.BIOFILM, '%': T.ABSCESS, 'T': T.PILLAR, '+': T.HEAL, 'W': T.DOOR_WALL, '@': T.PORTAL, '$': T.SPECIAL };
export const SOLID = new Set([T.WALL, T.LIQUID, T.OBST, T.DOOR_LOCKED, T.DOOR_BOSS, T.DOOR_SHUT, T.BIOFILM, T.ABSCESS, T.PILLAR, T.DOOR_WALL, T.PROP]);

