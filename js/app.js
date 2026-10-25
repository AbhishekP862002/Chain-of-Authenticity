// Chain of Authenticity – prototype
// One order moves through: verified listing -> locked at packing -> sealed transit
// -> two-OTP doorstep verification -> payment settled only after OTP 2.

const P = DATA.product, O = DATA.order, SELLER = DATA.seller, RULES = DATA.riskRules;
const PHOTO_SLOTS = [
  { key: 'logo', label: 'Logo', hint: 'Side logo, close up' },
  { key: 'sole', label: 'Sole', hint: 'Sole edge, from the side' },
  { key: 'tag', label: 'Tag', hint: 'Size tag with QR label' },
];

// ---------- state ----------
function fresh(scenario, payMode) {
  return {
    scenario,
    payMode: payMode || 'prepaid',
    stage: 'browse', // browse | transit | out | arrived | seal | inspect | accepted | delivered | rejected | returned
    step: 0, // authenticity stages completed (0–6)
    doorstep: 'pending', // pending | current | done | failed
    buyerTab: 'auth',
    expanded: null,
    otp1: null, otp1Input: '', otp2: null, otp2Input: '',
    partnerError: '',
    sealScanned: null,
    serialInput: '', serial: null,
    photos: { logo: null, sole: null, tag: null },
    photoResult: null,
    rejecting: false, rejectReason: '', rejectNote: '',
    payment: 'unpaid', // unpaid | held | due | released | refunded | not-charged
    trust: SELLER.trust,
    sold: SELLER.soldBefore,
    sellerNote: '',
    listMsg: '',
    inspectStart: null, inspectEnd: null,
    log: [],
  };
}

let S = fresh('genuine');
const SC = () => DATA.scenarios[S.scenario];

// ---------- helpers ----------
const rupees = n => '₹' + n.toLocaleString('en-IN');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const otp = () => String(Math.floor(1000 + Math.random() * 9000));
const clock = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const verifiedStock = () => SELLER.invoices.reduce((a, i) => a + i.qty, 0);
const elapsed = () => {
  if (!S.inspectStart) return '0:00';
  const s = Math.floor(((S.inspectEnd || Date.now()) - S.inspectStart) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
function log(msg, kind = 'info') { S.log.unshift({ t: clock(), msg, kind }); }

function riskCheck() {
  const reasons = [];
  if (P.premiumBrand) reasons.push(`${P.brand} is on the premium brand list`);
  if (P.price >= RULES.priceThreshold) reasons.push(`Price ${rupees(P.price)} is at or above ${rupees(RULES.priceThreshold)}`);
  if (S.trust < RULES.minTrust) reasons.push(`Seller trust ${S.trust} is below ${RULES.minTrust}`);
  return { on: reasons.length > 0, reasons };
}

function trustTier(t) {
  if (t >= 80) return { label: 'Good standing', cls: 'good', text: 'Premium listings active.' };
  if (t >= 60) return { label: 'Under watch', cls: 'warn', text: 'Every order gets verified delivery. Lower search ranking.' };
  return { label: 'Suspended', cls: 'bad', text: 'Removed from premium categories pending review.' };
}

// ---------- authenticity stages ----------
function authStages() {
  const sc = SC();
  return [
    { title: 'Seller verified', proof: `${SELLER.name} (GSTIN ${SELLER.gstin}) buys from ${SELLER.distributor}, which is on ${P.brand}'s authorized distributor list.` },
    { title: 'Stock matched', proof: `This pair comes from ${verifiedStock()} verified pairs on 2 authorized invoices. Sales can't exceed verified stock.` },
    { title: 'Serial locked at packing', proof: `Serial <span class="mono">${O.serial}</span> was scanned, found in the ${P.brand} registry and printed on your invoice. Packing photo saved.`, photo: true },
    { title: 'Tamper seal applied', proof: `Seal <span class="seal">${O.seal}</span> applied at ${O.warehouse}. Parcel weight ${O.weight}.` },
    { title: `Seal checked at ${O.hub1}`, proof: `Seal ${O.seal} intact, weight ${O.weight} matches packing.` },
    { title: `Seal checked at ${O.hub2}`, proof: `Seal ${O.seal} intact, weight ${O.weight} matches packing. Last scan before delivery.` },
    {
      title: 'Doorstep verification',
      proof: S.doorstep === 'done' ? `Seal and serial matched at your door. You accepted with OTP 2.`
        : S.doorstep === 'failed' ? `Failed at your door: ${esc(S.rejectReason)}.`
        : `At delivery you'll check seal ${O.seal} and serial ending ${O.serial.slice(-4)} before accepting.`,
    },
  ];
}

function stageState(i) {
  if (i < 6) return i < S.step ? 'done' : (i === S.step ? 'current' : 'pending');
  return S.doorstep === 'done' ? 'done' : S.doorstep === 'failed' ? 'failed' : (S.step >= 6 ? 'current' : 'pending');
}

const ADVANCE = [
  null, null,
  { label: 'Simulate: seller packs the order' },
  null,
  { label: `Simulate: parcel reaches ${O.hub1}` },
  { label: `Simulate: parcel reaches ${O.hub2}, out for delivery` },
];

// ---------- guide ----------
function guide() {
  switch (S.stage) {
    case 'browse': return 'Choose how to pay, then place the order in the buyer app.';
    case 'transit': return 'Use the simulate button in the buyer app to move the parcel. Tap any tracker stage to see its proof.';
    case 'out': return 'The parcel is out for delivery. In the delivery partner app, tap “I’ve arrived”.';
    case 'arrived': return 'The buyer app shows OTP 1. Type it into the delivery partner app.';
    case 'seal': return 'In the buyer app, scan the seal on the bag before opening anything.';
    case 'inspect': return 'Scan the product serial and add the three photos, then accept or reject.';
    case 'accepted': return S.payment === 'due'
      ? 'Pay in the buyer app. Flipkart holds the money until OTP 2.'
      : 'Type OTP 2 from the buyer app into the delivery partner app to complete delivery.';
    case 'delivered': return 'Delivery complete, and only now was the seller paid. Try another scenario from the menu above.';
    case 'rejected': return 'In the delivery partner app, take the item back.';
    case 'returned': return 'Return picked up. See the back office for the refund and the seller’s trust score. Try another scenario.';
  }
  return '';
}

// ---------- buyer app ----------
function shoeArt() {
  return `<svg class="shoe" viewBox="0 0 240 120" role="img" aria-label="Sneaker illustration">
    <path d="M18 86 C20 60 44 50 66 48 L104 30 C116 25 128 30 134 40 L146 58 C170 60 200 64 216 76 C226 82 226 92 218 96 L28 96 C20 96 17 92 18 86 Z" fill="#c9d3d1" stroke="#10282e" stroke-width="2"/>
    <path d="M18 92 L222 92 L218 104 C216 108 212 110 206 110 L32 110 C24 110 19 106 18 100 Z" fill="#f5f7f6" stroke="#10282e" stroke-width="2"/>
    <path d="M70 52 L92 84 M88 42 L114 82 M122 50 L150 80" stroke="#10282e" stroke-width="2" fill="none"/>
    <path d="M100 34 L112 30 M106 40 L118 36 M112 46 L124 42" stroke="#10282e" stroke-width="2"/>
  </svg>`;
}

function packingPhoto() {
  return `<svg class="packshot" viewBox="0 0 200 90" role="img" aria-label="Packing photo of the sealed box">
    <rect x="1" y="1" width="198" height="88" rx="6" fill="#dfe6e3"/>
    <rect x="40" y="22" width="120" height="52" fill="#c4a87a" stroke="#10282e" stroke-width="1.5"/>
    <rect x="40" y="40" width="120" height="12" fill="#f2c230" stroke="#10282e" stroke-width="1"/>
    <text x="100" y="49.5" text-anchor="middle" font-size="8" font-family="JetBrains Mono, monospace" fill="#10282e">${O.seal}</text>
    <text x="8" y="84" font-size="7" font-family="JetBrains Mono, monospace" fill="#10282e">PACKED · ${O.serial}</text>
  </svg>`;
}

function trackerView() {
  const stages = authStages();
  const items = stages.map((s, i) => {
    const st = stageState(i);
    const open = S.expanded === i;
    const icon = st === 'done' ? '✓' : st === 'failed' ? '✕' : st === 'current' ? '•' : '';
    return `<li class="tk ${st}">
      <button class="tk-row" data-action="toggle" data-i="${i}" aria-expanded="${open}">
        <span class="tk-dot" aria-hidden="true">${icon}</span>
        <span class="tk-title">${s.title}</span>
        <span class="tk-state">${st === 'done' ? 'Verified' : st === 'failed' ? 'Failed' : st === 'current' ? 'Next' : 'Pending'}</span>
      </button>
      ${open ? `<div class="tk-proof">${st === 'pending' ? '<p class="muted">Not checked yet.</p>' : `<p>${s.proof}</p>`}${s.photo && st === 'done' ? packingPhoto() : ''}</div>` : ''}
    </li>`;
  }).join('');
  return `<ol class="tracker">${items}</ol>`;
}

function deliveryView() {
  const labels = ['Ordered', 'Packed', 'Shipped', 'Out for delivery', S.stage === 'rejected' || S.stage === 'returned' ? 'Returned at door' : 'Delivered'];
  let reached = 1;
  if (S.step >= 4) reached = 2;
  if (S.step >= 5) reached = 3;
  if (S.step >= 6) reached = 4;
  if (['delivered', 'rejected', 'returned'].includes(S.stage)) reached = 5;
  return `<ol class="tracker">${labels.map((l, i) => {
    const st = i < reached ? (i === 4 && S.stage !== 'delivered' ? 'failed' : 'done') : i === reached ? 'current' : 'pending';
    return `<li class="tk ${st}"><div class="tk-row static"><span class="tk-dot" aria-hidden="true">${st === 'done' ? '✓' : st === 'failed' ? '↩' : ''}</span><span class="tk-title">${l}</span></div></li>`;
  }).join('')}</ol>`;
}

function orderHeader() {
  return `<div class="order-mini">
    ${shoeArt()}
    <div><strong>${P.name}</strong><span class="muted">${P.variant} · ${rupees(P.price)}</span><span class="muted">Order ${O.id}</span></div>
  </div>`;
}

function otpBox(code, title, note) {
  return `<div class="otp-card">
    <p class="otp-title">${title}</p>
    <div class="otp-digits" aria-label="${title}: ${code.split('').join(' ')}">${code.split('').map(d => `<span>${d}</span>`).join('')}</div>
    <p class="muted small">${note}</p>
  </div>`;
}

function rejectBox(defaultReason) {
  if (!S.rejecting) return `<button class="btn btn-bad-ghost" data-action="start-reject">Reject at door</button>`;
  const reasons = ['Seal is different or broken', 'Serial doesn’t match the invoice', 'Product looks counterfeit', 'Product is damaged', 'Wrong size or colour'];
  const current = S.rejectReason || defaultReason;
  return `<div class="reject-box">
    <label for="reject-reason"><strong>Why are you rejecting it?</strong></label>
    <select id="reject-reason" data-bind="rejectReason">${reasons.map(r => `<option ${r === current ? 'selected' : ''}>${r}</option>`).join('')}</select>
    <p class="muted small">The item goes back with the delivery partner. A prepaid amount is refunded automatically.</p>
    <div class="row">
      <button class="btn btn-bad" data-action="confirm-reject">Confirm rejection</button>
      <button class="btn btn-ghost" data-action="cancel-reject">Keep checking</button>
    </div>
  </div>`;
}

function buyerApp() {
  const sc = SC();
  if (S.stage === 'browse') {
    const risk = riskCheck();
    return `<div class="product">
      ${shoeArt()}
      <h2>${P.name}</h2>
      <p class="muted">${P.variant}</p>
      <p class="price">${rupees(P.price)}</p>
      <p class="sold-by">Sold by <strong>${SELLER.name}</strong> <span class="chip good">Authorized seller</span></p>
      <div class="note good-note">
        <strong>Verified delivery on this order</strong>
        <p>${risk.reasons.join('. ')}. You’ll check the seal and serial before accepting, and the seller is paid only after you accept.</p>
      </div>
      <fieldset class="pay">
        <legend>Payment</legend>
        <label><input type="radio" name="pay" value="prepaid" ${S.payMode === 'prepaid' ? 'checked' : ''}> Pay now (UPI or card)</label>
        <label><input type="radio" name="pay" value="pod" ${S.payMode === 'pod' ? 'checked' : ''}> Pay on delivery, after checking</label>
      </fieldset>
      <button class="btn btn-wide" data-action="place-order">Place order</button>
    </div>`;
  }

  let top = '';
  if (S.stage === 'transit') {
    const nxt = ADVANCE[S.step];
    top = `<button class="btn btn-ghost btn-wide sim" data-action="advance">${nxt ? nxt.label : 'Simulate next event'}</button>`;
  }
  if (S.stage === 'out') {
    top = `<div class="note">
      <strong>Out for delivery</strong>
      <p>Your bag should carry seal <span class="seal">${O.seal}</span>. The serial on the shoe should end in <span class="mono">${O.serial.slice(-4)}</span>.</p>
    </div>`;
  }
  if (S.stage === 'arrived') {
    top = otpBox(S.otp1, 'OTP 1: share with the delivery partner', 'This confirms it’s you. Don’t open the bag yet.');
  }
  if (S.stage === 'seal') {
    const scanned = S.sealScanned;
    const ok = scanned === O.seal;
    top = `<section class="doorstep">
      <h3>Step 1 of 3: Check the seal</h3>
      <p>Expected seal from your tracker: <span class="seal">${O.seal}</span></p>
      ${scanned === null ? `<button class="btn btn-wide" data-action="scan-seal">Scan seal on the bag</button>` : `
        <div class="result ${ok ? 'good' : 'bad'}">
          <p><strong>${ok ? 'Seal matches' : 'Seal doesn’t match'}</strong></p>
          <p>Seal on the bag: <span class="seal ${ok ? '' : 'seal-bad'}">${esc(scanned)}</span></p>
          ${ok ? '' : `<p>The bag may have been opened after the last hub scan at ${O.hub2}. Don’t open it.</p>`}
        </div>
        ${ok ? `<button class="btn btn-wide" data-action="to-inspect">Open the bag and continue</button>` : rejectBox('Seal is different or broken')}`}
    </section>`;
  }
  if (S.stage === 'inspect') top = inspectView();
  if (S.stage === 'accepted') {
    top = S.payment === 'due'
      ? `<div class="note"><strong>Pay ${rupees(P.price)} to finish</strong><p>Flipkart holds the money and releases it to the seller only after you share OTP 2.</p>
         <button class="btn btn-wide" data-action="pay-pod">Pay ${rupees(P.price)} by UPI</button></div>`
      : otpBox(S.otp2, 'OTP 2: share to accept the product', 'Sharing this marks the order delivered and releases payment to the seller.');
  }
  if (S.stage === 'delivered') {
    top = `<div class="result good big"><p><strong>Delivered and verified</strong></p><p>Seal and serial matched. You accepted in ${elapsed()} at the door.</p></div>`;
  }
  if (S.stage === 'rejected' || S.stage === 'returned') {
    const refund = S.payment === 'refunded' ? `Refund of ${rupees(P.price)} started to your original payment method.` : 'You weren’t charged.';
    top = `<div class="result bad big"><p><strong>Rejected at the door</strong></p><p>Reason: ${esc(S.rejectReason)}.</p><p>${refund}</p></div>`;
  }

  return `${orderHeader()}${top}
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected="${S.buyerTab === 'auth'}" data-action="tab" data-tab="auth">Authenticity</button>
      <button role="tab" aria-selected="${S.buyerTab === 'delivery'}" data-action="tab" data-tab="delivery">Delivery</button>
    </div>
    ${S.buyerTab === 'auth' ? trackerView() : deliveryView()}`;
}

function inspectView() {
  const sr = S.serial;
  const allPhotos = PHOTO_SLOTS.every(p => S.photos[p.key]);
  const pr = S.photoResult;
  const photoFail = pr && PHOTO_SLOTS.some(p => !pr[p.key].ok);
  let verdict = '';
  if (sr && pr) {
    const good = sr.ok && !photoFail;
    verdict = `<div class="result ${good ? 'good' : 'bad'}">
      <p><strong>${good ? 'Looks genuine' : 'Suspicious: we recommend rejecting'}</strong></p>
      <p>${good ? 'Serial matches your invoice and the photos match the reference.' : 'At least one check failed. You can reject now and the item goes back.'}</p>
    </div>
    <div class="row">
      <button class="btn" data-action="accept" ${sr.ok ? '' : 'disabled'}>Accept product</button>
      ${S.rejecting ? '' : rejectBox()}
    </div>
    ${S.rejecting ? rejectBox(sr.ok ? 'Product looks counterfeit' : 'Serial doesn’t match the invoice') : ''}
    ${sr.ok ? '' : '<p class="muted small">Accept is turned off because the serial doesn’t match the invoice.</p>'}`;
  }

  return `<section class="doorstep">
    <h3>Step 2 of 3: Match the serial</h3>
    <p class="small">Your invoice says <span class="mono">${O.serial}</span>.</p>
    <div class="row">
      <input class="mono" id="serial" data-bind="serialInput" value="${esc(S.serialInput)}" placeholder="Serial on the shoe label" aria-label="Serial on the shoe label">
      <button class="btn btn-ghost" data-action="scan-serial">Scan</button>
      <button class="btn" data-action="check-serial">Check</button>
    </div>
    ${sr ? `<ul class="checks">${sr.items.map(c => `<li class="${c.ok ? 'good' : 'bad'}">${c.ok ? '✓' : '✕'} ${c.text}</li>`).join('')}</ul>` : ''}

    <h3>Step 3 of 3: Photo check</h3>
    <div class="photos">
      ${PHOTO_SLOTS.map(p => `<div class="slot">
        ${S.photos[p.key]
          ? (S.photos[p.key] === 'sample' ? `<div class="thumb sample">${p.label}<br>sample</div>` : `<img class="thumb" src="${S.photos[p.key]}" alt="${p.label} photo">`)
          : `<div class="thumb empty">${p.hint}</div>`}
        <span class="slot-name">${p.label}</span>
        <label class="link">Upload<input type="file" accept="image/*" capture="environment" data-photo="${p.key}" hidden></label>
        <button class="link" data-action="sample" data-k="${p.key}">Use sample</button>
      </div>`).join('')}
    </div>
    <button class="btn btn-wide" data-action="run-photo" ${allPhotos ? '' : 'disabled'}>Run photo check</button>
    ${pr ? `<ul class="checks">${PHOTO_SLOTS.map(p => `<li class="${pr[p.key].ok ? 'good' : 'bad'}">${pr[p.key].ok ? '✓' : '✕'} ${pr[p.key].note}</li>`).join('')}</ul>
      <p class="muted small">Prototype: results come from the chosen scenario, standing in for an image-matching model.</p>` : ''}
    ${verdict}
  </section>`;
}

// ---------- delivery partner app ----------
function partnerApp() {
  const card = `<div class="drop">
    <p><strong>${DATA.buyer.name}</strong></p>
    <p class="muted">${DATA.buyer.address}</p>
    <p class="muted">${O.id} · ${S.payMode === 'prepaid' ? 'Prepaid' : `Pay on delivery, ${rupees(P.price)}`}</p>
    <p><span class="chip warn">Verified delivery: 2 OTPs</span></p>
  </div>`;

  if (['browse', 'transit'].includes(S.stage)) {
    return `<div class="empty-state"><p><strong>No delivery assigned yet</strong></p><p class="muted">This order appears here once it’s out for delivery.</p></div>`;
  }
  if (S.stage === 'out') {
    return `${card}<p class="small">Before handing over, the buyer checks seal <span class="seal">${O.seal}</span> and the product serial.</p>
      <button class="btn btn-wide" data-action="arrive">I’ve arrived</button>`;
  }
  if (S.stage === 'arrived') {
    return `${card}<label class="field"><span>Enter OTP 1 from the buyer</span>
      <input class="mono otp-in" inputmode="numeric" maxlength="4" data-bind="otp1Input" value="${esc(S.otp1Input)}" aria-label="OTP 1"></label>
      ${S.partnerError ? `<p class="error">${S.partnerError}</p>` : ''}
      <button class="btn btn-wide" data-action="verify-otp1">Verify OTP 1</button>`;
  }
  if (S.stage === 'seal' || S.stage === 'inspect') {
    const steps = [
      ['Seal check', S.sealScanned === null ? 'current' : (S.sealScanned === O.seal ? 'done' : 'failed')],
      ['Serial match', S.serial ? (S.serial.ok ? 'done' : 'failed') : (S.stage === 'inspect' ? 'current' : 'pending')],
      ['Photo check', S.photoResult ? (PHOTO_SLOTS.every(p => S.photoResult[p.key].ok) ? 'done' : 'failed') : 'pending'],
    ];
    return `${card}<div class="wait">
      <p><strong>Buyer is checking the product</strong></p>
      <p class="timer"><span id="ptimer">${elapsed()}</span> <span class="muted small">target under 2:00</span></p>
      <ul class="checks">${steps.map(([l, st]) => `<li class="${st === 'done' ? 'good' : st === 'failed' ? 'bad' : ''}">${st === 'done' ? '✓' : st === 'failed' ? '✕' : '○'} ${l}</li>`).join('')}</ul>
      <p class="muted small">Wait at the door. Don’t take the parcel back unless the buyer rejects it.</p>
    </div>`;
  }
  if (S.stage === 'accepted') {
    if (S.payment === 'due') return `${card}<div class="wait"><p><strong>Buyer accepted</strong></p><p class="muted">Waiting for the buyer to pay ${rupees(P.price)} in the app.</p></div>`;
    return `${card}<label class="field"><span>Enter OTP 2 from the buyer</span>
      <input class="mono otp-in" inputmode="numeric" maxlength="4" data-bind="otp2Input" value="${esc(S.otp2Input)}" aria-label="OTP 2"></label>
      ${S.partnerError ? `<p class="error">${S.partnerError}</p>` : ''}
      <button class="btn btn-wide" data-action="verify-otp2">Mark delivered</button>`;
  }
  if (S.stage === 'delivered') {
    return `${card}<div class="result good big"><p><strong>Delivered</strong></p><p>OTP 2 verified. Doorstep check took ${elapsed()}.</p></div>`;
  }
  if (S.stage === 'rejected') {
    return `${card}<div class="result bad"><p><strong>Buyer rejected the item</strong></p><p>Reason: ${esc(S.rejectReason)}.</p></div>
      <button class="btn btn-wide" data-action="pickup">Take item back</button>`;
  }
  if (S.stage === 'returned') {
    return `${card}<div class="result"><p><strong>Return picked up</strong></p><p>The item goes to the inspection hub with the packing photo and seal record.</p></div>`;
  }
  return '';
}

// ---------- back office ----------
function backOffice() {
  const payLabels = {
    unpaid: ['Not paid yet', '', 'Nothing is collected until the order is placed.'],
    held: ['Held by Flipkart', 'warn', 'The buyer has paid. The seller gets nothing until the buyer accepts with OTP 2.'],
    due: ['Due at the door', '', 'The buyer pays only after checking the product.'],
    released: ['Released to seller', 'good', 'Paid out after OTP 2, when the buyer had verified and accepted the product.'],
    refunded: ['Refunded to buyer', 'bad', 'Rejected at the door, so the held amount went back to the buyer. The seller was never paid.'],
    'not-charged': ['Not charged', 'bad', 'Rejected at the door before payment. The seller is not paid.'],
  };
  const [pl, pc, pt] = payLabels[S.payment];
  const flow = ['Buyer pays', 'Held by Flipkart', S.payment === 'refunded' ? 'Refunded' : 'Released after OTP 2'];
  const flowAt = { unpaid: -1, due: -1, held: 1, released: 2, refunded: 2, 'not-charged': -1 }[S.payment];

  const tier = trustTier(S.trust);
  const stock = verifiedStock();
  const risk = riskCheck();

  return `
  <section class="panel">
    <h2>Payment</h2>
    <div class="pay-head"><span class="amount">${rupees(P.price)}</span><span class="chip ${pc}">${pl}</span></div>
    <p class="small">${pt}</p>
    <ol class="rail">${flow.map((f, i) => `<li class="${i <= flowAt ? 'on' : ''} ${i === 2 && S.payment === 'refunded' ? 'bad' : ''}">${f}</li>`).join('')}</ol>
    <p class="muted small">Mode: ${S.payMode === 'prepaid' ? 'paid in advance' : 'pay on delivery'}</p>
  </section>

  <section class="panel">
    <h2>Seller</h2>
    <div class="seller-head">
      <div><strong>${SELLER.name}</strong><span class="muted small">GSTIN ${SELLER.gstin}</span></div>
      <div class="trust ${tier.cls}"><span class="trust-num">${S.trust}</span><span class="small">trust score</span></div>
    </div>
    <div class="bar"><span class="${tier.cls}" style="width:${S.trust}%"></span></div>
    <p class="small"><strong>${tier.label}.</strong> ${tier.text}</p>
    ${S.sellerNote ? `<p class="note small">${S.sellerNote}</p>` : ''}
    <table>
      <caption class="muted small">Authorized invoices from ${SELLER.distributor} (GSTIN ${SELLER.distributorGstin}, on the brand’s list)</caption>
      <thead><tr><th>Invoice</th><th>Date</th><th>Pairs</th></tr></thead>
      <tbody>${SELLER.invoices.map(i => `<tr><td class="mono">${i.no}</td><td>${i.date}</td><td>${i.qty}</td></tr>`).join('')}</tbody>
    </table>
    <p class="small">Verified stock ${stock} · sold ${S.sold} · left to sell <strong>${stock - S.sold}</strong></p>
    <button class="btn btn-ghost" data-action="list-more">Try listing 60 more pairs</button>
    ${S.listMsg ? `<p class="error">${S.listMsg}</p>` : ''}
  </section>

  <section class="panel">
    <h2>Why this order gets verified delivery</h2>
    <ul class="checks">${risk.reasons.map(r => `<li class="good">✓ ${r}</li>`).join('')}</ul>
    <p class="muted small">Orders that meet none of these rules ship normally, without the doorstep check.</p>
  </section>

  <section class="panel">
    <h2>Event log</h2>
    ${S.log.length ? `<ol class="log">${S.log.map(e => `<li class="${e.kind}"><span class="mono">${e.t}</span> ${e.msg}</li>`).join('')}</ol>` : '<p class="muted small">Events appear here as the order moves.</p>'}
  </section>`;
}

// ---------- actions ----------
const actions = {
  'place-order'() {
    S.stage = 'transit'; S.step = 2; S.sold += 1;
    log(`Order ${O.id} placed for ${P.name}, ${rupees(P.price)}`);
    log(`Verified delivery switched on: ${riskCheck().reasons.join('; ')}`);
    log(`Seller ${SELLER.name} verified against ${P.brand}'s authorized distributor list`, 'good');
    log(`Stock check passed: ${S.sold} of ${verifiedStock()} verified pairs now sold`, 'good');
    if (S.payMode === 'prepaid') { S.payment = 'held'; log(`${rupees(P.price)} paid by buyer, held by Flipkart`); }
    else { S.payment = 'due'; log('Pay on delivery: buyer pays after checking the product'); }
  },
  advance() {
    if (S.step === 2) { S.step = 4; log(`Serial ${O.serial} scanned at packing, found in brand registry, printed on invoice`, 'good'); log(`Packing photo saved; seal ${O.seal} applied, weight ${O.weight}`, 'good'); }
    else if (S.step === 4) { S.step = 5; log(`${O.hub1}: seal ${O.seal} intact, weight matches`, 'good'); }
    else if (S.step === 5) { S.step = 6; S.stage = 'out'; S.doorstep = 'current'; log(`${O.hub2}: seal ${O.seal} intact, weight matches`, 'good'); log('Out for delivery'); }
  },
  arrive() { S.stage = 'arrived'; S.otp1 = otp(); S.partnerError = ''; log('Delivery partner at the door; OTP 1 sent to buyer'); },
  'verify-otp1'() {
    if (S.otp1Input.trim() !== S.otp1) { S.partnerError = 'OTP 1 doesn’t match. Ask the buyer to read it again.'; return; }
    S.partnerError = ''; S.stage = 'seal'; S.inspectStart = Date.now(); log('OTP 1 verified: buyer identity confirmed', 'good');
  },
  'scan-seal'() {
    S.sealScanned = SC().bagSeal;
    if (S.sealScanned === O.seal) log(`Doorstep seal scan: ${S.sealScanned} matches`, 'good');
    else log(`Doorstep seal scan: found ${S.sealScanned}, expected ${O.seal}`, 'bad');
  },
  'to-inspect'() { S.stage = 'inspect'; },
  'scan-serial'() { S.serialInput = SC().productSerial; actions['check-serial'](); },
  'check-serial'() {
    const v = S.serialInput.trim().toUpperCase();
    if (!v) { S.serial = { ok: false, items: [{ ok: false, text: 'Enter or scan the serial first' }] }; return; }
    const match = v === O.serial, inReg = DATA.brandRegistry.includes(v);
    S.serial = { ok: match && inReg, items: [
      { ok: match, text: match ? 'Matches the serial on your invoice' : `Doesn’t match the invoice serial ${O.serial}` },
      { ok: inReg, text: inReg ? `Found in the ${P.brand} registry` : `Not found in the ${P.brand} registry` },
    ] };
    log(`Doorstep serial check: ${v} ${S.serial.ok ? 'matches invoice and registry' : 'failed'}`, S.serial.ok ? 'good' : 'bad');
  },
  sample(el) { S.photos[el.dataset.k] = 'sample'; },
  'run-photo'() {
    S.photoResult = SC().photos;
    const fails = PHOTO_SLOTS.filter(p => !S.photoResult[p.key].ok).length;
    log(`Photo check: ${fails ? `${fails} of 3 checks failed` : 'all 3 checks passed'}`, fails ? 'bad' : 'good');
  },
  'start-reject'() { S.rejecting = true; },
  'cancel-reject'() { S.rejecting = false; },
  'confirm-reject'() {
    const sel = document.getElementById('reject-reason');
    S.rejectReason = sel ? sel.value : 'Rejected';
    S.rejecting = false; S.stage = 'rejected'; S.doorstep = 'failed'; S.inspectEnd = Date.now();
    log(`Buyer rejected at the door: ${S.rejectReason}`, 'bad');
    if (S.payment === 'held') { S.payment = 'refunded'; log(`${rupees(P.price)} refund started to buyer; seller not paid`); }
    else if (S.payment === 'due') { S.payment = 'not-charged'; log('Buyer not charged; seller not paid'); }

    const sealIssue = S.sealScanned && S.sealScanned !== O.seal;
    const fakeSignal = (S.serial && !S.serial.ok) || (S.photoResult && PHOTO_SLOTS.some(p => !S.photoResult[p.key].ok));
    if (sealIssue) {
      S.sellerNote = `No seller penalty: the seal was intact at ${O.hub2}, so the tamper happened after the last hub. A logistics investigation was opened.`;
      log(`Logistics investigation opened for the leg after ${O.hub2}`);
    } else if (fakeSignal) {
      const before = S.trust; S.trust = Math.max(0, S.trust - 18);
      S.sellerNote = `Trust score cut from ${before} to ${S.trust}: serial or photo check failed on a sealed parcel, so the item left the seller this way.`;
      log(`Seller trust score ${before} → ${S.trust} (counterfeit signal on a sealed parcel)`, 'bad');
    } else {
      S.sellerNote = 'No penalty yet: every check passed, so the return goes to inspection. If it’s genuine, the buyer’s misuse score goes up instead.';
      log('All checks had passed: return sent to inspection before any penalty');
    }
  },
  pickup() { S.stage = 'returned'; log('Return picked up at the door, sent to inspection hub'); },
  accept() {
    S.stage = 'accepted'; S.otp2 = otp(); S.inspectEnd = Date.now(); S.partnerError = '';
    log('Buyer accepted the product after checks', 'good');
  },
  'pay-pod'() { S.payment = 'held'; log(`${rupees(P.price)} paid at the door, held by Flipkart until OTP 2`); },
  'verify-otp2'() {
    if (S.otp2Input.trim() !== S.otp2) { S.partnerError = 'OTP 2 doesn’t match. Ask the buyer to read it again.'; return; }
    S.partnerError = ''; S.stage = 'delivered'; S.doorstep = 'done'; S.payment = 'released';
    log('OTP 2 verified: order marked delivered', 'good');
    log(`${rupees(P.price)} released to ${SELLER.name}`, 'good');
  },
  'list-more'() {
    const left = verifiedStock() - S.sold;
    S.listMsg = `Blocked: only ${left} verified pairs are left. Upload a new authorized invoice to list more.`;
    log(`Listing of 60 more pairs blocked by stock reconciliation (${left} verified left)`, 'bad');
  },
  tab(el) { S.buyerTab = el.dataset.tab; },
  toggle(el) { const i = Number(el.dataset.i); S.expanded = S.expanded === i ? null : i; },
  reset() { S = fresh(S.scenario, S.payMode); },
};

// ---------- render + events ----------
const $ = id => document.getElementById(id);

function render() {
  $('buyer').innerHTML = buyerApp();
  $('partner').innerHTML = partnerApp();
  $('office').innerHTML = backOffice();
  $('guide-text').textContent = guide();
  $('scenario').value = S.scenario;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) { fn(el); render(); }
});

document.addEventListener('input', e => {
  const key = e.target.dataset.bind;
  if (key) S[key] = e.target.value;
});

document.addEventListener('change', e => {
  if (e.target.name === 'pay') { S.payMode = e.target.value; render(); }
  if (e.target.id === 'scenario') { S = fresh(e.target.value, S.payMode); render(); }
  if (e.target.dataset.photo) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const key = e.target.dataset.photo;
    const reader = new FileReader();
    reader.onload = () => { S.photos[key] = reader.result; render(); };
    reader.readAsDataURL(file);
  }
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const b = e.target.dataset && e.target.dataset.bind;
  const map = { otp1Input: 'verify-otp1', otp2Input: 'verify-otp2', serialInput: 'check-serial' };
  if (b && map[b]) { actions[map[b]](); render(); }
});

setInterval(() => { const t = $('ptimer'); if (t) t.textContent = elapsed(); }, 1000);

// scenario menu
$('scenario').innerHTML = Object.entries(DATA.scenarios).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
render();
