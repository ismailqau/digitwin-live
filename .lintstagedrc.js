module.exports = {
  // TypeScript/JavaScript files - run in batches to avoid timeout
  '**/*.{ts,tsx,js,jsx}': (files) => {
    const commands = [];
    // Run eslint with fix only (allow warnings, fail on errors only)
    commands.push(`eslint --fix --no-warn-ignored ${files.join(' ')}`);
    // Run prettier separately
    commands.push(`prettier --write ${files.join(' ')}`);
    return commands;
  },

  // TypeScript files - run type checking
  '**/*.{ts,tsx}': () => {
    // Run type-check on the entire project to catch type issues
    // We don't run it on individual files because TypeScript needs the full context
    // This prevents TypeScript errors from being committed
    return 'pnpm type-check';
  },

  // JSON files (exclude lock files)
  '**/*.json': (files) => {
    const filtered = files.filter(
      (file) => !file.includes('package-lock.json') && !file.includes('pnpm-lock')
    );
    return filtered.length > 0 ? `prettier --write ${filtered.join(' ')}` : [];
  },

  // Markdown files - only prettier
  '**/*.md': (files) => `prettier --write ${files.join(' ')}`,

  // YAML files
  '**/*.{yml,yaml}': (files) => `prettier --write ${files.join(' ')}`,

  // Package.json files
  '**/package.json': (files) => `prettier --write ${files.join(' ')}`,

  // Prisma schema - only if prisma is available
  '**/*.prisma': (files) => {
    try {
      require.resolve('prisma');
      return `prisma format ${files.join(' ')}`;
    } catch {
      // Prisma not installed, skip formatting
      return [];
    }
  },
};
