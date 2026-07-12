import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('container logging configuration', () => {
  for (const composeFile of ['docker-compose.yml', 'docker-compose.nas.yml']) {
    it(`${composeFile} enables bounded logs for every service`, () => {
      const compose = read(composeFile);
      const servicesSection = compose.split(/^services:\s*$/m)[1].split(/^volumes:\s*$/m)[0];
      const serviceCount = (servicesSection.match(/^  [a-z][a-z0-9-]+:\s*$/gm) || []).length;
      const loggingCount = (servicesSection.match(/logging: \*default-logging/g) || []).length;

      expect(compose).toContain('x-logging: &default-logging');
      expect(compose).toContain('driver: json-file');
      expect(compose).toContain('max-size: "${CONTAINER_LOG_MAX_SIZE:-10m}"');
      expect(compose).toContain('max-file: "${CONTAINER_LOG_MAX_FILES:-5}"');
      expect(loggingCount).toBe(serviceCount);
    });
  }

  it('verifies the effective NAS container logging config after deployment', () => {
    const deployScript = read('deploy-to-nas.sh');
    expect(deployScript).toContain('def verify_container_logging');
    expect(deployScript).toContain('Verified container logging');
  });
});
