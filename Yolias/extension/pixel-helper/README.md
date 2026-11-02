# Yolias Pixel Helper (Chrome, Manifest V3)

Verify, debug and inspect Yolias Pixel events on any website.

- Finds the Yolias pixel on the page (`yolias.com/px.js`, `yolias("init", …)`), checks each pixel ID with Yolias (`/api/px?check=`).
- Lists every event the pixel sent (PageView, Purchase, Lead, InitiateCheckout, custom events) with its parameters, whether the visitor came from a Yolias link, email matching and test codes.
- Shows problems like Facebook's Pixel Helper: event sent before `init`, Purchase without `value` or `currency`, a non-standard event sent with `track`, a repeated `event_id`, an unknown pixel ID.
- The toolbar badge shows the number of events (red when there is an error).

It reads only what the Yolias pixel announces on the page (the `yolias:pixel` DOM event) and the pixel's script tags; nothing is sent anywhere except the pixel ID check to Yolias.

Load for testing: chrome://extensions → Developer mode → Load unpacked → this folder.
