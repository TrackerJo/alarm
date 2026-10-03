export function parseUuid(value) {
  const uuid = value.trim().toLowerCase()
  if (/^(?:0x)?[0-9a-f]{4}$/.test(uuid) || /^(?:0x)?[0-9a-f]{8}$/.test(uuid)) return Number.parseInt(uuid.replace(/^0x/, ''), 16)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) return uuid
  throw new Error('Enter a valid 16-bit, 32-bit, or full Bluetooth UUID.')
}

export function encodePayload(value, encoding) {
  if (!value.length) throw new Error('Enter some data to send.')
  let bytes
  if (encoding === 'hex') {
    const hex = value.replace(/\s/g, '')
    if (!hex.length || hex.length % 2 || !/^[0-9a-f]+$/i.test(hex)) throw new Error('Hex data must contain complete byte pairs, such as 01 FF 0A.')
    bytes = Uint8Array.from(hex.match(/.{2}/g), byte => Number.parseInt(byte, 16))
  } else bytes = new TextEncoder().encode(value)
  if (bytes.length > 512) throw new Error('Send at most 512 bytes per write. Your device may require smaller messages.')
  return bytes
}

export async function writeData(device, serviceUuid, characteristicUuid, bytes, mode) {
  if (!device.gatt?.connected) throw new Error('The device disconnected. Connect it again before sending.')
  const service = await device.gatt.getPrimaryService(parseUuid(serviceUuid))
  const characteristic = await service.getCharacteristic(parseUuid(characteristicUuid))
  if (mode === 'response') {
    if (!characteristic.properties.write) throw new Error('This characteristic does not support writes with a response. Try without response if supported.')
    await characteristic.writeValueWithResponse(bytes)
  } else {
    if (!characteristic.properties.writeWithoutResponse) throw new Error('This characteristic does not support writes without a response. Try with response if supported.')
    await characteristic.writeValueWithoutResponse(bytes)
  }
}
