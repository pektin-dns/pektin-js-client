import { ClientCapabilities } from "../types.js";
import { deAbsolute } from "../utils/index.js";
import { VaultPolicy } from "./types.js";

export const pektinSignerPolicy: VaultPolicy = `
path "pektin-transit/sign/{{identity.entity.metadata.domain}}/sha2-256" {
    capabilities = ["update"]
}`;

export const pektinConfidantPolicy = (capabilities: ClientCapabilities): VaultPolicy => {
    let policy = ``;
    if (capabilities.allAccess) {
        policy += `
path "pektin-kv/data/*" {
    capabilities = ["read"]
}`;
    } else {
        if (capabilities.configAccess) {
            policy += `
path "pektin-kv/data/pektin-config" {
    capabilities = ["read"]
}`;
        }

        if (capabilities.recursorAccess) {
            policy += `
path "pektin-kv/data/recursor-auth" {
    capabilities = ["read"]
}`;
        }
        if (capabilities.proxyAccess) {
            policy += `
path "pektin-kv/data/proxy-auth" {
    capabilities = ["read"]
}`;
        }
    }
    if (capabilities.allowAllSigningDomains) {
        policy += `
path "pektin-signer-passwords-1/data/*" {
    capabilities = ["read"]
}`;
    } else if (capabilities.allowedSigningDomains) {
        capabilities.allowedSigningDomains.map((domain) => {
            policy += `
path "pektin-signer-passwords-1/data/${deAbsolute(domain)}" {
    capabilities = ["read"]
}`;
        });
    }

    return policy as VaultPolicy;
};
export const pektinApiPolicy: VaultPolicy = `
path "pektin-signer-passwords-2/data/*" {
    capabilities = ["read"]
}

path "pektin-policies/data/*" {
    capabilities = ["read"]
}`;
