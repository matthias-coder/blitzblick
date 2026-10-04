export const PRAISE = {
  great: ['Super gemacht!', 'Klasse!', 'Wow, toll!', 'Spitze!', 'Prima gemacht!'],
  good: ['Gut gemacht!', 'Schön!', 'Prima!', 'Das war gut!'],
  practiced: ['Toll geübt!', 'Weiter so!', 'Schön geübt!', 'Gut, dass du übst!'],
};

export const STICKER = ['Du hast einen neuen Sticker!', 'Ein neuer Sticker für dein Album!', 'Schau mal, ein neuer Sticker!'];
export const SECRET = ['Psst … ein geheimer Sticker!', 'Huch, die Unfug-Bande war da! Ein geheimer Sticker!', 'Pssst, ein geheimer Sticker für dein Album!'];
export const levelUpText = (from) => `Level ${from + 1} geschafft! Jetzt kommt Level ${from + 2}.`;

export function createPicker(random = Math.random) {
  const last = new Map();
  return (key, options) => {
    const pool = options.length > 1 ? options.filter((o) => o !== last.get(key)) : options;
    const v = pool[Math.floor(random() * pool.length)];
    last.set(key, v);
    return v;
  };
}
export const DUPLICATE = ['Den hast du schon – jetzt hast du ihn doppelt!', 'Noch einmal der! Der zählt mit.'];
export const TRADE = ['Du kannst eine Sticker-Tüte öffnen!', 'Deine Sterne reichen für eine Sticker-Tüte!'];
export const SAVE = ['Sammle weiter Sterne für die nächste Sticker-Tüte.', 'Bald reicht es für eine Sticker-Tüte!'];
export const BONUS_PAGE = 'Eine neue Bonusseite! Und dreißig Sterne dazu!';
