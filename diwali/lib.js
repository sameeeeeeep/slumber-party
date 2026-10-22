/* Shared by index.html and make.html: phone → short key. */
(function () {
  function sha256(str) {
    const K = [], H = [];
    let n = 2, c = 0;
    const isPrime = x => { for (let i = 2; i * i <= x; i++) if (x % i === 0) return false; return true; };
    while (c < 64) {
      if (isPrime(n)) {
        if (c < 8) H[c] = (Math.pow(n, 1 / 2) * 2 ** 32) | 0;
        K[c++] = (Math.pow(n, 1 / 3) * 2 ** 32) | 0;
      }
      n++;
    }
    const bytes = new TextEncoder().encode(str);
    const len = bytes.length;
    const total = ((len + 9 + 63) >> 6) << 4;
    const words = new Array(total).fill(0);
    for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
    words[total - 1] = len * 8;
    const r = (x, k) => (x >>> k) | (x << (32 - k));
    let h = H.slice();
    for (let j = 0; j < total; j += 16) {
      const w = words.slice(j, j + 16);
      let [a, b, cc, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        if (i >= 16) {
          const w15 = w[i - 15], w2 = w[i - 2];
          w[i] = (w[i - 16] + (r(w15, 7) ^ r(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (r(w2, 17) ^ r(w2, 19) ^ (w2 >>> 10))) | 0;
        }
        const t1 = (hh + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & cc) ^ (b & cc))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = b; b = a; a = (t1 + t2) | 0;
      }
      h = [a, b, cc, d, e, f, g, hh].map((v, i) => (v + h[i]) | 0);
    }
    return h.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
  }

  // Indian numbers: keep the last 10 digits so +91 / 0 / spaces don't matter.
  const digits = phone => String(phone || '').replace(/\D/g, '').slice(-10);
  const keyFor = (phone, salt) => sha256(salt + ':' + digits(phone)).slice(0, 10);

  window.MKDLib = { sha256, digits, keyFor };
})();
