import data from "./motion-library-data.json";

export interface LibraryMotion {
  sourceKey: string;
  textureKey: string;
  count: number;
  peak: number;
  stretch: number;
  anchor: { x: number; y: number };
  presentationSize: { width: number; height: number };
  atlas: {
    frames: { frame: { x: number; y: number; w: number; h: number }; duration: number;
      rotated: boolean; trimmed: boolean; sourceSize: { w: number; h: number };
      spriteSourceSize: { x: number; y: number; w: number; h: number } }[];
    meta: { size: { w: number; h: number } };
  };
}

/** Generated from Aseprite's exported rectangles, never inferred from a grid at runtime. */
export const libraryMotions: readonly LibraryMotion[] = data;
const bySource = new Map(libraryMotions.map(item => [item.sourceKey, item]));
export function libraryMotion(sourceKey: string): LibraryMotion | undefined { return bySource.get(sourceKey); }
