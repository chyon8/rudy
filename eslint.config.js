import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/mobile/metro.config.js', 'apps/mobile/plugins/**', 'apps/mobile/ios/**', 'apps/mobile/index.share.js', 'apps/mobile/.expo/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
