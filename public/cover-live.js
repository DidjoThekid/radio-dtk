// Radio DTK : affiche la pochette intégrée du MP3 en cours à la place des barres roses de la carte.
(function () {
  var cache = {};
  var tracked = [];

  var origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (tracked.indexOf(this) === -1) tracked.push(this);
    return origPlay.apply(this, arguments);
  };

  function concat(chunks) {
    var n = 0, i, out, p = 0;
    for (i = 0; i < chunks.length; i++) n += chunks[i].length;
    out = new Uint8Array(n);
    for (i = 0; i < chunks.length; i++) { out.set(chunks[i], p); p += chunks[i].length; }
    return out;
  }
  function tagSize(h) {
    return ((h[6] & 0x7f) << 21) | ((h[7] & 0x7f) << 14) | ((h[8] & 0x7f) << 7) | (h[9] & 0x7f);
  }

  async function fetchHead(url) {
    var res = await fetch(url, { headers: { Range: 'bytes=0-3000000' } });
    var reader = res.body.getReader();
    var chunks = [], got = 0, need = 0;
    while (true) {
      var r = await reader.read();
      if (r.done) break;
      chunks.push(r.value); got += r.value.length;
      if (!need && got >= 10) {
        var h = concat(chunks);
        if (h[0] !== 0x49 || h[1] !== 0x44 || h[2] !== 0x33) { reader.cancel(); return null; }
        need = 10 + tagSize(h);
      }
      if (need && got >= need) break;
    }
    try { reader.cancel(); } catch (e) {}
    return concat(chunks);
  }

  function parseCover(bytes) {
    var ver = bytes[3], size = tagSize(bytes);
    var buf = bytes.subarray(10, 10 + size), pos = 0;
    if (bytes[5] & 0x40) {
      pos += ver === 4
        ? ((buf[0] & 0x7f) << 21) | ((buf[1] & 0x7f) << 14) | ((buf[2] & 0x7f) << 7) | (buf[3] & 0x7f)
        : (buf[0] << 24 | buf[1] << 16 | buf[2] << 8 | buf[3]) + 4;
    }
    var idLen = ver === 2 ? 3 : 4, hdrLen = ver === 2 ? 6 : 10;
    while (pos + hdrLen <= buf.length) {
      var id = String.fromCharCode.apply(null, buf.subarray(pos, pos + idLen));
      if (!/^[A-Z0-9]+$/.test(id)) break;
      var fsize;
      if (ver === 2) fsize = (buf[pos + 3] << 16) | (buf[pos + 4] << 8) | buf[pos + 5];
      else if (ver === 4) fsize = ((buf[pos + 4] & 0x7f) << 21) | ((buf[pos + 5] & 0x7f) << 14) | ((buf[pos + 6] & 0x7f) << 7) | (buf[pos + 7] & 0x7f);
      else fsize = (buf[pos + 4] << 24 | buf[pos + 5] << 16 | buf[pos + 6] << 8 | buf[pos + 7]) >>> 0;
      var start = pos + hdrLen, end = start + fsize;
      if (fsize <= 0 || end > buf.length) break;
      if (id === 'APIC' || id === 'PIC') {
        var d = buf.subarray(start, end), enc = d[0], i = 1, mime;
        if (id === 'PIC') {
          mime = String.fromCharCode(d[1], d[2], d[3]).toLowerCase() === 'png' ? 'image/png' : 'image/jpeg'; i = 4;
        } else {
          var j = i; while (j < d.length && d[j] !== 0) j++;
          mime = String.fromCharCode.apply(null, d.subarray(i, j)) || 'image/jpeg'; i = j + 1;
        }
        i += 1;
        if (enc === 1 || enc === 2) { while (i + 1 < d.length && !(d[i] === 0 && d[i + 1] === 0)) i += 2; i += 2; }
        else { while (i < d.length && d[i] !== 0) i++; i += 1; }
        if (mime === 'image/jpg') mime = 'image/jpeg';
        return new Blob([d.subarray(i)], { type: mime });
      }
      pos = end;
    }
    return null;
  }

  // Trouve les barres roses (juste au-dessus du texte "EN DIRECT" / "PUBLICITÉ" dans la carte)
  function findBars() {
    var els = document.querySelectorAll('div,span,p,small,h6');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length || !/^(en direct|publicit)/i.test(el.textContent.trim())) continue;
      var prev = el.previousElementSibling;
      if (!prev) continue;
      var r = prev.getBoundingClientRect();
      if (r.width >= 24 && r.height >= 24 && r.height < 200) return { label: el, bars: prev };
    }
    return null;
  }
  function showCover(url) {
    var img = document.getElementById('cover-live-img');
    if (!img) {
      var t = findBars(); if (!t) return;
      img = document.createElement('img');
      img.id = 'cover-live-img';
      img.alt = 'Pochette';
      img.style.cssText = 'display:block;margin:0 auto 12px;width:min(170px,50vw);height:min(170px,50vw);' +
        'object-fit:cover;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.45)';
      t.label.parentNode.insertBefore(img, t.label);
      t.bars.setAttribute('data-cover-hidden', '1');
      t.bars.style.display = 'none';
    }
    if (img.src !== url) img.src = url;
  }
  function showBars() {
    var img = document.getElementById('cover-live-img');
    if (img) img.remove();
    var b = document.querySelector('[data-cover-hidden]');
    if (b) { b.style.display = ''; b.removeAttribute('data-cover-hidden'); }
  }

  function load(src) {
    if (!cache[src]) {
      cache[src] = (async function () {
        try {
          var head = await fetchHead(src);
          var blob = head && parseCover(head);
          return blob ? URL.createObjectURL(blob) : null;
        } catch (e) { return null; }
      })();
    }
    return cache[src];
  }

  function currentSrc() {
    var els = tracked.concat([].slice.call(document.querySelectorAll('audio')));
    for (var i = 0; i < els.length; i++) {
      var s = els[i].currentSrc || els[i].src;
      if (s && !els[i].paused) return s;
    }
    return null;
  }

  async function tick() {
    var src = currentSrc();
    if (!src) return;
    var url = await load(src);
    if (src !== currentSrc()) return;
    if (url) showCover(url); else showBars();
  }
  setInterval(tick, 1000);
})();
