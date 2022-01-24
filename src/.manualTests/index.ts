import { ExtendedPektinApiClient } from "../index.js";
import { PektinRRType } from "../types.js";
const pc = new ExtendedPektinApiClient({
    username: "admin-eJzwqXlEMHWMAA",
    managerPassword:
        "m.RgMj19aCGo2ykcX2BTjeCEdo9jdQQjGBMBv583KkPJrB00yOT5ueRMkk2-mbJ1HNI_5xVGd6uYzqHMeuuqBqj1EAHWbVfluRH7FaR0xI-EzjULMlhgSDmrFoIqyp5aQRQr_tzg",
    confidantPassword:
        "c.bWq_8n7L2C18cYUh_PM8mWAon1_16fYu4WH_J4WqrorME6i5nPxsyNyIUJvAFehMSM5P3PD2Podp-hrRUljGPoEOptsJbwHlwC58edtijG_rB-WkgJ-MESSvjVTJOsy6sq0-zA",
    vaultEndpoint: "http://127.0.0.1:8200"
});

console.log(
    await pc.set([
        {
            name: "pektin.xyz.",
            rr_type: PektinRRType.SOA,
            rr_set: [
                {
                    ttl: 60,
                    mname: "ns.x.y.",
                    rname: "x.x.y.",
                    serial: 0,
                    refresh: 0,
                    retry: 0,
                    expire: 0,
                    minimum: 0
                }
            ]
        }
    ])
);
