export const PRAISE = {
  great: ['Super gemacht!', 'Klasse!', 'Wow, toll!', 'Spitze!', 'Prima gemacht!'],
  good: ['Gut gemacht!', 'Schön!', 'Prima!', 'Das war gut!'],
  practiced: ['Toll geübt!', 'Weiter so!', 'Schön geübt!', 'Gut, dass du übst!'],
};

export const STICKER = ['Du hast einen neuen Sticker!', 'Ein neuer Sticker für dein Album!', 'Schau mal, ein neuer Sticker!'];
export const BONUS = ['Du bekommst Extra-Sterne!', 'Extra-Sterne für dich!', 'Hier sind Extra-Sterne!'];
export const ALMOST = ['Ab acht Richtigen gibt es einen Sticker.', 'Noch ein bisschen mehr, dann gibt es einen Sticker.', 'Fast! Ab acht gibt es einen Sticker.'];

export function createPicker(random = Math.random) {
  const last = new Map();
  return (key, options) => {
    const pool = options.length > 1 ? options.filter((o) => o !== last.get(key)) : options;
    const v = pool[Math.floor(random() * pool.length)];
    last.set(key, v);
    return v;
  };
}
