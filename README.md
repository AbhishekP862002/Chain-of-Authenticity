# Chain of Authenticity

A working prototype for **verified delivery of premium products** on an e-commerce marketplace. It supplements my 2-page submission for the Flipkart Associate Product Manager program.

## The problem

I ordered New Balance shoes worth ₹6,500 online and received a fake. The logo print was poor, the sole looked straight out of a moulding machine, and there was no brand QR code. Buyers have no way to confirm a product is genuine before accepting it, and existing OTP open-box delivery only proves the parcel wasn't opened in transit. A fake sealed by the seller passes every check.

## The solution in this prototype

**Verify → Show → Confirm → Settle**

| Feature | What you can try |
| --- | --- |
| Authorized seller and stock check | Back office shows the seller's authorized invoices. "Try listing 60 more pairs" is blocked because sales can't exceed verified stock. |
| Item locked at packing | The product serial is scanned, checked against the brand registry and printed on the invoice. A packing photo and a tamper seal ID are recorded. |
| Authenticity Tracker | In the buyer app, tap any stage to see its proof: seller check, stock match, serial, seal, hub scans. |
| Two-OTP doorstep verification | OTP 1 confirms the buyer → buyer scans the seal → opens the box, matches the serial, runs the photo check → OTP 2 accepts. Delivery counts as done only after OTP 2. |
| Payment held until OTP 2 | Buyer can pay in advance or on delivery. The money is held by Flipkart and released to the seller only after OTP 2. A rejection refunds automatically. |
| Seller trust score | A counterfeit signal on a sealed parcel cuts the seller's score. A seal tampered after the last hub opens a logistics investigation instead, with no seller penalty. |
| Risk-based trigger | Verified delivery switches on only for premium brands, orders at or above ₹3,000, or low-trust sellers. |

## Run it

No install or build step. Either:

- open `index.html` in any browser, or
- turn on **GitHub Pages** for this repo (Settings → Pages → deploy from `main`, root folder) to get a live demo link.

## Demo walkthrough (about 2 minutes)

The bar under the title always tells you the next step.

1. Pick a **scenario** at the top:
   - **Genuine product:** every check passes and the seller is paid after OTP 2.
   - **Seller packed a different item:** the seal is intact, but the serial and photos fail. The buyer rejects and the seller's trust score drops.
   - **Seal tampered in transit:** the seal at the door doesn't match. The buyer rejects before opening, and a logistics investigation opens.
2. In the **buyer app**, choose a payment mode and place the order.
3. Press the dashed **Simulate** button three times to move the parcel through packing and two hub scans.
4. In the **delivery partner app**, tap *I've arrived*, then type the OTP 1 shown in the buyer app.
5. In the buyer app, scan the seal, then scan the serial and add three photos ("Use sample" works).
6. Accept and share OTP 2, or reject at the door.
7. Watch the **back office**: payment status, seller trust score and the event log.

## Project structure

```
index.html        Layout: buyer app, delivery partner app, back office
css/styles.css    Styles
js/data.js        Mock data: product, seller, invoices, brand registry, scenarios
js/app.js         Order state machine, screens and actions
```

## What's simulated

All sellers, serials, invoices and GSTINs are mock data. The photo check returns results from the chosen scenario, standing in for an image-matching model. In production the brand registry would be a brand API, and the seal, weight and hub scans would come from logistics systems.
