// Test preload: any attempt to open a network connection throws. Loaded with `node --require`.
const net = require('node:net');
const dns = require('node:dns');
const tls = require('node:tls');
const block = (what) => () => {
  throw new Error(`network blocked for test: ${what}`);
};
net.Socket.prototype.connect = block('net.Socket.connect');
net.connect = net.createConnection = block('net.connect');
tls.connect = block('tls.connect');
dns.lookup = block('dns.lookup');
dns.resolve = block('dns.resolve');
globalThis.fetch = block('fetch');
process.stderr.write('[preload] network blocked for test\n');
