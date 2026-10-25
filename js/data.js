// Mock data for the prototype. Every name, number and ID here is invented.
const DATA = {
  product: {
    name: 'New Balance 574 Core',
    brand: 'New Balance',
    variant: 'Grey, UK 9',
    price: 6500,
    premiumBrand: true,
  },

  buyer: {
    name: 'Rohan Mehta',
    address: 'B-14, Hauz Khas, New Delhi 110016',
  },

  seller: {
    name: 'UrbanKicks Store',
    gstin: '27AAKCU4821M1Z3',
    distributor: 'NB Footwear Distribution',
    distributorGstin: '29AABCN5520K1Z8',
    invoices: [
      { no: 'INV-NBD-2026-0412', date: '18 Sep 2026', qty: 30 },
      { no: 'INV-NBD-2026-0467', date: '5 Oct 2026', qty: 20 },
    ],
    soldBefore: 12,
    trust: 92,
  },

  order: {
    id: 'OD-4471-2026',
    serial: 'NB574-26-0007318',
    seal: 'SL-A7K29',
    weight: '1.18 kg',
    warehouse: 'UrbanKicks warehouse, Bhiwandi',
    hub1: 'Bhiwandi mother hub',
    hub2: 'Gurugram sort hub',
  },

  // Orders at or above this price, from premium brands or from low-trust
  // sellers get verified delivery. Everything else ships normally.
  riskRules: {
    priceThreshold: 3000,
    minTrust: 80,
  },

  // Serials the brand has registered as genuine (mock brand registry).
  brandRegistry: [
    'NB574-26-0007316',
    'NB574-26-0007317',
    'NB574-26-0007318',
    'NB574-26-0007319',
    'NB574-26-0007320',
  ],

  scenarios: {
    genuine: {
      label: 'Genuine product',
      bagSeal: 'SL-A7K29',
      productSerial: 'NB574-26-0007318',
      photos: {
        logo: { ok: true, note: 'Logo print is sharp and matches the reference' },
        sole: { ok: true, note: 'Sole edges are finished, no moulding marks' },
        tag: { ok: true, note: 'Size tag and brand QR label are present' },
      },
    },
    swapped: {
      label: 'Seller packed a different item',
      bagSeal: 'SL-A7K29',
      productSerial: 'NB574-21-9930015',
      photos: {
        logo: { ok: false, note: 'Logo edges are blurred and letter spacing differs' },
        sole: { ok: false, note: 'Moulding marks visible along the sole edge' },
        tag: { ok: false, note: 'No brand QR code or serial label found' },
      },
    },
    tampered: {
      label: 'Seal tampered in transit',
      bagSeal: 'SL-B3Q11',
      productSerial: 'NB574-26-0007318',
      photos: {
        logo: { ok: true, note: 'Logo print is sharp and matches the reference' },
        sole: { ok: true, note: 'Sole edges are finished, no moulding marks' },
        tag: { ok: true, note: 'Size tag and brand QR label are present' },
      },
    },
  },
};
