import { parentPort } from 'worker_threads';

console.log("Simple worker started");

parentPort.postMessage({ msg: 'Hello from simple worker!' });