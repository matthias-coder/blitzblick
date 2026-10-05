// German names for screen readers, keyed by the sticker name (the part after the page id)
export const STICKER_NAMES = {
  pear: 'Birne', orange: 'Orange', lemon: 'Zitrone', pineapple: 'Ananas', cherry: 'Kirsche', peach: 'Pfirsich', kiwi: 'Kiwi', plum: 'Pflaume',
  carrot: 'Karotte', tomato: 'Tomate', broccoli: 'Brokkoli', corn: 'Mais', pepper: 'Paprika', pumpkin: 'Kürbis', mushroom: 'Pilz', toadstool: 'Fliegenpilz',
  icecream: 'Eis', cake: 'Kuchen', grapes: 'Weintrauben', banana: 'Banane', cocoa: 'Kakao', cheese: 'Käse', watermelon: 'Wassermelone', strawberry: 'Erdbeere',
  pizza: 'Pizza', burger: 'Burger', taco: 'Taco', roastchicken: 'Brathähnchen', popsicle: 'Eis am Stiel', birthdaycake: 'Geburtstagstorte', spaghetti: 'Spaghetti', hotdog: 'Hotdog',
  teddy: 'Teddy', train: 'Zug', hotairballoon: 'Heißluftballon', helicopter: 'Hubschrauber', rocket: 'Rakete', sailboat: 'Segelboot', yoyo: 'Jo-Jo', blocks: 'Bauklötze',
  car: 'Auto', bus: 'Bus', plane: 'Flugzeug', ship: 'Schiff', bike: 'Fahrrad', tractor: 'Traktor', firetruck: 'Feuerwehrauto',
  moon: 'Mond', sun: 'Sonne', planet: 'Planet', star: 'Stern', astronaut: 'Astronaut', ufo: 'Ufo', comet: 'Komet',
  pickaxe: 'Spitzhacke', sword: 'Schwert', grassblock: 'Grasblock', crystal: 'Kristall', chest: 'Truhe', slime: 'Schleim', sixtyseven: 'Siebenundsechzig',
  lion: 'Löwe', elephant: 'Elefant', giraffe: 'Giraffe', monkey: 'Affe', penguin: 'Pinguin', turtle: 'Schildkröte', zebra: 'Zebra', hedgehog: 'Igel',
  fish: 'Fisch', octopus: 'Krake', crab: 'Krebs', whale: 'Wal', starfish: 'Seestern', seahorse: 'Seepferdchen', jellyfish: 'Qualle', shell: 'Muschel',
  trex: 'T-Rex', stegosaurus: 'Stegosaurus', triceratops: 'Triceratops', brachiosaurus: 'Brachiosaurus', pterodactyl: 'Flugsaurier', egg: 'Dino-Ei', volcano: 'Vulkan', footprint: 'Fußspur',
  tralalero: 'Tralalero Tralala', bombardiro: 'Bombardiro Crocodilo', tungtung: 'Tung Tung Tung Sahur', ballerina: 'Ballerina Cappuccina',
  patapim: 'Brr Brr Patapim', lirili: 'Lirilì Larilà', chimpanzini: 'Chimpanzini Bananini', trippitroppi: 'Trippi Troppi',
  cat: 'Katze', pencils: 'Buntstifte', backpack: 'Rucksack', book: 'Buch', headphones: 'Kopfhörer', sneakers: 'Turnschuhe', flowers: 'Blumen', drawingbook: 'Malbuch',
  pot: 'Topf', bread: 'Brot', spatula: 'Pfannenwender', mug: 'Tasse', whisk: 'Schneebesen', rollingpin: 'Nudelholz', salad: 'Salat', cereal: 'Müsli',
  pan: 'Pfanne', ladle: 'Schöpfkelle', kettle: 'Wasserkocher', toaster: 'Toaster', grater: 'Reibe', colander: 'Sieb', ovenmitt: 'Topflappen', bowl: 'Schüssel',
  wand: 'Zauberstab', spellbook: 'Zauberbuch', crystals: 'Kristalle', potion: 'Zaubertrank', broom: 'Hexenbesen', telescope: 'Fernrohr', globe: 'Globus', camera: 'Kamera',
  toast: 'Toast', finger: 'Finger', bubbletea: 'Bubble Tea', shroomrider: 'Pilzreiter', yarncat: 'Kabelsalat-Katze', melon: 'Wassermelone',
  sunflower: 'Sonnenblume', wateringcan: 'Gießkanne', tulips: 'Tulpen', snail: 'Schnecke', butterfly: 'Schmetterling', gnome: 'Gartenzwerg', bee: 'Biene', flowerpot: 'Blumentopf',
  excavator: 'Bagger', crane: 'Kran', dumptruck: 'Kipplaster', hardhat: 'Bauhelm', cone: 'Leitkegel', mixer: 'Betonmischer', wheelbarrow: 'Schubkarre', hammer: 'Hammer',
  ladybug: 'Marienkäfer', dragonfly: 'Libelle', caterpillar: 'Raupe', beetle: 'Käfer', grasshopper: 'Grashüpfer', spider: 'Spinne', firefly: 'Glühwürmchen', worm: 'Wurm',
  icecowboy: 'Eis-Cowboy', surfrock: 'Surf-Stein', saxavocado: 'Saxofon-Avocado', cloudbot: 'Wolkenroboter', balletpencil: 'Ballett-Stift', mouse: 'Computermaus', wrenchscientist: 'Schrauben-Forscher', pizzaking: 'Pizzakönig',
};

export const stickerName = (id) => STICKER_NAMES[String(id).slice(String(id).indexOf('/') + 1)] ?? '';
