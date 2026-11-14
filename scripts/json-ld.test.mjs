import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { serializeJsonLd } from '../src/lib/json-ld.js';

describe('JSON-LD serialization', () => {
  it('preserves JSON data while escaping HTML script-sensitive characters', () => {
    const value = {
      description: '</script><script>alert(1)</script>',
      separators: String.fromCharCode(0x2028) + ' and ' + String.fromCharCode(0x2029),
      ampersand: 'A & B',
    };
    const serialized = serializeJsonLd(value);

    assert.deepEqual(JSON.parse(serialized), value);
    assert.equal(serialized.includes('</script>'), false);
    assert.ok(serialized.includes(String.fromCharCode(92) + 'u003c/script'));
    assert.equal(serialized.includes('<'), false);
    assert.equal(serialized.includes('>'), false);
    assert.equal(serialized.includes('&'), false);
    assert.equal(serialized.includes(String.fromCharCode(0x2028)), false);
    assert.equal(serialized.includes(String.fromCharCode(0x2029)), false);
  });

  it('rejects values JSON cannot serialize', () => {
    assert.throws(() => serializeJsonLd(undefined), /JSON serializable/);
  });
});
