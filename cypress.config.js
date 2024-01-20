import { defineConfig } from 'cypress';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs';

export default defineConfig({
  projectId: '5jtiwr',
  e2e: {
    baseUrl: 'http://localhost:3000',
    setupNodeEvents(on, config) {
      on('task', {
        compareSnapshots({ before, after, threshold }) {
          const beforeImage = PNG.sync.read(fs.readFileSync(before));
          const afterImage = PNG.sync.read(fs.readFileSync(after));
          const diff = new PNG({ width: beforeImage.width, height: beforeImage.height });

          const diffPixels = pixelmatch(
            beforeImage.data,
            afterImage.data,
            diff.data,
            beforeImage.width,
            beforeImage.height,
            { threshold: threshold }
          );

          // Return the number of pixels that are different
          return diffPixels;
        },
      });
    },
  },

  component: {
    devServer: {
      framework: "none",
      bundler: "vite",
    },
  },
});
