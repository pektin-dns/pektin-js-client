import { ExtendedPektinApiClient } from "../index.js";
const pc = new ExtendedPektinApiClient({
    confidantPassword:
        "c.Gvby0sp_kceGaq1ejBkFCuUNJKd07ZpsA9tozbeka40MSxrTBFp6BsGPaIIT6Us0NRbCU8HH0L2zNZ-50eEk7m8fXivTxSinSdCbEfOVQx_8h6tpADlCpI-lUWNy1jjnTPzY5g",
    vaultEndpoint: "http://127.0.0.1:8200",
    username: "admin-m3EtghwjAWzNJA",
    override: {
        pektinApiEndpoint: "http://127.0.0.1:3001"
    }
});

await pc.setupMainDomain();
