import { createElement } from 'react';

function Metric({ value, label }) {
  return createElement('div', null,
    createElement('strong', null, value),
    createElement('span', null, label)
  );
}

function SectionHeading({ title, accent, text }) {
  return createElement('div', { className: 'section-heading' },
    createElement('h2', null, title, ' ', createElement('em', null, accent)),
    createElement('p', null, text)
  );
}

function FeatureCard({ title, text, Icon }) {
  return createElement('article', { className: 'feature-card' },
    createElement('div', { className: 'feature-icon' }, createElement(Icon, { size: 38 })),
    createElement('h3', null, title),
    createElement('p', null, text)
  );
}

globalThis.Metric = Metric;
globalThis.SectionHeading = SectionHeading;
globalThis.FeatureCard = FeatureCard;
