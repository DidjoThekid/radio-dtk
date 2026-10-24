// Recharge l'app automatiquement quand une nouvelle version du site est en ligne.
(function () {
  var current = null;
  async function check() {
    try {
      var r = await fetch('/api/version', { cache: 'no-store' });
      var d = await r.json();
      if (current && d.version !== current) { location.reload(); return; }
      current = d.version;
    } catch (e) {}
  }
  check();
  setInterval(check, 30000);
})();
