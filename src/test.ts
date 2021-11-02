import { ExtendedPektinApiClient } from "./index.js";

const pc = new ExtendedPektinApiClient({
    username: "ui-j-6samfz_r1OTQ",
    password:
        "Bq9Wvf4_FeDtKNoxdFLJweZzYhKVnN4Ll9SiQniyBRQIu2c_1BIHqGihFr6KlQproTrMndkSA50aUQY_HS8VRJNWBdveGAeoWWwcGrECPBwgIygDbKUjeXHaGE2FOvXeWTmbHg",
    vaultEndpoint: "http://127.0.0.1:8200"
});

console.log(await pc.setupMainDomain());

console.log(await pc.getDomains());
