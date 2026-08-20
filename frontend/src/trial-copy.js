function updateTrialCopy() {
  const root = document.getElementById('root');
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    node.nodeValue = String(node.nodeValue || '')
      .replace(/\b2-day\b/gi, '7-day')
      .replace(/\b2 days\b/gi, '7 days')
      .replace(/\b2 day\b/gi, '7 day');
  }
}

window.addEventListener('load', updateTrialCopy, { once: true });
window.addEventListener('hashchange', () => setTimeout(updateTrialCopy, 0));
