import { optimize, Config as SvgoConfig } from 'svgo';

export interface OptimizeSvgOptions {
  multipass?: boolean;
  removeDimensions?: boolean;
  keepViewBox?: boolean;
  stripColors?: boolean; // convert fill/stroke to currentColor
}

export interface OptimizedSvgResult {
  optimizedSvg: string;
  originalSize: number;
  optimizedSize: number;
  savingsPercent: number;
}

export const SvgOptimizer = {
  optimize(svgString: string, options: OptimizeSvgOptions = {}): OptimizedSvgResult {
    const originalSize = Buffer.byteLength(svgString, 'utf8');

    const plugins: any[] = [
      {
        name: 'preset-default',
        params: {
          overrides: {
            removeViewBox: options.keepViewBox !== false ? false : true,
            cleanupIds: false // prevent breaking internal references prematurely
          }
        }
      },
      'removeXMLNS' // Can re-add if needed
    ];

    if (options.removeDimensions) {
      plugins.push('removeDimensions');
    }

    if (options.stripColors) {
      plugins.push({
        name: 'convertColors',
        params: {
          currentColor: true
        }
      });
    }

    const config: SvgoConfig = {
      multipass: options.multipass !== false,
      plugins
    };

    try {
      const result = optimize(svgString, config);
      let output = result.data;

      // Ensure xmlns is present on root <svg>
      if (!output.includes('xmlns=')) {
        output = output.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const optimizedSize = Buffer.byteLength(output, 'utf8');
      const savingsPercent = originalSize > 0 
        ? Math.max(0, Math.round(((originalSize - optimizedSize) / originalSize) * 100))
        : 0;

      return {
        optimizedSvg: output,
        originalSize,
        optimizedSize,
        savingsPercent
      };
    } catch (err) {
      console.warn('SVGO optimization warning, falling back to original:', err);
      return {
        optimizedSvg: svgString,
        originalSize,
        optimizedSize: originalSize,
        savingsPercent: 0
      };
    }
  }
};
