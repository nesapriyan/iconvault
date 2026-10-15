import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { BadRequestError } from '../utils/errors.js';

export interface SanitizedSvgResult {
  sanitizedSvg: string;
  width: number;
  height: number;
  viewBox: string;
  hasStroke: boolean;
  hasGradient: boolean;
  hasText: boolean;
  hasImage: boolean;
  warnings: string[];
}

// Setup DOMPurify with JSDOM
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window as any);

// Allowed SVG tags and attributes
const ALLOWED_TAGS = [
  'svg', 'g', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline',
  'ellipse', 'defs', 'clipPath', 'mask', 'pattern', 'linearGradient',
  'radialGradient', 'stop', 'text', 'tspan', 'symbol', 'use'
];

const ALLOWED_ATTR = [
  'xmlns', 'xmlns:xlink', 'version', 'viewBox', 'width', 'height',
  'id', 'class', 'fill', 'fill-rule', 'fill-opacity', 'stroke',
  'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity',
  'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'points', 'transform', 'opacity', 'style', 'clip-path', 'mask',
  'offset', 'stop-color', 'stop-opacity', 'gradientTransform',
  'gradientUnits', 'spreadMethod', 'href', 'xlink:href'
];

export const SvgSanitizer = {
  sanitize(rawInput: string | Buffer): SanitizedSvgResult {
    let svgString = typeof rawInput === 'string' ? rawInput : rawInput.toString('utf8');

    // Remove BOM and trim
    svgString = svgString.replace(/^\uFEFF/, '').trim();

    // Check for XXE and DOCTYPE entity expansion attacks
    if (/<!ENTITY/i.test(svgString)) {
      throw new BadRequestError('Invalid SVG: XML entities are not permitted for security reasons');
    }

    // Must contain an <svg tag
    if (!/<svg[\s>]/i.test(svgString)) {
      throw new BadRequestError('Invalid file: Content is not a valid SVG document');
    }

    // Run DOMPurify with strict SVG config
    const purified = DOMPurify.sanitize(svgString, {
      USE_PROFILES: { svg: true, svgFilters: false },
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'foreignObject', 'link', 'meta', 'audio', 'video'],
      FORBID_ATTR: ['onload', 'onclick', 'onerror', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
      ALLOW_DATA_ATTR: false
    });

    if (!purified || !/<svg[\s>]/i.test(purified)) {
      throw new BadRequestError('SVG sanitization failed: No valid SVG content remained');
    }

    // Parse with JSDOM for deep inspection and final cleanup
    const dom = new JSDOM(purified, { contentType: 'image/svg+xml' });
    const document = dom.window.document;
    const svgEl = document.querySelector('svg');

    if (!svgEl) {
      throw new BadRequestError('Failed to parse sanitized SVG');
    }

    // Check and neutralize external hrefs in <use> or other tags
    const elementsWithHref = svgEl.querySelectorAll('[href], [xlink\\:href]');
    elementsWithHref.forEach(el => {
      const href = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
      // Reject external URLs
      if (/^(https?:|\/\/|javascript:|data:)/i.test(href)) {
        el.removeAttribute('href');
        el.removeAttribute('xlink:href');
      }
    });

    // Check dimensions and viewBox
    let width = 24;
    let height = 24;
    let viewBox = svgEl.getAttribute('viewBox') || '';

    const widthAttr = svgEl.getAttribute('width');
    const heightAttr = svgEl.getAttribute('height');

    if (widthAttr) {
      const parsedW = parseFloat(widthAttr.replace(/px/i, ''));
      if (!isNaN(parsedW) && parsedW > 0) width = Math.round(parsedW);
    }
    if (heightAttr) {
      const parsedH = parseFloat(heightAttr.replace(/px/i, ''));
      if (!isNaN(parsedH) && parsedH > 0) height = Math.round(parsedH);
    }

    if (!viewBox) {
      viewBox = `0 0 ${width} ${height}`;
      svgEl.setAttribute('viewBox', viewBox);
    }

    // Inspect characteristics for font conversion warnings
    const warnings: string[] = [];

    // Check strokes
    const strokeElements = svgEl.querySelectorAll('[stroke]:not([stroke="none"]):not([stroke="transparent"])');
    const rootStroke = svgEl.getAttribute('stroke');
    const hasStroke = strokeElements.length > 0 || (!!rootStroke && rootStroke !== 'none' && rootStroke !== 'transparent') || /stroke\s*:\s*(?!none|transparent)/i.test(purified);
    if (hasStroke) {
      warnings.push('Contains stroke attributes. Icon fonts require filled outlines rather than strokes.');
    }

    // Check gradients
    const hasGradient = svgEl.querySelectorAll('linearGradient, radialGradient').length > 0;
    if (hasGradient) {
      warnings.push('Contains color gradients. Icon fonts only render solid single-color glyphs.');
    }

    // Check text
    const hasText = svgEl.querySelectorAll('text, tspan').length > 0;
    if (hasText) {
      warnings.push('Contains text elements. Text should be converted to path outlines.');
    }

    // Check embedded images
    const hasImage = svgEl.querySelectorAll('image').length > 0;
    if (hasImage) {
      warnings.push('Contains raster images which cannot be converted to icon fonts or vector paths.');
    }

    // Ensure xmlns is present on root
    if (!svgEl.getAttribute('xmlns')) {
      try {
        svgEl.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns', 'http://www.w3.org/2000/svg');
      } catch {}
    }

    let finalSvg = svgEl.outerHTML;
    if (!finalSvg.includes('xmlns=')) {
      finalSvg = finalSvg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    return {
      sanitizedSvg: finalSvg,
      width,
      height,
      viewBox,
      hasStroke,
      hasGradient,
      hasText,
      hasImage,
      warnings
    };
  }
};
