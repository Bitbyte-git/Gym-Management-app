// Contract: Morfin_Auth_Web_SDK_1.0.0.3, SDKSample/morfinauth.js and SDK PDF.
// Matching here is a workstation diagnostic and never authorizes API attendance.
let recoveryRequired = false;
let drainUntil = 0;
const drainKey = 'pulsefit.scannerDrainUntil';
const readDrain = () => { try { return Math.max(drainUntil, Number(globalThis.localStorage?.getItem(drainKey)) || 0); } catch { return drainUntil; } };
const setDrain = value => { drainUntil = value; try { if (value) globalThis.localStorage?.setItem(drainKey, String(value)); else globalThis.localStorage?.removeItem(drainKey); } catch {} };
let scannerBusy = false; // Shared across adapter instances in this browser tab.
export function createMorFinAuth({ baseUrl = 'https://localhost:8030/morfinauth', fetchImpl = globalThis.fetch } = {}) {
  const base = new URL(baseUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) || !['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('MorFinAuth must use a local workstation URL without credentials');
  }
  const explanations = {
    '-1601': 'No scanner found. Connect the MFS500.',
    '-1603': 'The SDK license is invalid. Check the workstation license with Mantra.',
    '-2018': 'The client license key is invalid. Check the value supplied by Mantra.',
    '-2019': 'Capture timed out. Place your finger on the scanner and retry.',
    '-2023': 'Another capture is running. Close other scanner applications.',
    '-2024': 'Device already initialized. Close the vendor test page or other scanner application.',
    '-2025': 'Device is not initialized. Reconnect the scanner and retry.',
    '-2027': 'Scanner disconnected. Reconnect it and retry.',
    '-2038': 'No fingerprint captured. Place your finger fully on the scanner.',
  };
  async function post(method, body, { signal, timeout = 5000 } = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeout);
    try {
      const response = await fetchImpl(base.href.replace(/\/$/, '') + '/' + method, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: controller.signal,
        credentials: 'omit', cache: 'no-store',
      });
      if (!response.ok) throw new Error('MorFinAuth HTTP ' + response.status);
      const data = await response.json();
      if (data.ErrorCode !== 0 && data.ErrorCode !== '0') {
        const description = explanations[String(data.ErrorCode)] || (typeof data.ErrorDescription === 'string' ? data.ErrorDescription.slice(0, 300) : 'Unknown vendor error');
        throw Object.assign(new Error('MorFinAuth ' + String(data.ErrorCode).slice(0, 20) + ': ' + description), {
          code: String(data.ErrorCode) === '-2019' ? 'CAPTURE_TIMEOUT' : ['-1601', '-2027'].includes(String(data.ErrorCode)) ? 'DEVICE_DISCONNECTED' : 'VENDOR_ERROR',
        });
      }
      return data;
    } catch (error) {
      if (controller.signal.aborted) throw Object.assign(new Error(signal?.aborted ? 'Capture cancelled' : 'MorFinAuth timed out. Retry with your finger on the scanner.'), { code: signal?.aborted ? 'CAPTURE_CANCELLED' : 'SERVICE_TIMEOUT' });
      if (error instanceof TypeError) throw Object.assign(new Error('Cannot reach MorFinAuth. Check Windows service, trusted HTTPS certificate, browser local-network permission and allowed application origin.'), { code: 'SERVICE_UNAVAILABLE' });
      throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  async function exclusive(task, { recovery = false } = {}) {
    if (!recovery && (recoveryRequired || readDrain() > Date.now())) throw Object.assign(new Error('Scanner is finishing an earlier capture. Use Retry after recovery.'), { code: 'SCANNER_DRAINING' });
    if (scannerBusy) throw new Error('A fingerprint operation is already in progress');
    scannerBusy = true;
    try {
      // Also serialize scanner operations across same-origin tabs when Web Locks is supported.
      if (globalThis.navigator?.locks) return await navigator.locks.request('pulsefit-morfinauth', { mode: 'exclusive', ifAvailable: true }, lock => {
        if (!lock) throw Object.assign(new Error('Scanner in use in another tab.'), { code: 'SCANNER_IN_USE' });
        return task();
      });
      return await task();
    } finally { scannerBusy = false; }
  }
  async function discoverInternal(options) {
    const data = await post('connecteddevicelist', undefined, options);
    if (typeof data.ErrorDescription !== 'string' || !data.ErrorDescription.includes(':')) return [];
    return data.ErrorDescription.split(':')[1].split(',').map(s => s.trim()).filter(Boolean);
  }
  const infoInternal = (device, { clientKey = '', ...options } = {}) => post('info', { ConnectedDvc: device, ClientKey: clientKey }, options);
  const cleanupInternal = () => post('uninitdevice');
  async function withDevice(options, task) {
    return exclusive(async () => {
      let initialized = false, operationError, result;
      const initializeOwnedDevice = async () => {
        if (options.signal?.aborted) throw new Error('Capture cancelled');
        const devices = await discoverInternal(options);
        const device = devices.find(d => d === 'MFS500');
        if (!device) throw Object.assign(new Error('MFS500 is disconnected. Connect the scanner and retry.'), { code: 'DEVICE_DISCONNECTED' });
        await post('checkdevice', { ConnectedDvc: device }, options);
        // The working sample's GetInfo initializes the device.
        const details = await infoInternal(device, options);
        initialized = true;
        const d = details.DeviceInfo;
        if (!d?.SerialNo || d.Model !== 'MFS500') throw new Error('MFS500 device information is incomplete');
        return d;
      };
      const reinitializeOwnedDevice = async () => {
        if (options.signal?.aborted) throw new Error('Capture cancelled');
        await cleanupInternal();
        initialized = false;
        if (!recoveryRequired) setDrain(0);
        if (options.signal?.aborted) throw new Error('Capture cancelled');
        // The existing tab/run keeps ownership throughout cleanup and initialization.
        return initializeOwnedDevice();
      };
      try {
        const d = await initializeOwnedDevice();
        result = await task(d, reinitializeOwnedDevice);
      } catch (error) { operationError = error; }
      finally {
        try { if (initialized) { await cleanupInternal(); if (!recoveryRequired) setDrain(0); } }
        catch (error) { if (!operationError) operationError = error; }
      }
      if (options.signal?.aborted) throw new Error('Capture cancelled');
      if (operationError) throw operationError;
      return result;
    });
  }
  const dataField = (value, label) => {
    if (typeof value !== 'string' || !value || value.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('MorFinAuth returned invalid ' + label);
    return value;
  };
  function matchResult(data) {
    // This installed service omits Status for a non-match; it emits true for a match.
    const omittedFalse = !Object.prototype.hasOwnProperty.call(data, 'Status') &&
      typeof data.ErrorDescription === 'string' && data.ErrorDescription.trim() === 'Success';
    if (typeof data.Status !== 'boolean' && !omittedFalse) throw new Error('MorFinAuth returned an undocumented matching status');
    return { matched: data.Status === true, vendorErrorCode: data.ErrorCode, diagnosticOnly: true };
  }
  async function hardwarePost(method, body) {
    setDrain(Date.now() + 30000); // Metadata only; no biometric material enters persistent storage.
    try {
      // Do not abort the hardware HTTP operation when the component pauses.
      // Drain its finite capture first, then uninitialize while still holding ownership.
      return await post(method, body, { timeout: 15000 });
    } catch (error) {
      if (['SERVICE_TIMEOUT', 'SERVICE_UNAVAILABLE'].includes(error.code)) recoveryRequired = true;
      throw error;
    }
  }
  async function templateFromDevice(d, options = {}) {
    if (options.signal?.aborted) throw Object.assign(new Error('Capture cancelled'), { code: 'CAPTURE_CANCELLED' });
    const captured = await hardwarePost('capture', { Quality: 60, TimeOut: 10 });
    if (options.signal?.aborted) throw Object.assign(new Error('Capture cancelled'), { code: 'CAPTURE_CANCELLED' });
    if (!Number.isFinite(Number(captured.Quality)) || Number(captured.Quality) < 60) throw Object.assign(new Error('Poor-quality capture. Reposition your finger.'), { code: 'POOR_CAPTURE' });
    const template = await post('gettemplate', { TmpFormat: 0 }, options);
    if (template.TmpData && template.ImgData && template.TmpData !== template.ImgData) throw new Error('Ambiguous template response from MorFinAuth');
    return { templateBase64: dataField(template.TmpData ?? template.ImgData, 'template'), templateFormat: 'FMR_V2005',
      quality: Number(captured.Quality), deviceModel: d.Model, deviceSerial: d.SerialNo };
  }
  async function runSession(options, task) {
    if (options.requireLock && !globalThis.navigator?.locks) throw Object.assign(new Error('This browser cannot coordinate scanner tabs. Use a supported secure browser.'), { code: 'LOCK_UNAVAILABLE' });
    return withDevice(options, async (d, reset) => {
      let currentDevice = d;
      return task({
        get device() { return { model: currentDevice.Model, serial: currentDevice.SerialNo }; },
        captureTemplate: () => templateFromDevice(currentDevice, options),
        reinitialize: async () => {
          currentDevice = await reset();
          return { model: currentDevice.Model, serial: currentDevice.SerialNo };
        },
      });
    });
  }
  async function recover({ signal } = {}) {
    return exclusive(async () => {
      const remaining = Math.max(0, readDrain() - Date.now());
      if (remaining) await new Promise(resolve => setTimeout(resolve, remaining));
      if (signal?.aborted) throw new Error('Recovery cancelled');
      await cleanupInternal();
      recoveryRequired = false;
      setDrain(0);
    }, { recovery: true });
  }
  async function capture(options = {}) {
    return withDevice(options, async d => {
      const captured = await hardwarePost('capture', { Quality: 60, TimeOut: 10 });
      if (options.signal?.aborted) throw new Error('Capture cancelled');
      if (!Number.isFinite(Number(captured.Quality)) || Number(captured.Quality) < 60) throw new Error('Fingerprint quality is too low. Clean the scanner and retry.');
      const template = await post('gettemplate', { TmpFormat: 0 }, options);
      const image = await post('getimage', { ImgFormat: 0 }, options);
      // PDF documents TmpData; both supplied and installed HTML samples read ImgData.
      // Support the two documented variants; reject inconsistent simultaneous values.
      if (template.TmpData && template.ImgData && template.TmpData !== template.ImgData) throw new Error('Ambiguous template response from MorFinAuth');
      return {
        templateBase64: dataField(template.TmpData ?? template.ImgData, 'template'), templateFormat: 'FMR_V2005',
        imageBase64: dataField(image.ImgData, 'image'), imageFormat: 'BMP', quality: Number(captured.Quality),
        ...(captured.Nfiq != null ? { nfiq: Number(captured.Nfiq) } : {}),
        deviceModel: d.Model, deviceSerial: d.SerialNo,
        ...(d.Width != null ? { imageWidth: Number(d.Width) } : {}),
        ...(d.Height != null ? { imageHeight: Number(d.Height) } : {}),
        capturedAt: new Date().toISOString(), vendorErrorCode: captured.ErrorCode,
        vendorErrorDescription: captured.ErrorDescription,
      };
    });
  }
  const verify = ({ probeTemplate, galleryTemplate, templateFormat = 'FMR_V2005', ...options }) => {
    if (templateFormat !== 'FMR_V2005') return Promise.reject(new Error('Only FMR_V2005 diagnostics are enabled'));
    return withDevice(options, async () => matchResult(await post('verify', {
      ProbTemplate: dataField(probeTemplate, 'probe template'), GalleryTemplate: dataField(galleryTemplate, 'gallery template'), TmpFormat: 0,
    }, options)));
  };
  const match = ({ galleryTemplate, templateFormat = 'FMR_V2005', ...options }) => {
    if (templateFormat !== 'FMR_V2005') return Promise.reject(new Error('Only FMR_V2005 diagnostics are enabled'));
    return withDevice(options, async () => matchResult(await hardwarePost('match', {
      Quality: 60, TimeOut: 10, GalleryTemplate: dataField(galleryTemplate, 'gallery template'), TmpFormat: 0,
    })));
  };
  return {
    discover: options => exclusive(() => discoverInternal(options)),
    availability: options => exclusive(async () => ({ devices: await discoverInternal(options) })),
    info: (device, options) => exclusive(() => infoInternal(device, options)),
    initialize: (device, { clientKey = '', ...options } = {}) => exclusive(() => post('initdevice', { ConnectedDvc: device, ClientKey: clientKey }, options)),
    cleanup: () => exclusive(cleanupInternal),
    capture, verify, match, runSession, recover,
  };
}
