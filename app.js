// Den här filen finns bara kvar för gamla, cachade versioner av sidan som fortfarande pekar hit.
// Appen ligger nu i js/. Ladda om sidan förbi cachen en gång så hämtas den nya versionen.
(function () {
  if (sessionStorage.getItem('hpReloaded')) return;
  sessionStorage.setItem('hpReloaded', '1');
  location.replace(location.pathname + '?u=' + Date.now());
})();
