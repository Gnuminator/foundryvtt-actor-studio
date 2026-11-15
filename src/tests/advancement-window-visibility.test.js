/**
 * Resume (fork, PR 10 lows): which advancement windows count as open, against a real DOM.
 * jsdom has no checkVisibility, so the computed-style path runs for real and the checkVisibility path is
 * exercised with a stand-in that records its arguments. (tests/setup.js replaces the global document, so a
 * JSDOM is installed per test.)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { advancementsStillOpen } from '~/src/helpers/CharacterResume';

const WINDOW_CLASS = 'application dnd5e2 advancement manager';

function addWindow(id, { hidden = false, style = '', parent = document.body } = {}) {
  const el = document.createElement('div');
  el.id = id;
  el.className = WINDOW_CLASS;
  if (hidden) el.setAttribute('hidden', '');
  if (style) el.setAttribute('style', style);
  parent.appendChild(el);
  return el;
}

let saved;
let dom;

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
  saved = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle, Element: globalThis.Element };
  globalThis.document = dom.window.document;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.Element = dom.window.Element;
  globalThis.foundry = { applications: { instances: new Map() } };
});

afterEach(() => {
  globalThis.document = saved.document;
  if (saved.getComputedStyle) globalThis.getComputedStyle = saved.getComputedStyle; else delete globalThis.getComputedStyle;
  if (saved.Element) globalThis.Element = saved.Element; else delete globalThis.Element;
  dom.window.close();
});

describe('advancementsStillOpen against a real DOM (computed style fallback)', () => {
  it('a plain window is open', () => {
    addWindow('w1');
    expect(advancementsStillOpen()).toBe(true);
  });

  it('display:none, the hidden attribute and a hidden ancestor are not open', () => {
    addWindow('w1', { style: 'display:none' });
    expect(advancementsStillOpen()).toBe(false);
    document.body.innerHTML = '';
    addWindow('w2', { hidden: true });
    expect(advancementsStillOpen()).toBe(false);
    document.body.innerHTML = '';
    const parent = document.createElement('section');
    parent.style.display = 'none';
    document.body.appendChild(parent);
    addWindow('w3', { parent });
    expect(advancementsStillOpen()).toBe(false);
  });

  it('visibility:hidden is not open', () => {
    addWindow('w1', { style: 'visibility:hidden' });
    expect(advancementsStillOpen()).toBe(false);
  });

  it('a hidden attribute that CSS overrides still counts as open', () => {
    const css = document.createElement('style');
    css.textContent = '.advancement.manager[hidden] { display: block !important; }';
    document.head.appendChild(css);
    addWindow('w1', { hidden: true });
    expect(advancementsStillOpen()).toBe(true);
  });
});

describe('advancementsStillOpen with the browser checkVisibility', () => {
  it('asks for the visibility property too and trusts the answer', () => {
    const calls = [];
    let answer = false;
    Element.prototype.checkVisibility = function (options) { calls.push(options); return answer; };
    addWindow('w1');
    expect(advancementsStillOpen()).toBe(false);
    expect(calls[0]).toMatchObject({ visibilityProperty: true });
    answer = true;
    expect(advancementsStillOpen()).toBe(true);
  });
});
