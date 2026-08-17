(() => {
  const replacements = [
    ['AutoGateway', 'OmniUPI'],
    ['AUTOGATEWAY', 'OMNIUPI'],
    ['automatic-upi-gateway.onrender.com', 'api.omniupi.in'],
    ['yourquirey-gif.github.io/automatic-upi-gateway', 'omniupi.in'],
    ['https://yourquirey-gif.github.io/automatic-upi-gateway', 'https://omniupi.in'],
  ];
  const replace = (value) => replacements.reduce((v, [from, to]) => v.split(from).join(to), value);
  const fix = (root = document) => {
    const walker = document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => { const next = replace(node.nodeValue || ''); if (next !== node.nodeValue) node.nodeValue = next; });
    document.querySelectorAll('[href],[src],[content],[action]').forEach(el => {
      ['href','src','content','action'].forEach(attr => { if (el.hasAttribute(attr)) { const v = replace(el.getAttribute(attr)); if (v !== el.getAttribute(attr)) el.setAttribute(attr, v); } });
    });
    if (document.title) document.title = replace(document.title);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => fix()); else fix();
  new MutationObserver(() => fix()).observe(document.documentElement, { childList: true, subtree: true });
})();
