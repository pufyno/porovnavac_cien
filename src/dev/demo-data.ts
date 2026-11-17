// Ukážkové dáta: vymyslené e-shopy a vymyslené ceny. Názvy produktov sú
// reálne, aby sa dalo skúšať vyhľadávanie; EAN kódy sú vymyslené (len
// s platnou kontrolnou číslicou) a nezodpovedajú skutočným produktom.

export interface DemoShop {
  slug: string;
  name: string;
  country: 'SK' | 'CZ';
}

export interface DemoProduct {
  key: string;
  name: string;
  brand: string | null;
  category: string;
  /** Poradové číslo, z ktorého vznikne EAN; `null` = ponuka bez EAN. */
  eanSeq: number | null;
}

export interface DemoOffer {
  shop: string;
  product: string;
  /** 0 = skladom. */
  deliveryDays: number;
  /** [deň relatívne k dnešku, cena]; prvý záznam je deň, keď sa ponuka objavila. */
  prices: [number, number][];
}

export const DEMO_SHOPS: DemoShop[] = [
  { slug: 'alfa-elektro', name: 'Alfa Elektro', country: 'SK' },
  { slug: 'beta-shop', name: 'Beta Shop', country: 'SK' },
  { slug: 'delta-tech', name: 'Delta Tech', country: 'SK' },
  { slug: 'gama-elektro', name: 'Gama Elektro CZ', country: 'CZ' },
];

const VACUUMS = 'Elektronika | Domáce spotrebiče | Robotické vysávače';
const PHONES = 'Elektronika | Mobilné telefóny';
const AUDIO = 'Elektronika | Audio | Slúchadlá';

export const DEMO_PRODUCTS: DemoProduct[] = [
  { key: 's8', name: 'Roborock S8 Pro Ultra White', brand: 'Roborock', category: VACUUMS, eanSeq: 1 },
  { key: 's24-128', name: 'Samsung Galaxy S24 8GB/128GB Onyx Black', brand: 'Samsung', category: PHONES, eanSeq: 2 },
  { key: 's24-256', name: 'Samsung Galaxy S24 8GB/256GB Onyx Black', brand: 'Samsung', category: PHONES, eanSeq: 3 },
  { key: 'i15', name: 'Apple iPhone 15 128GB modrý', brand: 'Apple', category: PHONES, eanSeq: 4 },
  { key: 'i15pro', name: 'Apple iPhone 15 Pro 256GB prírodný titán', brand: 'Apple', category: PHONES, eanSeq: 5 },
  { key: 'xm5', name: 'Sony WH-1000XM5 čierne', brand: 'Sony', category: AUDIO, eanSeq: 6 },
  { key: 'xm4', name: 'Sony WH-1000XM4 čierne', brand: 'Sony', category: AUDIO, eanSeq: 7 },
  { key: 'c4', name: 'LG OLED55C4 55" 4K OLED TV', brand: 'LG', category: 'Elektronika | Televízory', eanSeq: 8 },
  { key: 'v15', name: 'Dyson V15 Detect Absolute', brand: 'Dyson', category: 'Elektronika | Vysávače', eanSeq: 9 },
  { key: 's10', name: 'Xiaomi Robot Vacuum S10+', brand: 'Xiaomi', category: VACUUMS, eanSeq: 10 },
  { key: 'kabel', name: 'Kábel USB-C 1 m čierny', brand: null, category: 'Elektronika | Príslušenstvo', eanSeq: null },
];

const START = -100;

export const DEMO_OFFERS: DemoOffer[] = [
  // Roborock: Alfa poctivo zlacnila; Beta na týždeň zdražila a „zľavnila“ späť.
  { shop: 'alfa-elektro', product: 's8', deliveryDays: 0, prices: [[START, 545], [-10, 489]] },
  { shop: 'beta-shop', product: 's8', deliveryDays: 3, prices: [[START, 515], [-14, 740], [-7, 519]] },
  { shop: 'delta-tech', product: 's8', deliveryDays: 0, prices: [[START, 549]] },
  { shop: 'gama-elektro', product: 's8', deliveryDays: 0, prices: [[START, 13490], [-12, 12490]] },

  // Galaxy S24: dva varianty so stabilnou cenou.
  { shop: 'alfa-elektro', product: 's24-128', deliveryDays: 0, prices: [[START, 699]] },
  { shop: 'beta-shop', product: 's24-128', deliveryDays: 0, prices: [[START, 709]] },
  { shop: 'alfa-elektro', product: 's24-256', deliveryDays: 0, prices: [[START, 759]] },
  { shop: 'beta-shop', product: 's24-256', deliveryDays: 2, prices: [[START, 765]] },
  { shop: 'gama-elektro', product: 's24-128', deliveryDays: 0, prices: [[START, 17990]] },

  // iPhone 15: pred pár dňami zdražel vo všetkých obchodoch.
  { shop: 'alfa-elektro', product: 'i15', deliveryDays: 0, prices: [[START, 699], [-6, 779]] },
  { shop: 'delta-tech', product: 'i15', deliveryDays: 0, prices: [[START, 705], [-8, 789]] },
  { shop: 'gama-elektro', product: 'i15', deliveryDays: 0, prices: [[START, 18990], [-15, 17490]] },
  { shop: 'alfa-elektro', product: 'i15pro', deliveryDays: 0, prices: [[START, 1199]] },

  // Slúchadlá: dva modely, ktoré sa líšia jednou číslicou.
  { shop: 'beta-shop', product: 'xm5', deliveryDays: 0, prices: [[START, 329], [-30, 279]] },
  { shop: 'delta-tech', product: 'xm5', deliveryDays: 0, prices: [[START, 319]] },
  { shop: 'alfa-elektro', product: 'xm4', deliveryDays: 0, prices: [[START, 249]] },

  { shop: 'alfa-elektro', product: 'c4', deliveryDays: 5, prices: [[START, 1299], [-40, 1199], [-20, 1249]] },
  { shop: 'delta-tech', product: 'c4', deliveryDays: 0, prices: [[START, 1349]] },
  { shop: 'beta-shop', product: 's10', deliveryDays: 0, prices: [[START, 399], [-50, 349]] },

  // Novinka: v ponuke len pár dní, na verdikt je to málo.
  { shop: 'delta-tech', product: 'v15', deliveryDays: 0, prices: [[-5, 649]] },

  // Ponuka bez EAN sa nespáruje na produkt.
  { shop: 'beta-shop', product: 'kabel', deliveryDays: 0, prices: [[START, 6.9]] },
];
