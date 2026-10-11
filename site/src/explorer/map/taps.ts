// Small targets on the map: keeping the markers of neighbouring small countries from sitting on
// top of each other, and working out which marker a finger meant. Pure functions of points, with
// no DOM and no geometry data, so the browser can import them and all of it is unit tested.

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Moves points apart until none are closer than `gap`: each pair that is too close is pushed
 * equally in opposite directions along the line between them. Points with room around them stay
 * exactly where they are. Returned in input order.
 */
export function spreadPoints(points: readonly Point[], gap: number): Point[] {
  const spread = points.map(({ x, y }) => ({ x, y }));
  // Moving one pair can crowd another, so go round until a pass moves nothing.
  for (let pass = 0; pass < 20; pass++) {
    let moved = false;
    for (let a = 0; a < spread.length; a++) {
      for (let b = a + 1; b < spread.length; b++) {
        const dx = spread[b].x - spread[a].x;
        const dy = spread[b].y - spread[a].y;
        const distance = Math.hypot(dx, dy);
        if (distance >= gap - 1e-9) continue;
        // Two points in the same place are pulled apart sideways.
        const [ux, uy] = distance === 0 ? [1, 0] : [dx / distance, dy / distance];
        const push = (gap - distance) / 2;
        spread[a].x -= ux * push;
        spread[a].y -= uy * push;
        spread[b].x += ux * push;
        spread[b].y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return spread;
}

/**
 * The target nearest to `point`, if it is within `reach` of it; otherwise undefined. On a touch
 * screen this turns a tap near a marker into a tap on it, and settles which of two close markers
 * was meant. Of two targets at the same distance the earlier one wins.
 */
export function nearestWithin<T extends Point>(point: Point, targets: readonly T[], reach: number): T | undefined {
  let nearest: T | undefined;
  let best = reach;
  for (const target of targets) {
    const distance = Math.hypot(target.x - point.x, target.y - point.y);
    if (distance <= best && (nearest === undefined || distance < best)) {
      nearest = target;
      best = distance;
    }
  }
  return nearest;
}
