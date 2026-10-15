import { describe, it, expect } from 'vitest';
import { SvgSanitizer } from '../src/services/svgSanitizer.js';
import { BadRequestError } from '../src/utils/errors.js';

describe('SvgSanitizer', () => {
  it('should accept and clean a valid SVG', () => {
    const validSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z"/></svg>`;
    const result = SvgSanitizer.sanitize(validSvg);

    expect(result.sanitizedSvg).toContain('<svg');
    expect(result.viewBox).toBe('0 0 24 24');
    expect(result.width).toBe(24);
    expect(result.height).toBe(24);
    expect(result.warnings.length).toBe(0);
  });

  it('should strip malicious <script> tags', () => {
    const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <script>alert("xss")</script>
      <circle cx="12" cy="12" r="10"/>
    </svg>`;
    const result = SvgSanitizer.sanitize(maliciousSvg);

    expect(result.sanitizedSvg).not.toContain('<script');
    expect(result.sanitizedSvg).not.toContain('alert');
    expect(result.sanitizedSvg).toContain('<circle');
  });

  it('should remove inline event handlers (onload, onclick)', () => {
    const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" onload="fetch('http://evil.com')" onclick="steal()">
      <rect x="0" y="0" width="10" height="10" onmouseover="hack()"/>
    </svg>`;
    const result = SvgSanitizer.sanitize(maliciousSvg);

    expect(result.sanitizedSvg).not.toContain('onload');
    expect(result.sanitizedSvg).not.toContain('onclick');
    expect(result.sanitizedSvg).not.toContain('onmouseover');
  });

  it('should remove external href links', () => {
    const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg">
      <use href="https://evil.com/icon.svg#hack"/>
      <circle cx="5" cy="5" r="5"/>
    </svg>`;
    const result = SvgSanitizer.sanitize(maliciousSvg);

    expect(result.sanitizedSvg).not.toContain('https://evil.com');
  });

  it('should reject XXE entity expansion attacks', () => {
    const xxeSvg = `<?xml version="1.0"?>
    <!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
    <svg>&xxe;</svg>`;

    expect(() => SvgSanitizer.sanitize(xxeSvg)).toThrow(BadRequestError);
  });

  it('should reject non-SVG inputs', () => {
    const nonSvg = `<html><body>Not an SVG</body></html>`;
    expect(() => SvgSanitizer.sanitize(nonSvg)).toThrow(BadRequestError);
  });

  it('should detect strokes and warn for font conversions', () => {
    const strokeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor"><line x1="0" y1="0" x2="24" y2="24"/></svg>`;
    const result = SvgSanitizer.sanitize(strokeSvg);

    expect(result.hasStroke).toBe(true);
    expect(result.warnings.some(w => w.includes('stroke'))).toBe(true);
  });
});
