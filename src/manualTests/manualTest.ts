import { ExtendedPektinApiClient } from "./../index.js";
const pc = new ExtendedPektinApiClient({
    confidantPassword:
        "c.tXe01jCFgHwi0_LsxoMslKrACtZQ7H9KgVNYSh_An6HR3-P67qN_MFZIF-Rw-UbNkwhfQgvkvhuGRK-ETSC_h-hYIz6AvrY_uH8UV00P5PwRVIb9JKgmcYyHR7r-6cppJC6Tcg",
    vaultEndpoint: "http://pektin-vault:8200",
    username: "admin-0N0l57Ejzt7Z6w",
    override: {
        pektinApiEndpoint: "http://pektin-api:80"
    }
});

await pc.setupMainDomain();
