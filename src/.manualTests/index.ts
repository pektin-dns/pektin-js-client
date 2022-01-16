import { ExtendedPektinApiClient } from "../index.js";
const pc = new ExtendedPektinApiClient({
    confidantPassword:
        "c.QIUKgkW1pHcIQVX0G87fgmmGPkxsft5tVq74tash-HA_-3WMRRJ85k3I2dptd9Zlh0ASb7iqT47VUcDoNmNzRpDseKMz_E4fOd-zhjaCfPCPSVVKwINYuyeOyfXAHdNsNesiLA",
    vaultEndpoint: "http://127.0.0.1:8200",
    username: "admin-H__-tnuYhe3vuA",
    override: {
        pektinApiEndpoint: "http://127.0.0.1:3001"
    }
});

console.log(
    await pc.getZoneRecords(["cloudflare.com", "pektin.xyz.", "pektin.xyzss.", "dadsd.com"])
);
