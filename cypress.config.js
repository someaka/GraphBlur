import { defineConfig } from 'cypress';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  projectId: '5jtiwr',
  e2e: {
    baseUrl: 'http://localhost:3000',
    setupNodeEvents(on, config) {
      // Define the screenshot paths within the setupNodeEvents function scope
      let beforeScreenshotPath = '';
      let afterScreenshotPath = '';

      on('after:screenshot', (details) => {
        // Check the screenshot name and store the path
        if (details.name === 'before') {
          beforeScreenshotPath = details.path;
        } else if (details.name === 'after') {
          afterScreenshotPath = details.path;
        }
      });

      on('task', {
        getBeforeScreenshotPath() {
          return beforeScreenshotPath;
        },
        getAfterScreenshotPath() {
          return afterScreenshotPath;
        },
        compareSnapshots({ threshold }) {
          const beforeImage = PNG.sync.read(fs.readFileSync(beforeScreenshotPath));
          const afterImage = PNG.sync.read(fs.readFileSync(afterScreenshotPath));
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
