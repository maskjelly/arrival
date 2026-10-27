import { NetworkEnricher } from './geo.ts';
const geo = new NetworkEnricher({
  cityPath: process.env.GEOIP_CITY_PATH,
  asnPath: process.env.GEOIP_ASN_PATH,
});
console.log('Downloading DB-IP Lite city and ASN databases. IP lookups will run locally.');
await geo.update(process.argv[2]);
const status = geo.status();
if (status.job.error) {
  console.error(status.job.error);
  process.exitCode = 1;
} else
  console.log(
    JSON.stringify({ city: status.city, asn: status.asn, attribution: status.provider }, null, 2),
  );
