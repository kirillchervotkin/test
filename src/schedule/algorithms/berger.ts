import { BadRequestException } from '@nestjs/common';
export interface Pairing {
  round: number;
  homeSlotId: string;
  awaySlotId: string;
}
export class BergerAlgorithm {
  static async generate(ids: string[], circles = 1): Promise<Pairing[]> {
    if (
      ids.length < 2 ||
      ids.length > 128 ||
      new Set(ids).size !== ids.length ||
      !Number.isInteger(circles) ||
      circles < 1 ||
      circles > 8
    ) {
      throw new BadRequestException(
        'Для кругового этапа нужны 2–128 уникальных слотов и 1–8 кругов',
      );
    }
    const ring: (string | null)[] = [...ids];
    if (ring.length % 2) ring.push(null);
    const first: Pairing[] = [];
    for (let round = 0; round < ring.length - 1; round++) {
      for (let i = 0; i < ring.length / 2; i++) {
        const a = ring[i],
          b = ring[ring.length - 1 - i];
        if (!a || !b) continue;
        const reverse = i === 0 ? round % 2 === 1 : i % 2 === 1;
        first.push({
          round: round + 1,
          homeSlotId: reverse ? b : a,
          awaySlotId: reverse ? a : b,
        });
      }
      ring.splice(1, 0, ring.pop()!);
    }
    return Array.from({ length: circles }, (_, circle) =>
      first.map((pair) => ({
        round: pair.round + circle * (ring.length - 1),
        homeSlotId: circle % 2 ? pair.awaySlotId : pair.homeSlotId,
        awaySlotId: circle % 2 ? pair.homeSlotId : pair.awaySlotId,
      })),
    ).flat();
  }
}
