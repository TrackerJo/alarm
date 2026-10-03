import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import { parseUuid, encodePayload, writeData } from './ble.js'

function BluetoothIcon({ large = false }) {
  return <svg className={large ? 'bluetooth large' : 'bluetooth'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 7 10 10-5 4V3l5 4L7 17" /></svg>
}

const ALARM_SERVICE = '4fafc201-1fb5-459e-8fcc-c5c9c331914b'
const ALARM_CHARACTERISTIC = 'beb5483e-36e1-4688-b7f5-ea07361b26a8'

function App() {
  const [serviceUuid, setServiceUuid] = useState(ALARM_SERVICE)
  const [devices, setDevices] = useState([])
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const tracked = useRef(new Map())
  const supported = Boolean(navigator.bluetooth)
  const secure = window.isSecureContext

  function remember(device) {
    if (!tracked.current.has(device.id)) {
      const disconnected = () => {
        setDevices(items => items.map(item => item.device.id === device.id ? { ...item, connected: false } : item))
        setMessage(`${device.name || 'Unnamed device'} disconnected.`)
      }
      device.addEventListener('gattserverdisconnected', disconnected)
      tracked.current.set(device.id, { device, disconnected })
    }
    setDevices(items => items.some(item => item.device.id === device.id)
      ? items.map(item => item.device.id === device.id ? { device, connected: Boolean(device.gatt?.connected) } : item)
      : [...items, { device, connected: Boolean(device.gatt?.connected) }])
  }

  useEffect(() => {
    let active = true
    const registry = tracked.current
    if (navigator.bluetooth?.getDevices) {
      navigator.bluetooth.getDevices().then(saved => {
        if (active) saved.forEach(remember)
      }).catch(() => {})
    }
    return () => {
      active = false
      registry.forEach(({ device, disconnected }) => {
        device.removeEventListener('gattserverdisconnected', disconnected)
        if (device.gatt?.connected) device.gatt.disconnect()
      })
      registry.clear()
    }
  }, [])

  async function findDevice() {
    setError('')
    setMessage('Choose a nearby device in your browser’s Bluetooth picker.')
    setBusy('picker')
    try {
      const optionalServices = serviceUuid.trim() ? [parseUuid(serviceUuid)] : []
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices })
      remember(device)
      setMessage(`${device.name || 'Unnamed device'} added. Select Connect to open a connection.`)
    } catch (err) {
      if (err.name === 'NotFoundError') setMessage('Device selection canceled. You can search again anytime.')
      else {
        setMessage('')
        setError(friendlyError(err))
      }
    } finally { setBusy(null) }
  }

  async function connect(device) {
    setBusy(device.id)
    setError('')
    setMessage(`Connecting to ${device.name || 'Unnamed device'}…`)
    try {
      if (!device.gatt) throw new Error('This device does not support a BLE GATT connection.')
      await device.gatt.connect()
      remember(device)
      setMessage(`Connected to ${device.name || 'Unnamed device'}.`)
    } catch (err) {
      setMessage('')
      setError(friendlyError(err))
    } finally { setBusy(null) }
  }

  function disconnect(device) {
    device.gatt?.disconnect()
    remember(device)
    setMessage(`${device.name || 'Unnamed device'} disconnected.`)
  }

  const count = devices.filter(item => item.connected).length
  return <main>
    <header><a className="brand" href="./"><span className="brand-icon"><BluetoothIcon /></span>nearby<span className="brand-dot">.</span></a><span className="header-label">BLUETOOTH EXPLORER</span></header>
    <section className="intro"><p className="eyebrow">A LITTLE CLOSER. A LITTLE MORE CONNECTED.</p><h1>Your devices,<br />within reach.</h1><p className="description">Find a nearby Bluetooth Low Energy device and connect to it in a few clicks.</p></section>
    <section className="workspace" aria-labelledby="devices-heading">
      <div className="toolbar"><div><h2 id="devices-heading">Devices</h2><p>{count ? `${count} connected` : 'Ready when you are'}</p></div><button className="primary" onClick={findDevice} disabled={!supported || !secure || busy !== null}><span aria-hidden="true">＋</span>{busy === 'picker' ? 'Choosing device…' : 'Find a device'}</button></div>
      <div className="service-access"><label htmlFor="service-access">Service UUID for sending data <span>(optional)</span></label><input id="service-access" value={serviceUuid} onChange={event => setServiceUuid(event.target.value)} placeholder="e.g. FFE0 or a full service UUID" disabled={busy !== null} spellCheck={false} /><p>Enter your device’s service UUID before selecting it. To allow a new service on an existing device, enter its UUID and select the device again.</p></div>
      {!supported || !secure ? <div className="notice" role="alert"><strong>{!secure ? 'A secure connection is required' : 'Bluetooth is unavailable in this browser'}</strong><p>{!secure ? 'Open this app on localhost or use HTTPS to access Bluetooth.' : 'Open this page in a browser with Web Bluetooth support, such as Chrome on desktop or Android.'}</p></div> : null}
      {devices.length === 0 ? <div className="empty"><div className="empty-icon"><BluetoothIcon large /></div><h3>Make your first connection</h3><p>Turn on your device and keep it nearby.<br />Then select <strong>Find a device</strong> to open the Bluetooth picker.</p><span className="empty-note">Only devices you choose appear here</span></div> : <ul className="device-list">{devices.map(({ device, connected }) => <li key={device.id}><div className="device-row"><div className="device-icon"><BluetoothIcon /></div><div className="device-info"><h3>{device.name || 'Unnamed device'}</h3><p className={connected ? 'state connected' : 'state'}><span className="dot" />{busy === device.id ? 'Connecting…' : connected ? 'Connected' : 'Disconnected'}</p><p className="device-id">ID: {device.id}</p></div><button disabled={busy !== null} className={connected ? 'secondary' : 'primary small'} onClick={() => connected ? disconnect(device) : connect(device)}>{busy === device.id ? 'Connecting…' : connected ? 'Disconnect' : 'Connect'}</button></div>{connected && <SendPanel device={device} initialService={serviceUuid} blocked={busy !== null} />}</li>)}</ul>}
      <div className="status" aria-live="polite" role="status">{message || 'Your browser will ask permission before accessing a device.'}</div>
      {error && <div className="error" role="alert">{error}</div>}
    </section>
    <aside className="help"><span className="info-icon" aria-hidden="true">i</span><div><h3>A quick note on discovery</h3><p>Your browser shows nearby BLE devices in its own picker. This list keeps the devices you select, including previously permitted devices when supported. Connection availability depends on your device.</p></div></aside>
    <footer><span>Small distances. Simple connections.</span><a href="https://developer.chrome.com/docs/capabilities/bluetooth" target="_blank" rel="noreferrer">About Web Bluetooth ↗</a></footer>
  </main>
}

function SendPanel({ device, initialService, blocked }) {
  const [service, setService] = useState(initialService)
  const [characteristic, setCharacteristic] = useState(initialService.toLowerCase() === ALARM_SERVICE ? ALARM_CHARACTERISTIC : '')
  const [payload, setPayload] = useState('')
  const [encoding, setEncoding] = useState('text')
  const [mode, setMode] = useState('response')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')
  const [failed, setFailed] = useState(false)
  async function send(event) {
    event.preventDefault()
    setSending(true)
    setResult('')
    setFailed(false)
    try {
      const bytes = encodePayload(payload, encoding)
      await writeData(device, service, characteristic, bytes, mode)
      setResult(mode === 'response' ? `Device acknowledged ${bytes.length} bytes.` : `Submitted ${bytes.length} bytes without acknowledgement.`)
    } catch (error) {
      setFailed(true)
      setResult(error.name === 'SecurityError' || error.name === 'NotAllowedError'
        ? 'Service access is not permitted. Enter this service UUID above, choose Find a device, and select this device again.'
        : error.name === 'NotFoundError' ? 'The service or characteristic was not found. Check the UUIDs against your device documentation.'
        : error.name === 'NetworkError' ? 'Write failed. Check the connection and your device’s payload size requirements before retrying.'
        : error.message || 'Unable to send data.')
    } finally { setSending(false) }
  }
  return <form className="send-panel" onSubmit={send}>
    <h3>Send data</h3>
    <p className="send-hint">The alarm clock UUIDs are prefilled. Change them here to send to another device.</p>
    <fieldset disabled={sending || blocked}>
      <div className="send-fields">
        <label>Service UUID<input required value={service} onChange={event => setService(event.target.value)} placeholder="FFE0 or full UUID" spellCheck={false} /></label>
        <label>Characteristic UUID<input required value={characteristic} onChange={event => setCharacteristic(event.target.value)} placeholder="FFE1 or full UUID" spellCheck={false} /></label>
        <label>Data format<select value={encoding} onChange={event => setEncoding(event.target.value)}><option value="text">Text (UTF-8)</option><option value="hex">Hex bytes</option></select></label>
        <label>Write mode<select value={mode} onChange={event => setMode(event.target.value)}><option value="response">With response</option><option value="no-response">Without response</option></select></label>
      </div>
      <label>Data<textarea required value={payload} onChange={event => setPayload(event.target.value)} placeholder={encoding === 'hex' ? '01 FF 0A' : 'Message to send'} spellCheck={false} rows={3} /></label>
      <button className="primary" type="submit">{sending ? 'Sending…' : 'Send data'}</button>
    </fieldset>
    <p className={failed ? 'send-result failed' : 'send-result'} role="status" aria-live="polite">{result}</p>
  </form>
}

function friendlyError(error) {
  if (error.name === 'NetworkError') return 'Could not connect. Keep the device nearby, make sure it is on and available, then try again.'
  if (error.name === 'SecurityError' || error.name === 'NotAllowedError') return 'Bluetooth access was denied. Allow Bluetooth in your browser and system settings, then try again.'
  if (error.name === 'NotSupportedError') return 'Bluetooth is not supported on this browser or device.'
  return error.message || 'Something went wrong. Please try again.'
}

createRoot(document.getElementById('root')).render(<App />)
