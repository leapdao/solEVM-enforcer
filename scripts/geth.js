
var personal = personal;

if (personal.listAccounts.length === 0) {
  var k = '2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120';

  for (var i = 0; i < 5; i++) {
    try {
      personal.importRawKey(k + i.toString(), '');
    } catch (e) {
    }
  }
}

personal.listAccounts.forEach(
  function (e) {
    personal.unlockAccount(e, '', ~0 >>> 0);
  }
);
