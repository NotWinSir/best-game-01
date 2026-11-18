// Keyboard and mouse, read as plain state the simulation samples each step. The wyrm steers
// toward the pointer while it is over the stage; the turn keys (A/D and the arrows) steer when
// no pointer has been seen, so the game plays on a keyboard alone. One-shot presses (start,
// pause, dash, choosing an upgrade) are queued as edges and consumed by the screen that wants
// them, so a press is never lost between frames and never fires twice.

export function createInput(canvas) {
  const held = new Set();
  const edges = [];
  const pointer = { x: 0, y: 0, seen: false };

  function pushEdge(code) {
    if (!held.has(code)) edges.push(code);
    held.add(code);
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    pushEdge(event.code);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    pointer.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    pointer.seen = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    pointer.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    pointer.seen = true;
    edges.push('PointerDown');
  });

  return {
    pointer,
    /** True while the key is physically down. */
    down(code) {
      return held.has(code);
    },
    /** The queued one-shot presses since the last call; empties the queue. */
    takeEdges() {
      return edges.splice(0, edges.length);
    },
    /** Forget queued presses (used when a screen changes under the player's hands). */
    clearEdges() {
      edges.length = 0;
    },
  };
}

/** The steer input for one step: a target point for the pointer, or a turn direction for keys. */
export function steerFrom(input) {
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');
  if (left !== right) return { turn: left ? -1 : 1, target: null };
  if (input.pointer.seen) return { turn: 0, target: { x: input.pointer.x, y: input.pointer.y } };
  return { turn: 0, target: null };
}

export function dashHeld(input) {
  return input.down('ShiftLeft') || input.down('ShiftRight') || input.down('Space');
}
