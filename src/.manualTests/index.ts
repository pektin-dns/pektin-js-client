import { ExtendedPektinApiClient } from "../index.js";
const pc = new ExtendedPektinApiClient({
    username: "admin-ERwxFZQIWR_yOA",
    managerPassword:
        "m.RyRRfuwh-8_HeFhUzY3e9uVnrzAGWX1lC8wYTz506CgsTDghSylJiIDWgjvVVznUnBy6nABIZEK0OIobMfZQZf933oQT_zRWiUlJhheY8xfo35l9x6mx11fN0Jng5TkkYWirYw",
    confidantPassword:
        "c.o5MGb2zXSUGvVezruFSFLAJGq0MlHdCWL01aGr4kxOxv5NdDgA28FOWjDTqsTFXsr41KDphHLm55sktuJJcTsD_p2bOZV3-FGW8_VGFdcTXxd5mI71W8UcUy-ySryT5sq4V7gA",
    vaultEndpoint: "http://127.0.0.1:8200"
});

console.log(
    await pc.getZoneRecords(["cloudflare.com", "pektin.xyz.", "pektin.xyzss.", "dadsd.com"])
);
