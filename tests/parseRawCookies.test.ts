import { test, describe } from 'node:test';
import assert from 'node:assert';
import { parseCookies } from '../generic/parseRawCookies.js';

describe('parseCookies', () => {
  test('parses a single cookie string', () => {
    const input = 'id=123';
    const expected = { id: '123' };
    assert.deepStrictEqual(parseCookies(input), expected);
  });

  test('parses multiple cookies from a single string', () => {
    const input = 'id=123; name=John; theme=dark';
    const expected = { id: '123', name: 'John', theme: 'dark' };
    assert.deepStrictEqual(parseCookies(input), expected);
  });

  test('handles spaces in cookie strings', () => {
    const input = ' id = 123 ;  name = John ';
    const expected = { id: '123', name: 'John' };
    assert.deepStrictEqual(parseCookies(input), expected);
  });

  test('decodes URI components', () => {
    const input = 'email=user%40example.com; city=New%20York';
    const expected = { email: 'user@example.com', city: 'New York' };
    assert.deepStrictEqual(parseCookies(input), expected);
  });

  test('parses an array of cookie strings', () => {
    const input = ['id=123', 'name=John', 'theme=dark'];
    const expected = { id: '123', name: 'John', theme: 'dark' };
    assert.deepStrictEqual(parseCookies(input), expected);
  });

  test('parses an array of complex cookie strings', () => {
    const input = ['id=123; Path=/; HttpOnly', 'name=John; Secure'];
    const expected = { id: '123', name: 'John' };
    assert.deepStrictEqual(parseCookies(input), expected);
  });

  test('normalizes an existing cookie object', () => {
    const input = { id: 123, name: 'John', active: true };
    const expected = { id: 123, name: 'John', active: 'true' };
    assert.deepStrictEqual(parseCookies(input), expected);
  });

  test('handles empty input', () => {
    assert.deepStrictEqual(parseCookies(''), {});
    assert.deepStrictEqual(parseCookies([]), {});
    assert.deepStrictEqual(parseCookies({}), {});
  });

  test('handles malformed strings', () => {
    assert.deepStrictEqual(parseCookies('invalid'), { invalid: '' });
    assert.deepStrictEqual(parseCookies('key='), { key: '' });
    assert.deepStrictEqual(parseCookies('=value'), {});
  });

  test('parses multiple cookies with all common attributes in a single string', () => {
    const input = 'user=sergio; Path=/; Domain=example.com; Expires=Wed, 21 Oct 2025 07:28:00 GMT; Max-Age=3600; SameSite=Lax; Secure; HttpOnly; Partitioned; Priority=High; theme=dark; Path=/app; Secure';
    const expected = { user: 'sergio', theme: 'dark' };
    assert.deepStrictEqual(parseCookies(input), expected);
  });
});
