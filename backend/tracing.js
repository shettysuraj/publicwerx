const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');

const apiKey = process.env.HONEYCOMB_API_KEY;
if (!apiKey) {
  console.warn('HONEYCOMB_API_KEY not set — tracing disabled');
  return;
}

const SENSITIVE_PARAMS = ['token', 'state'];

function redactQuery(raw) {
  if (!raw) return raw;
  const params = new URLSearchParams(raw);
  let changed = false;
  for (const key of SENSITIVE_PARAMS) {
    if (params.has(key)) { params.set(key, 'REDACTED'); changed = true; }
  }
  return changed ? params.toString() : raw;
}

const sdk = new NodeSDK({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'publicwerx' }),
  traceExporter: new OTLPTraceExporter({
    url: 'http://127.0.0.1:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-http': {
        requestHook: (span) => {
          const query = span.attributes['url.query'];
          if (query) span.setAttribute('url.query', redactQuery(query));
          const target = span.attributes['http.target'];
          if (typeof target === 'string' && target.includes('?')) {
            const [p, q] = target.split('?', 2);
            span.setAttribute('http.target', p + '?' + redactQuery(q));
          }
          const url = span.attributes['http.url'];
          if (typeof url === 'string' && url.includes('?')) {
            const idx = url.indexOf('?');
            span.setAttribute('http.url', url.slice(0, idx + 1) + redactQuery(url.slice(idx + 1)));
          }
        },
      },
    }),
  ],
});

sdk.start();
