import { parentPort } from 'worker_threads';

logger.log("Simple worker started");

parentPort.postMessage({ msg: 'Hello from simple worker!' });