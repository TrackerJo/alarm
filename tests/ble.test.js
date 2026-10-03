import test from 'node:test'
import assert from 'node:assert/strict'
import { parseUuid, encodePayload, writeData } from '../src/ble.js'

test('normalizes short UUIDs and preserves full UUIDs', () => {
  assert.equal(parseUuid(' 0xFFE0 '), 0xffe0)
  assert.equal(parseUuid('1234ABCD'), 0x1234abcd)
  assert.equal(parseUuid('6E400001-B5A3-F393-E0A9-E50E24DCCA9E'), '6e400001-b5a3-f393-e0a9-e50e24dcca9e')
  assert.throws(() => parseUuid('oops'))
})
test('encodes UTF-8 and hex and rejects invalid or oversized payloads', () => {
  assert.deepEqual([...encodePayload('é', 'text')], [0xc3, 0xa9])
  assert.deepEqual([...encodePayload('01 ff\n0A', 'hex')], [1, 255, 10])
  for (const value of ['', ' ', '0', 'GG', '01 ZZ']) assert.throws(() => encodePayload(value, 'hex'))
  assert.throws(() => encodePayload('é'.repeat(257), 'text'))
})
function mockDevice(properties) {
  const calls = []
  const characteristic = {
    properties,
    writeValueWithResponse: async bytes => calls.push(['response', [...bytes]]),
    writeValueWithoutResponse: async bytes => calls.push(['no-response', [...bytes]]),
  }
  const device = { gatt: { connected: true, getPrimaryService: async uuid => {
    calls.push(['service', uuid])
    return { getCharacteristic: async uuid => { calls.push(['characteristic', uuid]); return characteristic } }
  } } }
  return { device, calls }
}
test('writes to the requested service and characteristic in either mode', async () => {
  for (const mode of ['response', 'no-response']) {
    const { device, calls } = mockDevice({ write: true, writeWithoutResponse: true })
    await writeData(device, 'FFE0', 'FFE1', Uint8Array.of(1, 255), mode)
    assert.deepEqual(calls, [['service', 0xffe0], ['characteristic', 0xffe1], [mode, [1, 255]]])
  }
})
test('rejects unsupported writes and disconnected devices', async () => {
  const { device, calls } = mockDevice({ write: false, writeWithoutResponse: false })
  await assert.rejects(writeData(device, 'FFE0', 'FFE1', Uint8Array.of(1), 'response'), /does not support/)
  await assert.rejects(writeData(device, 'FFE0', 'FFE1', Uint8Array.of(1), 'no-response'), /does not support/)
  assert.ok(calls.every(call => call[0] !== 'response' && call[0] !== 'no-response'))
  device.gatt.connected = false
  await assert.rejects(writeData(device, 'FFE0', 'FFE1', Uint8Array.of(1), 'response'), /disconnected/)
})
test('propagates permission and write failures', async () => {
  const device = { gatt: { connected: true, getPrimaryService: async () => { throw new DOMException('Denied', 'SecurityError') } } }
  await assert.rejects(writeData(device, 'FFE0', 'FFE1', Uint8Array.of(1), 'response'), { name: 'SecurityError' })
})
