# Known Issues

## Deprecated Dependencies

### Overview

Some packages in the project use deprecated dependencies. These are warnings, not errors, and do not affect functionality. They should be addressed in a future maintenance cycle.

### Deprecated Direct Dependencies

1. **multer@1.4.5-lts.2** (used in `apps/api-gateway`)
   - Status: Deprecated but still functional
   - Alternative: Consider migrating to `@fastify/multipart` or `busboy` directly
   - Impact: Low - file uploads work correctly

2. **@testing-library/jest-native@5.4.3** (used in `apps/mobile-app`)
   - Status: Deprecated
   - Alternative: Use `@testing-library/react-native` built-in matchers
   - Impact: Low - tests work correctly

3. **metro-react-native-babel-preset@0.77.0** (used in `apps/mobile-app`)
   - Status: Deprecated
   - Alternative: Use `@react-native/babel-preset`
   - Impact: Low - builds work correctly

4. **react-native-audio-recorder-player@3.6.14** (used in `apps/mobile-app`)
   - Status: Deprecated
   - Alternative: Consider `react-native-audio` or `expo-av`
   - Impact: Low - audio recording/playback works correctly

### Deprecated Subdependencies

The following subdependencies are deprecated but are managed through pnpm overrides in the root `package.json`:

- Babel proposal plugins (now part of Babel core)
- `abab`, `domexception`, `node-domexception` (replaced by native implementations)
- `are-we-there-yet`, `gauge`, `npmlog` (replaced by newer progress libraries)
- `flatten` (use native array methods)
- `lodash.get`, `lodash.isequal` (use lodash or native methods)

### Resolution Strategy

1. **Short-term**: Overrides in `package.json` ensure latest compatible versions
2. **Medium-term**: Update direct dependencies when stable alternatives are available
3. **Long-term**: Migrate to maintained alternatives during major version updates

### Monitoring

Run `pnpm outdated` regularly to check for updates:

```bash
pnpm outdated
```

Check for security vulnerabilities:

```bash
pnpm audit
```

### Priority

- **High**: Security vulnerabilities (none currently)
- **Medium**: Deprecated packages with maintained alternatives
- **Low**: Deprecated packages that are still functional

## Other Known Issues

### None Currently

All other systems are functioning as expected.

---

**Last Updated**: December 1, 2024
