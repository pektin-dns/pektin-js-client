import { ExtendedPektinApiClient } from "../index.js";
const pc = new ExtendedPektinApiClient({
    confidantPassword:
        "c.Poe8KnGekf164xwaFL6R7vkibkac8W-4DaJOK49BcFDLfoDoDXkL5-Mh0NiE8qrYuhrJ2TAR4Og7pMacM_JR0-tmZKCVal2m6jT85RRgiAWyNcA3wYW1ik1Jhn7Ek8WMmgw1Bw",
    vaultEndpoint: "http://127.0.0.1:8200",
    username: "admin-uF0euRyAGavGSw",
    override: {
        pektinApiEndpoint: "http://127.0.0.1:3001"
    }
});

await pc.setupMainDomain();
