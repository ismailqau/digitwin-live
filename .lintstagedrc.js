module.exports = {
  // TypeScript/JavaScript files
  '**/*.{ts,tsx,js,jsx}': ['eslint --fix --max-warnings=0 --no-warn-ignored', 'prettier --write'],

  // JSON files (exclude lock files)
  '**/*.json': (files) => {
    const filtered = files.filter(
      (file) => !file.includes('package-lock.json') && !file.includes('pnpm-lock')
    );
    return filtered.length > 0 ? `prettier --write ${filtered.join(' ')}` : [];
  },

  // Markdown files - only prettier
  '**/*.md': ['prettier --write'],

  // YAML files
  '**/*.{yml,yaml}': ['prettier --write'],

  // Package.json files
  '**/package.json': ['prettier --write'],

  // Prisma schema
  '**/*.prisma': ['prisma format'],
};
